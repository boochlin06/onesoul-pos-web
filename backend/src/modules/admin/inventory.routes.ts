import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../plugins/prisma';
import { recordAuditLog } from './audit.service.js';

export const adminInventoryRoutes: FastifyPluginAsync = async (fastify) => {
  // 1. 跨店商品庫存水平對照總覽 (竹北 vs 金山)
  fastify.get('/inventory/summary', async (request, reply) => {
    const products = await prisma.product.findMany();
    const inventories = await prisma.storeInventory.findMany();

    const summary = products.map((prod: any) => {
      const chupeiInv = inventories.find((i: any) => i.productId === prod.id && i.storeId === 'chupei');
      const jinshanInv = inventories.find((i: any) => i.productId === prod.id && i.storeId === 'jinshan');

      const chupeiQty = chupeiInv?.quantity ?? 0;
      const jinshanQty = jinshanInv?.quantity ?? 0;
      const safetyStock = chupeiInv?.safetyStock || jinshanInv?.safetyStock || 0;

      return {
        id: prod.id,
        barcode: prod.barcode || '',
        name: prod.name,
        category: prod.category,
        costPrice: prod.costPrice,
        sellingPrice: prod.sellingPrice,
        suggestedPoints: prod.suggestedPoints,
        version: prod.version || 0,
        chupeiStock: chupeiQty,
        jinshanStock: jinshanQty,
        totalStock: chupeiQty + jinshanQty,
        safetyStock,
        isLowStock: (chupeiQty + jinshanQty) <= safetyStock && safetyStock > 0,
      };
    });

    return reply.send({
      success: true,
      data: summary,
      meta: {
        totalProducts: summary.length,
        lowStockCount: summary.filter((i) => i.isLowStock).length,
      },
    });
  });

  // 2. 修改商品主檔 (支援樂觀鎖 version)
  fastify.put('/inventory/products/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { name, costPrice, sellingPrice, suggestedPoints, barcode, version } = request.body as any;
    const operatorId = (request as any).user?.email || 'admin@onesoul.com';

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      return reply.code(404).send({ success: false, message: '找不到此商品' });
    }

    if (version !== undefined && existing.version !== version) {
      return reply.code(409).send({
        success: false,
        message: '資料已被其他管理員更新，請重新整理後再試 (樂觀鎖版本衝突)',
      });
    }

    const updated = await prisma.$transaction(async (tx: any) => {
      const res = await tx.product.update({
        where: { id },
        data: {
          name: name ?? existing.name,
          costPrice: costPrice !== undefined ? Number(costPrice) : existing.costPrice,
          sellingPrice: sellingPrice !== undefined ? Number(sellingPrice) : existing.sellingPrice,
          suggestedPoints: suggestedPoints !== undefined ? Number(suggestedPoints) : existing.suggestedPoints,
          barcode: barcode ?? existing.barcode,
          version: { increment: 1 },
        },
      });

      await recordAuditLog(tx, {
        operatorId,
        action: 'PRICE_OR_MASTER_UPDATE',
        targetType: 'Product',
        targetId: id,
        beforeState: {
          costPrice: existing.costPrice,
          sellingPrice: existing.sellingPrice,
          name: existing.name,
        },
        afterState: {
          costPrice: res.costPrice,
          sellingPrice: res.sellingPrice,
          name: res.name,
        },
        reason: '管理員修改商品主檔',
        ipAddress: request.ip,
      });

      return res;
    });

    return reply.send({
      success: true,
      message: '商品主檔更新成功',
      data: updated,
    });
  });

  // 3. 單品手動庫存調帳 (附理由與審計日誌)
  fastify.post('/inventory/adjust-stock', async (request, reply) => {
    const { storeId, productId, delta, newQuantity, reason } = request.body as any;
    const operatorId = (request as any).user?.email || 'admin@onesoul.com';

    if (!storeId || !productId) {
      return reply.code(400).send({ success: false, message: '缺少門市代碼或商品編號' });
    }

    if (!reason || reason.trim().length < 4) {
      return reply.code(400).send({ success: false, message: '調帳理由不可空白且至少需 4 個字元' });
    }

    const currentInv = await prisma.storeInventory.findUnique({
      where: {
        storeId_productId: { storeId, productId },
      },
    });

    const beforeQty = currentInv?.quantity ?? 0;
    let finalQty = beforeQty;
    let calcDelta = 0;

    if (delta !== undefined) {
      calcDelta = Number(delta);
      finalQty = beforeQty + calcDelta;
    } else if (newQuantity !== undefined) {
      finalQty = Number(newQuantity);
      calcDelta = finalQty - beforeQty;
    }

    if (finalQty < 0) {
      return reply.code(400).send({ success: false, message: '調帳後庫存不可為負數' });
    }

    await prisma.$transaction(async (tx: any) => {
      // 🛡️ 交易內讀取新鮮庫存並進行樂觀鎖與安全餘額驗證
      const freshInv = await tx.storeInventory.findUnique({
        where: { storeId_productId: { storeId, productId } },
      });
      if (!freshInv) {
        throw new Error('找不到該門市庫存紀錄');
      }
      if (currentInv && freshInv.version !== currentInv.version) {
        throw new Error('庫存版本衝突，資料已被其他操作更新，請重新整理');
      }
      if (freshInv.quantity + calcDelta < 0) {
        throw new Error('扣減後庫存不可為負數');
      }

      const updated = await tx.storeInventory.update({
        where: {
          storeId_productId: { storeId, productId },
        },
        data: {
          quantity: { increment: calcDelta },
          version: { increment: 1 },
        },
      });

      await tx.inventoryLog.create({
        data: {
          storeId,
          productId,
          changeType: 'MANUAL_ADJUST',
          delta: calcDelta,
          balance: updated.quantity,
          reason,
          operator: operatorId,
        },
      });

      await recordAuditLog(tx, {
        operatorId,
        action: 'STOCK_DELTA_ADJUST',
        targetType: 'StoreInventory',
        targetId: `${storeId}:${productId}`,
        beforeState: { quantity: beforeQty },
        afterState: { quantity: finalQty },
        delta: calcDelta,
        reason,
        ipAddress: request.ip,
      });
    });

    return reply.send({
      success: true,
      message: '庫存調帳成功',
      data: {
        storeId,
        productId,
        beforeQty,
        finalQty,
        delta: calcDelta,
      },
    });
  });

  // 4. Excel / CSV 批次上架精靈 (Bulk Import)
  fastify.post('/inventory/products/bulk-import', async (request, reply) => {
    const { items, defaultStoreId = 'chupei' } = request.body as any;
    const operatorId = (request as any).user?.email || 'admin@onesoul.com';

    if (!Array.isArray(items) || items.length === 0) {
      return reply.code(400).send({ success: false, message: '請提供待匯入之商品陣列' });
    }

    let successCount = 0;
    const errors: any[] = [];

    await prisma.$transaction(async (tx: any) => {
      for (let i = 0; i < items.length; i++) {
        const row = items[i];
        if (!row.id || !row.name) {
          errors.push({ row: i + 1, message: '缺少商品 ID 或品名' });
          continue;
        }

        try {
          await tx.product.createMany({
            data: [
              {
                id: String(row.id).trim(),
                name: String(row.name).trim(),
                category: row.category || 'GENERAL',
                costPrice: Number(row.costPrice) || 0,
                sellingPrice: Number(row.sellingPrice) || 0,
                suggestedPoints: Number(row.suggestedPoints) || 0,
                barcode: row.barcode ? String(row.barcode).trim() : null,
              },
            ],
          });

          // 建立預設門市庫存
          const initQty = Number(row.quantity) || 0;
          await tx.storeInventory.createMany({
            data: [
              {
                storeId: defaultStoreId,
                productId: String(row.id).trim(),
                quantity: initQty,
                safetyStock: Number(row.safetyStock) || 0,
              },
            ],
          });

          successCount++;
        } catch (e: any) {
          errors.push({ row: i + 1, id: row.id, message: e.message });
        }
      }

      await recordAuditLog(tx, {
        operatorId,
        action: 'BULK_IMPORT_PRODUCTS',
        targetType: 'Product',
        targetId: `batch-${Date.now()}`,
        afterState: { totalSubmitted: items.length, successCount },
        reason: `批次匯入商品 ${successCount} 筆`,
        ipAddress: request.ip,
      });
    });

    return reply.send({
      success: true,
      message: `批次匯入完成：成功 ${successCount} 筆，失敗 ${errors.length} 筆`,
      data: {
        successCount,
        errors,
      },
    });
  });
};
