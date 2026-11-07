import { AllocationPrizeItem, SetPlan, FinancialSummary } from '../types';

/** 乾淨剝離商品名稱中的賞級前綴 (不用加入1號賞、A賞等前綴，只保留純商品名稱) */
export function cleanPrizeName(rawName: string): string {
  const name = (rawName || '').trim();
  if (!name) return '';
  return name
    .replace(/^([0-9０-９]+號賞|[0-9０-９]+賞|[A-Za-z]+賞|SP賞|特賞|最後賞|LAST賞|W賞|Z賞|X賞)\s*/i, '')
    .trim() || name;
}

/** 向下相容 formatPrizeNameWithGrade：現在一律輸出純商品名稱，不疊加賞級前綴 */
export function formatPrizeNameWithGrade(_grade: string, prodName: string): string {
  return cleanPrizeName(prodName);
}

/** 尋找套組內排在第 1 個的實體大獎 (1號賞或A賞) 的商品名稱 */
export function getTopPrizeName(items: AllocationPrizeItem[]): string | null {
  const topPrize = items.find(
    (it) => !it.isNonGk && it.productId && it.productId !== '0p' && it.productId !== '1p' && it.prizeName
  );
  if (!topPrize) return null;
  // 去除賞位編號前綴如 "1號賞 "、"A賞 "、"特賞 "、"LAST賞 " 等，直接提取商品本名
  const clean = topPrize.prizeName.replace(/^([0-9]+號賞|[A-Z]賞|特賞|最後賞|LAST賞|SP賞|\b[0-9]+\b|\b[A-Z]\b)\s*/i, '').trim();
  return clean || topPrize.prizeName.trim();
}

/** 階梯折扣與整十元四捨五入計算 */
export function calculateTierPricing(
  basePrice: number,
  tenPlusOne: boolean
): {
  price1: number;
  price3: number;
  price5: number;
  price10: number;
} {
  const p1 = Math.max(0, Number(basePrice) || 0);
  const p3 = Math.round((3 * p1 * 0.97) / 10) * 10;
  const p5 = Math.round((5 * p1 * 0.95) / 10) * 10;
  const p10 = tenPlusOne ? 10 * p1 : Math.round((10 * p1 * 0.90) / 10) * 10;

  return { price1: p1, price3: p3, price5: p5, price10: p10 };
}

/** 財務指標與平帳計算純函數 */
export function calculateFinancialSummary(plan: SetPlan): FinancialSummary {
  const { totalDraws, price1, price3, price5, price10, items } = plan;
  // 1. 已配總抽數
  const allocatedDraws = items.reduce((sum, it) => sum + (Number(it.draws) || 0), 0);
  // 2. 總成本
  const totalCost = items.reduce((sum, it) => sum + ((Number(it.draws) || 0) * (Number(it.costPrice) || 0)), 0);
  // 3. 點數總負債 (pt)
  const totalPoints = items.reduce((sum, it) => sum + ((Number(it.draws) || 0) * (Number(it.points) || 0)), 0);
  const maxPointLiability = totalPoints * 20; // 1pt = $20

  // 4. 加權單抽價 (期望值)
  const p1 = price1 || 0;
  const p3 = price3 || 0;
  const p5 = price5 || 0;
  const p10 = price10 || 0;
  const effectivePerDraw = (0.35 * p1) + (0.20 * (p3 / 3)) + (0.25 * (p5 / 5)) + (0.20 * (p10 / 10));

  // 5. 總營收 (單套)
  const expectedRevenue = totalDraws * effectivePerDraw;
  // 6. 現金毛利率
  const cashMargin = expectedRevenue > 0 ? ((expectedRevenue - totalCost) / expectedRevenue) * 100 : 0;
  // 7. 8:2 轉點期望毛利率
  const hybridCost = (totalCost * 0.8) + (maxPointLiability * 0.2);
  const hybridMargin = expectedRevenue > 0 ? ((expectedRevenue - hybridCost) / expectedRevenue) * 100 : 0;

  return {
    allocatedDraws,
    drawsDiff: totalDraws - allocatedDraws,
    isBalanced: totalDraws === allocatedDraws,
    totalCost,
    totalPoints,
    maxPointLiability,
    effectivePerDraw: Math.round(effectivePerDraw),
    expectedRevenue: Math.round(expectedRevenue),
    cashMargin: Math.round(cashMargin * 10) / 10,
    hybridMargin: Math.round(hybridMargin * 10) / 10,
  };
}

/** 由目標毛利率逆推建議單抽價 */
export function reversePriceFromMargin(
  totalCost: number,
  totalDraws: number,
  targetMargin: number
): number {
  if (totalDraws <= 0 || targetMargin >= 100) return 0;
  const marginRatio = targetMargin / 100;
  const targetRevenue = totalCost / (1 - marginRatio);
  // 加權係數: 0.35 + 0.20*0.97 + 0.25*0.95 + 0.20*0.90 = 0.9615
  const suggestedP1 = (targetRevenue / totalDraws) / 0.9615;
  return Math.round(suggestedP1 / 10) * 10;
}

/** 計算下一個推薦的賞位代號 (數字或字母) */
export function computeNextGrade(items: AllocationPrizeItem[], mode: 'number' | 'letter'): string {
  const existingPrizes = items.filter(
    (it) => it.prizeGrade.toUpperCase() !== 'X' && it.prizeGrade.toUpperCase() !== 'Z' && !it.isNonGk
  );

  if (mode === 'number') {
    const numList = existingPrizes
      .map((it) => parseInt(it.prizeGrade, 10))
      .filter((n) => !isNaN(n));
    const maxNum = numList.length > 0 ? Math.max(...numList) : 0;
    return String(maxNum + 1);
  } else {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    return letters[Math.min(existingPrizes.length, letters.length - 1)];
  }
}

/** 統計所有工作台方案對各商品的即時抽數累加佔用 (跨套防撞沙盤) */
export function buildWorkbenchAllocMap(plans: SetPlan[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const plan of plans) {
    const count = plan.batchCount || 1;
    for (const it of plan.items) {
      if (!it.productId || ['0p', '1p', 'x', 'X', 'BLIND_BOX'].includes(it.productId) || it.isNonGk) {
        continue;
      }
      const qty = (Number(it.draws) || 0) * count;
      map.set(it.productId, (map.get(it.productId) || 0) + qty);
    }
  }
  return map;
}
