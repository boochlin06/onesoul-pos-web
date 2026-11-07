import { prisma } from '../../../plugins/prisma.js';
import { recordAuditLog } from '../audit.service.js';
import {
  resolveCanonicalIP,
  IP_TO_RAW_CATEGORY_MAP,
  DEFAULT_INVENTORY_CATEGORIES,
  calculateSuggestedPoints,
  calculateStoreBalance,
  calculateTurnoverDays,
  calculateHotSellerAdvice,
  calculateSlowMovingAdvice,
  scoreProductForSuggest,
  isExcludedProduct,
} from './inventory.calculator.js';
import type {
  SuggestQuery,
  InventorySummaryQuery,
  DecisionAnalyticsQuery,
  CreateProductDto,
  UpdateProductDto,
  AdjustStockDto,
  BatchUpdateDto,
  BulkImportDto,
} from './inventory.types.js';

export class InventoryServiceError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'InventoryServiceError';
    this.statusCode = statusCode;
  }
}

async function executeInTransaction<T>(
  tx: any | undefined,
  fn: (client: any) => Promise<T>
): Promise<T> {
  if (tx) {
    return fn(tx);
  }
  return prisma.$transaction(fn);
}

export class InventoryService {
  /**
   * 極速輕量商品自動補全與即時庫存查詢
   */
  async suggest(query: SuggestQuery, tx?: any) {
    const db = tx || prisma;
    const { q = '', storeId = 'all', limit = 8 } = query;
    const searchKeyword = String(q || '').trim().toLowerCase().slice(0, 50);
    const maxLimit = Math.min(Math.max(parseInt(String(limit), 10) || 8, 1), 20);

    if (!searchKeyword) {
      return { success: true, data: [] };
    }

    const allProducts = await db.product.findMany();
    const scoredProducts: Array<{ prod: any; score: number }> = [];

    for (let i = 0; i < allProducts.length; i++) {
      const prod = allProducts[i] as any;
      const score = scoreProductForSuggest(prod, searchKeyword);
      if (score > 0) {
        scoredProducts.push({ prod, score });
      }
    }

    if (scoredProducts.length === 0) {
      return { success: true, data: [] };
    }

    // 依權重降序排序，相同權重者依更新時間新到舊排序
    scoredProducts.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const timeA = a.prod.updatedAt ? new Date(a.prod.updatedAt).getTime() : 0;
      const timeB = b.prod.updatedAt ? new Date(b.prod.updatedAt).getTime() : 0;
      return timeB - timeA;
    });

    const matchedProducts = scoredProducts.slice(0, maxLimit).map((item) => item.prod);
    const matchedIds = matchedProducts.map((p) => p.id);

    const targetStoreId = (storeId && storeId !== 'all' && storeId !== 'undefined') ? String(storeId) : undefined;
    const inventories = await db.storeInventory.findMany({
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
        suggestedPoints: prod.suggestedPoints || calculateSuggestedPoints(prod.sellingPrice),
        stock,
        storeStocks,
      };
    });

    return { success: true, data: results };
  }

  /**
   * 跨門市商品庫存水平對照總覽 (含多門市展開、低庫存過濾與分頁)
   */
  async getSummary(query: InventorySummaryQuery, tx?: any) {
    const db = tx || prisma;
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
    } = query;

    const isLowStockFilter = lowStockOnly === 'true' || lowStockOnly === true;
    const searchKeyword = String(q || '').trim().toLowerCase();

    const [stores, products, inventories, activeLuckyBags] = await Promise.all([
      db.store.findMany({
        where: { isActive: true },
        select: { id: true, name: true, code: true },
      }),
      db.product.findMany(),
      db.storeInventory.findMany(),
      db.luckyBag.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, storeId: true },
      }),
    ]);

    const bagStoreMap = new Map<string, string>();
    const activeBagIds: string[] = [];
    for (const b of activeLuckyBags) {
      bagStoreMap.set(b.id, b.storeId);
      activeBagIds.push(b.id);
    }

    const activePrizes = activeBagIds.length > 0
      ? await db.luckyBagPrize.findMany({
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

      const pMain = prod.mainCategory || (prod.category === 'BLIND_BOX' ? 'BLIND_BOX' : 'GK');
      const pSub = prod.subCategory || prod.category;

      if (mainCategory && mainCategory !== 'ALL' && pMain !== mainCategory) {
        continue;
      }

      const targetCat = subCategory || category;
      if (targetCat && targetCat !== 'ALL') {
        if (targetCat === 'GK') {
          if (pMain !== 'GK') continue;
        } else if (targetCat === 'BLIND_BOX') {
          if (pMain !== 'BLIND_BOX') continue;
        } else {
          const directMatch = prod.category === targetCat || pSub === targetCat;
          const mappedAliases = IP_TO_RAW_CATEGORY_MAP[targetCat];
          const aliasMatch = mappedAliases ? (mappedAliases.includes(prod.category) || mappedAliases.includes(pSub)) : false;
          const blindBoxMatch = targetCat === '潮玩盲盒' && pMain === 'BLIND_BOX';

          if (!directMatch && !aliasMatch && !blindBoxMatch) {
            continue;
          }
        }
      }

      if (isLowStockFilter && !isLowStock) {
        continue;
      }

      if (searchKeyword) {
        const matchName = prod.name.toLowerCase().includes(searchKeyword);
        const matchId = prod.id.toLowerCase().includes(searchKeyword);
        const matchBarcode = prod.barcode ? prod.barcode.toLowerCase().includes(searchKeyword) : false;
        if (!matchName && !matchId && !matchBarcode) {
          continue;
        }
      }

      if (isExcludedProduct({ ...prod, totalStock: inv.totalStock })) {
        continue;
      }

      const createdTime = prod.createdAt ? (typeof prod.createdAt === 'number' ? prod.createdAt : new Date(prod.createdAt).getTime()) : 0;
      const rawInboundDate = prod.inboundDate || prod.createdAt;
      const inboundTime = rawInboundDate ? (typeof rawInboundDate === 'number' ? rawInboundDate : new Date(rawInboundDate).getTime()) : createdTime;
      const numId = parseInt(prod.id, 10);

      const curStock = (!storeId || storeId === 'all') ? inv.totalStock : (inv.storeStocks[storeId] || 0);
      const curAllocating = (!storeId || storeId === 'all') ? inv.totalAllocatingStock : (inv.allocatingStocks[storeId] || 0);

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
        stock: curStock,
        allocatingStock: curAllocating,
        storeStocks: inv.storeStocks,
        allocatingStocks: inv.allocatingStocks,
        safetyStocks: inv.safetyStocks,
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

    allSummaries.sort((a, b) => {
      let diff = 0;
      if (sortBy === 'createdAt') {
        diff = a._time - b._time;
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

      return sortOrder === 'desc' ? -diff : diff;
    });

    const total = allSummaries.length;
    let paginatedData = allSummaries;
    let paginationMeta: any = null;

    if (page !== undefined && page !== null && page !== '') {
      const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
      const limit = Math.max(1, Math.min(200, parseInt(String(pageSize), 10) || 20));
      const skip = (pageNum - 1) * limit;
      paginatedData = allSummaries.slice(skip, skip + limit);
      paginationMeta = {
        page: pageNum,
        pageSize: limit,
        total,
        totalPages: Math.ceil(total / limit),
      };
    }

    return {
      success: true,
      stores,
      data: paginatedData,
      pagination: paginationMeta,
      meta: {
        totalProducts: products.length,
        filteredCount: total,
        lowStockCount: globalLowStockCount,
      },
    };
  }

  /**
   * 跨店 IP 存貨平衡與動銷決策看板分析
   */
  async getDecisionAnalytics(query: DecisionAnalyticsQuery, tx?: any) {
    const db = tx || prisma;
    const { days = '30', storeId = 'all' } = query;
    const daysNum = Math.max(1, Math.min(365, parseInt(String(days), 10) || 30));

    const [stores, allProducts, allInventories, orders] = await Promise.all([
      db.store.findMany({
        where: { isActive: true },
        select: { id: true, name: true, code: true },
      }),
      db.product.findMany(),
      db.storeInventory.findMany(),
      db.order.findMany(),
    ]);

    const storeMap = new Map<string, string>();
    for (const s of stores) {
      storeMap.set(s.id, s.name);
    }

    const validProducts = allProducts.filter(
      (p: any) => !['88888', '99999'].includes(p.id) && !p.isSpecial
    );
    const productMap = new Map<string, any>();
    for (const p of validProducts) {
      productMap.set(p.id, p);
    }

    const productStockMap = new Map<
      string,
      { total: number; chupei: number; jinshan: number; storeStocks: Record<string, number> }
    >();
    for (const inv of allInventories) {
      if (!productStockMap.has(inv.productId)) {
        productStockMap.set(inv.productId, { total: 0, chupei: 0, jinshan: 0, storeStocks: {} });
      }
      const entry = productStockMap.get(inv.productId)!;
      const qty = inv.quantity || 0;
      entry.storeStocks[inv.storeId] = (entry.storeStocks[inv.storeId] || 0) + qty;
      entry.total += qty;
      if (inv.storeId === 'chupei') entry.chupei += qty;
      if (inv.storeId === 'jinshan') entry.jinshan += qty;
    }

    const now = Date.now();
    const completedOrders = orders.filter((o: any) => o.status === 'COMPLETED' && o.createdAt);
    const orderDates = completedOrders.map((o: any) => new Date(o.createdAt).getTime());
    const maxOrderTime = orderDates.length > 0 ? Math.max(...orderDates) : now;
    const refTime = (now - maxOrderTime > 90 * 86400000) ? maxOrderTime : now;
    const cutoffTime = refTime - daysNum * 86400000;

    const recentOrderMap = new Map<string, any>();
    for (const o of completedOrders) {
      const t = new Date(o.createdAt).getTime();
      if (t >= cutoffTime) {
        recentOrderMap.set(o.id, o);
      }
    }

    let orderItems: any[] = [];
    if (db.orderItem?.findMany) {
      orderItems = await db.orderItem.findMany();
    } else {
      for (const o of completedOrders) {
        if (Array.isArray((o as any).items)) {
          orderItems.push(...(o as any).items);
        }
      }
    }

    const productSales30d = new Map<string, number>();
    const ipSales30d = new Map<string, number>();

    const weekBuckets = [
      { label: '4週前', start: cutoffTime, end: cutoffTime + 7 * 86400000, total: 0, ipMap: new Map<string, number>() },
      { label: '3週前', start: cutoffTime + 7 * 86400000, end: cutoffTime + 14 * 86400000, total: 0, ipMap: new Map<string, number>() },
      { label: '2週前', start: cutoffTime + 14 * 86400000, end: cutoffTime + 21 * 86400000, total: 0, ipMap: new Map<string, number>() },
      { label: '近7天', start: cutoffTime + 21 * 86400000, end: refTime + 86400000, total: 0, ipMap: new Map<string, number>() },
    ];

    for (const it of orderItems) {
      if (!it.productId || ['88888', '99999', 'SKU-SYS-Z-NON-GK'].includes(it.productId)) continue;
      const prod = productMap.get(it.productId);
      if (!prod) continue;

      const order = recentOrderMap.get(it.orderId);
      if (!order) continue;

      if (storeId !== 'all' && order.storeId !== storeId) continue;

      const orderTime = new Date(order.createdAt).getTime();
      const qty = it.quantity || it.draws || 1;

      productSales30d.set(it.productId, (productSales30d.get(it.productId) || 0) + qty);

      const ip = resolveCanonicalIP(prod);
      ipSales30d.set(ip, (ipSales30d.get(ip) || 0) + qty);

      for (const wb of weekBuckets) {
        if (orderTime >= wb.start && orderTime < wb.end) {
          wb.total += qty;
          wb.ipMap.set(ip, (wb.ipMap.get(ip) || 0) + qty);
          break;
        }
      }
    }

    const ipGroupMap = new Map<
      string,
      {
        ip: string;
        productCount: number;
        chupeiStock: number;
        jinshanStock: number;
        totalStock: number;
        storeStocks: Record<string, number>;
      }
    >();

    for (const prod of validProducts) {
      const ip = resolveCanonicalIP(prod);
      if (!ipGroupMap.has(ip)) {
        ipGroupMap.set(ip, {
          ip,
          productCount: 0,
          chupeiStock: 0,
          jinshanStock: 0,
          totalStock: 0,
          storeStocks: {},
        });
      }
      const g = ipGroupMap.get(ip)!;
      g.productCount += 1;
      const stock = productStockMap.get(prod.id);
      if (stock) {
        g.totalStock += stock.total;
        g.chupeiStock += stock.chupei;
        g.jinshanStock += stock.jinshan;
        for (const [sId, sQty] of Object.entries(stock.storeStocks)) {
          g.storeStocks[sId] = (g.storeStocks[sId] || 0) + sQty;
        }
      }
    }

    const chupeiName = storeMap.get('chupei') || '竹北店';
    const jinshanName = storeMap.get('jinshan') || '金山店';

    const ipSummary = Array.from(ipGroupMap.values()).map((g) => {
      const sales30d = ipSales30d.get(g.ip) || 0;
      const turnoverDays = calculateTurnoverDays(g.totalStock, sales30d);
      const stockShareChupei = g.totalStock > 0 ? Math.round((g.chupeiStock / g.totalStock) * 100) : 0;
      const stockShareJinshan = g.totalStock > 0 ? Math.round((g.jinshanStock / g.totalStock) * 100) : 0;

      const balanceResult = calculateStoreBalance({
        chupeiStock: g.chupeiStock,
        jinshanStock: g.jinshanStock,
        chupeiStoreName: chupeiName,
        jinshanStoreName: jinshanName,
      });

      return {
        ip: g.ip,
        productCount: g.productCount,
        totalStock: g.totalStock,
        chupeiStock: g.chupeiStock,
        jinshanStock: g.jinshanStock,
        storeStocks: g.storeStocks,
        stockShareChupei,
        stockShareJinshan,
        status: balanceResult.status,
        statusLabel: balanceResult.statusLabel,
        statusColor: balanceResult.statusColor,
        rebalanceSuggestion: balanceResult.rebalanceSuggestion,
        suggestTransfer: balanceResult.suggestTransfer,
        sales30d,
        turnoverDays,
      };
    });

    ipSummary.sort((a, b) => {
      if (b.totalStock !== a.totalStock) return b.totalStock - a.totalStock;
      return b.productCount - a.productCount;
    });

    // 爆款狂銷 Top 5
    const productSalesList: any[] = [];
    for (const prod of validProducts) {
      const salesCount30d = productSales30d.get(prod.id) || 0;
      const stock = productStockMap.get(prod.id) || { total: 0, chupei: 0, jinshan: 0 };
      if (salesCount30d > 0) {
        const advice = calculateHotSellerAdvice(salesCount30d, stock.total);
        productSalesList.push({
          id: prod.id,
          name: prod.name,
          category: prod.category,
          subCategory: prod.subCategory,
          ip: resolveCanonicalIP(prod),
          salesCount30d,
          currentStock: stock.total,
          chupeiStock: stock.chupei,
          jinshanStock: stock.jinshan,
          dailyVelocity: advice.dailyVelocity,
          estimatedStockoutDays: advice.estimatedStockoutDays,
          decisionAdvice: advice.decisionAdvice,
        });
      }
    }
    productSalesList.sort((a, b) => b.salesCount30d - a.salesCount30d);
    const topSelling = productSalesList.slice(0, 5);

    // 庫存積壓滯銷預警 Top 5
    const slowMovingList: any[] = [];
    for (const prod of validProducts) {
      const salesCount30d = productSales30d.get(prod.id) || 0;
      const stock = productStockMap.get(prod.id) || { total: 0, chupei: 0, jinshan: 0 };
      if (stock.total >= 1 && salesCount30d === 0) {
        const cost = prod.costPrice || 200;
        const slowAdvice = calculateSlowMovingAdvice(stock.total, cost);
        slowMovingList.push({
          id: prod.id,
          name: prod.name,
          category: prod.category,
          subCategory: prod.subCategory,
          ip: resolveCanonicalIP(prod),
          salesCount30d: 0,
          currentStock: stock.total,
          chupeiStock: stock.chupei,
          jinshanStock: stock.jinshan,
          costPrice: cost,
          sellingPrice: prod.sellingPrice || 0,
          tiedCapital: slowAdvice.tiedCapital,
          decisionAdvice: slowAdvice.decisionAdvice,
        });
      }
    }
    slowMovingList.sort((a, b) => {
      if (b.tiedCapital !== a.tiedCapital) return b.tiedCapital - a.tiedCapital;
      return b.currentStock - a.currentStock;
    });
    const slowMoving = slowMovingList.slice(0, 5);

    const totalSales30d = Array.from(productSales30d.values()).reduce((a, b) => a + b, 0);
    const ipSalesBreakdown = Array.from(ipSales30d.entries())
      .map(([ip, sales]) => ({
        ip,
        sales,
        percentage: totalSales30d > 0 ? Math.round((sales / totalSales30d) * 100) : 0,
      }))
      .sort((a, b) => b.sales - a.sales);

    const weeklyTrend = weekBuckets.map((wb) => ({
      weekLabel: wb.label,
      totalSales: wb.total,
      ipBreakdown: Object.fromEntries(wb.ipMap),
    }));

    const totals = {
      totalProducts: validProducts.length,
      totalStock: ipSummary.reduce((sum, g) => sum + g.totalStock, 0),
      chupeiTotalStock: ipSummary.reduce((sum, g) => sum + g.chupeiStock, 0),
      jinshanTotalStock: ipSummary.reduce((sum, g) => sum + g.jinshanStock, 0),
      totalSales30d,
      balancedIpCount: ipSummary.filter((g) => g.status === 'BALANCED').length,
      rebalanceNeededCount: ipSummary.filter((g) => g.status === 'CHUPEI_DEFICIT' || g.status === 'JINSHAN_DEFICIT').length,
      lowStockIpCount: ipSummary.filter((g) => g.status === 'LOW_STOCK' || g.status === 'OUT_OF_STOCK').length,
    };

    return {
      success: true,
      data: {
        stores,
        ipSummary,
        topSelling,
        slowMoving,
        salesTrend: {
          totalSales: totalSales30d,
          byIP: ipSalesBreakdown,
          weeklyTrend,
        },
        totals,
      },
    };
  }

  /**
   * 獲取商品全部分類清單
   */
  async getCategories(tx?: any) {
    const db = tx || prisma;
    const products = await db.product.findMany({
      select: { category: true, subCategory: true },
    });
    const categorySet = new Set<string>(DEFAULT_INVENTORY_CATEGORIES);
    for (const p of products) {
      if (p.category && p.category.trim() && p.category !== 'None') {
        categorySet.add(p.category.trim());
      }
      if (p.subCategory && p.subCategory.trim() && p.subCategory !== 'None') {
        categorySet.add(p.subCategory.trim());
      }
    }
    return {
      success: true,
      data: Array.from(categorySet),
    };
  }

  /**
   * 手動新增單品主檔與各門市期初庫存錄入
   */
  async createProduct(dto: CreateProductDto, operatorId = 'admin@onesoul.com', tx?: any) {
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
    } = dto;

    if (!name || !name.trim()) {
      throw new InventoryServiceError('商品品名為必填欄位', 400);
    }

    const prodId = (customId && customId.trim())
      ? customId.trim()
      : `${category.toUpperCase().slice(0, 3)}-${Date.now().toString().slice(-6)}`;

    const db = tx || prisma;
    const existing = await db.product.findUnique({ where: { id: prodId } });
    if (existing) {
      throw new InventoryServiceError(`貨號 [${prodId}] 已存在，請使用不同貨號`, 409);
    }

    const numSellingPrice = Math.max(0, Number(sellingPrice) || 0);
    const numCostPrice = Math.max(0, Number(costPrice) || 0);
    const points = suggestedPoints !== undefined ? Number(suggestedPoints) : calculateSuggestedPoints(numSellingPrice);

    const stores = await db.store.findMany({ where: { isActive: true } });

    const rawCat = (category || '').trim();
    const resolvedMainCategory = dto.mainCategory || (rawCat === 'BLIND_BOX' ? 'BLIND_BOX' : 'GK');
    const resolvedSubCategory = dto.subCategory || (rawCat === 'BLIND_BOX' ? '盲盒' : rawCat || '綜合');
    const resolvedCategory = rawCat || resolvedSubCategory;

    return executeInTransaction(tx, async (transactionClient) => {
      const prod = await transactionClient.product.create({
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
        await transactionClient.storeInventory.create({
          data: {
            storeId: s.id,
            productId: prodId,
            quantity: qty,
            safetyStock: Math.max(0, Number(safetyStock) || 2),
            version: 1,
          },
        });

        if (qty > 0) {
          await transactionClient.inventoryLog.create({
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

      await recordAuditLog(transactionClient, {
        operatorId,
        action: 'CREATE_PRODUCT',
        targetType: 'Product',
        targetId: prodId,
        afterState: {
          product: prod,
          initialStocks,
          safetyStock,
        },
        reason: `新增單品主檔 [${prodId}] ${name.trim()} (售價: $${numSellingPrice})`,
      });

      return {
        success: true,
        data: prod,
        message: `商品 [${prodId}] ${name.trim()} 建立成功！`,
      };
    });
  }

  /**
   * 修改商品主檔 (支援樂觀鎖版本檢查)
   */
  async updateProduct(id: string, dto: UpdateProductDto, operatorId = 'admin@onesoul.com', ipAddress?: string, tx?: any) {
    const { name, category, mainCategory, subCategory, costPrice, sellingPrice, suggestedPoints, barcode, version } = dto;
    const db = tx || prisma;

    const existing = await db.product.findUnique({ where: { id } });
    if (!existing) {
      throw new InventoryServiceError('找不到此商品', 404);
    }

    if (version !== undefined && existing.version !== version) {
      throw new InventoryServiceError('資料已被其他管理員更新，請重新整理後再試 (樂觀鎖版本衝突)', 409);
    }

    return executeInTransaction(tx, async (transactionClient) => {
      const updateData: any = {
        name: name !== undefined ? name : existing.name,
        costPrice: costPrice !== undefined ? Number(costPrice) : existing.costPrice,
        sellingPrice: sellingPrice !== undefined ? Number(sellingPrice) : existing.sellingPrice,
        suggestedPoints: suggestedPoints !== undefined ? Number(suggestedPoints) : existing.suggestedPoints,
        barcode: barcode !== undefined ? barcode : existing.barcode,
        version: { increment: 1 },
      };

      if (category !== undefined) {
        updateData.category = category;
        updateData.subCategory = category === 'BLIND_BOX' ? '盲盒' : category;
        updateData.mainCategory = category === 'BLIND_BOX' ? 'BLIND_BOX' : (mainCategory ?? existing.mainCategory ?? 'GK');
      }
      if (mainCategory !== undefined) updateData.mainCategory = mainCategory;
      if (subCategory !== undefined) updateData.subCategory = subCategory;

      const res = await transactionClient.product.update({
        where: { id },
        data: updateData,
      });

      await recordAuditLog(transactionClient, {
        operatorId,
        action: 'PRICE_OR_MASTER_UPDATE',
        targetType: 'Product',
        targetId: id,
        beforeState: {
          category: existing.category,
          costPrice: existing.costPrice,
          sellingPrice: existing.sellingPrice,
          name: existing.name,
        },
        afterState: {
          category: res.category,
          costPrice: res.costPrice,
          sellingPrice: res.sellingPrice,
          name: res.name,
        },
        reason: '管理員修改商品主檔',
        ipAddress,
      });

      return {
        success: true,
        message: '商品主檔更新成功',
        data: res,
      };
    });
  }

  /**
   * 單品手動庫存調帳 (附理由與審計日誌)
   */
  async adjustStock(dto: AdjustStockDto, operatorId = 'admin@onesoul.com', ipAddress?: string, tx?: any) {
    const { storeId, productId, delta, newQuantity, reason } = dto;

    if (!storeId || !productId) {
      throw new InventoryServiceError('缺少門市代碼或商品編號', 400);
    }

    const effectiveReason = (reason && reason.trim().length >= 2)
      ? reason.trim()
      : '試算表原地單元格快速調帳';

    const db = tx || prisma;
    const currentInv = await db.storeInventory.findUnique({
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
      throw new InventoryServiceError('調帳後庫存不可為負數', 400);
    }

    return executeInTransaction(tx, async (transactionClient) => {
      const freshInv = await transactionClient.storeInventory.findUnique({
        where: { storeId_productId: { storeId, productId } },
      });
      if (!freshInv) {
        throw new InventoryServiceError('找不到該門市庫存紀錄', 404);
      }
      if (currentInv && freshInv.version !== currentInv.version) {
        throw new InventoryServiceError('庫存版本衝突，資料已被其他操作更新，請重新整理', 409);
      }
      if (freshInv.quantity + calcDelta < 0) {
        throw new InventoryServiceError('扣減後庫存不可為負數', 400);
      }

      const updated = await transactionClient.storeInventory.update({
        where: {
          storeId_productId: { storeId, productId },
        },
        data: {
          quantity: { increment: calcDelta },
          version: { increment: 1 },
        },
      });

      await transactionClient.inventoryLog.create({
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

      await recordAuditLog(transactionClient, {
        operatorId,
        action: 'STOCK_DELTA_ADJUST',
        targetType: 'StoreInventory',
        targetId: `${storeId}:${productId}`,
        beforeState: { quantity: beforeQty },
        afterState: { quantity: finalQty },
        delta: calcDelta,
        reason: effectiveReason,
        ipAddress,
      });

      return {
        success: true,
        message: '庫存調帳成功',
        data: {
          storeId,
          productId,
          beforeQty,
          finalQty,
          delta: calcDelta,
        },
      };
    });
  }

  /**
   * 試算表級批次原地更新 (商品主檔 + 門市庫存調帳一次性原子提交)
   */
  async batchUpdate(dto: BatchUpdateDto, operatorId = 'admin@onesoul.com', ipAddress?: string, tx?: any) {
    const { productUpdates = [], stockAdjustments = [] } = dto;

    if (!Array.isArray(productUpdates) && !Array.isArray(stockAdjustments)) {
      throw new InventoryServiceError('無效的批次更新格式', 400);
    }

    if (productUpdates.length === 0 && stockAdjustments.length === 0) {
      throw new InventoryServiceError('沒有任何待更新的變更項目', 400);
    }

    const updatedProductIds: string[] = [];
    const updatedStockEntries: Array<{ storeId: string; productId: string; newQty: number }> = [];

    // 🛡️ Invariant 3: 依固定字典序排序更新項目，杜絕並發死鎖 (Deadlock 40P01)
    const sortedProductUpdates = [...productUpdates].sort((a, b) =>
      (a.id || '').localeCompare(b.id || '')
    );
    const sortedStockAdjustments = [...stockAdjustments].sort((a, b) => {
      const pDiff = (a.productId || '').localeCompare(b.productId || '');
      if (pDiff !== 0) return pDiff;
      return (a.storeId || '').localeCompare(b.storeId || '');
    });

    return executeInTransaction(tx, async (transactionClient) => {
      // 1. 商品主檔更新 (按商品 ID 字典序更新)
      for (const prodUp of sortedProductUpdates) {
        if (!prodUp.id) continue;
        const existing = await transactionClient.product.findUnique({ where: { id: prodUp.id } });
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

        const updated = await transactionClient.product.update({
          where: { id: prodUp.id },
          data: updateData,
        });

        await recordAuditLog(transactionClient, {
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
          ipAddress,
        });
        updatedProductIds.push(prodUp.id);
      }

      // 2. 門市庫存調帳 (按 storeId:productId 字典序更新 + 原子增減防 Lost Update)
      for (const stockAdj of sortedStockAdjustments) {
        const { storeId, productId, newQuantity, delta, reason } = stockAdj;
        if (!storeId || !productId) continue;

        const currentInv = await transactionClient.storeInventory.findUnique({
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
          continue;
        }

        const effectiveReason = reason && reason.trim().length >= 2 
          ? reason.trim() 
          : '試算表原地批次更新庫存';

        if (!currentInv) {
          await transactionClient.storeInventory.create({
            data: {
              storeId,
              productId,
              quantity: finalQty,
              safetyStock: 2,
              version: 1,
            },
          });
        } else {
          // 🛡️ 若指定 delta 則使用原子 increment 防 Lost Update，指定 newQuantity 則設為 finalQty
          const updateData = delta !== undefined
            ? { quantity: { increment: calcDelta }, version: { increment: 1 } }
            : { quantity: finalQty, version: { increment: 1 } };

          await transactionClient.storeInventory.update({
            where: { storeId_productId: { storeId, productId } },
            data: updateData,
          });
        }

        await transactionClient.inventoryLog.create({
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

        await recordAuditLog(transactionClient, {
          operatorId,
          action: 'BATCH_STOCK_ADJUST',
          targetType: 'StoreInventory',
          targetId: `${storeId}:${productId}`,
          beforeState: { quantity: beforeQty },
          afterState: { quantity: finalQty },
          delta: calcDelta,
          reason: effectiveReason,
          ipAddress,
        });

        updatedStockEntries.push({ storeId, productId, newQty: finalQty });
      }

      return {
        success: true,
        message: `成功更新 ${updatedProductIds.length} 筆商品主檔，${updatedStockEntries.length} 筆庫存紀錄`,
        data: {
          updatedProductCount: updatedProductIds.length,
          updatedStockCount: updatedStockEntries.length,
          productIds: updatedProductIds,
          stockEntries: updatedStockEntries,
        },
      };
    });
  }

  /**
   * 批次匯入商品 (Excel / CSV Bulk Import)
   */
  async bulkImport(dto: BulkImportDto, operatorId = 'admin@onesoul.com', ipAddress?: string, tx?: any) {
    const { items, defaultStoreId = 'chupei' } = dto;

    if (!Array.isArray(items) || items.length === 0) {
      throw new InventoryServiceError('請提供待匯入之商品陣列', 400);
    }

    const db = tx || prisma;
    const activeStores = await db.store.findMany({ where: { isActive: true } });

    // 🛡️ Pre-validation 防禦 PostgreSQL 25P02 (事務區塊中止) 陷阱：
    // 在進入資料庫交易前預先檢查已存在之 ID 與批次內重複 ID，杜絕 Unique 碰撞中斷整個事務
    const candidateIds = items
      .map((it) => (it.id ? String(it.id).trim() : ''))
      .filter(Boolean);
    const existingProducts = await db.product.findMany({
      where: { id: { in: candidateIds } },
      select: { id: true },
    });
    const existingIdSet = new Set(existingProducts.map((p: { id: string }) => p.id));
    const seenInBatch = new Set<string>();

    let successCount = 0;
    const errors: any[] = [];

    return executeInTransaction(tx, async (transactionClient) => {
      for (let i = 0; i < items.length; i++) {
        const row = items[i];
        if (!row.id || !row.name) {
          errors.push({ row: i + 1, message: '缺少商品 ID 或品名' });
          continue;
        }

        const trimmedId = String(row.id).trim();
        if (existingIdSet.has(trimmedId)) {
          errors.push({ row: i + 1, id: row.id, message: `商品貨號 ${trimmedId} 已存在，跳過建立` });
          continue;
        }
        if (seenInBatch.has(trimmedId)) {
          errors.push({ row: i + 1, id: row.id, message: `批次清單內包含重複之商品貨號 ${trimmedId}` });
          continue;
        }
        seenInBatch.add(trimmedId);

        try {
          const autoCat = (row.category && String(row.category).trim()) 
            ? String(row.category).trim() 
            : resolveCanonicalIP({ name: row.name });
          const sellingPriceNum = Number(row.sellingPrice) || 0;
          const costPriceNum = Number(row.costPrice) || 0;
          const autoPoints = row.suggestedPoints !== undefined 
            ? Number(row.suggestedPoints) 
            : calculateSuggestedPoints(sellingPriceNum);

          await transactionClient.product.createMany({
            data: [
              {
                id: trimmedId,
                name: String(row.name).trim(),
                category: autoCat,
                costPrice: costPriceNum,
                sellingPrice: sellingPriceNum,
                suggestedPoints: autoPoints,
                barcode: row.barcode ? String(row.barcode).trim() : null,
              },
            ],
          });

          const initQty = Number(row.quantity) || 0;
          const storesToInit = activeStores.length > 0 ? activeStores : [{ id: defaultStoreId }];
          for (const s of storesToInit) {
            const qty = s.id === defaultStoreId ? initQty : 0;
            await transactionClient.storeInventory.createMany({
              data: [
                {
                  storeId: s.id,
                  productId: String(row.id).trim(),
                  quantity: qty,
                  safetyStock: Number(row.safetyStock) || 2,
                },
              ],
            });
          }

          successCount++;
        } catch (e: any) {
          errors.push({ row: i + 1, id: row.id, message: e.message });
        }
      }

      await recordAuditLog(transactionClient, {
        operatorId,
        action: 'BULK_IMPORT_PRODUCTS',
        targetType: 'Product',
        targetId: `batch-${Date.now()}`,
        afterState: { totalSubmitted: items.length, successCount },
        reason: `批次匯入商品 ${successCount} 筆`,
        ipAddress,
      });

      return {
        success: true,
        message: `批次匯入完成：成功 ${successCount} 筆，失敗 ${errors.length} 筆`,
        data: {
          successCount,
          errors,
        },
      };
    });
  }
}

export const inventoryService = new InventoryService();
