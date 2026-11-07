import type {
  LiveStockItem,
  LiveStockQuery,
  AllocationPrizeItemInput,
  AllocationPlanInput,
  NormalizedPrizeItem,
  PlanFinancialSummary,
  PlanValidationResult,
} from './allocation.types.js';

/**
 * 1. 建立門市實體庫存索引 Map<productId, Record<storeId, number>>
 * 零 DB 依賴純函數
 */
export function calculateProductStoreStocks(
  inventories: Array<{ productId: string; storeId: string; quantity: number }>
): Map<string, Record<string, number>> {
  const invMap = new Map<string, Record<string, number>>();
  for (let i = 0; i < inventories.length; i++) {
    const inv = inventories[i];
    let sMap = invMap.get(inv.productId);
    if (!sMap) {
      sMap = {};
      invMap.set(inv.productId, sMap);
    }
    sMap[inv.storeId] = (sMap[inv.storeId] || 0) + (inv.quantity || 0);
  }
  return invMap;
}

/**
 * 2. 統計在場活躍套組中各商品已配賞數量 Map<productId, Record<storeId, number>>
 * 零 DB 依賴純函數
 */
export function calculateActiveAllocations(
  activeBags: Array<{ id: string; storeId: string }>,
  activePrizes: Array<{ bagId: string; productId: string | null; draws: number }>
): Map<string, Record<string, number>> {
  const bagStoreMap = new Map<string, string>();
  for (let i = 0; i < activeBags.length; i++) {
    const b = activeBags[i];
    bagStoreMap.set(b.id, b.storeId);
  }

  const allocatedMap = new Map<string, Record<string, number>>();
  for (let i = 0; i < activePrizes.length; i++) {
    const p = activePrizes[i];
    if (!p.productId) continue;
    const sId = bagStoreMap.get(p.bagId);
    if (!sId) continue;
    let sAlloc = allocatedMap.get(p.productId);
    if (!sAlloc) {
      sAlloc = {};
      allocatedMap.set(p.productId, sAlloc);
    }
    const qty = p.draws || 0;
    sAlloc[sId] = (sAlloc[sId] || 0) + qty;
  }
  return allocatedMap;
}

/**
 * 3. 商品主分類與次分類解析
 */
export function resolveCategoryClassification(
  prod: { category?: string | null; mainCategory?: string | null; subCategory?: string | null }
): { mainCategory: string; subCategory: string; category: string } {
  const mainCategory = prod.mainCategory || (prod.category === 'BLIND_BOX' ? 'BLIND_BOX' : 'GK');
  const subCategory = prod.subCategory || prod.category || 'GENERAL';
  const category = prod.category || 'GENERAL';
  return { mainCategory, subCategory, category };
}

/**
 * 4. 計算單一商品現貨看板視圖模型
 * 遵守 Invariant #2: availableStock = max(0, stock - allocatedCount)
 */
export function calculateLiveStockItem(
  prod: {
    id: string;
    name: string;
    category?: string | null;
    mainCategory?: string | null;
    subCategory?: string | null;
    costPrice?: number | null;
    sellingPrice?: number | null;
    suggestedPoints?: number | null;
  },
  stockMap: Record<string, number>,
  allocMap: Record<string, number>,
  targetStoreId?: string
): LiveStockItem {
  const { mainCategory, subCategory, category } = resolveCategoryClassification(prod);
  const totalStock = Object.values(stockMap).reduce((a, b) => a + b, 0);
  const totalAllocated = Object.values(allocMap).reduce((a, b) => a + b, 0);

  const targetStock = targetStoreId && targetStoreId !== 'ALL' ? (stockMap[targetStoreId] || 0) : totalStock;
  const targetAllocated = targetStoreId && targetStoreId !== 'ALL' ? (allocMap[targetStoreId] || 0) : totalAllocated;

  const isOverAllocated = targetAllocated > targetStock;
  const availableStock = Math.max(0, targetStock - targetAllocated);

  const sellingPrice = prod.sellingPrice || 0;
  const suggestedPoints = prod.suggestedPoints || Math.round(sellingPrice * 0.05);

  return {
    id: prod.id,
    name: prod.name,
    mainCategory,
    subCategory,
    category,
    costPrice: prod.costPrice || 0,
    sellingPrice,
    suggestedPoints,
    storeStocks: stockMap,
    totalStock,
    storeAllocated: allocMap,
    totalAllocated,
    stock: targetStock,
    allocatedCount: targetAllocated,
    isOverAllocated,
    availableStock,
  };
}

