import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../plugins/prisma';
import { recordAuditLog } from './audit.service.js';

export const adminInventoryRoutes: FastifyPluginAsync = async (fastify) => {
  // 1. 跨門市商品庫存水平對照總覽 - 動態多門市擴展、最新至舊排序、O(1) Hash Map 毫秒級極速分頁
  fastify.get('/inventory/summary', async (request, reply) => {
    const { 
      q = '', 
      category, 
      lowStockOnly = 'false', 
      page, 
      pageSize = '20',
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = request.query as any;

    const isLowStockFilter = lowStockOnly === 'true' || lowStockOnly === true;
    const searchKeyword = String(q || '').trim().toLowerCase();

    // 1. 並行獲取所有啟用門市、全量商品與門市庫存
    const [stores, products, inventories] = await Promise.all([
      prisma.store.findMany({
        where: { isActive: true },
        select: { id: true, name: true, code: true },
      }),
      prisma.product.findMany(),
      prisma.storeInventory.findMany(),
    ]);

    // 2. 建立動態多門市庫存 O(1) 雜湊索引映射表
    // 支援任意門市擴展 (chupei, jinshan, sanmin, etc.)
    const invMap = new Map<string, {
      storeStocks: Record<string, number>;
      safetyStocks: Record<string, number>;
      totalStock: number;
      maxSafetyStock: number;
    }>();

    for (let i = 0; i < inventories.length; i++) {
      const inv = inventories[i];
      let entry = invMap.get(inv.productId);
      if (!entry) {
        entry = {
          storeStocks: {},
          safetyStocks: {},
          totalStock: 0,
          maxSafetyStock: 0,
        };
        invMap.set(inv.productId, entry);
      }
      const qty = inv.quantity || 0;
      entry.storeStocks[inv.storeId] = (entry.storeStocks[inv.storeId] || 0) + qty;
      entry.totalStock += qty;

      if (inv.safetyStock) {
        entry.safetyStocks[inv.storeId] = inv.safetyStock;
        if (inv.safetyStock > entry.maxSafetyStock) {
          entry.maxSafetyStock = inv.safetyStock;
        }
      }
    }

    // 3. 快速聚合與條件過濾
    const allSummaries: any[] = [];
    let globalLowStockCount = 0;

    for (let i = 0; i < products.length; i++) {
      const prod = products[i];
      const inv = invMap.get(prod.id) || {
        storeStocks: {},
        safetyStocks: {},
        totalStock: 0,
        maxSafetyStock: 2,
      };

      const isLowStock = inv.totalStock <= inv.maxSafetyStock && inv.maxSafetyStock > 0;
      if (isLowStock) {
        globalLowStockCount++;
      }

      // 分類篩選
      if (category && category !== 'ALL' && prod.category !== category) {
        continue;
      }

      // 低庫存篩選
      if (isLowStockFilter && !isLowStock) {
        continue;
      }

      // 關鍵字搜尋 (品名、貨號、條碼)
      if (searchKeyword) {
        const matchName = prod.name.toLowerCase().includes(searchKeyword);
        const matchId = prod.id.toLowerCase().includes(searchKeyword);
        const matchBarcode = prod.barcode ? prod.barcode.toLowerCase().includes(searchKeyword) : false;
        if (!matchName && !matchId && !matchBarcode) {
          continue;
        }
      }

      allSummaries.push({
        id: prod.id,
        barcode: prod.barcode || '',
        name: prod.name,
        category: prod.category,
        costPrice: prod.costPrice,
        sellingPrice: prod.sellingPrice,
        suggestedPoints: prod.suggestedPoints,
        version: prod.version || 0,
        createdAt: prod.createdAt,
        updatedAt: prod.updatedAt,
        // 動態門市庫存映射
        storeStocks: inv.storeStocks,
        safetyStocks: inv.safetyStocks,
        // 向下相容竹北/金山欄位
        chupeiStock: inv.storeStocks['chupei'] || 0,
        jinshanStock: inv.storeStocks['jinshan'] || 0,
        totalStock: inv.totalStock,
        safetyStock: inv.maxSafetyStock,
        isLowStock,
      });
    }

    // 4. 動態排序 (預設: 最新建立在前 createdAt DESC)
    allSummaries.sort((a, b) => {
      let diff = 0;
      if (sortBy === 'createdAt') {
        const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        diff = tA - tB;
      } else if (sortBy === 'updatedAt') {
        const tA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const tB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        diff = tA - tB;
      } else if (sortBy === 'sellingPrice') {
        diff = (a.sellingPrice || 0) - (b.sellingPrice || 0);
      } else if (sortBy === 'totalStock') {
        diff = (a.totalStock || 0) - (b.totalStock || 0);
      } else if (sortBy === 'name') {
        diff = a.name.localeCompare(b.name, 'zh-TW');
      }

      // 降序反轉
      return sortOrder === 'desc' ? -diff : diff;
    });

    // 5. 分頁處理 (未傳 page 則向下相容回傳全部)
    const total = allSummaries.length;
    let paginatedData = allSummaries;
    let paginationMeta: any = null;

    if (page !== undefined && page !== null && page !== '') {
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limit = Math.max(1, Math.min(200, parseInt(pageSize, 10) || 20));
      const skip = (pageNum - 1) * limit;
      paginatedData = allSummaries.slice(skip, skip + limit);
      paginationMeta = {
        page: pageNum,
        pageSize: limit,
        total,
        totalPages: Math.ceil(total / limit),
      };
    }

    return reply.send({
      success: true,
      stores, // 回傳系統所有 active 門市，供前端動態渲染表頭
      data: paginatedData,
      pagination: paginationMeta,
      meta: {
        totalProducts: products.length,
        filteredCount: total,
        lowStockCount: globalLowStockCount,
      },
    });
  });

  // 2. 手動新增單品主檔與各門市期初庫存錄入
  fastify.post('/inventory/products', async (request, reply) => {
    const {
      id: customId,
      name,
      category = 'GENERAL',
      costPrice = 0,
      sellingPrice = 0,
      suggestedPoints,
      barcode,
      initialStocks = {},
      safetyStock = 2,
    } = request.body as any;

    if (!name || !name.trim()) {
      return reply.code(400).send({ success: false, message: '商品品名為必填欄位' });
    }

    const operatorId = (request as any).user?.email || 'admin@onesoul.com';
    const prodId = (customId && customId.trim())
      ? customId.trim()
      : `${category.toUpperCase().slice(0, 3)}-${Date.now().toString().slice(-6)}`;

    // 檢查貨號重複
    const existing = await prisma.product.findUnique({ where: { id: prodId } });
    if (existing) {
      return reply.code(409).send({ success: false, message: `貨號 [${prodId}] 已存在，請使用不同貨號` });
    }

    const numSellingPrice = Math.max(0, Number(sellingPrice) || 0);
    const numCostPrice = Math.max(0, Number(costPrice) || 0);
    const points = suggestedPoints !== undefined ? Number(suggestedPoints) : Math.round(numSellingPrice * 0.05);

    // 取得所有啟用門市
    const stores = await prisma.store.findMany({ where: { isActive: true } });

    const createdProduct = await prisma.$transaction(async (tx: any) => {
      const prod = await tx.product.create({
        data: {
          id: prodId,
          name: name.trim(),
          category: category.trim() || 'GENERAL',
          costPrice: numCostPrice,
          sellingPrice: numSellingPrice,
          suggestedPoints: points,
          barcode: barcode ? barcode.trim() : null,
          version: 1,
        },
      });

      for (const s of stores) {
        const qty = Math.max(0, Number(initialStocks[s.id]) || 0);
        await tx.storeInventory.create({
          data: {
            storeId: s.id,
            productId: prodId,
            quantity: qty,
            safetyStock: Math.max(0, Number(safetyStock) || 2),
            version: 1,
          },
        });

        if (qty > 0) {
          await tx.inventoryLog.create({
            data: {
              storeId: s.id,
              productId: prodId,
              type: 'INBOUND',
              delta: qty,
              balance: qty,
              reason: '後台手動新增單品期初入庫',
              operator: operatorId,
            },
          });
        }
      }

      return prod;
    });

    await recordAuditLog(prisma, {
      operatorId,
      action: 'CREATE_PRODUCT',
      targetType: 'Product',
      targetId: prodId,
      afterState: {
        product: createdProduct,
        initialStocks,
        safetyStock,
      },
      reason: `新增單品主檔 [${prodId}] ${name.trim()} (售價: $${numSellingPrice})`,
    });

    return reply.code(201).send({
      success: true,
      data: createdProduct,
      message: `商品 [${prodId}] ${name.trim()} 建立成功！`,
    });
  });

  // 3. 修改商品主檔 (支援樂觀鎖 version)
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
