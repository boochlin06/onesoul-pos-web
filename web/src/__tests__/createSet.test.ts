import { describe, it, expect } from 'vitest';
import {
  calcSuggestedPrice,
  validateCreateSetPrice,
  buildCreateSetPayload,
} from '../logic/createSet';

// ── calcSuggestedPrice ────────────────────────────────
describe('calcSuggestedPrice', () => {
  it('基本計算: CEIL(590 * 60 / 120) = 295', () => {
    expect(calcSuggestedPrice(590, 120, 60)).toBe(295);
  });

  it('基本計算: CEIL(590 * 60 / 40) = 885', () => {
    expect(calcSuggestedPrice(590, 40, 60)).toBe(885);
  });

  it('基本計算: CEIL(590 * 60 / 80) = 443', () => {
    expect(calcSuggestedPrice(590, 80, 60)).toBe(443);
  });

  it('基本計算: CEIL(170 * 60 / 20) = 510', () => {
    expect(calcSuggestedPrice(170, 20, 60)).toBe(510);
  });

  it('points=0 → 回傳 0', () => {
    expect(calcSuggestedPrice(0, 120, 60)).toBe(0);
  });

  it('draws=0 → 回傳 0 (除以零保護)', () => {
    expect(calcSuggestedPrice(590, 0, 60)).toBe(0);
  });

  it('multiplier 可自訂 (e.g. 50)', () => {
    expect(calcSuggestedPrice(600, 100, 50)).toBe(300);
  });
});

// ── validateCreateSetPrice ────────────────────────────
describe('validateCreateSetPrice', () => {
  const config = { minPriceRatio: 0.92, maxPriceRatio: 1.5 };

  it('價格在範圍內 → null (無錯誤)', () => {
    expect(validateCreateSetPrice(300, 300, config)).toBeNull();
  });

  it('價格等於建議價 → 合法', () => {
    expect(validateCreateSetPrice(500, 500, config)).toBeNull();
  });

  it('剛好在下限 CEIL(300*0.92)=276 → 合法', () => {
    expect(validateCreateSetPrice(276, 300, config)).toBeNull();
  });

  it('低於下限 275 < 276 → 錯誤', () => {
    const err = validateCreateSetPrice(275, 300, config);
    expect(err).not.toBeNull();
    expect(err).toContain('276');
    expect(err).toContain('450');
  });

  it('剛好在上限 FLOOR(300*1.5)=450 → 合法', () => {
    expect(validateCreateSetPrice(450, 300, config)).toBeNull();
  });

  it('超過上限 451 > 450 → 錯誤', () => {
    const err = validateCreateSetPrice(451, 300, config);
    expect(err).not.toBeNull();
    expect(err).toContain('450');
  });

  it('負數價格 → 錯誤', () => {
    expect(validateCreateSetPrice(-10, 300, config)).not.toBeNull();
  });

  it('建議價為 0 → 任何正數都合法', () => {
    expect(validateCreateSetPrice(100, 0, config)).toBeNull();
  });
});

// ── buildCreateSetPayload ─────────────────────────────
describe('buildCreateSetPayload', () => {
  it('建立完整 payload', () => {
    const result = buildCreateSetPayload({
      itemNo: '3066',
      itemName: '幻想屋五條',
      totalDraws: 120,
      suggestedPrice: 295,
      actualPrice: 300,
      branch: '竹北',
    });
    expect(result).toEqual({
      itemNo: '3066',
      itemName: '幻想屋五條',
      totalDraws: 120,
      suggestedPrice: 295,
      actualPrice: 300,
      branch: '竹北',
    });
  });

  it('自動 trim itemNo', () => {
    const result = buildCreateSetPayload({
      itemNo: '  3066  ',
      itemName: '幻想屋五條',
      totalDraws: 120,
      suggestedPrice: 295,
      actualPrice: 300,
      branch: '金山',
    });
    expect(result.itemNo).toBe('3066');
  });

  it('空 itemNo → 拋錯', () => {
    expect(() =>
      buildCreateSetPayload({
        itemNo: '',
        itemName: '幻想屋五條',
        totalDraws: 120,
        suggestedPrice: 295,
        actualPrice: 300,
        branch: '竹北',
      }),
    ).toThrow('貨號不可為空');
  });

  it('空 itemName → 拋錯', () => {
    expect(() =>
      buildCreateSetPayload({
        itemNo: '3066',
        itemName: '',
        totalDraws: 120,
        suggestedPrice: 295,
        actualPrice: 300,
        branch: '竹北',
      }),
    ).toThrow('名稱不可為空');
  });

  it('draws=0 → 拋錯', () => {
    expect(() =>
      buildCreateSetPayload({
        itemNo: '3066',
        itemName: '幻想屋五條',
        totalDraws: 0,
        suggestedPrice: 295,
        actualPrice: 300,
        branch: '竹北',
      }),
    ).toThrow('抽數');
  });

  it('actualPrice=0 → 拋錯', () => {
    expect(() =>
      buildCreateSetPayload({
        itemNo: '3066',
        itemName: '幻想屋五條',
        totalDraws: 120,
        suggestedPrice: 295,
        actualPrice: 0,
        branch: '竹北',
      }),
    ).toThrow('價格');
  });
});
