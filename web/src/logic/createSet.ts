// ── 開套純函數 (framework-agnostic, 100% testable) ──

/**
 * 計算建議價格
 * 公式: CEIL(points * multiplier / draws)
 */
export function calcSuggestedPrice(
  points: number,
  draws: number,
  multiplier: number,
): number {
  if (!points || !draws) return 0;
  return Math.ceil(points * multiplier / draws);
}

/**
 * 驗證實際單抽價格是否在允許範圍內
 * @returns null = 合法, string = 錯誤訊息
 */
export function validateCreateSetPrice(
  actualPrice: number,
  suggestedPrice: number,
  config: { minPriceRatio: number; maxPriceRatio: number },
): string | null {
  if (actualPrice <= 0) return '單抽價格必須大於 0';
  if (!suggestedPrice || suggestedPrice <= 0) return null; // 無建議價時不擋
  const minPrice = Math.ceil(suggestedPrice * config.minPriceRatio);
  const maxPrice = Math.floor(suggestedPrice * config.maxPriceRatio);
  if (actualPrice < minPrice || actualPrice > maxPrice) {
    return `單抽價格必須在 NT$${minPrice} ~ NT$${maxPrice} 之間`;
  }
  return null;
}

/**
 * 建構開套 API payload（含驗證）
 * @throws Error 若資料不完整
 */
export interface CreateSetInput {
  itemNo: string;
  itemName: string;
  totalDraws: number;
  suggestedPrice: number;
  actualPrice: number;
  branch: string;
}

export function buildCreateSetPayload(input: CreateSetInput): CreateSetInput {
  const itemNo = input.itemNo.trim();
  if (!itemNo) throw new Error('貨號不可為空');
  if (!input.itemName) throw new Error('名稱不可為空');
  if (!input.totalDraws || input.totalDraws <= 0) throw new Error('抽數必須大於 0');
  if (!input.actualPrice || input.actualPrice <= 0) throw new Error('單抽價格必須大於 0');
  return { ...input, itemNo };
}
