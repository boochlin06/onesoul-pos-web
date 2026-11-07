import { describe, it, expect, beforeAll, vi } from 'vitest';
import { prisma, initPrisma } from '../src/plugins/prisma.js';
import { allocationService } from '../src/modules/admin/allocation/allocation.service.js';
import {
  calculateLiveStockItem,
  sortProductIdsForLock,
  calculateProductStoreStocks,
  calculateActiveAllocations,
} from '../src/modules/admin/allocation/allocation.calculator.js';

describe('Empirical Challenger 1: Invariant Stress Verification Harness', () => {
  beforeAll(async () => {
    await initPrisma();
  });

  // ══════════════════════════════════════════════════════════════════
  // INVARIANT #2: 開套不預扣庫存，提貨核銷不變量 (Zero Pre-Deduction)
  // ══════════════════════════════════════════════════════════════════
  describe('Invariant #2 Empirical Verification: allocationService.publishPlans & LiveStock', () => {
    it('Empirical Test 2.1: Spy on StoreInventory - verify ZERO update/create calls during publishPlans', async () => {
      // 監控 prisma.storeInventory 寫入方法
      const updateSpy = vi.spyOn((prisma as any).storeInventory, 'update');
      const createSpy = vi.spyOn((prisma as any).storeInventory, 'create');
      const createManySpy = vi.spyOn((prisma as any).storeInventory, 'createMany');

      try {
        const payload = {
          name: 'Empirical-Stress-Set-Zero-Deduction',
          storeId: 'chupei',
          totalDraws: 100,
          price1: 350,
          batchCount: 3, // 批次開 3 套
          items: [
            { prizeGrade: 'A', prizeName: 'A賞 大雕像', productId: 'GK001', draws: 2, costPrice: 6000, points: 200 },
            { prizeGrade: 'B', prizeName: 'B賞 模型', productId: 'GK002', draws: 3, costPrice: 3000, points: 100 },
            { prizeGrade: 'X', prizeName: 'X賞 盲盒', productId: 'X', draws: 10, costPrice: 200, points: 10 },
            { prizeGrade: 'Z', prizeName: 'Z賞 保底', productId: '0p', draws: 85, costPrice: 0, points: 1, isNonGk: true },
          ],
        };

        const result = await allocationService.publishPlans(payload, 'challenger@onesoul.com');
        expect(result.success).toBe(true);
        expect(result.data.length).toBe(3);

        // 🚨 斷言：完全零呼叫 StoreInventory 寫入 API
        expect(updateSpy).toHaveBeenCalledTimes(0);
        expect(createSpy).toHaveBeenCalledTimes(0);
        expect(createManySpy).toHaveBeenCalledTimes(0);
      } finally {
        updateSpy.mockRestore();
        createSpy.mockRestore();
        createManySpy.mockRestore();
      }
    });

    it('Empirical Test 2.2: DB Level Physical Inventory Immutability Snapshot', async () => {
      // 1. 取得發布前全量門市庫存快照
      const snapshotBefore = await (prisma as any).storeInventory.findMany();
      expect(snapshotBefore.length).toBeGreaterThan(0);

      // 建立以 storeId_productId 為鍵的數量映射
      const qtyMapBefore = new Map<string, number>();
      snapshotBefore.forEach((inv: any) => {
        qtyMapBefore.set(`${inv.storeId}:${inv.productId}`, inv.quantity);
      });

      // 2. 執行高強度多方案發布
      const multiPlanPayload = {
        plans: [
          {
            name: 'Stress-Plan-Alpha',
            storeId: 'chupei',
            totalDraws: 80,
            price1: 300,
            items: [
              { prizeGrade: '1', prizeName: '特賞', productId: 'GK001', draws: 1 },
              { prizeGrade: 'Z', prizeName: '小賞', productId: '0p', draws: 79, isNonGk: true },
            ],
          },
          {
            name: 'Stress-Plan-Beta',
            storeId: 'jinshan',
            totalDraws: 100,
            price1: 400,
            items: [
              { prizeGrade: 'A', prizeName: '頭獎', productId: 'GK002', draws: 2 },
              { prizeGrade: 'Z', prizeName: '小賞', productId: '0p', draws: 98, isNonGk: true },
            ],
          },
        ],
      };

      const result = await allocationService.publishPlans(multiPlanPayload, 'challenger@onesoul.com');
      expect(result.success).toBe(true);

      // 3. 取得發布後全量門市庫存快照
      const snapshotAfter = await (prisma as any).storeInventory.findMany();

      // 🚨 斷言：行數完全一致，每筆庫存數量無任何偏差 (0 delta)
      expect(snapshotAfter.length).toBe(snapshotBefore.length);
      snapshotAfter.forEach((inv: any) => {
        const key = `${inv.storeId}:${inv.productId}`;
        const prevQty = qtyMapBefore.get(key);
        expect(prevQty).toBeDefined();
        expect(inv.quantity).toBe(prevQty); // 實體庫存嚴禁異動
      });
    });

    it('Empirical Test 2.3: calculateLiveStockItem accounts for allocatedCount without mutating physical inventory', () => {
      const originalStockMap = { chupei: 10, jinshan: 5 };
      const originalAllocMap = { chupei: 3, jinshan: 7 };

      // 凍結物件以保證無任何副作用或原生物件修改
      const stockMapCopy = Object.freeze({ ...originalStockMap });
      const allocMapCopy = Object.freeze({ ...originalAllocMap });

      const prod = {
        id: 'GK-TEST-001',
        name: '極限測試雕像',
        sellingPrice: 12000,
        category: 'GK',
      };

      // 1. 測試特定門市 (未超配)
      const resChupei = calculateLiveStockItem(prod, stockMapCopy, allocMapCopy, 'chupei');
      expect(resChupei.stock).toBe(10);
      expect(resChupei.allocatedCount).toBe(3);
      expect(resChupei.availableStock).toBe(7); // 10 - 3 = 7
      expect(resChupei.isOverAllocated).toBe(false);

      // 2. 測試特定門市 (超配門市 jinshan: stock 5, alloc 7)
      const resJinshan = calculateLiveStockItem(prod, stockMapCopy, allocMapCopy, 'jinshan');
      expect(resJinshan.stock).toBe(5);
      expect(resJinshan.allocatedCount).toBe(7);
      expect(resJinshan.availableStock).toBe(0); // Math.max(0, 5 - 7) = 0, 絕不為負數
      expect(resJinshan.isOverAllocated).toBe(true);

      // 3. 測試全門市彙整 ('ALL')
      const resAll = calculateLiveStockItem(prod, stockMapCopy, allocMapCopy, 'ALL');
      expect(resAll.totalStock).toBe(15);
      expect(resAll.totalAllocated).toBe(10);
      expect(resAll.stock).toBe(15);
      expect(resAll.allocatedCount).toBe(10);
      expect(resAll.availableStock).toBe(5); // 15 - 10 = 5
      expect(resAll.isOverAllocated).toBe(false);

      // 4. 驗證輸入參數未被修改
      expect(stockMapCopy).toEqual(originalStockMap);
      expect(allocMapCopy).toEqual(originalAllocMap);
    });

    it('Empirical Test 2.4: calculateLiveStockItem Edge Cases (empty, missing, negative stocks)', () => {
      const prod = { id: 'EDGE-01', name: '邊界商品' };

      // 1. 空映射
      const emptyRes = calculateLiveStockItem(prod, {}, {});
      expect(emptyRes.totalStock).toBe(0);
      expect(emptyRes.totalAllocated).toBe(0);
      expect(emptyRes.availableStock).toBe(0);
      expect(emptyRes.isOverAllocated).toBe(false);

      // 2. 門市存在於 allocMap 但不存在於 stockMap (庫存為 0 但被分配)
      const disjoinedRes = calculateLiveStockItem(prod, { chupei: 5 }, { jinshan: 2 }, 'jinshan');
      expect(disjoinedRes.stock).toBe(0);
      expect(disjoinedRes.allocatedCount).toBe(2);
      expect(disjoinedRes.availableStock).toBe(0);
      expect(disjoinedRes.isOverAllocated).toBe(true);

      // 3. 負庫存防禦
      const negativeStockRes = calculateLiveStockItem(prod, { chupei: -3 }, { chupei: 2 }, 'chupei');
      expect(negativeStockRes.stock).toBe(-3);
      expect(negativeStockRes.allocatedCount).toBe(2);
      expect(negativeStockRes.availableStock).toBe(0); // Math.max(0, -3 - 2) = 0
      expect(negativeStockRes.isOverAllocated).toBe(true);
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // INVARIANT #3: 多商品併發鎖序字典序防死鎖不變量 (Deterministic Lock Ordering)
  // ══════════════════════════════════════════════════════════════════
  describe('Invariant #3 Empirical Verification: sortProductIdsForLock Adversarial Stress', () => {
    it('Empirical Test 3.1: Strict Determinism under 100 Random Permutations', () => {
      // 50 個混合格式的商品 ID
      const baseProductIds = [
        'GK-001',
        'GK-002',
        'GK-003',
        '3233',
        '2880',
        '100',
        '2',
        '20',
        'A_FIGURE',
        'B_FIGURE',
        'Z_FIGURE',
        'alpha',
        'beta',
        'omega',
        '海賊王_魯夫',
        '鬼滅之刃_炭治郎',
        '七龍珠_悟空',
        'PROD#01',
        'PROD@02',
        'PROD$03',
        'SKU-999',
        'SKU-000',
      ];

      // 取得基準排序結果
      const canonicalSorted = sortProductIdsForLock(baseProductIds);
      expect(canonicalSorted.length).toBe(baseProductIds.length);

      // 執行 100 次隨機洗牌並驗證排序結果完全一致
      for (let i = 0; i < 100; i++) {
        const shuffled = [...baseProductIds].sort(() => Math.random() - 0.5);
        const result = sortProductIdsForLock(shuffled);
        expect(result).toEqual(canonicalSorted);
      }
    });

    it('Empirical Test 3.2: Reverse Order Idempotency and Inversion Defense', () => {
      const ascending = ['A01', 'A02', 'B01', 'B02', 'C01', 'Z99'];
      const descending = [...ascending].reverse();

      const sortedFromAsc = sortProductIdsForLock(ascending);
      const sortedFromDesc = sortProductIdsForLock(descending);

      expect(sortedFromAsc).toEqual(ascending);
      expect(sortedFromDesc).toEqual(ascending);
      expect(sortedFromAsc).toEqual(sortedFromDesc);
    });

    it('Empirical Test 3.3: Massive Duplicates Deduplication & Stability', () => {
      // 1000 個高重複性陣列
      const duplicatesInput = Array.from({ length: 1000 }, (_, idx) => {
        const idList = ['GK003', 'GK001', 'GK002', 'GK001', 'GK003'];
        return idList[idx % idList.length];
      });

      const result = sortProductIdsForLock(duplicatesInput);
      expect(result).toEqual(['GK001', 'GK002', 'GK003']);
    });

    it('Empirical Test 3.4: Adversarial Falsy, Nulls, Undefineds, and Whitespace', () => {
      const adversarialInput = [
        null,
        undefined,
        '',
        '   ',
        '\t',
        '\n',
        null,
        undefined,
        '  \r\n  ',
      ];

      const result = sortProductIdsForLock(adversarialInput);
      expect(result).toEqual([]);
    });

    it('Empirical Test 3.5: Mixed Chaos Input with Symbols, Unicode, Numbers and Nulls', () => {
      const chaosInput = [
        null,
        '海賊王_索隆',
        'GK002',
        '',
        '3233',
        undefined,
        'GK001',
        '海賊王_索隆', // 重複中文
        'GK002',      // 重複英數
        '#SPECIAL',
        '2',
        '10',
        '   ',
        '@SYMBOL',
      ];

      const result = sortProductIdsForLock(chaosInput);

      // 驗證無 null/undefined/空字串
      expect(result.every((id) => typeof id === 'string' && id.trim().length > 0)).toBe(true);

      // 驗證去重
      const uniqueSet = new Set(result);
      expect(uniqueSet.size).toBe(result.length);

      // 驗證相鄰元素之嚴格字典序 (localeCompare <= 0)
      for (let i = 0; i < result.length - 1; i++) {
        const cmp = result[i].localeCompare(result[i + 1]);
        expect(cmp).toBeLessThan(0);
      }
    });

    it('Empirical Test 3.6: Concurrent Multi-Thread/Process Lock Order Emulation', async () => {
      // 模擬 10 個並發結帳/開套線程以不同隨機順序鎖定相同 5 隻商品
      const targetItems = ['GK005', 'GK001', 'GK004', 'GK002', 'GK003'];
      const concurrency = 10;

      const runConcurrentLockSimulation = async (threadId: number) => {
        // 洗牌輸入
        const threadInput = [...targetItems].sort(() => Math.random() - 0.5);
        const lockOrder = sortProductIdsForLock(threadInput);
        return { threadId, lockOrder };
      };

      const results = await Promise.all(
        Array.from({ length: concurrency }, (_, i) => runConcurrentLockSimulation(i))
      );

      const canonical = ['GK001', 'GK002', 'GK003', 'GK004', 'GK005'];
      results.forEach(({ lockOrder }) => {
        // 🚨 斷言：所有並發線程鎖定的商品 ID 順序 100% 絕對一致，杜絕任何交叉死鎖環
        expect(lockOrder).toEqual(canonical);
      });
    });
  });
});
