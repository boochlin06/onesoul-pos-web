import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../plugins/prisma.js';
import { recordAuditLog } from './audit.service.js';

export const adminPreOrdersRoutes: FastifyPluginAsync = async (fastify) => {
  // 1. 查詢預購單清單 (支援分頁、狀態篩選、廠商篩選、關鍵字、日期排序與統計概覽)
  fastify.get('/preorders', async (request, reply) => {
    const {
      page = 1,
      pageSize = 50,
      status,
      supplier,
      q = '',
    } = request.query as any;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limit = Math.max(1, Math.min(200, parseInt(pageSize, 10) || 50));
    const skip = (pageNum - 1) * limit;

    const where: any = {};
    if (status && status !== 'ALL') {
      where.status = status;
    }
    if (supplier) {
      where.supplier = supplier;
    }
    if (q) {
      where.q = q;
    }

    const [allPreOrders, products, stores] = await Promise.all([
      (prisma as any).preOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.product.findMany({ select: { id: true, name: true, category: true, costPrice: true } }),
      prisma.store.findMany({ select: { id: true, name: true } }),
    ]);

    const prodMap = new Map(products.map((p) => [p.id, p]));
    const storeMap = new Map(stores.map((s) => [s.id, s.name]));

    // 計算統計摘要
    let pendingCount = 0;
    let completedCount = 0;
    let cancelledCount = 0;
    let totalDepositPending = 0;

    for (const po of allPreOrders) {
      if (po.status === 'PENDING') {
        pendingCount += 1;
        totalDepositPending += po.deposit || 0;
      } else if (po.status === 'COMPLETED') {
        completedCount += 1;
      } else if (po.status === 'CANCELLED') {
        cancelledCount += 1;
      }
    }

    // 分頁切片
    const total = allPreOrders.length;
    const paginated = allPreOrders.slice(skip, skip + limit).map((po: any) => ({
      ...po,
      product: po.productId ? prodMap.get(po.productId) || null : null,
      targetStoreName: po.targetStoreId ? storeMap.get(po.targetStoreId) || po.targetStoreId : '未指定',
    }));

    return {
      success: true,
      data: paginated,
      pagination: {
        page: pageNum,
        pageSize: limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      summary: {
        total,
        pendingCount,
        completedCount,
        cancelledCount,
        totalDepositPending,
      },
    };
  });

  // 2. 推薦下一號最大貨號 (排除 88888/99999 虛擬號與 100000+ 盲盒號，精準接續實體 GK 序號如 4108)
  fastify.get('/preorders/suggest-next-id', async () => {
    const products = await prisma.product.findMany({ select: { id: true } });
    let maxId = 0;
    for (const p of products) {
      const pidStr = String(p.id).trim();
      if (/^\d+$/.test(pidStr)) {
        const num = parseInt(pidStr, 10);
        // 排除虛擬號 88888/99999 與 100000+ 盲盒專用號，只鎖定實體 GK 區段
        if (num > maxId && num < 80000) {
          maxId = num;
        }
      }
    }
    const nextId = String(maxId > 0 ? maxId + 1 : 4108);
    return {
      success: true,
      suggestedId: nextId,
    };
  });

  // 3. 新增預購單 (向廠商提早預付訂金)
  fastify.post('/preorders', async (request, reply) => {
    const user = (request as any).user;
    const body = request.body as any;

    const {
      name,
      version,
      quantity = 1,
      deposit = 0,
      supplier = '玩譯',
      targetStoreId = 'chupei',
      note,
    } = body;

    if (!name || String(name).trim() === '') {
      return reply.code(400).send({ success: false, message: '預購商品名稱為必填項目' });
    }

    const qty = Math.max(1, parseInt(quantity, 10) || 1);
    const dep = Math.max(0, parseInt(deposit, 10) || 0);

    const created = await (prisma as any).preOrder.create({
      data: {
        name: String(name).trim(),
        version: version ? String(version).trim() : null,
        quantity: qty,
        deposit: dep,
        finalPayment: 0,
        shippingFee: 0,
        totalCost: dep,
        supplier: supplier ? String(supplier).trim() : '玩譯',
        targetStoreId: targetStoreId || 'chupei',
        productId: null,
        status: 'PENDING',
        arrivedAt: null,
        note: note ? String(note).trim() : null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    await recordAuditLog(prisma, {
      operatorId: user?.id || 'system',
      action: 'CREATE_PREORDER',
      targetType: 'PreOrder',
      targetId: created.id,
      afterState: created,
      reason: `建立廠商預購單: ${created.name} (訂金 $${dep}) 廠商: ${created.supplier}`,
      ipAddress: request.ip,
    });

    return reply.code(201).send({
      success: true,
      message: '預購單已成功建立',
      data: created,
    });
  });

  // 4. 補款並驗收入庫 (核心原子操作：計算總成本、轉入商品主檔 Product、入庫 StoreInventory)
  fastify.post('/preorders/:id/receive', async (request, reply) => {
    const user = (request as any).user;
    const { id } = request.params as { id: string };
    const body = request.body as any;

    const {
      finalPayment = 0,
      shippingFee = 0,
      productId,
      productName,
      allocationCost,
      sellingPrice = 0,
      suggestedPoints = 0,
      storeId = 'chupei',
    } = body;

    const preOrder = await (prisma as any).preOrder.findUnique({ where: { id } });
    if (!preOrder) {
      return reply.code(404).send({ success: false, message: '查無此預購單' });
    }
    if (preOrder.status !== 'PENDING') {
      return reply.code(400).send({
        success: false,
        message: `此預購單當前狀態為 [${preOrder.status}]，不可重複驗收入庫`,
      });
    }

    const assignedPid = String(productId || '').trim();
    if (!assignedPid) {
      return reply.code(400).send({ success: false, message: '請指定或確認入庫之商品貨號' });
    }

    const finalPay = Math.max(0, Math.round(parseFloat(finalPayment) || 0));
    const shipFee = Math.max(0, Math.round(parseFloat(shippingFee) || 0));
    const totalCost = (preOrder.deposit || 0) + finalPay + shipFee;
    const qtyToAdd = Math.max(1, preOrder.quantity || 1);
    const unitCost = Math.round(totalCost / qtyToAdd);
    const allocCost = Math.max(
      0,
      allocationCost !== undefined && allocationCost !== null && allocationCost !== ''
        ? Math.round(parseFloat(allocationCost))
        : unitCost
    );
    const sellPrice = Math.max(0, Math.round(parseFloat(sellingPrice) || 0));
    const sugPoints = Math.max(0, Math.round(parseFloat(suggestedPoints) || 0));
    const finalStoreId = storeId || preOrder.targetStoreId || 'chupei';
    const finalName = String(productName || preOrder.name).trim();

    try {
      const result = await prisma.$transaction(async (tx: any) => {
        // A. 檢查商品主檔碰撞 (防止未授權覆蓋現有 GK，允許明確關聯或原本已綁定的貨號)
        let product = await tx.product.findUnique({ where: { id: assignedPid } });
        const isSelfBound = preOrder.productId === assignedPid;
        const allowLink = Boolean(body?.confirmLink || body?.allowLinkExisting);

        if (product && !isSelfBound && !allowLink) {
          throw new Error(`貨號 [${assignedPid}] 已存在（品名: ${product.name}），請更換貨號以避免覆蓋現有商品主檔！`);
        }

        // B. 原子條件更新預購單狀態，防禦並發 TOCTOU 雙重入庫
        const updateResult = await tx.preOrder.updateMany({
          where: { id, status: 'PENDING' },
          data: {
            status: 'COMPLETED',
            finalPayment: finalPay,
            shippingFee: shipFee,
            totalCost,
            productId: assignedPid,
            targetStoreId: finalStoreId,
            arrivedAt: new Date(),
          },
        });
        if (updateResult.count === 0) {
          throw new Error('此預購單狀態已非待處理 (PENDING)，可能已被其他並發操作入庫或取消');
        }

        // C. 建立或更新商品主檔 (注意: 成本記錄單隻進貨成本 unitCost)
        if (!product) {
          product = await tx.product.create({
            data: {
              id: assignedPid,
              name: finalName,
              category: 'GK',
              costPrice: unitCost,
              allocationCost: allocCost,
              sellingPrice: sellPrice,
              suggestedPoints: sugPoints,
              isSpecial: false,
              remark: `預購單 [${preOrder.id}] 到貨轉入 (廠商: ${preOrder.supplier}, 入庫量: ${qtyToAdd}, 總成本: $${totalCost}, 單隻成本: $${unitCost})`,
            },
          });
        } else {
          // 若原本預購單就已綁定該商品，更新其成本與售價
          product = await tx.product.update({
            where: { id: assignedPid },
            data: {
              name: finalName,
              costPrice: unitCost,
              allocationCost: allocCost,
              sellingPrice: sellPrice > 0 ? sellPrice : product.sellingPrice,
              suggestedPoints: sugPoints > 0 ? sugPoints : product.suggestedPoints,
            },
          });
        }

        // D. 門市庫存入庫 (StoreInventory)
        const isOffsetHistorical = Boolean(body?.offsetHistoricalDraw);
        const physicalQtyToAdd = isOffsetHistorical ? 0 : qtyToAdd;

        let inv = await tx.storeInventory.findUnique({
          where: { storeId_productId: { storeId: finalStoreId, productId: assignedPid } },
        });

        if (!inv) {
          inv = await tx.storeInventory.create({
            data: {
              storeId: finalStoreId,
              productId: assignedPid,
              quantity: physicalQtyToAdd,
              safetyStock: 1,
              version: 0,
            },
          });
        } else if (physicalQtyToAdd > 0) {
          inv = await tx.storeInventory.update({
            where: { id: inv.id },
            data: {
              quantity: { increment: physicalQtyToAdd },
              version: { increment: 1 },
            },
          });
        }

        // E. 寫入庫存異動日誌 (InventoryLog)
        await tx.inventoryLog.create({
          data: {
            storeId: finalStoreId,
            productId: assignedPid,
            changeType: isOffsetHistorical ? 'OFFSET_FUTURES' : 'PURCHASE_IN',
            delta: physicalQtyToAdd,
            balance: inv.quantity,
            reason: isOffsetHistorical
              ? `預購單 [${preOrder.id}] 到貨平帳 (期貨抽獎已出貨履約沖抵，門市現貨不增)`
              : `預購單 [${preOrder.id}] 到貨驗收入庫: ${finalName} x${qtyToAdd} (總成本 $${totalCost}, 單隻成本 $${unitCost})`,
            operator: user?.email || 'system',
          },
        });

        const updatedPreOrder = await tx.preOrder.findUnique({ where: { id } });
        return { product, inventory: inv, preOrder: updatedPreOrder };
      });

      await recordAuditLog(prisma, {
        operatorId: user?.id || 'system',
        action: 'RECEIVE_PREORDER_STOCK',
        targetType: 'PreOrder',
        targetId: id,
        afterState: result.preOrder,
        reason: `預購單補款驗收入庫: [${assignedPid}] ${finalName} 入庫至 ${finalStoreId} (入庫 ${qtyToAdd} 件, 總成本 $${totalCost}, 單隻成本 $${unitCost})`,
        ipAddress: request.ip,
      });

      return {
        success: true,
        message: `🎉 預購商品 [${assignedPid} ${finalName}] 已成功補款並入庫至 ${finalStoreId} 店！(入庫 ${qtyToAdd} 件, 單隻成本 $${unitCost})`,
        data: result,
      };
    } catch (err: any) {
      return reply.code(400).send({
        success: false,
        message: err.message || '補款驗收入庫失敗',
      });
    }
  });

  // 5. 取消預購單 (工作室砍單 / 退訂退回訂金)
  fastify.post('/preorders/:id/cancel', async (request, reply) => {
    const user = (request as any).user;
    const { id } = request.params as { id: string };
    const { reason = '廠商/工作室通知砍單退訂' } = (request.body as any) || {};

    const preOrder = await (prisma as any).preOrder.findUnique({ where: { id } });
    if (!preOrder) {
      return reply.code(404).send({ success: false, message: '查無此預購單' });
    }
    // 原子防護，防止並發重複取消
    const updateResult = await (prisma as any).preOrder.updateMany({
      where: { id, status: 'PENDING' },
      data: {
        status: 'CANCELLED',
        note: preOrder.note ? `${preOrder.note} [取消原因: ${reason}]` : `[取消原因: ${reason}]`,
      },
    });

    if (updateResult.count === 0) {
      return reply.code(400).send({
        success: false,
        message: '此預購單狀態已非待處理 (PENDING)，無法執行取消退訂',
      });
    }

    const updated = await (prisma as any).preOrder.findUnique({ where: { id } });

    await recordAuditLog(prisma, {
      operatorId: user?.id || 'system',
      action: 'CANCEL_PREORDER',
      targetType: 'PreOrder',
      targetId: id,
      afterState: updated,
      reason: `預購單取消退訂: ${preOrder.name} (原因: ${reason})`,
      ipAddress: request.ip,
    });

    return {
      success: true,
      message: `預購單 [${preOrder.name}] 已成功標記取消退訂`,
      data: updated,
    };
  });
};
