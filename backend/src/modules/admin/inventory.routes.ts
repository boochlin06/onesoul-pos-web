import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../plugins/prisma';
import { recordAuditLog } from './audit.service.js';

export const adminInventoryRoutes: FastifyPluginAsync = async (fastify) => {
  // 0. 極速輕量商品自動補全 (Autocomplete / Suggest) - 專為配賞工作台與掃碼設計，權重感知排序、精準庫存過濾
  fastify.get('/inventory/suggest', async (request, reply) => {
    const { q = '', storeId = 'all', limit = '8' } = request.query as any;
    const searchKeyword = String(q || '').trim().toLowerCase().slice(0, 50);
    const maxLimit = Math.min(Math.max(parseInt(limit as string, 10) || 8, 1), 20);

    if (!searchKeyword) {
      return reply.send({ success: true, data: [] });
    }

    const allProducts = await prisma.product.findMany();
    const scoredProducts: Array<{ prod: any; score: number }> = [];

    for (let i = 0; i < allProducts.length; i++) {
      const prod = allProducts[i] as any;
      const prodId = (prod.id || '').trim();
      const prodName = (prod.name || '').trim();
      const barcode = (prod.barcode || '').trim();

      // 防護過濾：排除無效/測試假貨號
      if (['GK001', 'GEN001', 'BB001', '88888', '99999', '0p', '3935'].includes(prodId)) continue;
      if (!prodName || prodName === 'None' || prodName.startsWith('商品-')) continue;

      const idLower = prodId.toLowerCase();
      const nameLower = prodName.toLowerCase();
      const barcodeLower = barcode.toLowerCase();

      let score = 0;
      // 權重體系：精準匹配 (1000) > 開頭匹配 (500) > 品名開頭 (300) > 模糊包含 (100)
      if (idLower === searchKeyword || barcodeLower === searchKeyword) {
        score = 1000;
      } else if (idLower.startsWith(searchKeyword) || barcodeLower.startsWith(searchKeyword)) {
        score = 500;
      } else if (nameLower.startsWith(searchKeyword)) {
        score = 300;
      } else if (nameLower.includes(searchKeyword)) {
        score = 100;
      }

      if (score > 0) {
        scoredProducts.push({ prod, score });
      }
    }

    if (scoredProducts.length === 0) {
      return reply.send({ success: true, data: [] });
    }

    // 依權重降序排序，相同權重者依更新時間新到舊排序（徹底解決 Ranking Starvation，最新大賞優先露出）
    scoredProducts.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const timeA = a.prod.updatedAt ? new Date(a.prod.updatedAt).getTime() : 0;
      const timeB = b.prod.updatedAt ? new Date(b.prod.updatedAt).getTime() : 0;
      return timeB - timeA;
    });

    const matchedProducts = scoredProducts.slice(0, maxLimit).map((item) => item.prod);
    const matchedIds = matchedProducts.map((p) => p.id);

    // 嚴格精準查詢庫存：只查詢符合的 8 筆商品，嚴禁全表掃描
    const targetStoreId = (storeId && storeId !== 'all' && storeId !== 'undefined') ? String(storeId) : undefined;
    const inventories = await prisma.storeInventory.findMany({
      where: {
        productId: { in: matchedIds },
        ...(targetStoreId ? { storeId: targetStoreId } : {}),
      },
    });

    const stockMap = new Map<string, Record<string, number>>();
    for (let i = 0; i < inventories.length; i++) {
      const inv = inventories[i] as any;
      let entry = stockMap.get(inv.productId);
      if (!entry) {
        entry = {};
        stockMap.set(inv.productId, entry);
      }
      entry[inv.storeId] = (entry[inv.storeId] || 0) + (inv.quantity || 0);
    }

    const results = matchedProducts.map((prod) => {
      const storeStocks = stockMap.get(prod.id) || {};
      const stock = !targetStoreId
        ? Object.values(storeStocks).reduce((a, b) => a + b, 0)
        : (storeStocks[targetStoreId] || 0);

      return {
        id: prod.id,
        name: prod.name,
        barcode: prod.barcode || '',
        category: prod.category || 'GENERAL',
        costPrice: prod.costPrice || 0,
        sellingPrice: prod.sellingPrice || 0,
        suggestedPoints: prod.suggestedPoints || Math.round((prod.sellingPrice || 0) * 0.05),
        stock,
        storeStocks,
      };
    });

    return reply.send({ success: true, data: results });
  });

  // 1. 跨門市商品庫存水平對照總覽 - 動態多門市擴展、最新至舊排序、O(1) Hash Map 毫秒級極速分頁
  fastify.get('/inventory/summary', async (request, reply) => {
    const { 
      q = '', 
      category, 
      mainCategory,
      subCategory,
      storeId = 'all',
      lowStockOnly = 'false', 
      page, 
      pageSize = '20',
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = request.query as any;

    const isLowStockFilter = lowStockOnly === 'true' || lowStockOnly === true;
    const searchKeyword = String(q || '').trim().toLowerCase();

    // 1. 並行獲取所有啟用門市、全量商品、門市庫存與活躍一番賞套組
    const [stores, products, inventories, activeLuckyBags] = await Promise.all([
      prisma.store.findMany({
        where: { isActive: true },
        select: { id: true, name: true, code: true },
      }),
      prisma.product.findMany(),
      prisma.storeInventory.findMany(),
      prisma.luckyBag.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, storeId: true },
      }),
    ]);

    // 建立在場套組門市索引
    const bagStoreMap = new Map<string, string>();
    const activeBagIds: string[] = [];
    for (const b of activeLuckyBags) {
      bagStoreMap.set(b.id, b.storeId);
      activeBagIds.push(b.id);
    }

    // 統計各商品在場一番賞套組佔用 (配置中)
    const activePrizes = activeBagIds.length > 0
      ? await prisma.luckyBagPrize.findMany({
          where: {
            bagId: { in: activeBagIds },
            productId: { not: null },
          },
          select: {
            bagId: true,
            productId: true,
            draws: true,
          },
        })
      : [];

    const liveAllocMap = new Map<string, Record<string, number>>();
    for (const p of activePrizes) {
      if (!p.productId) continue;
      const sId = bagStoreMap.get(p.bagId);
      if (!sId) continue;
      let sAlloc = liveAllocMap.get(p.productId);
      if (!sAlloc) {
        sAlloc = {};
        liveAllocMap.set(p.productId, sAlloc);
      }
      sAlloc[sId] = (sAlloc[sId] || 0) + (p.draws || 0);
    }

    // 2. 建立動態多門市庫存與配置中 O(1) 雜湊索引映射表
    const invMap = new Map<string, {
      storeStocks: Record<string, number>;
      allocatingStocks: Record<string, number>;
      safetyStocks: Record<string, number>;
      totalStock: number;
      totalAllocatingStock: number;
      maxSafetyStock: number;
    }>();

    for (let i = 0; i < inventories.length; i++) {
      const inv = inventories[i] as any;
      let entry = invMap.get(inv.productId);
      if (!entry) {
        entry = {
          storeStocks: {},
          allocatingStocks: {},
          safetyStocks: {},
          totalStock: 0,
          totalAllocatingStock: 0,
          maxSafetyStock: 0,
        };
        invMap.set(inv.productId, entry);
      }
      const qty = inv.quantity || 0;
      entry.storeStocks[inv.storeId] = (entry.storeStocks[inv.storeId] || 0) + qty;
      entry.totalStock += qty;

      // 合併試算表初期配置中數量與即時活躍套組配置中數量
      const liveAlloc = liveAllocMap.get(inv.productId)?.[inv.storeId] || 0;
      const initAlloc = inv.allocatingQuantity || 0;
      const allocQty = Math.max(initAlloc, liveAlloc);
      entry.allocatingStocks[inv.storeId] = allocQty;
      entry.totalAllocatingStock += allocQty;

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
      const prod = products[i] as any;
      const inv = invMap.get(prod.id) || {
        storeStocks: {},
        allocatingStocks: {},
        safetyStocks: {},
        totalStock: 0,
        totalAllocatingStock: 0,
        maxSafetyStock: 2,
      };

      const isLowStock = inv.totalStock <= inv.maxSafetyStock && inv.maxSafetyStock > 0;
      if (isLowStock) {
        globalLowStockCount++;
      }

      // 分類二級聯動篩選
      const pMain = (prod as any).mainCategory || (prod.category === 'BLIND_BOX' ? 'BLIND_BOX' : 'GK');
      const pSub = (prod as any).subCategory || prod.category;

      // 1. 大項過濾 (GK vs BLIND_BOX)
      if (mainCategory && mainCategory !== 'ALL' && pMain !== mainCategory) {
        continue;
      }

      // 2. 次項 / IP 過濾 (相容既有 category / subCategory 參數)
      const targetCat = subCategory || category;
      if (targetCat && targetCat !== 'ALL') {
        if (targetCat === 'GK') {
          if (pMain !== 'GK') continue;
        } else if (targetCat === 'BLIND_BOX') {
          if (pMain !== 'BLIND_BOX') continue;
        } else {
          // 精確匹配 IP
          if (prod.category !== targetCat && pSub !== targetCat) {
            continue;
          }
        }
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

      // 🛡️ 防護過濾：排除無效空白佔位幽靈商品、不存在的 Mock 測試商品 (GK001, GEN001, BB001) 與特殊加扣點 (88888, 99999, 0p, 3935, None, 商品-XXXX)
      const prodName = (prod.name || '').trim();
      const prodId = (prod.id || '').trim();
      const isDummyName = !prodName || prodName === 'None' || prodName.startsWith('商品-') || prodName.startsWith('[待補品名') || prodName === prodId;
      const isFakeCode = ['GK001', 'GEN001', 'BB001'].includes(prodId) || ['4710001', '4710002', '4710003'].includes(prod.barcode || '');
      const isSpecialCode = isFakeCode || prodId === '88888' || prodId === '99999' || prodId === '0p' || prodId === '3935' || prodName === '隨便加' || prodName === '隨便扣';
      const isZeroStockAndPrice = (prod.costPrice || 0) === 0 && (prod.sellingPrice || 0) === 0 && inv.totalStock === 0;
      if (isSpecialCode || (isDummyName && isZeroStockAndPrice) || (isDummyName && (prod.costPrice || 0) === 0 && (prod.sellingPrice || 0) === 0)) {
        continue;
      }

      const createdTime = prod.createdAt ? (typeof prod.createdAt === 'number' ? prod.createdAt : new Date(prod.createdAt).getTime()) : 0;
      const rawInboundDate = prod.inboundDate || prod.createdAt;
      const inboundTime = rawInboundDate ? (typeof rawInboundDate === 'number' ? rawInboundDate : new Date(rawInboundDate).getTime()) : createdTime;
      const numId = parseInt(prod.id, 10);

      // 當前門市視角庫存量與配置中數量 (若 storeId === 'all' 則為全店合計)
      const curStock = (!storeId || storeId === 'all') ? inv.totalStock : (inv.storeStocks[storeId] || 0);
      const curAllocating = (!storeId || storeId === 'all') ? inv.totalAllocatingStock : (inv.allocatingStocks[storeId] || 0);

      // 格式化純日期 YYYY/MM/DD
      let formattedDate: string | null = null;
      if (inboundTime > 0) {
        const d = new Date(inboundTime);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        formattedDate = `${y}/${m}/${day}`;
      }

      allSummaries.push({
        id: prod.id,
        barcode: prod.barcode || '',
        name: prod.name,
        mainCategory: pMain,
        subCategory: pSub,
        category: prod.category || '綜合',
        costPrice: prod.costPrice,
        sellingPrice: prod.sellingPrice,
        suggestedPoints: prod.suggestedPoints,
        version: prod.version || 0,
        createdAt: prod.createdAt,
        updatedAt: prod.updatedAt,
        inboundDate: formattedDate,
        // 當前視角數量 (供前端單一欄位顯示)
        stock: curStock,
        allocatingStock: curAllocating,
        // 動態門市庫存映射
        storeStocks: inv.storeStocks,
        allocatingStocks: inv.allocatingStocks,
        safetyStocks: inv.safetyStocks,
        // 向下相容既有欄位
        chupeiStock: inv.storeStocks['chupei'] || 0,
        jinshanStock: inv.storeStocks['jinshan'] || 0,
        totalStock: inv.totalStock,
        totalAllocatingStock: inv.totalAllocatingStock,
        safetyStock: inv.maxSafetyStock,
        isLowStock,
        _time: createdTime,
        _inboundTime: inboundTime,
        _curStock: curStock,
        _curAlloc: curAllocating,
        _numId: isNaN(numId) ? null : numId,
      });
    }

    // 4. 動態排序 (預設: 最新建立在前 createdAt DESC)
    allSummaries.sort((a, b) => {
      let diff = 0;
      if (sortBy === 'createdAt') {
        diff = a._time - b._time;
        // 次級排序: 若時間戳相同，依貨號遞增/遞減排序 (大編號新商品在前)
        if (diff === 0) {
          if (a._numId !== null && b._numId !== null) {
            diff = a._numId - b._numId;
          } else {
            diff = a.id.localeCompare(b.id);
          }
        }
      } else if (sortBy === 'updatedAt') {
        const tA = a.updatedAt ? (typeof a.updatedAt === 'number' ? a.updatedAt : new Date(a.updatedAt).getTime()) : 0;
        const tB = b.updatedAt ? (typeof b.updatedAt === 'number' ? b.updatedAt : new Date(b.updatedAt).getTime()) : 0;
        diff = tA - tB;
      } else if (sortBy === 'sellingPrice') {
        diff = (a.sellingPrice || 0) - (b.sellingPrice || 0);
      } else if (sortBy === 'totalStock' || sortBy === 'stock') {
        diff = (a._curStock || 0) - (b._curStock || 0);
      } else if (sortBy === 'allocatingStock') {
        diff = (a._curAlloc || 0) - (b._curAlloc || 0);
      } else if (sortBy === 'inboundDate' || sortBy === 'inboundAgeDays') {
        diff = (a._inboundTime || 0) - (b._inboundTime || 0);
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

    const rawCat = (category || '').trim();
    const resolvedMainCategory = (request.body as any)?.mainCategory || (rawCat === 'BLIND_BOX' ? 'BLIND_BOX' : 'GK');
    const resolvedSubCategory = (request.body as any)?.subCategory || (rawCat === 'BLIND_BOX' ? '盲盒' : rawCat || '綜合');
    const resolvedCategory = rawCat || resolvedSubCategory;

    const createdProduct = await prisma.$transaction(async (tx: any) => {
      const prod = await tx.product.create({
        data: {
          id: prodId,
          name: name.trim(),
          mainCategory: resolvedMainCategory,
          subCategory: resolvedSubCategory,
          category: resolvedCategory,
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
              changeType: 'MANUAL_ADJUST',
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

    const effectiveReason = (reason && reason.trim().length >= 2)
      ? reason.trim()
      : '試算表原地單元格快速調帳';

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
          reason: effectiveReason,
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
        reason: effectiveReason,
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

  // 3.5 試算表級批次原地更新 (商品主檔 + 門市庫存調帳一次性原子提交)
  fastify.post('/inventory/batch-update', async (request, reply) => {
    const { productUpdates = [], stockAdjustments = [] } = request.body as any;
    const operatorId = (request as any).user?.email || 'admin@onesoul.com';

    if (!Array.isArray(productUpdates) && !Array.isArray(stockAdjustments)) {
      return reply.code(400).send({ success: false, message: '無效的批次更新格式' });
    }

    if (productUpdates.length === 0 && stockAdjustments.length === 0) {
      return reply.code(400).send({ success: false, message: '沒有任何待更新的變更項目' });
    }

    const updatedProductIds: string[] = [];
    const updatedStockEntries: Array<{ storeId: string; productId: string; newQty: number }> = [];

    await prisma.$transaction(async (tx: any) => {
      // 1. 商品主檔更新
      for (const prodUp of productUpdates) {
        if (!prodUp.id) continue;
        const existing = await tx.product.findUnique({ where: { id: prodUp.id } });
        if (!existing) continue;

        const updateData: any = {
          version: { increment: 1 },
        };
        if (prodUp.name !== undefined) updateData.name = prodUp.name;
        if (prodUp.category !== undefined) {
          updateData.category = prodUp.category;
          updateData.subCategory = prodUp.category === 'BLIND_BOX' ? '盲盒' : prodUp.category;
          updateData.mainCategory = prodUp.category === 'BLIND_BOX' ? 'BLIND_BOX' : 'GK';
        }
        if (prodUp.mainCategory !== undefined) updateData.mainCategory = prodUp.mainCategory;
        if (prodUp.subCategory !== undefined) {
          updateData.subCategory = prodUp.subCategory;
          if (prodUp.category === undefined) updateData.category = prodUp.subCategory;
        }
        if (prodUp.sellingPrice !== undefined) updateData.sellingPrice = Number(prodUp.sellingPrice);
        if (prodUp.costPrice !== undefined) updateData.costPrice = Number(prodUp.costPrice);
        if (prodUp.suggestedPoints !== undefined) updateData.suggestedPoints = Number(prodUp.suggestedPoints);
        if (prodUp.barcode !== undefined) updateData.barcode = prodUp.barcode ? String(prodUp.barcode).trim() : null;

        const updated = await tx.product.update({
          where: { id: prodUp.id },
          data: updateData,
        });

        await recordAuditLog(tx, {
          operatorId,
          action: 'BATCH_PRODUCT_UPDATE',
          targetType: 'Product',
          targetId: prodUp.id,
          beforeState: {
            costPrice: existing.costPrice,
            sellingPrice: existing.sellingPrice,
            suggestedPoints: existing.suggestedPoints,
          },
          afterState: {
            costPrice: updated.costPrice,
            sellingPrice: updated.sellingPrice,
            suggestedPoints: updated.suggestedPoints,
          },
          reason: '試算表批次原地修改主檔',
          ipAddress: request.ip,
        });
        updatedProductIds.push(prodUp.id);
      }

      // 2. 門市庫存調帳
      for (const stockAdj of stockAdjustments) {
        const { storeId, productId, newQuantity, delta, reason } = stockAdj;
        if (!storeId || !productId) continue;

        const currentInv = await tx.storeInventory.findUnique({
          where: { storeId_productId: { storeId, productId } },
        });

        const beforeQty = currentInv?.quantity ?? 0;
        let finalQty = beforeQty;
        let calcDelta = 0;

        if (newQuantity !== undefined) {
          finalQty = Math.max(0, Number(newQuantity));
          calcDelta = finalQty - beforeQty;
        } else if (delta !== undefined) {
          calcDelta = Number(delta);
          finalQty = Math.max(0, beforeQty + calcDelta);
        }

        if (calcDelta === 0 && currentInv) {
          continue; // 無變更跳過
        }

        const effectiveReason = reason && reason.trim().length >= 2 
          ? reason.trim() 
          : '試算表原地批次更新庫存';

        let updatedInv;
        if (!currentInv) {
          updatedInv = await tx.storeInventory.create({
            data: {
              storeId,
              productId,
              quantity: finalQty,
              safetyStock: 2,
              version: 1,
            },
          });
        } else {
          updatedInv = await tx.storeInventory.update({
            where: { storeId_productId: { storeId, productId } },
            data: {
              quantity: finalQty,
              version: { increment: 1 },
            },
          });
        }

        await tx.inventoryLog.create({
          data: {
            storeId,
            productId,
            changeType: 'MANUAL_ADJUST',
            delta: calcDelta,
            balance: finalQty,
            reason: effectiveReason,
            operator: operatorId,
          },
        });

        await recordAuditLog(tx, {
          operatorId,
          action: 'BATCH_STOCK_ADJUST',
          targetType: 'StoreInventory',
          targetId: `${storeId}:${productId}`,
          beforeState: { quantity: beforeQty },
          afterState: { quantity: finalQty },
          delta: calcDelta,
          reason: effectiveReason,
          ipAddress: request.ip,
        });

        updatedStockEntries.push({ storeId, productId, newQty: finalQty });
      }
    });

    return reply.send({
      success: true,
      message: `成功更新 ${updatedProductIds.length} 筆商品主檔，${updatedStockEntries.length} 筆庫存紀錄`,
      data: {
        updatedProductCount: updatedProductIds.length,
        updatedStockCount: updatedStockEntries.length,
        productIds: updatedProductIds,
        stockEntries: updatedStockEntries,
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
