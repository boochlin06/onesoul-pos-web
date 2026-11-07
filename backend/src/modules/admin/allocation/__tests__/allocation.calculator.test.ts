import { describe, it, expect } from 'vitest';
import {
  calculateProductStoreStocks,
  calculateActiveAllocations,
  resolveCategoryClassification,
  calculateLiveStockItem,
  filterLiveStockItems,
  validatePlanForPublish,
  resolvePrizePoints,
  resolvePrizeProductId,
  normalizePlanItems,
  sortProductIdsForLock,
  formatBatchBagName,
  generateBagId,
  calculatePlanFinancials,
} from '../allocation.calculator.js';
import type { LiveStockItem } from '../allocation.types.js';

describe('Allocation Calculator Pure Seam Tests', () => {
  describe('1. calculateProductStoreStocks', () => {
    it('應正確將各門市庫存對應並累計至 Map 中', () => {
      const inventories = [
        { productId: 'P001', storeId: 'chupei', quantity: 5 },
        { productId: 'P001', storeId: 'jinshan', quantity: 3 },
        { productId: 'P002', storeId: 'chupei', quantity: 10 },
      ];

      const result = calculateProductStoreStocks(inventories);
      expect(result.get('P001')).toEqual({ chupei: 5, jinshan: 3 });
      expect(result.get('P002')).toEqual({ chupei: 10 });
      expect(result.get('NON_EXISTENT')).toBeUndefined();
    });
  });

  describe('2. calculateActiveAllocations', () => {
    it('應依在場套組門市索引正確統計各商品在各門市之已配抽數', () => {
      const activeBags = [
        { id: 'BAG-1', storeId: 'chupei' },
        { id: 'BAG-2', storeId: 'jinshan' },
      ];
      const activePrizes = [
        { bagId: 'BAG-1', productId: 'P001', draws: 2 },
        { bagId: 'BAG-1', productId: 'P002', draws: 1 },
        { bagId: 'BAG-2', productId: 'P001', draws: 4 },
        { bagId: 'BAG-1', productId: null, draws: 90 }, // 抽象小賞無 productId
        { bagId: 'BAG-UNKNOWN', productId: 'P001', draws: 5 }, // 未知套組
      ];

      const result = calculateActiveAllocations(activeBags, activePrizes);
      expect(result.get('P001')).toEqual({ chupei: 2, jinshan: 4 });
      expect(result.get('P002')).toEqual({ chupei: 1 });
      expect(result.get('P003')).toBeUndefined();
    });
  });

  describe('3. resolveCategoryClassification', () => {
    it('應正確解析商品主分類與次分類，預設 BLIND_BOX 或 GK', () => {
      expect(resolveCategoryClassification({ category: 'BLIND_BOX' })).toEqual({
        mainCategory: 'BLIND_BOX',
        subCategory: 'BLIND_BOX',
        category: 'BLIND_BOX',
      });

      expect(resolveCategoryClassification({ category: 'FIGURE' })).toEqual({
        mainCategory: 'GK',
        subCategory: 'FIGURE',
        category: 'FIGURE',
      });

      expect(resolveCategoryClassification({
        mainCategory: 'GK',
        subCategory: 'STATUE',
        category: 'COLLECTIBLE',
      })).toEqual({
        mainCategory: 'GK',
        subCategory: 'STATUE',
        category: 'COLLECTIBLE',
      });
    });
  });

  describe('4. calculateLiveStockItem', () => {
    const sampleProd = {
      id: 'GK001',
      name: '魯夫四檔限定雕像',
      costPrice: 5000,
      sellingPrice: 10000,
      category: 'GK',
    };

    it('應正確計算全門市與特定門市之庫存、已配量與可配現貨量 (Invariant #2)', () => {
      const stockMap = { chupei: 5, jinshan: 2 };
      const allocMap = { chupei: 3, jinshan: 4 };

      // 針對特定門市 (chupei)
      const itemChupei = calculateLiveStockItem(sampleProd, stockMap, allocMap, 'chupei');
      expect(itemChupei.stock).toBe(5);
      expect(itemChupei.allocatedCount).toBe(3);
      expect(itemChupei.isOverAllocated).toBe(false);
      expect(itemChupei.availableStock).toBe(2); // 5 - 3 = 2
      expect(itemChupei.suggestedPoints).toBe(500); // 10000 * 0.05

      // 針對超配門市 (jinshan)
      const itemJinshan = calculateLiveStockItem(sampleProd, stockMap, allocMap, 'jinshan');
      expect(itemJinshan.stock).toBe(2);
      expect(itemJinshan.allocatedCount).toBe(4);
      expect(itemJinshan.isOverAllocated).toBe(true);
      expect(itemJinshan.availableStock).toBe(0); // max(0, 2 - 4)

      // 針對全門市 ('ALL' 或未提供)
      const itemAll = calculateLiveStockItem(sampleProd, stockMap, allocMap, 'ALL');
      expect(itemAll.totalStock).toBe(7);
      expect(itemAll.totalAllocated).toBe(7);
      expect(itemAll.stock).toBe(7);
      expect(itemAll.allocatedCount).toBe(7);
      expect(itemAll.isOverAllocated).toBe(false);
      expect(itemAll.availableStock).toBe(0);
    });
  });

  describe('5. filterLiveStockItems', () => {
    const items: LiveStockItem[] = [
      {
        id: 'GK001',
        name: '海賊王 魯夫雕像',
        mainCategory: 'GK',
        subCategory: 'ONE_PIECE',
        category: 'ONE_PIECE',
        costPrice: 5000,
        sellingPrice: 8000,
        suggestedPoints: 400,
        storeStocks: { chupei: 3 },
        totalStock: 3,
        storeAllocated: {},
        totalAllocated: 0,
        stock: 3,
        allocatedCount: 0,
        isOverAllocated: false,
        availableStock: 3,
      },
      {
        id: 'BB001',
        name: '泡泡瑪特 盲盒公仔',
        mainCategory: 'BLIND_BOX',
        subCategory: 'POPMART',
        category: 'BLIND_BOX',
        costPrice: 150,
        sellingPrice: 300,
        suggestedPoints: 15,
        storeStocks: { chupei: 0 },
        totalStock: 0,
        storeAllocated: {},
        totalAllocated: 0,
        stock: 0,
        allocatedCount: 0,
        isOverAllocated: false,
        availableStock: 0,
      },
      {
        id: 'GK002',
        name: '鬼滅之刃 炭治郎',
        mainCategory: 'GK',
        subCategory: 'DEMON_SLAYER',
        category: 'DEMON_SLAYER',
        costPrice: 4000,
        sellingPrice: 7000,
        suggestedPoints: 350,
        storeStocks: { chupei: 1 },
        totalStock: 1,
        storeAllocated: {},
        totalAllocated: 0,
        stock: 1,
        allocatedCount: 0,
        isOverAllocated: false,
        availableStock: 1,
      },
    ];

    it('預設 minQty=1 應自動過濾 stock < 1 的商品', () => {
      const filtered = filterLiveStockItems(items, { minQty: '1' });
      expect(filtered.length).toBe(2);
      expect(filtered.map((i) => i.id)).toEqual(['GK001', 'GK002']);
    });

    it('傳入 minQty=0 時應包含 0 庫存商品', () => {
      const filtered = filterLiveStockItems(items, { minQty: 0 });
      expect(filtered.length).toBe(3);
    });

    it('帶入 mainCategory=GK 應徹底排除盲盒', () => {
      const filtered = filterLiveStockItems(items, { mainCategory: 'GK', minQty: 0 });
      expect(filtered.length).toBe(2);
      expect(filtered.every((i) => i.mainCategory === 'GK')).toBe(true);
    });

    it('帶入 category 與關鍵字 q 模糊搜尋', () => {
      const filtered = filterLiveStockItems(items, { q: '魯夫', minQty: 0 });
      expect(filtered.length).toBe(1);
      expect(filtered[0].id).toBe('GK001');

      const byId = filterLiveStockItems(items, { q: 'GK002', minQty: 0 });
      expect(byId.length).toBe(1);
      expect(byId[0].name).toContain('炭治郎');
    });
  });

  describe('6. validatePlanForPublish', () => {
    it('缺少方案名稱應報錯', () => {
      const result = validatePlanForPublish({ name: '', totalDraws: 100, price1: 350 }, 0);
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toBe('第 1 個方案請輸入套組名稱');
    });

    it('抽數或單價 <= 0 應報錯', () => {
      const res1 = validatePlanForPublish({ name: '測試套組', totalDraws: 0, price1: 350 });
      expect(res1.isValid).toBe(false);
      expect(res1.errorMessage).toContain('請設定有效的總抽數與單抽價格');

      const res2 = validatePlanForPublish({ name: '測試套組', totalDraws: 100, price1: 0 });
      expect(res2.isValid).toBe(false);
      expect(res2.errorMessage).toContain('請設定有效的總抽數與單抽價格');
    });

    it('抽數未平帳應精確報錯', () => {
      const result = validatePlanForPublish({
        name: '未平帳套組',
        totalDraws: 100,
        price1: 350,
        items: [
          { prizeGrade: 'A', prizeName: 'A賞', productId: 'GK001', draws: 50 },
        ],
      });
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain('抽數未平帳：目前已配置 50 抽，與總抽數 100 抽不符 (差距 50 抽)');
    });

    it('未配置任何實體公仔大獎應報錯', () => {
      const result = validatePlanForPublish({
        name: '全小賞套組',
        totalDraws: 100,
        price1: 350,
        items: [
          { prizeGrade: 'Z', prizeName: '非GK保底', productId: '0p', draws: 100, isNonGk: true },
        ],
      });
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain('必須至少配置 1 款實體公仔大獎');
    });

    it('合法方案應通過並校正 batchCount 邊界 (1~20)', () => {
      const result = validatePlanForPublish({
        name: '合法套組',
        totalDraws: 80,
        price1: 350,
        batchCount: 25, // 超過 20
        items: [
          { prizeGrade: 'A', prizeName: 'A賞', productId: 'GK001', draws: 2 },
          { prizeGrade: 'Z', prizeName: 'Z賞', productId: '0p', draws: 78, isNonGk: true },
        ],
      });
      expect(result.isValid).toBe(true);
      expect(result.validated?.numDraws).toBe(80);
      expect(result.validated?.unitPrice).toBe(350);
      expect(result.validated?.batchCount).toBe(20); // capped at 20
    });
  });

  describe('7. resolvePrizePoints', () => {
    it('X 賞未設定點數應注入預設等價點數 (10 點或自訂)', () => {
      expect(resolvePrizePoints('X', undefined, undefined, 10)).toBe(10);
      expect(resolvePrizePoints('X', 0, undefined, 10)).toBe(10);
      expect(resolvePrizePoints('X', undefined, 15, 10)).toBe(15);
      expect(resolvePrizePoints('X', 20, 15, 10)).toBe(20);
    });

    it('Z 賞或非 GK 小賞應注入保底 1 點', () => {
      expect(resolvePrizePoints('Z', undefined, undefined)).toBe(1);
      expect(resolvePrizePoints('Z', 0, undefined)).toBe(1);
      expect(resolvePrizePoints('1', 0, undefined, 10, true)).toBe(1); // isNonGk
    });

    it('常規賞位應保留明訂點數或預設 0 點', () => {
      expect(resolvePrizePoints('1', 150, undefined)).toBe(150);
      expect(resolvePrizePoints('A', undefined, undefined)).toBe(0);
    });
  });

  describe('8. resolvePrizeProductId', () => {
    it('抽象小賞或 X/Z 賞應解析為 null，不扣特定單品外鍵', () => {
      expect(resolvePrizeProductId('0p', 'Z')).toBeNull();
      expect(resolvePrizeProductId('1p', 'Z')).toBeNull();
      expect(resolvePrizeProductId('X', 'X')).toBeNull();
      expect(resolvePrizeProductId('BLIND_BOX', 'X')).toBeNull();
      expect(resolvePrizeProductId('GEN001', 'Z')).toBeNull();
      expect(resolvePrizeProductId('GK001', 'A', true)).toBeNull(); // isNonGk
    });

    it('常規實體公仔大賞應保留原 productId', () => {
      expect(resolvePrizeProductId('GK001', 'A', false)).toBe('GK001');
      expect(resolvePrizeProductId('3233', '1', false)).toBe('3233');
    });
  });

  describe('9. normalizePlanItems', () => {
    it('應將傳入的獎項明細正規化為乾淨的 NormalizedPrizeItem 列表', () => {
      const plan = {
        name: '測試',
        totalDraws: 100,
        price1: 350,
        blindBoxPointsValue: 12,
      };
      const items = [
        { prizeGrade: 'a', prizeName: '大賞', productId: 'GK001', draws: '1', costPrice: '5000', points: '150' },
        { prizeGrade: 'x', prizeName: '盲盒', productId: 'X', draws: 5, costPrice: 200 },
        { prizeGrade: 'z', prizeName: '小賞', productId: '0p', draws: 94, isNonGk: true },
      ];

      const normalized = normalizePlanItems(items, plan, 10);
      expect(normalized[0]).toEqual({
        prizeGrade: 'A',
        prizeName: '大賞',
        productId: 'GK001',
        points: 150,
        draws: 1,
        isNonGk: false,
        costPrice: 5000,
      });

      expect(normalized[1]).toEqual({
        prizeGrade: 'X',
        prizeName: '盲盒',
        productId: null,
        points: 12,
        draws: 5,
        isNonGk: false,
        costPrice: 200,
      });

      expect(normalized[2]).toEqual({
        prizeGrade: 'Z',
        prizeName: '小賞',
        productId: null,
        points: 1,
        draws: 94,
        isNonGk: true,
        costPrice: 0,
      });
    });
  });

  describe('10. sortProductIdsForLock (Invariant #3 防死鎖字典序鎖)', () => {
    it('應依標準字典序排序商品 ID 並去重與排除無效值', () => {
      const rawIds = ['GK003', 'GK001', null, 'GK002', '', 'GK001', undefined];
      const sorted = sortProductIdsForLock(rawIds);
      expect(sorted).toEqual(['GK001', 'GK002', 'GK003']);
    });
  });

  describe('11. formatBatchBagName & generateBagId', () => {
    it('formatBatchBagName: 單套維持原名，多套附加序號', () => {
      expect(formatBatchBagName('海賊一番賞', 0, 1)).toBe('海賊一番賞');
      expect(formatBatchBagName('海賊一番賞', 0, 3)).toBe('海賊一番賞 #1');
      expect(formatBatchBagName('海賊一番賞', 2, 3)).toBe('海賊一番賞 #3');
    });

    it('generateBagId: 產生 LB- 開頭的唯一字串', () => {
      const id = generateBagId(1700000000000, 42);
      expect(id).toBe('LB-0000042');
      expect(generateBagId()).toMatch(/^LB-\d{7}$/);
    });
  });

  describe('12. calculatePlanFinancials', () => {
    it('應精確試算總營收、總成本、毛利率與損平抽數', () => {
      const items = [
        { costPrice: 8000, draws: 1 },
        { costPrice: 2000, draws: 2 },
        { costPrice: 200, draws: 5 },
        { costPrice: 0, draws: 72 },
      ];
      // totalCost = 8000 + 4000 + 1000 + 0 = 13000
      // totalDraws = 80, unitPrice = 350
      // revenue = 28000
      // profit = 15000, margin = 15000 / 28000 = 53.57%
      // breakevenDraws = ceil(13000 / 350) = 38
      const financials = calculatePlanFinancials(80, 350, items);
      expect(financials.totalRevenue).toBe(28000);
      expect(financials.totalCost).toBe(13000);
      expect(financials.grossProfit).toBe(15000);
      expect(financials.marginRate).toBe(53.57);
      expect(financials.breakevenDraws).toBe(38);
      expect(financials.isHealthy).toBe(true);
    });
  });
});