/**
 * 5. 門市現貨看板資料篩選器 (支援 minQty、主分類、次分類、關鍵字)
 */
export function filterLiveStockItems(
  items: LiveStockItem[],
  query: LiveStockQuery
): LiveStockItem[] {
  const { category, mainCategory, q = '', minQty = '1' } = query;
  const search = String(q || '').trim().toLowerCase();
  const minStock = minQty !== undefined && minQty !== null && minQty !== '' ? parseInt(String(minQty), 10) : 1;
  const effectiveMinStock = isNaN(minStock) ? 1 : minStock;

  return items.filter((item) => {
    // 依 minQty 門檻篩選
    if (item.stock < effectiveMinStock) {
      return false;
    }

    // 主分類過濾
    if (mainCategory && mainCategory !== 'ALL' && item.mainCategory !== mainCategory) {
      return false;
    }

    // 分類過濾 (支援 GK, BLIND_BOX 與自訂子分類)
    if (category && category !== 'ALL') {
      if (category === 'GK' && item.mainCategory !== 'GK') return false;
      else if (category === 'BLIND_BOX' && item.mainCategory !== 'BLIND_BOX') return false;
      else if (category !== 'GK' && category !== 'BLIND_BOX' && item.category !== category && item.subCategory !== category) return false;
    }

    // 關鍵字搜尋 (品名與貨號)
    if (search) {
      const matchName = item.name.toLowerCase().includes(search);
      const matchId = item.id.toLowerCase().includes(search);
      if (!matchName && !matchId) return false;
    }

    return true;
  });
}

/**
 * 6. 開套方案規則防呆驗證 (抽數平帳、大獎必備、價格抽數合法性)
 */
export function validatePlanForPublish(
  plan: AllocationPlanInput,
  planIndex = 0
): PlanValidationResult {
  const { name, totalDraws, price1, items = [], batchCount = 1 } = plan;

  if (!name || !name.trim()) {
    return {
      isValid: false,
      errorMessage: `第 ${planIndex + 1} 個方案請輸入套組名稱`,
    };
  }

  const numDraws = parseInt(String(totalDraws), 10);
  const unitPrice = parseInt(String(price1), 10);
  const count = Math.max(1, Math.min(20, parseInt(String(batchCount), 10) || 1));

  if (!numDraws || numDraws <= 0 || !unitPrice || unitPrice <= 0) {
    return {
      isValid: false,
      errorMessage: `[${name}] 請設定有效的總抽數與單抽價格`,
    };
  }

  // 抽數平帳驗證：各獎項抽數總和必須等於 totalDraws
  const sumDraws = items.reduce((acc, item) => acc + (parseInt(String(item.draws), 10) || 0), 0);
  if (sumDraws !== numDraws) {
    return {
      isValid: false,
      errorMessage: `[${name}] 抽數未平帳：目前已配置 ${sumDraws} 抽，與總抽數 ${numDraws} 抽不符 (差距 ${numDraws - sumDraws} 抽)`,
    };
  }

  // 大獎驗證：至少需有 1 款實體公仔大獎 (非 0p / 非 nonGK)
  const hasPhysicalPrize = items.some((it) => !it.isNonGk && it.productId && it.productId !== '0p');
  if (!hasPhysicalPrize) {
    return {
      isValid: false,
      errorMessage: `[${name}] 套組中必須至少配置 1 款實體公仔大獎`,
    };
  }

  return {
    isValid: true,
    validated: {
      numDraws,
      unitPrice,
      batchCount: count,
    },
  };
}

/**
 * 7. 解析獎項應發放點數 (X賞等價盲盒點數、Z賞保底1點)
 */
export function resolvePrizePoints(
  grade: string,
  explicitPoints: number | string | undefined | null,
  planBlindBoxPoints: number | string | undefined | null,
  globalBlindBoxPoints = 10,
  isNonGk?: boolean
): number {
  const upperGrade = String(grade || '1').trim().toUpperCase();
  const rawPoints = explicitPoints !== undefined && explicitPoints !== null && explicitPoints !== ''
    ? parseInt(String(explicitPoints), 10)
    : NaN;

  const rawPlanBb = planBlindBoxPoints !== undefined && planBlindBoxPoints !== null && planBlindBoxPoints !== ''
    ? parseInt(String(planBlindBoxPoints), 10)
    : NaN;

  const fallbackX = !isNaN(rawPlanBb) && rawPlanBb > 0 ? rawPlanBb : globalBlindBoxPoints;

  if (isNaN(rawPoints)) {
    if (upperGrade === 'X') return fallbackX;
    if (upperGrade === 'Z' || isNonGk) return 1;
    return 0;
  }

  if (upperGrade === 'X' && rawPoints === 0) return fallbackX;
  if ((upperGrade === 'Z' || isNonGk) && rawPoints === 0) return 1;
  return rawPoints;
}

