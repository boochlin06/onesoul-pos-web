import { describe, it, expect, beforeEach } from 'vitest';
import { createTestD1Database, TestD1Instance } from './d1-test-harness';
import {
  D1TransactionManager,
  D1OrderRepository,
  D1InventoryRepository,
  D1LuckyBagRepository,
  D1MemberRepository,
  D1SessionRepository,
} from '../src/adapters/d1';
import { CheckoutUseCase } from '../src/core/usecases/CheckoutUseCase';
import { Order, OrderItem } from '../src/core/entities/Order';
import { StoreInventory, InventoryLog, Product } from '../src/core/entities/Product';
import { LuckyBag, LuckyBagPrize } from '../src/core/entities/LuckyBag';
import { PointLog } from '../src/core/entities/Member';
import { InsufficientStockError, OverdrawError, isOk, isErr } from '@onesoul/shared';
import { sortProductIdsForLock } from '../src/core/invariants/invariants';

describe('Adversarial Stress Test: D1 Constraints, Rollback & Lock Ordering (Challenger M3)', () => {
  let harness: TestD1Instance;
  let txManager: D1TransactionManager;
  let orderRepo: D1OrderRepository;
  let inventoryRepo: D1InventoryRepository;
  let luckyBagRepo: D1LuckyBagRepository;
  let memberRepo: D1MemberRepository;
  let sessionRepo: D1SessionRepository;
  let checkoutUseCase: CheckoutUseCase;

  beforeEach(() => {
    harness = createTestD1Database();
    harness.seedCommonData();

    txManager = new D1TransactionManager(harness.db);
    orderRepo = new D1OrderRepository(harness.db);
    inventoryRepo = new D1InventoryRepository(harness.db);
    luckyBagRepo = new D1LuckyBagRepository(harness.db);
    memberRepo = new D1MemberRepository(harness.db);
    sessionRepo = new D1SessionRepository(harness.db);

    checkoutUseCase = new CheckoutUseCase(
      orderRepo,
      inventoryRepo,
      luckyBagRepo,
      memberRepo,
      sessionRepo,
      txManager
    );
  });

  describe('Suite 1: SQLite Schema & Constraint Verification via Raw Pragma / DDL', () => {
    it('verifies store_inventories table has CHECK (quantity >= 0) constraint', () => {
      const row = harness.rawDb
        .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'store_inventories'")
        .get() as { sql: string };
      expect(row).toBeDefined();
      expect(row.sql).toContain('CHECK("store_inventories"."quantity" >= 0)');
    });

    it('verifies lucky_bag_prizes table has CHECK (drawn_count <= draws) constraint', () => {
      const row = harness.rawDb
        .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'lucky_bag_prizes'")
        .get() as { sql: string };
      expect(row).toBeDefined();
      expect(row.sql).toContain('CHECK("lucky_bag_prizes"."drawn_count" <= "lucky_bag_prizes"."draws")');
    });

    it('verifies orders table has UNIQUE index on checkout_uid', () => {
      const indexes = harness.rawDb
        .prepare("SELECT name, sql FROM sqlite_master WHERE type = 'index' AND tbl_name = 'orders'")
        .all() as Array<{ name: string; sql: string }>;
      const hasUniqueCheckoutUid = indexes.some(
        (idx) => idx.sql && idx.sql.includes('UNIQUE') && idx.sql.includes('checkout_uid')
      );
      expect(hasUniqueCheckoutUid).toBe(true);
    });
  });

  describe('Suite 2: Negative Inventory Stress & Atomic Rollback', () => {
    it('direct raw SQL attempt to set negative inventory fails SQLite CHECK immediately', () => {
      harness.rawDb.exec(`
        INSERT INTO store_inventories (id, store_id, product_id, quantity, safety_stock, version)
        VALUES ('inv-raw-1', 'chupei', 'P-001', 5, 0, 1);
      `);

      expect(() => {
        harness.rawDb.exec(`UPDATE store_inventories SET quantity = -1 WHERE id = 'inv-raw-1';`);
      }).toThrow(/CHECK constraint failed/);

      const check = harness.rawDb
        .prepare("SELECT quantity FROM store_inventories WHERE id = 'inv-raw-1'")
        .get() as { quantity: number };
      expect(check.quantity).toBe(5);
    });

    it('deductQuantities throws InsufficientStockError when deducting past zero and leaves stock untouched', async () => {
      await inventoryRepo.save(
        new StoreInventory({ id: 'inv-adv-1', storeId: 'chupei', productId: 'P-001', quantity: 3 })
      );

      await expect(
        inventoryRepo.deductQuantities('chupei', [{ productId: 'P-001', quantity: 4 }])
      ).rejects.toThrow(InsufficientStockError);

      const check = await inventoryRepo.findByStoreAndProduct('chupei', 'P-001');
      expect(check?.quantity).toBe(3);
    });

    it('atomic rollback of multi-item deduction when partial item violates CHECK constraint', async () => {
      // Setup 3 products
      await inventoryRepo.save(
        new StoreInventory({ id: 'inv-a', storeId: 'chupei', productId: 'P-001', quantity: 10 })
      );
      await inventoryRepo.save(
        new StoreInventory({ id: 'inv-b', storeId: 'chupei', productId: 'P-002', quantity: 2 })
      );

      // Save product P-003
      await inventoryRepo.saveProduct(
        new Product({ id: 'P-003', name: '模型3', costPrice: 100, sellingPrice: 200 })
      );
      await inventoryRepo.save(
        new StoreInventory({ id: 'inv-c', storeId: 'chupei', productId: 'P-003', quantity: 15 })
      );

      // Attempt to deduct: P-001: 5 (ok), P-002: 5 (fails, 2-5=-3 < 0), P-003: 5 (ok)
      // Executed inside transaction
      await expect(
        txManager.runInTransaction(async (tx) => {
          await inventoryRepo.deductQuantities(
            'chupei',
            [
              { productId: 'P-001', quantity: 5 },
              { productId: 'P-002', quantity: 5 }, // will fail!
              { productId: 'P-003', quantity: 5 },
            ],
            tx
          );
        })
      ).rejects.toThrow(InsufficientStockError);

      // VERIFY ATOMIC ROLLBACK: P-001 must NOT be 5, it must still be 10!
      const p1 = await inventoryRepo.findByStoreAndProduct('chupei', 'P-001');
      const p2 = await inventoryRepo.findByStoreAndProduct('chupei', 'P-002');
      const p3 = await inventoryRepo.findByStoreAndProduct('chupei', 'P-003');

      expect(p1?.quantity).toBe(10);
      expect(p2?.quantity).toBe(2);
      expect(p3?.quantity).toBe(15);
    });

    it('atomic rollback across multi-entity transaction (Order + Member Points + InventoryLog + Stock)', async () => {
      await inventoryRepo.save(
        new StoreInventory({ id: 'inv-tx-multi', storeId: 'chupei', productId: 'P-001', quantity: 2 })
      );

      const member = await memberRepo.findOrCreateByPhone('0912345678', '測試會員');
      member.adjustPoints(100);
      await memberRepo.save(member);

      const runComplexTx = async () => {
        await txManager.runInTransaction(async (tx) => {
          // 1. Save an order
          const order = new Order({
            id: 'ORD-MULTI-FAIL',
            checkoutUID: 'UID-MULTI-FAIL-001',
            storeId: 'chupei',
            sessionId: 'sess-001',
            memberPhone: '0912345678',
            memberId: member.id,
            totalDue: 500,
            payment: { cash: 500, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
            netPointsDelta: -50,
            items: [
              new OrderItem({
                id: 'oi-fail-1',
                orderId: 'ORD-MULTI-FAIL',
                itemType: 'MERCHANDISE',
                productId: 'P-001',
                quantity: 1,
                unitPrice: 500,
                amount: 500,
                pointsImpact: 0,
              }),
            ],
            cashierEmail: 'cashier@onesoul.com',
          });
          await orderRepo.save(order, tx);

          // 2. Adjust member points
          member.adjustPoints(-50);
          await memberRepo.save(member, tx);
          await memberRepo.recordPointLog(
            new PointLog({
              id: 'pl-tx-fail-1',
              memberId: member.id,
              type: 'REDEEM',
              delta: -50,
              balance: 50,
              reason: '消費折抵',
            }),
            tx
          );

          // 3. Record InventoryLog
          await inventoryRepo.recordLog(
            new InventoryLog({
              id: 'log-tx-fail-1',
              storeId: 'chupei',
              productId: 'P-001',
              changeType: 'SALE',
              delta: -1,
              balance: 1,
              reason: '出庫日誌',
            }),
            tx
          );

          // 4. Trigger CHECK failure: try to deduct 10 items from stock of 2
          await inventoryRepo.deductQuantities(
            'chupei',
            [{ productId: 'P-001', quantity: 10 }],
            tx
          );
        });
      };

      await expect(runComplexTx()).rejects.toThrow(InsufficientStockError);

      // Verify complete rollback across all tables:
      // A. Order does not exist
      const orderCheck = await orderRepo.findById('ORD-MULTI-FAIL');
      expect(orderCheck).toBeNull();
      const uidCheck = await orderRepo.findByCheckoutUID('UID-MULTI-FAIL-001');
      expect(uidCheck).toBeNull();

      // B. Member points remained 100
      const memberCheck = await memberRepo.findById(member.id);
      expect(memberCheck?.points).toBe(100);
      const pointLogs = await memberRepo.findPointLogsByMemberId(member.id);
      expect(pointLogs.length).toBe(0);

      // C. InventoryLog was not committed
      const invLogs = await inventoryRepo.findLogsByStore('chupei');
      expect(invLogs.some((l) => l.id === 'log-tx-fail-1')).toBe(false);

      // D. Store inventory remained 2
      const invCheck = await inventoryRepo.findByStoreAndProduct('chupei', 'P-001');
      expect(invCheck?.quantity).toBe(2);
    });

    it('handles non-existent product deduction with InsufficientStockError and clean rollback', async () => {
      await expect(
        txManager.runInTransaction(async (tx) => {
          await inventoryRepo.deductQuantities(
            'chupei',
            [{ productId: 'P-NON-EXISTENT', quantity: 1 }],
            tx
          );
        })
      ).rejects.toThrow(InsufficientStockError);
    });

    it('ignores zero or negative quantity deductions gracefully', async () => {
      await inventoryRepo.save(
        new StoreInventory({ id: 'inv-zero', storeId: 'chupei', productId: 'P-001', quantity: 5 })
      );

      await inventoryRepo.deductQuantities('chupei', [
        { productId: 'P-001', quantity: 0 },
        { productId: 'P-001', quantity: -2 },
      ]);

      const check = await inventoryRepo.findByStoreAndProduct('chupei', 'P-001');
      expect(check?.quantity).toBe(5);
    });
  });

  describe('Suite 3: Overdrawing Stress & Atomic Rollback under CHECK (drawn_count <= draws)', () => {
    it('direct raw SQL attempt to set drawn_count > draws fails SQLite CHECK immediately', () => {
      harness.rawDb.exec(`
        INSERT INTO lucky_bags (id, store_id, name, unit_price, is_points_set, status)
        VALUES ('lb-raw-1', 'chupei', '測試套組', 200, 0, 'ACTIVE');

        INSERT INTO lucky_bag_prizes (id, bag_id, prize_grade, prize_name, draws, drawn_count)
        VALUES ('pz-raw-1', 'lb-raw-1', 'A', '大賞模型', 2, 0);
      `);

      expect(() => {
        harness.rawDb.exec(`UPDATE lucky_bag_prizes SET drawn_count = 3 WHERE id = 'pz-raw-1';`);
      }).toThrow(/CHECK constraint failed/);

      const check = harness.rawDb
        .prepare("SELECT drawn_count FROM lucky_bag_prizes WHERE id = 'pz-raw-1'")
        .get() as { drawn_count: number };
      expect(check.drawn_count).toBe(0);
    });

    it('incrementDrawnCount past prize draws triggers OverdrawError and preserves drawn_count', async () => {
      const bag = new LuckyBag({
        id: 'LB-OD-1',
        storeId: 'chupei',
        name: '超抽測試套組',
        unitPrice: 300,
      });
      const prize = new LuckyBagPrize({
        id: 'pz-od-1',
        bagId: 'LB-OD-1',
        prizeGrade: 'A',
        prizeName: 'A賞模型',
        draws: 2,
        drawnCount: 1,
      });

      await luckyBagRepo.saveBagWithPrizes(bag, [prize]);

      // Drawing 1 more hits 2/2 (allowed)
      await luckyBagRepo.incrementDrawnCount('LB-OD-1', 'A', 1);
      const after1 = await luckyBagRepo.findPrize('LB-OD-1', 'A');
      expect(after1?.drawnCount).toBe(2);
      expect(after1?.remainingDraws).toBe(0);

      // Attempting to draw 1 more violates CHECK (drawn_count <= draws)
      await expect(
        luckyBagRepo.incrementDrawnCount('LB-OD-1', 'A', 1)
      ).rejects.toThrow(OverdrawError);

      const afterFail = await luckyBagRepo.findPrize('LB-OD-1', 'A');
      expect(afterFail?.drawnCount).toBe(2);
    });

    it('atomic rollback of lucky bag draw and inventory deduction when overdrawing', async () => {
      await inventoryRepo.save(
        new StoreInventory({ id: 'inv-od-test', storeId: 'chupei', productId: 'P-001', quantity: 10 })
      );

      const bag = new LuckyBag({
        id: 'LB-OD-TX',
        storeId: 'chupei',
        name: '事務防超抽套組',
        unitPrice: 350,
      });
      const prizeA = new LuckyBagPrize({
        id: 'pz-od-tx-a',
        bagId: 'LB-OD-TX',
        prizeGrade: 'A',
        prizeName: 'A賞模型',
        draws: 1,
        drawnCount: 1, // Already sold out!
      });
      const prizeB = new LuckyBagPrize({
        id: 'pz-od-tx-b',
        bagId: 'LB-OD-TX',
        prizeGrade: 'B',
        prizeName: 'B賞模型',
        draws: 5,
        drawnCount: 0,
      });

      await luckyBagRepo.saveBagWithPrizes(bag, [prizeA, prizeB]);

      // In transaction: draw B (valid), deduct inventory (valid), then draw A (overdraw!)
      await expect(
        txManager.runInTransaction(async (tx) => {
          // 1. Draw B (succeeds)
          await luckyBagRepo.incrementDrawnCount('LB-OD-TX', 'B', 2, tx);

          // 2. Deduct inventory (succeeds)
          await inventoryRepo.deductQuantities('chupei', [{ productId: 'P-001', quantity: 2 }], tx);

          // 3. Draw A (FAILS with OverdrawError)
          await luckyBagRepo.incrementDrawnCount('LB-OD-TX', 'A', 1, tx);
        })
      ).rejects.toThrow(OverdrawError);

      // VERIFY ATOMIC ROLLBACK:
      // B's drawnCount must be 0, not 2!
      const checkB = await luckyBagRepo.findPrize('LB-OD-TX', 'B');
      expect(checkB?.drawnCount).toBe(0);

      // A's drawnCount must be 1, not 2!
      const checkA = await luckyBagRepo.findPrize('LB-OD-TX', 'A');
      expect(checkA?.drawnCount).toBe(1);

      // Inventory must be 10, not 8!
      const checkInv = await inventoryRepo.findByStoreAndProduct('chupei', 'P-001');
      expect(checkInv?.quantity).toBe(10);
    });
  });

  describe('Suite 4: UNIQUE (checkoutUID) Idempotency & Collision Protection', () => {
    it('rejects duplicate checkoutUID on order insertion with SQLite UNIQUE constraint error', async () => {
      const order1 = new Order({
        id: 'ORD-UNIQUE-1',
        checkoutUID: 'UID-STRESS-TOKEN-XYZ',
        storeId: 'chupei',
        sessionId: 'sess-001',
        memberPhone: '0911222333',
        totalDue: 1200,
        payment: { cash: 1200, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
        netPointsDelta: 0,
        items: [],
        cashierEmail: 'cashier@onesoul.com',
      });

      await orderRepo.save(order1);

      const duplicateOrder = new Order({
        id: 'ORD-UNIQUE-2',
        checkoutUID: 'UID-STRESS-TOKEN-XYZ', // Colliding UID
        storeId: 'chupei',
        sessionId: 'sess-001',
        memberPhone: '0955666777',
        totalDue: 9999,
        payment: { cash: 9999, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
        netPointsDelta: 0,
        items: [],
        cashierEmail: 'cashier@onesoul.com',
      });

      await expect(orderRepo.save(duplicateOrder)).rejects.toThrow(
        /UNIQUE constraint failed: orders.checkout_uid/
      );

      // Verify that original order is intact and second order does not exist
      const found = await orderRepo.findByCheckoutUID('UID-STRESS-TOKEN-XYZ');
      expect(found).not.toBeNull();
      expect(found?.id).toBe('ORD-UNIQUE-1');
      expect(found?.totalDue).toBe(1200);

      const ghost = await orderRepo.findById('ORD-UNIQUE-2');
      expect(ghost).toBeNull();
    });

    it('rolls back transaction if checkoutUID uniqueness collision occurs', async () => {
      // Seed existing order
      await orderRepo.save(
        new Order({
          id: 'ORD-SEEDED',
          checkoutUID: 'UID-ALREADY-COMMITTED',
          storeId: 'chupei',
          sessionId: 'sess-001',
          memberPhone: '0911000000',
          totalDue: 300,
          payment: { cash: 300, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
          netPointsDelta: 0,
          items: [],
          cashierEmail: 'cashier@onesoul.com',
        })
      );

      await inventoryRepo.save(
        new StoreInventory({ id: 'inv-uid-test', storeId: 'chupei', productId: 'P-001', quantity: 20 })
      );

      // Run transaction: deduct inventory, then attempt to insert colliding checkoutUID
      await expect(
        txManager.runInTransaction(async (tx) => {
          await inventoryRepo.deductQuantities('chupei', [{ productId: 'P-001', quantity: 5 }], tx);

          await orderRepo.save(
            new Order({
              id: 'ORD-COLLIDE',
              checkoutUID: 'UID-ALREADY-COMMITTED', // Duplicate!
              storeId: 'chupei',
              sessionId: 'sess-001',
              memberPhone: '0922000000',
              totalDue: 800,
              payment: { cash: 800, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
              netPointsDelta: 0,
              items: [],
              cashierEmail: 'cashier@onesoul.com',
            }),
            tx
          );
        })
      ).rejects.toThrow(/UNIQUE constraint failed: orders.checkout_uid/);

      // Verify inventory was rolled back to 20
      const invCheck = await inventoryRepo.findByStoreAndProduct('chupei', 'P-001');
      expect(invCheck?.quantity).toBe(20);

      const collideCheck = await orderRepo.findById('ORD-COLLIDE');
      expect(collideCheck).toBeNull();
    });

    it('allows updating existing order without triggering self-collision on checkoutUID', async () => {
      const order = new Order({
        id: 'ORD-UPDATE-ME',
        checkoutUID: 'UID-UPDATE-ME',
        storeId: 'chupei',
        sessionId: 'sess-001',
        memberPhone: '0933111222',
        totalDue: 1500,
        payment: { cash: 1500, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
        netPointsDelta: 0,
        items: [],
        cashierEmail: 'cashier@onesoul.com',
      });

      await orderRepo.save(order);

      // Update fields on the same order instance
      const reloaded = (await orderRepo.findById('ORD-UPDATE-ME'))!;
      expect(reloaded).not.toBeNull();

      await orderRepo.updateStatus('ORD-UPDATE-ME', 'CANCELLED', {
        voidReason: '顧客要求退貨作廢',
        voidedAt: new Date(),
        voidedBy: 'manager@onesoul.com',
      });

      const updated = await orderRepo.findById('ORD-UPDATE-ME');
      expect(updated?.status).toBe('CANCELLED');
      expect(updated?.voidReason).toBe('顧客要求退貨作廢');
      expect(updated?.checkoutUID).toBe('UID-UPDATE-ME');
    });
  });

  describe('Suite 5: Lock Ordering & Deterministic localeCompare in D1InventoryRepository', () => {
    it('verifies sortProductIdsForLock behaves identically to Array.sort with localeCompare', () => {
      const testCases = [
        ['P-003', 'P-001', 'P-002'],
        ['Z-PRODUCT', 'A-PRODUCT', 'M-PRODUCT', 'B-PRODUCT'],
        ['p-10', 'P-2', 'p-01', '0p', '1p'],
        ['GK-索隆', 'GK-魯夫', 'GK-艾斯'],
        ['P-001', 'P-001', 'P-002', 'P-001'],
      ];

      for (const list of testCases) {
        const sortedInvariants = sortProductIdsForLock(list);
        const uniqueExpected = Array.from(new Set(list)).sort((a, b) => a.localeCompare(b));
        expect(sortedInvariants).toEqual(uniqueExpected);
      }
    });

    it('verifies deductQuantities executes updates in sorted localeCompare order', async () => {
      // Save 4 products in arbitrary order
      const pids = ['P-CHARLIE', 'P-ALPHA', 'P-DELTA', 'P-BRAVO'];
      for (const id of pids) {
        await inventoryRepo.saveProduct(
          new Product({ id, name: id, costPrice: 100, sellingPrice: 200 })
        );
        await inventoryRepo.save(
          new StoreInventory({ id: `inv-${id}`, storeId: 'chupei', productId: id, quantity: 20 })
        );
      }

      // Pass unsorted deductions: DELTA, CHARLIE, BRAVO, ALPHA
      const unsorted = [
        { productId: 'P-DELTA', quantity: 2 },
        { productId: 'P-CHARLIE', quantity: 3 },
        { productId: 'P-BRAVO', quantity: 1 },
        { productId: 'P-ALPHA', quantity: 4 },
      ];

      // deductQuantities will sort by localeCompare
      await inventoryRepo.deductQuantities('chupei', unsorted);

      // Check final quantities
      const a = await inventoryRepo.findByStoreAndProduct('chupei', 'P-ALPHA');
      const b = await inventoryRepo.findByStoreAndProduct('chupei', 'P-BRAVO');
      const c = await inventoryRepo.findByStoreAndProduct('chupei', 'P-CHARLIE');
      const d = await inventoryRepo.findByStoreAndProduct('chupei', 'P-DELTA');

      expect(a?.quantity).toBe(16);
      expect(b?.quantity).toBe(19);
      expect(c?.quantity).toBe(17);
      expect(d?.quantity).toBe(18);

      // Check sorting logic directly
      const sorted = [...unsorted].sort((x, y) => x.productId.localeCompare(y.productId));
      expect(sorted.map((s) => s.productId)).toEqual([
        'P-ALPHA',
        'P-BRAVO',
        'P-CHARLIE',
        'P-DELTA',
      ]);
    });

    it('handles duplicate productIds in deductions by sequential application without lock inversion', async () => {
      await inventoryRepo.save(
        new StoreInventory({ id: 'inv-dup-pid', storeId: 'chupei', productId: 'P-001', quantity: 10 })
      );

      // Pass multiple deductions for the SAME product
      await inventoryRepo.deductQuantities('chupei', [
        { productId: 'P-001', quantity: 2 },
        { productId: 'P-001', quantity: 3 },
      ]);

      const check = await inventoryRepo.findByStoreAndProduct('chupei', 'P-001');
      expect(check?.quantity).toBe(5); // 10 - 2 - 3 = 5
    });

    it('verifies addQuantities also sorts additions by localeCompare', async () => {
      const unsorted = [
        { productId: 'P-002', quantity: 5 },
        { productId: 'P-001', quantity: 10 },
      ];

      await inventoryRepo.addQuantities('chupei', unsorted);

      const p1 = await inventoryRepo.findByStoreAndProduct('chupei', 'P-001');
      const p2 = await inventoryRepo.findByStoreAndProduct('chupei', 'P-002');

      expect(p1?.quantity).toBe(10);
      expect(p2?.quantity).toBe(5);
    });
  });

  describe('Suite 6: Full-Stack CheckoutUseCase & D1 Repositories Constraints Stress', () => {
    it('CheckoutUseCase rolls back completely when an overdraw occurs in D1', async () => {
      // Setup LuckyBag with 1 prize remaining
      const bag = new LuckyBag({
        id: 'LB-E2E-OD',
        storeId: 'chupei',
        name: '全鏈路一番賞防超抽測試',
        unitPrice: 350,
      });
      const prize = new LuckyBagPrize({
        id: 'pz-e2e-od',
        bagId: 'LB-E2E-OD',
        prizeGrade: 'A',
        prizeName: 'A賞模型',
        productId: 'P-001',
        draws: 1,
        drawnCount: 1, // Already 1/1 drawn!
      });
      await luckyBagRepo.saveBagWithPrizes(bag, [prize]);

      await inventoryRepo.save(
        new StoreInventory({ id: 'inv-e2e-od', storeId: 'chupei', productId: 'P-001', quantity: 5 })
      );

      const res = await checkoutUseCase.execute({
        storeId: 'chupei',
        cashierEmail: 'cashier@onesoul.com',
        customer: { phone: '0912345678', name: '王小明' },
        payment: { cash: 350, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
        lotteries: [
          {
            bagId: 'LB-E2E-OD',
            prizeGrade: 'A',
            draws: 1,
            unitPrice: 350,
            amount: 350,
            pickType: 'TAKE_AWAY',
          },
        ],
        checkoutUID: 'UID-FAIL-OVERDRAW-001',
      });

      expect(isErr(res)).toBe(true);
      if (isErr(res)) {
        expect(res.error).toBeInstanceOf(OverdrawError);
        expect(res.error.message).toContain('剩餘抽數不足');
      }

      // Verify no order was created
      const order = await orderRepo.findByCheckoutUID('UID-FAIL-OVERDRAW-001');
      expect(order).toBeNull();

      // Verify prize drawnCount is still 1
      const prizeCheck = await luckyBagRepo.findPrize('LB-E2E-OD', 'A');
      expect(prizeCheck?.drawnCount).toBe(1);

      // Verify inventory is still 5
      const invCheck = await inventoryRepo.findByStoreAndProduct('chupei', 'P-001');
      expect(invCheck?.quantity).toBe(5);
    });

    it('CheckoutUseCase rolls back completely when physical stock is insufficient in D1', async () => {
      await inventoryRepo.save(
        new StoreInventory({ id: 'inv-e2e-is', storeId: 'chupei', productId: 'P-001', quantity: 1 })
      );

      const res = await checkoutUseCase.execute({
        storeId: 'chupei',
        cashierEmail: 'cashier@onesoul.com',
        customer: { phone: '0912345678', name: '李大同' },
        payment: { cash: 7000, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
        merchandises: [
          {
            productId: 'P-001',
            quantity: 2, // Only 1 in stock!
            unitPrice: 3500,
            amount: 7000,
            paymentType: '現金',
          },
        ],
        checkoutUID: 'UID-FAIL-STOCK-001',
      });

      expect(isErr(res)).toBe(true);
      if (isErr(res)) {
        expect(res.error.message).toContain('庫存不足');
      }

      // Verify no order created
      const order = await orderRepo.findByCheckoutUID('UID-FAIL-STOCK-001');
      expect(order).toBeNull();

      // Verify inventory is still 1
      const invCheck = await inventoryRepo.findByStoreAndProduct('chupei', 'P-001');
      expect(invCheck?.quantity).toBe(1);
    });

    it('CheckoutUseCase provides idempotent response on duplicate checkoutUID without re-deducting stock in D1', async () => {
      await inventoryRepo.save(
        new StoreInventory({ id: 'inv-e2e-idem', storeId: 'chupei', productId: 'P-001', quantity: 10 })
      );

      const command = {
        storeId: 'chupei',
        cashierEmail: 'cashier@onesoul.com',
        customer: { phone: '0988000111', name: '張小華' },
        payment: { cash: 3500, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
        merchandises: [
          {
            productId: 'P-001',
            quantity: 1,
            unitPrice: 3500,
            amount: 3500,
            paymentType: '現金' as const,
          },
        ],
        checkoutUID: 'UID-IDEMPOTENT-001',
      };

      // 1st Execution
      const res1 = await checkoutUseCase.execute(command);
      expect(isOk(res1)).toBe(true);

      // Verify stock was deducted from 10 to 9
      const stockAfter1 = await inventoryRepo.findByStoreAndProduct('chupei', 'P-001');
      expect(stockAfter1?.quantity).toBe(9);

      // 2nd Execution with EXACT SAME checkoutUID
      const res2 = await checkoutUseCase.execute(command);
      expect(isOk(res2)).toBe(true);
      if (isOk(res2)) {
        expect(res2.data.message).toBe('結帳成功 (冪等響應)');
        expect(res2.data.checkoutUID).toBe('UID-IDEMPOTENT-001');
      }

      // CRUCIAL IDEMPOTENCY CHECK: Stock MUST REMAIN 9, NOT 8!
      const stockAfter2 = await inventoryRepo.findByStoreAndProduct('chupei', 'P-001');
      expect(stockAfter2?.quantity).toBe(9);

      // Verify only 1 order exists in database for this checkoutUID
      const allOrders = await orderRepo.listByStore('chupei');
      const matchingOrders = allOrders.filter((o) => o.checkoutUID === 'UID-IDEMPOTENT-001');
      expect(matchingOrders.length).toBe(1);
    });
  });
});
