import { describe, it, expect } from 'vitest';
import {
  calculatePlanFinancials,
  validatePlanForPublish,
  resolvePrizePoints,
  resolvePrizeProductId,
  normalizePlanItems,
} from '../src/modules/admin/allocation/allocation.calculator.js';
import {
  calculateTierPricing,
  calculateFinancialSummary,
  reversePriceFromMargin,
  cleanPrizeName,
  getTopPrizeName,
  computeNextGrade,
  buildWorkbenchAllocMap,
} from '../../admin/src/views/allocation/utils/calculations.js';

describe('Challenger 2: Empirical Stress Test Suite', () => {
  // ─────────────────────────────────────────────────────────────
  // 1. Backend: calculatePlanFinancials
  // ─────────────────────────────────────────────────────────────
  describe('1. Backend calculatePlanFinancials Stress & Edge Tests', () => {
    it('1.1 Standard healthy scenario (margin >= 35%, breakeven <= totalDraws)', () => {
      const items = [
        { costPrice: 5000, draws: 1 },
        { costPrice: 1000, draws: 2 },
        { costPrice: 50, draws: 77 },
      ];
      // totalCost = 5000 + 2000 + 3850 = 10850
      // revenue = 80 * 300 = 24000
      // profit = 13150
      // margin = 13150 / 24000 = 54.79%
      // breakevenDraws = ceil(10850 / 300) = 37 <= 80
      const fin = calculatePlanFinancials(80, 300, items);
      expect(fin.totalRevenue).toBe(24000);
      expect(fin.totalCost).toBe(10850);
      expect(fin.grossProfit).toBe(13150);
      expect(fin.marginRate).toBe(54.79);
      expect(fin.breakevenDraws).toBe(37);
      expect(fin.isHealthy).toBe(true);
    });

    it('1.2 Margin boundary: exactly 35.00% should be healthy', () => {
      // revenue = 10000, cost = 6500 => margin = 35%
      const items = [{ costPrice: 65, draws: 100 }];
      const fin = calculatePlanFinancials(100, 100, items);
      expect(fin.marginRate).toBe(35);
      expect(fin.breakevenDraws).toBe(65);
      expect(fin.isHealthy).toBe(true);
    });

    it('1.3 Margin boundary: 34.99% should NOT be healthy', () => {
      // revenue = 10000, cost = 6501 => margin = 34.99%
      const items = [{ costPrice: 6501, draws: 1 }];
      const fin = calculatePlanFinancials(100, 100, items);
      expect(fin.marginRate).toBe(34.99);
      expect(fin.breakevenDraws).toBe(66);
      expect(fin.isHealthy).toBe(false);
    });

    it('1.4 Zero cost items (100% margin)', () => {
      const items = [{ costPrice: 0, draws: 100 }];
      const fin = calculatePlanFinancials(100, 200, items);
      expect(fin.totalCost).toBe(0);
      expect(fin.grossProfit).toBe(20000);
      expect(fin.marginRate).toBe(100);
      expect(fin.breakevenDraws).toBe(0);
      expect(fin.isHealthy).toBe(true);
    });

    it('1.5 Zero revenue (totalDraws = 0 or unitPrice = 0)', () => {
      const items = [{ costPrice: 500, draws: 10 }];
      const finZeroDraws = calculatePlanFinancials(0, 200, items);
      expect(finZeroDraws.totalRevenue).toBe(0);
      expect(finZeroDraws.marginRate).toBe(0);
      expect(finZeroDraws.breakevenDraws).toBe(25);
      expect(finZeroDraws.isHealthy).toBe(false);

      const finZeroPrice = calculatePlanFinancials(100, 0, items);
      expect(finZeroPrice.totalRevenue).toBe(0);
      expect(finZeroPrice.marginRate).toBe(0);
      expect(finZeroPrice.breakevenDraws).toBe(0); // avoids division by zero
      expect(finZeroPrice.isHealthy).toBe(false);
    });

    it('1.6 Loss making scenario (cost > revenue)', () => {
      const items = [{ costPrice: 500, draws: 100 }]; // cost 50000
      const fin = calculatePlanFinancials(100, 300, items); // revenue 30000
      expect(fin.grossProfit).toBe(-20000);
      expect(fin.marginRate).toBe(-66.67);
      expect(fin.breakevenDraws).toBe(167); // 167 > 100
      expect(fin.isHealthy).toBe(false);
    });

    it('1.7 String inputs and missing fields coercion', () => {
      const items = [
        { costPrice: '500', draws: '10' },
        { costPrice: undefined, draws: 5 },
        { costPrice: null as any, draws: '2' },
        { draws: 3 },
      ];
      const fin = calculatePlanFinancials(20, 100, items as any);
      expect(fin.totalCost).toBe(5000);
      expect(fin.totalRevenue).toBe(2000);
    });

    it('1.8 Floating point costs behavior', () => {
      // Test string float vs number float
      const itemsNumber = [{ costPrice: 199.5, draws: 10 }];
      const finNumber = calculatePlanFinancials(10, 300, itemsNumber);
      expect(finNumber.totalCost).toBe(1995);

      const itemsString = [{ costPrice: '199.5', draws: 10 }];
      const finString = calculatePlanFinancials(10, 300, itemsString);
      // Notice: parseInt('199.5', 10) results in 199!
      expect(finString.totalCost).toBe(1990);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 2. Backend: validatePlanForPublish
  // ─────────────────────────────────────────────────────────────
  describe('2. Backend validatePlanForPublish Edge Cases & Security', () => {
    it('2.1 Rejects draw mismatch (sumDraws !== totalDraws)', () => {
      const planUnder = {
        name: 'Under-allocated',
        totalDraws: 80,
        price1: 300,
        items: [{ prizeGrade: 'A', draws: 79, productId: 'GK001' }],
      };
      const resUnder = validatePlanForPublish(planUnder as any);
      expect(resUnder.isValid).toBe(false);
      expect(resUnder.errorMessage).toContain('差距 1 抽');

      const planOver = {
        name: 'Over-allocated',
        totalDraws: 80,
        price1: 300,
        items: [{ prizeGrade: 'A', draws: 81, productId: 'GK001' }],
      };
      const resOver = validatePlanForPublish(planOver as any);
      expect(resOver.isValid).toBe(false);
      expect(resOver.errorMessage).toContain('差距 -1 抽');
    });

    it('2.2 Rejects when zero grand prizes exist', () => {
      const planNoGrand = {
        name: 'All Small Prizes',
        totalDraws: 80,
        price1: 300,
        items: [
          { prizeGrade: 'Z', draws: 40, productId: '0p', isNonGk: true },
          { prizeGrade: 'Z', draws: 40, productId: '0p', isNonGk: false }, // 0p is not a grand prize
        ],
      };
      const res = validatePlanForPublish(planNoGrand as any);
      expect(res.isValid).toBe(false);
      expect(res.errorMessage).toContain('至少配置 1 款實體公仔大獎');
    });

    it('2.3 Edge Case: productId "1p" or "X" vs grand prize check', () => {
      // In validatePlanForPublish: hasPhysicalPrize checks !it.isNonGk && it.productId && it.productId !== '0p'
      // If productId is '1p' or 'X', it !== '0p', but resolvePrizeProductId treats '1p' and 'X' as abstract!
      const planAbstractOnly = {
        name: 'Pseudo Grand Prize',
        totalDraws: 80,
        price1: 300,
        items: [
          { prizeGrade: '1', draws: 1, productId: '1p', isNonGk: false },
          { prizeGrade: 'Z', draws: 79, productId: '0p', isNonGk: true },
        ],
      };
      const validation = validatePlanForPublish(planAbstractOnly as any);
      // Check whether '1p' slipped through validation
      const normalized = normalizePlanItems(planAbstractOnly.items as any, planAbstractOnly as any);
      const hasActualProduct = normalized.some((it) => it.productId !== null);

      // We document this boundary behavior:
      // validation passes if productId is '1p' because '1p' !== '0p',
      // but normalized productId becomes null because '1p' is in ['0p', '1p', 'x', 'X', 'BLIND_BOX'].
      expect(validation.isValid).toBe(true);
      expect(hasActualProduct).toBe(false);
    });

    it('2.4 Negative draw count manipulation attack', () => {
      // An adversarial payload where draws sum to 80 via negative numbers: 85 and -5
      const exploitPlan = {
        name: 'Negative Draws Attack',
        totalDraws: 80,
        price1: 300,
        items: [
          { prizeGrade: 'A', draws: 85, productId: 'GK001' },
          { prizeGrade: 'Z', draws: -5, productId: '0p', isNonGk: true },
        ],
      };
      const res = validatePlanForPublish(exploitPlan as any);
      // Empirical observation: sumDraws = 85 + (-5) = 80!
      expect(res.isValid).toBe(true);
    });

    it('2.5 Batch count boundaries (clamps between 1 and 20)', () => {
      const planHigh = {
        name: 'Batch High',
        totalDraws: 10,
        price1: 100,
        batchCount: 999,
        items: [{ prizeGrade: 'A', draws: 10, productId: 'GK001' }],
      };
      expect(validatePlanForPublish(planHigh as any).validated?.batchCount).toBe(20);

      const planLow = {
        name: 'Batch Low',
        totalDraws: 10,
        price1: 100,
        batchCount: -5,
        items: [{ prizeGrade: 'A', draws: 10, productId: 'GK001' }],
      };
      expect(validatePlanForPublish(planLow as any).validated?.batchCount).toBe(1);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 3. Backend: resolvePrizePoints & resolvePrizeProductId
  // ─────────────────────────────────────────────────────────────
  describe('3. Backend resolvePrizePoints & resolvePrizeProductId', () => {
    it('3.1 resolvePrizePoints with various grade and point permutations', () => {
      // X Grade
      expect(resolvePrizePoints('X', undefined, undefined, 10)).toBe(10);
      expect(resolvePrizePoints('x', null, 15, 10)).toBe(15);
      expect(resolvePrizePoints('X', 0, 20, 10)).toBe(20); // 0 reverts to plan/global fallback
      expect(resolvePrizePoints('X', 25, 20, 10)).toBe(25); // explicit > 0 preserved

      // Z Grade
      expect(resolvePrizePoints('Z', undefined, undefined)).toBe(1);
      expect(resolvePrizePoints('z', 0, undefined)).toBe(1);
      expect(resolvePrizePoints('Z', 5, undefined)).toBe(5); // explicit > 0 preserved

      // isNonGk
      expect(resolvePrizePoints('1', undefined, undefined, 10, true)).toBe(1);
      expect(resolvePrizePoints('1', 0, undefined, 10, true)).toBe(1);
      expect(resolvePrizePoints('1', 50, undefined, 10, true)).toBe(50);

      // Normal Grand Prize
      expect(resolvePrizePoints('A', undefined, undefined)).toBe(0);
      expect(resolvePrizePoints('1', '', undefined)).toBe(0);
      expect(resolvePrizePoints('1', 200, undefined)).toBe(200);
    });

    it('3.2 resolvePrizeProductId with abstract identifiers', () => {
      expect(resolvePrizeProductId('0p', '1')).toBeNull();
      expect(resolvePrizeProductId('1p', '1')).toBeNull();
      expect(resolvePrizeProductId('x', '1')).toBeNull();
      expect(resolvePrizeProductId('X', '1')).toBeNull();
      expect(resolvePrizeProductId('BLIND_BOX', '1')).toBeNull();
      expect(resolvePrizeProductId('GK001', 'X')).toBeNull(); // Grade X forces null
      expect(resolvePrizeProductId('GK001', 'Z')).toBeNull(); // Grade Z forces null
      expect(resolvePrizeProductId('GK001', 'A', true)).toBeNull(); // isNonGk forces null
      expect(resolvePrizeProductId('GK001', 'A', false)).toBe('GK001');
      expect(resolvePrizeProductId('', 'A')).toBeNull();
      expect(resolvePrizeProductId(null, 'A')).toBeNull();
      expect(resolvePrizeProductId(undefined, 'A')).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 4. Frontend: calculateTierPricing
  // ─────────────────────────────────────────────────────────────
  describe('4. Frontend calculateTierPricing Stress Tests', () => {
    it('4.1 Standard pricing base = 350, tenPlusOne = false', () => {
      // p1 = 350
      // p3 = round(3 * 350 * 0.97 / 10) * 10 = round(1018.5 / 10) * 10 = 1020
      // p5 = round(5 * 350 * 0.95 / 10) * 10 = round(1662.5 / 10) * 10 = 1660
      // p10 = round(10 * 350 * 0.90 / 10) * 10 = round(3150 / 10) * 10 = 3150
      const tiers = calculateTierPricing(350, false);
      expect(tiers.price1).toBe(350);
      expect(tiers.price3).toBe(1020);
      expect(tiers.price5).toBe(1660);
      expect(tiers.price10).toBe(3150);
    });

    it('4.2 tenPlusOne = true maintains price10 = 10 * price1 without discount', () => {
      const tiers = calculateTierPricing(350, true);
      expect(tiers.price1).toBe(350);
      expect(tiers.price3).toBe(1020);
      expect(tiers.price5).toBe(1660);
      expect(tiers.price10).toBe(3500); // 10 * 350
    });

    it('4.3 Zero and negative base price handling', () => {
      const zeroTiers = calculateTierPricing(0, false);
      expect(zeroTiers).toEqual({ price1: 0, price3: 0, price5: 0, price10: 0 });

      const negTiers = calculateTierPricing(-100, false);
      expect(negTiers).toEqual({ price1: 0, price3: 0, price5: 0, price10: 0 });
    });

    it('4.4 Floating point base price', () => {
      const floatTiers = calculateTierPricing(333.33, false);
      // p1 = 333.33
      // p3 = round(3 * 333.33 * 0.97 / 10) * 10 = round(969.99 / 10) * 10 = 970
      // p5 = round(5 * 333.33 * 0.95 / 10) * 10 = round(1583.31 / 10) * 10 = 1580
      // p10 = round(10 * 333.33 * 0.90 / 10) * 10 = round(2999.97 / 10) * 10 = 3000
      expect(floatTiers.price3 % 10).toBe(0);
      expect(floatTiers.price5 % 10).toBe(0);
      expect(floatTiers.price10 % 10).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 5. Frontend: calculateFinancialSummary & reversePriceFromMargin
  // ─────────────────────────────────────────────────────────────
  describe('5. Frontend FinancialSummary & reversePriceFromMargin', () => {
    it('5.1 Expected revenue and weighted average per draw calculation', () => {
      const tiers = calculateTierPricing(350, false);
      const plan = {
        id: 'plan-1',
        name: 'Test Plan',
        storeId: 'chupei',
        totalDraws: 80,
        ...tiers,
        isTenPlusOne: false,
        targetMargin: 50,
        batchCount: 1,
        items: [
          { id: '1', prizeGrade: 'A', prizeName: '大獎', productId: 'GK001', draws: 2, costPrice: 4000, points: 0 },
          { id: '2', prizeGrade: 'X', prizeName: '盲盒', productId: 'X', draws: 8, costPrice: 150, points: 10 },
          { id: '3', prizeGrade: 'Z', prizeName: '小賞', productId: '0p', draws: 70, costPrice: 30, points: 1, isNonGk: true },
        ],
      };
      // totalCost = (2*4000) + (8*150) + (70*30) = 8000 + 1200 + 2100 = 11300
      // totalPoints = (2*0) + (8*10) + (70*1) = 80 + 70 = 150 pt
      // maxPointLiability = 150 * 20 = 3000
      // effectivePerDraw = (0.35 * 350) + (0.20 * 1020/3) + (0.25 * 1660/5) + (0.20 * 3150/10)
      //                 = 122.5 + 68 + 83 + 63 = 336.5
      // expectedRevenue = 80 * 336.5 = 26920
      // cashMargin = (26920 - 11300) / 26920 = 15620 / 26920 = 58.02% -> 58.0%
      // hybridCost = (11300 * 0.8) + (3000 * 0.2) = 9040 + 600 = 9640
      // hybridMargin = (26920 - 9640) / 26920 = 17280 / 26920 = 64.19% -> 64.2%
      const summary = calculateFinancialSummary(plan as any);
      expect(summary.totalCost).toBe(11300);
      expect(summary.totalPoints).toBe(150);
      expect(summary.maxPointLiability).toBe(3000);
      expect(summary.effectivePerDraw).toBe(337); // Math.round(336.5)
      expect(summary.expectedRevenue).toBe(26920);
      expect(summary.cashMargin).toBe(58.0);
      expect(summary.hybridMargin).toBe(64.2);
      expect(summary.isBalanced).toBe(true);
      expect(summary.drawsDiff).toBe(0);
    });

    it('5.2 reversePriceFromMargin mathematical round-trip consistency', () => {
      const totalCost = 15000;
      const totalDraws = 80;
      const targetMargin = 45; // 45%

      // suggestedP1 = (15000 / (1 - 0.45) / 80) / 0.9615 = (27272.727 / 80) / 0.9615 = 340.909 / 0.9615 = 354.55
      // rounded to 10: 350
      const suggestedP1 = reversePriceFromMargin(totalCost, totalDraws, targetMargin);
      expect(suggestedP1).toBe(350);

      // Now compute the resulting cashMargin with suggestedP1
      const tiers = calculateTierPricing(suggestedP1, false);
      const plan = {
        totalDraws,
        ...tiers,
        items: [{ draws: totalDraws, costPrice: totalCost / totalDraws, points: 0 }],
      };
      const summary = calculateFinancialSummary(plan as any);
      // Expected margin should be close to 45% within rounding tolerance (+- 2%)
      expect(Math.abs(summary.cashMargin - targetMargin)).toBeLessThan(2.0);
    });

    it('5.3 reversePriceFromMargin edge cases', () => {
      expect(reversePriceFromMargin(1000, 0, 50)).toBe(0); // 0 draws
      expect(reversePriceFromMargin(1000, 80, 100)).toBe(0); // 100% margin impossible
      expect(reversePriceFromMargin(1000, 80, 105)).toBe(0); // >100% margin impossible
      expect(reversePriceFromMargin(0, 80, 50)).toBe(0); // 0 cost
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 6. Cross-Seam Consistency: Backend vs Frontend
  // ─────────────────────────────────────────────────────────────
  describe('6. Cross-Seam Consistency: Backend vs Frontend Models', () => {
    it('6.1 Cost calculation equivalence across identical items', () => {
      const items = [
        { costPrice: 3500, draws: 2, points: 0 },
        { costPrice: 200, draws: 10, points: 10 },
        { costPrice: 40, draws: 68, points: 1 },
      ];
      const totalDraws = 80;
      const unitPrice = 300;

      // Backend cost
      const backendFin = calculatePlanFinancials(totalDraws, unitPrice, items);

      // Frontend cost
      const frontendSummary = calculateFinancialSummary({
        totalDraws,
        price1: unitPrice,
        price3: unitPrice * 3,
        price5: unitPrice * 5,
        price10: unitPrice * 10,
        items,
      } as any);

      expect(backendFin.totalCost).toBe(frontendSummary.totalCost);
      expect(backendFin.totalCost).toBe(3500 * 2 + 200 * 10 + 40 * 68); // 7000 + 2000 + 2720 = 11720
    });

    it('6.2 Revenue & Margin Model comparison: Flat vs Tiered Weighted', () => {
      const items = [
        { costPrice: 5000, draws: 1, points: 0 },
        { costPrice: 50, draws: 79, points: 1 },
      ];
      const totalDraws = 80;
      const basePrice = 350;

      // Backend assumes flat revenue = totalDraws * unitPrice
      const backendFin = calculatePlanFinancials(totalDraws, basePrice, items);

      // Frontend computes tiered prices and applies historical weight model
      const tiers = calculateTierPricing(basePrice, false);
      const frontendSummary = calculateFinancialSummary({
        totalDraws,
        ...tiers,
        items,
      } as any);

      // Backend flat revenue: 80 * 350 = 28000
      expect(backendFin.totalRevenue).toBe(28000);

      // Frontend expected revenue accounts for 3/5/10 draw discounts (~96.15% of flat):
      // effectivePerDraw = 336.5 -> 80 * 336.5 = 26920
      expect(frontendSummary.expectedRevenue).toBe(26920);

      // Because frontend includes tiered volume discounts, frontend cashMargin is lower than backend marginRate
      expect(frontendSummary.cashMargin).toBeLessThan(backendFin.marginRate);
      expect(backendFin.marginRate - frontendSummary.cashMargin).toBeCloseTo(1.24, 1);
    });

    it('6.3 Unbalance detection consistency: Backend error vs Frontend isBalanced', () => {
      const unbalancedPlan = {
        name: 'Unbalanced',
        totalDraws: 100,
        price1: 300,
        items: [
          { prizeGrade: 'A', draws: 30, productId: 'GK001', costPrice: 1000, points: 0 },
          { prizeGrade: 'Z', draws: 60, productId: '0p', isNonGk: true, costPrice: 20, points: 1 },
        ],
      };

      const backendVal = validatePlanForPublish(unbalancedPlan as any);
      expect(backendVal.isValid).toBe(false);
      expect(backendVal.errorMessage).toContain('抽數未平帳：目前已配置 90 抽，與總抽數 100 抽不符 (差距 10 抽)');

      const frontendSummary = calculateFinancialSummary(unbalancedPlan as any);
      expect(frontendSummary.isBalanced).toBe(false);
      expect(frontendSummary.allocatedDraws).toBe(90);
      expect(frontendSummary.drawsDiff).toBe(10);
    });
  });
});
