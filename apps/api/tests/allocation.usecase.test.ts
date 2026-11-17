import { describe, it, expect, beforeEach } from 'vitest';
import {
  AllocationUseCase,
  InMemoryLuckyBagRepository,
  InMemoryInventoryRepository,
  InMemoryTransactionManager,
  Product,
  StoreInventory,
  LuckyBag,
  LuckyBagPrize,
  PrizeAllocationPlan,
} from '../src';
import { isOk, isErr } from '@onesoul/shared';

describe('AllocationUseCase', () => {
  let allocationUseCase: AllocationUseCase;
  let luckyBagRepo: InMemoryLuckyBagRepository;
  let invRepo: InMemoryInventoryRepository;
  let txManager: InMemoryTransactionManager;

  beforeEach(async () => {
    luckyBagRepo = new InMemoryLuckyBagRepository();
    invRepo = new InMemoryInventoryRepository();
    txManager = new InMemoryTransactionManager();

    txManager.register(luckyBagRepo);
    txManager.register(invRepo);

    allocationUseCase = new AllocationUseCase(luckyBagRepo, invRepo, txManager);

    // Seed products
    await invRepo.saveProduct(
      new Product({
        id: 'GK-4100',
        name: 'GK 索隆 阿修羅',
        category: 'GK',
        costPrice: 2000,
        sellingPrice: 3800,
      })
    );
    await invRepo.saveProduct(
      new Product({
        id: 'GK-4101',
        name: 'GK 魯夫 ギア4',
        category: 'GK',
        costPrice: 2200,
        sellingPrice: 4200,
      })
    );
    await invRepo.saveProduct(
      new Product({
        id: 'BLIND-001',
        name: '海賊王盲盒系列',
        category: 'BLIND_BOX',
        costPrice: 150,
        sellingPrice: 250,
      })
    );

    // Seed inventories
    await invRepo.save(
      new StoreInventory({ id: 'inv-1', storeId: 'chupei', productId: 'GK-4100', quantity: 3 })
    );
    await invRepo.save(
      new StoreInventory({ id: 'inv-2', storeId: 'chupei', productId: 'GK-4101', quantity: 1 })
    );
    await invRepo.save(
      new StoreInventory({ id: 'inv-3', storeId: 'chupei', productId: 'BLIND-001', quantity: 20 })
    );
  });

  describe('1. LiveStockRadar Calculation (現貨雷達動態試算)', () => {
    it('calculates allocatedCount and availableStock dynamically without deducting inventory', async () => {
      // Create an active lucky bag occupying 2 units of GK-4100
      await luckyBagRepo.saveBagWithPrizes(
        new LuckyBag({ id: 'lb-1', storeId: 'chupei', name: '全明星大賞', unitPrice: 350 }),
        [
          new LuckyBagPrize({
            id: 'prz-1',
            bagId: 'lb-1',
            prizeGrade: 'A',
            prizeName: 'GK 索隆 阿修羅',
            productId: 'GK-4100',
            draws: 2,
            drawnCount: 0,
          }),
        ]
      );

      const res = await allocationUseCase.calculateLiveStockRadar('chupei');
      expect(isOk(res)).toBe(true);
      if (!isOk(res)) return;

      const zoro = res.data.find((item) => item.id === 'GK-4100');
      expect(zoro).toBeDefined();
      expect(zoro?.stock).toBe(3); // 實體庫存 3 件
      expect(zoro?.allocatedCount).toBe(2); // 在場套組占用 2 抽
      expect(zoro?.availableStock).toBe(1); // 可配現貨 = 3 - 2 = 1 件
      expect(zoro?.isOverAllocated).toBe(false);

      // GK-4101 has 1 stock and 0 allocated
      const luffy = res.data.find((item) => item.id === 'GK-4101');
      expect(luffy?.stock).toBe(1);
      expect(luffy?.allocatedCount).toBe(0);
      expect(luffy?.availableStock).toBe(1);
    });

    it('flags isOverAllocated when allocated count exceeds stock', async () => {
      // Allocate 2 units of GK-4101 when store only has 1 unit
      await luckyBagRepo.saveBagWithPrizes(
        new LuckyBag({ id: 'lb-2', storeId: 'chupei', name: '超配套組', unitPrice: 350 }),
        [
          new LuckyBagPrize({
            id: 'prz-2',
            bagId: 'lb-2',
            prizeGrade: 'A',
            prizeName: 'GK 魯夫 ギア4',
            productId: 'GK-4101',
            draws: 2,
            drawnCount: 0,
          }),
        ]
      );

      const res = await allocationUseCase.calculateLiveStockRadar('chupei');
      expect(isOk(res)).toBe(true);
      if (!isOk(res)) return;

      const luffy = res.data.find((item) => item.id === 'GK-4101');
      expect(luffy?.stock).toBe(1);
      expect(luffy?.allocatedCount).toBe(2);
      expect(luffy?.availableStock).toBe(0); // max(0, 1 - 2) = 0
      expect(luffy?.isOverAllocated).toBe(true);
    });

    it('filters radar items by category, query search, and minQty', async () => {
      const resCategory = await allocationUseCase.calculateLiveStockRadar('chupei', {
        category: 'GK',
      });
      expect(isOk(resCategory)).toBe(true);
      if (isOk(resCategory)) {
        expect(resCategory.data.every((it) => it.category === 'GK')).toBe(true);
      }

      const resSearch = await allocationUseCase.calculateLiveStockRadar('chupei', {
        q: '阿修羅',
      });
      expect(isOk(resSearch)).toBe(true);
      if (isOk(resSearch)) {
        expect(resSearch.data.length).toBe(1);
        expect(resSearch.data[0].id).toBe('GK-4100');
      }

      const resMinQty = await allocationUseCase.calculateLiveStockRadar('chupei', {
        minQty: 10,
      });
      expect(isOk(resMinQty)).toBe(true);
      if (isOk(resMinQty)) {
        expect(resMinQty.data.length).toBe(1);
        expect(resMinQty.data[0].id).toBe('BLIND-001');
      }
    });
  });

  describe('2. Invariant #2: Publish LuckyBag Plans', () => {
    it('publishes set without deducting StoreInventory and injects small prize points', async () => {
      const initialInv = await invRepo.findByStoreAndProduct('chupei', 'GK-4100');
      expect(initialInv?.quantity).toBe(3);

      const planCommand = {
        storeId: 'chupei',
        name: '海賊王 GK 旗艦套組',
        totalDraws: 80,
        unitPrice: 350,
        batchCount: 2,
        blindBoxPoints: 10,
        items: [
          { grade: 'A', name: 'GK 索隆 阿修羅', productId: 'GK-4100', draws: 1, cost: 2000 },
          { grade: 'B', name: 'GK 魯夫 ギア4', productId: 'GK-4101', draws: 1, cost: 2200 },
          { grade: 'X', name: '盲盒賞', productId: null, draws: 20, isNonGk: true },
          { grade: 'Z', name: '保底小賞', productId: null, draws: 58, isNonGk: true },
        ],
      };

      const res = await allocationUseCase.publishPlan(planCommand);
      expect(isOk(res)).toBe(true);
      if (!isOk(res)) return;

      expect(res.data.publishedCount).toBe(2);
      expect(res.data.bagIds.length).toBe(2);

      // Verify StoreInventory was NOT pre-deducted!
      const afterInv = await invRepo.findByStoreAndProduct('chupei', 'GK-4100');
      expect(afterInv?.quantity).toBe(3); // strictly untouched!

      // Verify prizes in published bag
      const prizes = await luckyBagRepo.findPrizesByBagId(res.data.bagIds[0]);
      expect(prizes.length).toBe(4);

      const prizeX = prizes.find((p) => p.prizeGrade === 'X');
      expect(prizeX?.points).toBe(10); // default injected 10 points

      const prizeZ = prizes.find((p) => p.prizeGrade === 'Z');
      expect(prizeZ?.points).toBe(1); // default injected 1 point
    });

    it('rejects publishing plans when sum of draws does not equal totalDraws', async () => {
      const res = await allocationUseCase.publishPlan({
        storeId: 'chupei',
        name: '錯誤套組',
        totalDraws: 80,
        unitPrice: 350,
        items: [
          { grade: 'A', name: 'GK 索隆', productId: 'GK-4100', draws: 1 },
          { grade: 'Z', name: '保底', productId: null, draws: 50, isNonGk: true },
        ],
      });

      expect(isErr(res)).toBe(true);
    });
  });

  describe('3. Plan Drafts & Financials', () => {
    it('saves and deletes allocation plan drafts', async () => {
      const plan = new PrizeAllocationPlan({
        id: 'plan-draft-001',
        storeId: 'chupei',
        name: '七龍珠特別套草稿',
        totalDraws: 80,
        unitPrice: 300,
        items: [
          { grade: 'A', name: '孫悟空', productId: 'GK-4100', draws: 1, points: 0, cost: 2000 },
        ],
      });

      const saveRes = await allocationUseCase.savePlanDraft(plan);
      expect(isOk(saveRes)).toBe(true);

      const found = await luckyBagRepo.findPlanById('plan-draft-001');
      expect(found).not.toBeNull();
      expect(found?.name).toBe('七龍珠特別套草稿');

      const delRes = await allocationUseCase.deletePlanDraft('plan-draft-001');
      expect(isOk(delRes)).toBe(true);

      const afterDel = await luckyBagRepo.findPlanById('plan-draft-001');
      expect(afterDel).toBeNull();
    });

    it('accurately calculates financial summary (revenue, cost, margin, breakeven)', () => {
      // 80 draws * $350 = $28,000 revenue
      // Cost: 1 * 2000 + 1 * 2200 + 20 * 150 + 58 * 50 = 2000 + 2200 + 3000 + 2900 = $10,100
      // Gross Profit: 28000 - 10100 = $17,900
      // Margin Rate: 17900 / 28000 = 63.93%
      // Breakeven Draws: ceil(10100 / 350) = 29 draws
      const result = allocationUseCase.calculateFinancials(80, 350, [
        { costPrice: 2000, draws: 1 },
        { costPrice: 2200, draws: 1 },
        { costPrice: 150, draws: 20 },
        { costPrice: 50, draws: 58 },
      ]);

      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      expect(result.data.totalRevenue).toBe(28000);
      expect(result.data.totalCost).toBe(10100);
      expect(result.data.grossProfit).toBe(17900);
      expect(result.data.marginRate).toBe(63.93);
      expect(result.data.breakevenDraws).toBe(29);
      expect(result.data.isHealthy).toBe(true);
    });
  });
});