/**
 * 8. 解析商品 ID 是否為抽象小賞 (0p, 1p, X, Z 不鎖定實體庫存外鍵)
 */
export function resolvePrizeProductId(
  productId: string | undefined | null,
  grade: string,
  isNonGk?: boolean
): string | null {
  const upperGrade = String(grade || '1').trim().toUpperCase();
  const pidStr = String(productId || '').trim();
  const isAbstract = ['0p', '1p', 'x', 'X', 'BLIND_BOX'].includes(pidStr) || !!isNonGk || upperGrade === 'X' || upperGrade === 'Z';
  return !isAbstract && pidStr ? pidStr : null;
}

/**
 * 9. 正規化全套獎項明細
 */
export function normalizePlanItems(
  items: AllocationPrizeItemInput[],
  plan: AllocationPlanInput,
  globalBlindBoxPoints = 10
): NormalizedPrizeItem[] {
  return items.map((item) => {
    const grade = String(item.prizeGrade || '1').trim().toUpperCase();
    const itemDraws = parseInt(String(item.draws), 10) || 1;
    const points = resolvePrizePoints(grade, item.points, plan.blindBoxPointsValue, globalBlindBoxPoints, item.isNonGk);
    const pid = resolvePrizeProductId(item.productId, grade, item.isNonGk);
    const costPrice = typeof item.costPrice === 'number' ? item.costPrice : (parseInt(String(item.costPrice), 10) || 0);

    return {
      prizeGrade: grade,
      prizeName: item.prizeName,
      productId: pid,
      points,
      draws: itemDraws,
      isNonGk: !!item.isNonGk,
      costPrice,
    };
  });
}

/**
 * 10. Invariant #3: 字典序排序商品 ID 防死鎖
 */
export function sortProductIdsForLock(productIds: Array<string | null | undefined>): string[] {
  const validIds = productIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
  return Array.from(new Set(validIds)).sort((a, b) => a.localeCompare(b));
}

/**
 * 11. 批次開套套組名稱產生器
 */
export function formatBatchBagName(baseName: string, batchIndex: number, totalBatches: number): string {
  return totalBatches > 1 ? `${baseName.trim()} #${batchIndex + 1}` : baseName.trim();
}

/**
 * 12. 套組唯一識別碼生成器 (LB-xxxxx)
 */
export function generateBagId(timestamp?: number, randomSuffix?: number): string {
  const ts = (timestamp !== undefined ? timestamp : Date.now()).toString();
  const rnd = randomSuffix !== undefined ? randomSuffix : Math.floor(Math.random() * 90 + 10);
  return `LB-${ts.slice(-5)}${rnd}`;
}

/**
 * 13. 配賞方案財務與毛利損平試算引擎
 */
export function calculatePlanFinancials(
  totalDraws: number,
  unitPrice: number,
  items: Array<{ costPrice?: number | string; draws: number | string }>
): PlanFinancialSummary {
  const revenue = totalDraws * unitPrice;
  const totalCost = items.reduce((sum, item) => {
    const cp = typeof item.costPrice === 'number' ? item.costPrice : (parseInt(String(item.costPrice), 10) || 0);
    const dr = typeof item.draws === 'number' ? item.draws : (parseInt(String(item.draws), 10) || 0);
    return sum + cp * dr;
  }, 0);

  const grossProfit = revenue - totalCost;
  const marginRate = revenue > 0 ? Math.round((grossProfit / revenue) * 10000) / 100 : 0;
  const breakevenDraws = unitPrice > 0 ? Math.ceil(totalCost / unitPrice) : 0;
  const isHealthy = marginRate >= 35 && breakevenDraws <= totalDraws;

  return {
    totalRevenue: revenue,
    totalCost,
    grossProfit,
    marginRate,
    breakevenDraws,
    isHealthy,
  };
}
