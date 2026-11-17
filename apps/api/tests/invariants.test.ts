import { describe, it, expect, beforeEach } from 'vitest';
import {
  PhoneNumber,
  StoreInventory,
  Product,
  Member,
  LuckyBag,
  LuckyBagPrize,
  validateWalkInBlock,
  validateLuckyBagPublish,
  resolveSmallPrizePoints,
  calculatePointsSetCost,
  validatePointsSetOrder,
  sortProductIdsForLock,
  InMemoryTransactionManager,
  InMemoryInventoryRepository,
  InMemoryMemberRepository,
  InMemoryLuckyBagRepository,
} from '../src';
import {
  InvariantViolationError,
  InsufficientStockError,
} from '@onesoul/shared';

describe('Domain Business Invariants & Anti-Deadlock Guarantees', () => {
  describe('🚨 Invariant #1: Walk-In Customer Block (散客點數零容忍阻斷)', () => {
    it('blocks walk-in customers from using points in payment', () => {
      const walkIn = new PhoneNumber('111111');
      expect(walkIn.isWalkIn).toBe(true);

      expect(() => {
        validateWalkInBlock(walkIn, {
          cash: 100,
          creditCard: 0,
          linePay: 0,
          remittance: 0,
          pointsUsed: 50,
        });
      }).toThrow(InvariantViolationError);
    });

    it('blocks walk-in customers from drawing points sets or lottery items with pointsCost', () => {
      const walkIn = new PhoneNumber('散客');
      expect(walkIn.isWalkIn).toBe(true);

      expect(() => {
        validateWalkInBlock(
          walkIn,
          { cash: 0, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
          [{ type: '點數', pointsCost: 20 }]
        );
      }).toThrow(InvariantViolationError);

      expect(() => {
        validateWalkInBlock(
          walkIn,
          { cash: 0, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
          [{ isPointsSet: true }]
        );
      }).toThrow(InvariantViolationError);
    });

    it('blocks walk-in customers from purchasing merchandises using points', () => {
      const walkIn = new PhoneNumber('WALKIN');
      expect(walkIn.isWalkIn).toBe(true);

      expect(() => {
        validateWalkInBlock(
          walkIn,
          { cash: 0, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
          [],
          [{ paymentType: '點數', totalPoints: 100 }]
        );
      }).toThrow(InvariantViolationError);
    });

    it('permits registered members with regular phone numbers to use points', () => {
      const memberPhone = new PhoneNumber('0912345678');
      expect(memberPhone.isWalkIn).toBe(false);

      expect(() => {
        validateWalkInBlock(
          memberPhone,
          { cash: 100, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 50 },
          [{ type: '帶走', pointsCost: 0 }],
          [{ paymentType: '現金', totalPoints: 0 }]
        );
      }).not.toThrow();
    });
  });

  describe('🚨 Invariant #2: LuckyBag Publish Does Not Pre-Deduct Inventory (開套不預扣庫存)', () => {
    it('validates total draws and requires at least 1 physical GK grand prize', () => {
      // Missing physical GK grand prize
      expect(() => {
        validateLuckyBagPublish({
          totalDraws: 80,
          items: [
            { grade: 'X', draws: 40, isNonGk: true },
            { grade: 'Z', draws: 40, isNonGk: true },
          ],
        });
      }).toThrow(InvariantViolationError);

      // Sum of draws mismatch
      expect(() => {
        validateLuckyBagPublish({
          totalDraws: 80,
          items: [
            { grade: 'A', draws: 1, productId: 'GK-4100' },
            { grade: 'Z', draws: 50, isNonGk: true },
          ],
        });
      }).toThrow(InvariantViolationError);

      // Valid plan with physical GK and matching sum of draws
      expect(() => {
        validateLuckyBagPublish({
          totalDraws: 80,
          items: [
            { grade: 'A', draws: 1, productId: 'GK-4100' },
            { grade: 'B', draws: 2, productId: 'GK-4101' },
            { grade: 'X', draws: 20, productId: null, isNonGk: true },
            { grade: 'Z', draws: 57, productId: null, isNonGk: true },
          ],
        });
      }).not.toThrow();
    });

    it('injects default points: X = 10P, Z = 1P', () => {
      expect(resolveSmallPrizePoints('X')).toBe(10);
      expect(resolveSmallPrizePoints('x')).toBe(10);
      expect(resolveSmallPrizePoints('Z')).toBe(1);
      expect(resolveSmallPrizePoints('z')).toBe(1);
      expect(resolveSmallPrizePoints('F', null, 10, true)).toBe(1); // non-GK small prize
      expect(resolveSmallPrizePoints('X', 15)).toBe(15); // custom override
    });

    it('enforces points set rules: amount = $0, pointsCost = floor(unitPrice / 20) * draws', () => {
      expect(calculatePointsSetCost(350, 1)).toBe(17);
      expect(calculatePointsSetCost(350, 3)).toBe(51);

      expect(() => {
        validatePointsSetOrder(true, 350, 1, 100, 17); // amount !== 0
      }).toThrow(InvariantViolationError);

      expect(() => {
        validatePointsSetOrder(true, 350, 1, 0, 20); // pointsCost mismatch
      }).toThrow(InvariantViolationError);

      expect(() => {
        validatePointsSetOrder(true, 350, 2, 0, 34); // valid
      }).not.toThrow();
    });
  });

  describe('🚨 Invariant #3: Anti-Deadlock Sorted Lock Order (多商品字典序防死鎖)', () => {
    it('sorts product IDs strictly using localeCompare and deduplicates', () => {
      const unsorted = ['GK-999', 'GK-001', 'GK-500', 'GK-001', null, 'GK-100', undefined];
      const sorted = sortProductIdsForLock(unsorted);

      expect(sorted).toEqual(['GK-001', 'GK-100', 'GK-500', 'GK-999']);
    });
  });

  describe('Transactional Atomic Rollback Behavior', () => {
    let txManager: InMemoryTransactionManager;
    let invRepo: InMemoryInventoryRepository;
    let memberRepo: InMemoryMemberRepository;
    let luckyBagRepo: InMemoryLuckyBagRepository;

    beforeEach(async () => {
      txManager = new InMemoryTransactionManager();
      invRepo = new InMemoryInventoryRepository();
      memberRepo = new InMemoryMemberRepository();
      luckyBagRepo = new InMemoryLuckyBagRepository();

      txManager.register(invRepo);
      txManager.register(memberRepo);
      txManager.register(luckyBagRepo);

      // Seed data
      await invRepo.saveProduct(
        new Product({ id: 'GK-4100', name: '大賞 GK 雕像 A', costPrice: 2000, sellingPrice: 3500 })
      );
      await invRepo.save(
        new StoreInventory({ id: 'inv-1', storeId: 'chupei', productId: 'GK-4100', quantity: 2 })
      );

      await memberRepo.save(
        new Member({ id: 'mem-1', phone: '0912345678', name: '王小明', points: 100 })
      );

      await luckyBagRepo.saveBagWithPrizes(
        new LuckyBag({ id: 'lb-1', storeId: 'chupei', name: '一番賞海賊王', unitPrice: 300 }),
        [
          new LuckyBagPrize({
            id: 'prz-1',
            bagId: 'lb-1',
            prizeGrade: 'A',
            prizeName: '大賞 GK 雕像 A',
            productId: 'GK-4100',
            draws: 1,
            drawnCount: 0,
          }),
        ]
      );
    });

    it('rolls back all modifications across repositories when a transaction fails midway', async () => {
      const initialMember = await memberRepo.findById('mem-1');
      const initialInv = await invRepo.findByStoreAndProduct('chupei', 'GK-4100');
      const initialPrize = await luckyBagRepo.findPrize('lb-1', 'A');

      expect(initialMember?.points).toBe(100);
      expect(initialInv?.quantity).toBe(2);
      expect(initialPrize?.drawnCount).toBe(0);

      // Execute transaction that deducts member points and prize draws, then fails due to insufficient inventory
      await expect(
        txManager.runInTransaction(async () => {
          // 1. Member points deducted
          const member = await memberRepo.findById('mem-1');
          member!.adjustPoints(-50);
          await memberRepo.save(member!);

          // 2. Prize drawn
          await luckyBagRepo.incrementDrawnCount('lb-1', 'A', 1);

          // 3. Fails: attempts to deduct 5 units from inventory with quantity = 2
          await invRepo.deductQuantities('chupei', [{ productId: 'GK-4100', quantity: 5 }]);
        })
      ).rejects.toThrow(InsufficientStockError);

      // Verify that state in ALL repositories rolled back to original
      const restoredMember = await memberRepo.findById('mem-1');
      const restoredInv = await invRepo.findByStoreAndProduct('chupei', 'GK-4100');
      const restoredPrize = await luckyBagRepo.findPrize('lb-1', 'A');

      expect(restoredMember?.points).toBe(100);
      expect(restoredInv?.quantity).toBe(2);
      expect(restoredPrize?.drawnCount).toBe(0);
    });
  });
});
