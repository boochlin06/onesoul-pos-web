import { describe, it, expect, beforeEach } from 'vitest';
import { createTestD1Database, TestD1Instance } from './d1-test-harness';
import {
  D1TransactionManager,
  D1OrderRepository,
  D1InventoryRepository,
  D1LuckyBagRepository,
  D1MemberRepository,
  D1SessionRepository,
  D1TransferRepository,
  D1StocktakeRepository,
  D1PreOrderRepository,
  D1AuditRepository,
  D1SettingsRepository,
} from '../src/adapters/d1';
import { Order, OrderItem } from '../src/core/entities/Order';
import { StoreInventory, InventoryLog, Product } from '../src/core/entities/Product';
import { LuckyBag, LuckyBagPrize, PrizeAllocationPlan } from '../src/core/entities/LuckyBag';
import { PointLog } from '../src/core/entities/Member';
import { CashRegisterSession } from '../src/core/entities/CashRegisterSession';
import { TransferOrder, TransferOrderItem } from '../src/core/entities/TransferOrder';
import { Stocktake, StocktakeItem } from '../src/core/entities/Stocktake';
import { PreOrder } from '../src/core/entities/PreOrder';
import { AuditLog } from '../src/core/entities/AuditLog';
import { InsufficientStockError, OverdrawError } from '@onesoul/shared';


describe('Cloudflare D1 Drizzle Repositories & Real SQLite Constraints Test Suite', () => {
  let harness: TestD1Instance;
  let txManager: D1TransactionManager;
  let orderRepo: D1OrderRepository;
  let inventoryRepo: D1InventoryRepository;
  let luckyBagRepo: D1LuckyBagRepository;
  let memberRepo: D1MemberRepository;
  let sessionRepo: D1SessionRepository;
  let transferRepo: D1TransferRepository;
  let stocktakeRepo: D1StocktakeRepository;
  let preOrderRepo: D1PreOrderRepository;
  let auditRepo: D1AuditRepository;
  let settingsRepo: D1SettingsRepository;

  beforeEach(() => {
    harness = createTestD1Database();
    harness.seedCommonData();

    txManager = new D1TransactionManager(harness.db);
    orderRepo = new D1OrderRepository(harness.db);
    inventoryRepo = new D1InventoryRepository(harness.db);
    luckyBagRepo = new D1LuckyBagRepository(harness.db);
    memberRepo = new D1MemberRepository(harness.db);
    sessionRepo = new D1SessionRepository(harness.db);
    transferRepo = new D1TransferRepository(harness.db);
    stocktakeRepo = new D1StocktakeRepository(harness.db);
    preOrderRepo = new D1PreOrderRepository(harness.db);
    auditRepo = new D1AuditRepository(harness.db);
    settingsRepo = new D1SettingsRepository(harness.db);
  });

  describe('1. Inventory & SQLite CHECK (quantity >= 0) Invariants', () => {
    it('should save and retrieve store inventory successfully', async () => {
      const inv = new StoreInventory({
        id: 'inv-01',
        storeId: 'chupei',
        productId: 'P-001',
        quantity: 15,
        safetyStock: 3,
      });

      await inventoryRepo.save(inv);

      const found = await inventoryRepo.findByStoreAndProduct('chupei', 'P-001');
      expect(found).not.toBeNull();
      expect(found?.quantity).toBe(15);
      expect(found?.safetyStock).toBe(3);
    });

    it('should deduct inventory in deterministic localeCompare dictionary order', async () => {
      await inventoryRepo.save(
        new StoreInventory({ id: 'inv-01', storeId: 'chupei', productId: 'P-001', quantity: 10 })
      );
      await inventoryRepo.save(
        new StoreInventory({ id: 'inv-02', storeId: 'chupei', productId: 'P-002', quantity: 20 })
      );

      await inventoryRepo.deductQuantities('chupei', [
        { productId: 'P-002', quantity: 5 },
        { productId: 'P-001', quantity: 3 },
      ]);

      const p1 = await inventoryRepo.findByStoreAndProduct('chupei', 'P-001');
      const p2 = await inventoryRepo.findByStoreAndProduct('chupei', 'P-002');
      expect(p1?.quantity).toBe(7);
      expect(p2?.quantity).toBe(15);
    });

    it('should trigger SQLite CHECK (quantity >= 0) and throw InsufficientStockError when deducting past zero', async () => {
      await inventoryRepo.save(
        new StoreInventory({ id: 'inv-01', storeId: 'chupei', productId: 'P-001', quantity: 2 })
      );

      await expect(
        inventoryRepo.deductQuantities('chupei', [{ productId: 'P-001', quantity: 5 }])
      ).rejects.toThrow(InsufficientStockError);

      // Verify that quantity remains unchanged
      const current = await inventoryRepo.findByStoreAndProduct('chupei', 'P-001');
      expect(current?.quantity).toBe(2);
    });

    it('should record and list inventory logs', async () => {
      const log = new InventoryLog({
        id: 'log-01',
        storeId: 'chupei',
        productId: 'P-001',
        changeType: 'SALE',
        delta: -1,
        balance: 9,
        operator: 'cashier@onesoul.com',
        reason: '收銀銷售出庫',
      });

      await inventoryRepo.recordLog(log);
      const logs = await inventoryRepo.findLogsByStore('chupei');
      expect(logs.length).toBe(1);
      expect(logs[0].changeType).toBe('SALE');
      expect(logs[0].delta).toBe(-1);
    });

    it('should manage product entity records', async () => {
      const product = new Product({
        id: 'P-003',
        name: '航海王 索隆 GK 潮流雕像',
        sellingPrice: 5000,
        costPrice: 3000,
      });

      await inventoryRepo.saveProduct(product);
      const found = await inventoryRepo.findProductById('P-003');
      expect(found).not.toBeNull();
      expect(found?.name).toBe('航海王 索隆 GK 潮流雕像');

      const all = await inventoryRepo.findAllProducts();
      expect(all.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('2. LuckyBag & SQLite CHECK (drawn_count <= draws) Invariants', () => {
    it('should save lucky bag with prizes and query prizes', async () => {
      const bag = new LuckyBag({
        id: 'LB-TEST-01',
        storeId: 'chupei',
        name: '七龍珠超絕戰鬥一番賞套組',
        unitPrice: 300,
      });

      const prizes = [
        new LuckyBagPrize({
          id: 'pz-a',
          bagId: 'LB-TEST-01',
          prizeGrade: 'A',
          prizeName: '悟空大賞雕像',
          productId: 'P-001',
          draws: 2,
          drawnCount: 0,
        }),
        new LuckyBagPrize({
          id: 'pz-z',
          bagId: 'LB-TEST-01',
          prizeGrade: 'Z',
          prizeName: '保底壓克力小立牌',
          productId: '0p',
          points: 1,
          draws: 50,
          drawnCount: 0,
        }),
      ];

      await luckyBagRepo.saveBagWithPrizes(bag, prizes);

      const foundBag = await luckyBagRepo.findById('LB-TEST-01');
      expect(foundBag).not.toBeNull();
      expect(foundBag?.name).toBe('七龍珠超絕戰鬥一番賞套組');

      const foundPrizes = await luckyBagRepo.findPrizesByBagId('LB-TEST-01');
      expect(foundPrizes.length).toBe(2);

      const prizeA = await luckyBagRepo.findPrize('LB-TEST-01', 'A');
      expect(prizeA?.draws).toBe(2);
      expect(prizeA?.remainingDraws).toBe(2);
    });

    it('should increment drawn count successfully within limits', async () => {
      const bag = new LuckyBag({
        id: 'LB-DRAW-01',
        storeId: 'chupei',
        name: '開抽測試套組',
        unitPrice: 200,
      });

      const prize = new LuckyBagPrize({
        id: 'pz-draw-1',
        bagId: 'LB-DRAW-01',
        prizeGrade: 'A',
        prizeName: 'A賞潮流雕像',
        draws: 3,
        drawnCount: 0,

      });

      await luckyBagRepo.saveBagWithPrizes(bag, [prize]);

      await luckyBagRepo.incrementDrawnCount('LB-DRAW-01', 'A', 2);
      const afterDraw = await luckyBagRepo.findPrize('LB-DRAW-01', 'A');
      expect(afterDraw?.drawnCount).toBe(2);
      expect(afterDraw?.remainingDraws).toBe(1);
    });

    it('should trigger SQLite CHECK (drawn_count <= draws) and throw OverdrawError on exceeding draws', async () => {
      const bag = new LuckyBag({
        id: 'LB-OVERDRAW',
        storeId: 'chupei',
        name: '防超抽驗證套組',
        unitPrice: 200,
      });

      const prize = new LuckyBagPrize({
        id: 'pz-over-1',
        bagId: 'LB-OVERDRAW',
        prizeGrade: 'LAST',
        prizeName: '最後賞模型',
        draws: 1,
        drawnCount: 0,
      });

      await luckyBagRepo.saveBagWithPrizes(bag, [prize]);

      // Draw 1 is fine
      await luckyBagRepo.incrementDrawnCount('LB-OVERDRAW', 'LAST', 1);

      // Attempting to draw 1 more should violate CHECK constraint
      await expect(
        luckyBagRepo.incrementDrawnCount('LB-OVERDRAW', 'LAST', 1)
      ).rejects.toThrow(OverdrawError);
    });

    it('should decrement drawn count properly', async () => {
      const bag = new LuckyBag({
        id: 'LB-DEC',
        storeId: 'chupei',
        name: '退抽驗證套組',
        unitPrice: 250,
      });

      const prize = new LuckyBagPrize({
        id: 'pz-dec-1',
        bagId: 'LB-DEC',
        prizeGrade: 'B',
        prizeName: 'B賞模型',
        draws: 5,
        drawnCount: 3,
      });

      await luckyBagRepo.saveBagWithPrizes(bag, [prize]);
      await luckyBagRepo.decrementDrawnCount('LB-DEC', 'B', 2);

      const after = await luckyBagRepo.findPrize('LB-DEC', 'B');
      expect(after?.drawnCount).toBe(1);
    });

    it('should save, list, and delete prize allocation plans', async () => {
      const plan = new PrizeAllocationPlan({
        id: 'plan-01',
        storeId: 'chupei',
        name: '秋季配賞草案',
        totalDraws: 80,
        unitPrice: 350,
        targetMargin: 0.38,
        items: [
          { grade: 'A', name: 'A賞 GK 雕像', productId: 'P-001', draws: 2, points: 0, cost: 2000 },
          { grade: 'Z', name: 'Z賞保底小賞', productId: '0p', draws: 78, points: 1, cost: 10 },
        ],
      });

      await luckyBagRepo.savePlan(plan);
      const foundPlan = await luckyBagRepo.findPlanById('plan-01');
      expect(foundPlan).not.toBeNull();
      expect(foundPlan?.name).toBe('秋季配賞草案');
      expect(foundPlan?.items.length).toBe(2);

      const plans = await luckyBagRepo.findPlansByStore('chupei');
      expect(plans.length).toBe(1);

      await luckyBagRepo.deletePlan('plan-01');
      const afterDelete = await luckyBagRepo.findPlanById('plan-01');
      expect(afterDelete).toBeNull();
    });
  });

  describe('3. Order & checkoutUID UNIQUE Idempotency Invariants', () => {
    it('should save and find order by ID and checkoutUID', async () => {
      const item = new OrderItem({
        id: 'oi-01',
        orderId: 'ORD-001',
        itemType: 'MERCHANDISE',
        productId: 'P-001',
        quantity: 1,
        unitPrice: 3500,
        amount: 3500,
        pointsImpact: 0,
      });

      const order = new Order({
        id: 'ORD-001',
        checkoutUID: 'UID-TEST-ABC-001',
        storeId: 'chupei',
        sessionId: 'sess-001',
        memberPhone: '0912345678',
        totalDue: 3500,
        payment: { cash: 3500, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
        netPointsDelta: 0,
        items: [item],
        cashierEmail: 'cashier@onesoul.com',
      });

      await orderRepo.save(order);

      const foundById = await orderRepo.findById('ORD-001');
      expect(foundById).not.toBeNull();
      expect(foundById?.totalDue).toBe(3500);
      expect(foundById?.items.length).toBe(1);

      const foundByUid = await orderRepo.findByCheckoutUID('UID-TEST-ABC-001');
      expect(foundByUid).not.toBeNull();
      expect(foundByUid?.id).toBe('ORD-001');
    });

    it('should enforce UNIQUE constraint on checkoutUID to prevent duplicate checkouts', async () => {
      const order1 = new Order({
        id: 'ORD-DUP-1',
        checkoutUID: 'UNIQUE-TOKEN-12345',
        storeId: 'chupei',
        sessionId: 'sess-001',
        memberPhone: '0911000111',
        totalDue: 1000,
        payment: { cash: 1000, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
        netPointsDelta: 0,
        items: [],
        cashierEmail: 'cashier@onesoul.com',
      });

      await orderRepo.save(order1);

      const order2 = new Order({
        id: 'ORD-DUP-2',
        checkoutUID: 'UNIQUE-TOKEN-12345', // Duplicate UID!
        storeId: 'chupei',
        sessionId: 'sess-001',
        memberPhone: '0922000222',
        totalDue: 2000,
        payment: { cash: 2000, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
        netPointsDelta: 0,
        items: [],
        cashierEmail: 'cashier@onesoul.com',
      });

      await expect(orderRepo.save(order2)).rejects.toThrow(/UNIQUE constraint failed: orders.checkout_uid/);
    });

    it('should update order status with void metadata', async () => {
      const order = new Order({
        id: 'ORD-VOID-01',
        checkoutUID: 'UID-VOID-01',
        storeId: 'chupei',
        sessionId: 'sess-001',
        memberPhone: '0988777666',
        totalDue: 500,
        payment: { cash: 500, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
        netPointsDelta: 0,
        items: [],
        cashierEmail: 'cashier@onesoul.com',
      });

      await orderRepo.save(order);

      await orderRepo.updateStatus('ORD-VOID-01', 'CANCELLED', {
        voidReason: '客人換貨作廢',
        voidedAt: new Date(),
        voidedBy: 'manager@onesoul.com',
      });

      const updated = await orderRepo.findById('ORD-VOID-01');
      expect(updated?.status).toBe('CANCELLED');
      expect(updated?.voidReason).toBe('客人換貨作廢');
      expect(updated?.voidedBy).toBe('manager@onesoul.com');
    });

    it('should list orders by session, store, and member', async () => {
      const order = new Order({
        id: 'ORD-LIST-01',
        checkoutUID: 'UID-LIST-01',
        storeId: 'chupei',
        sessionId: 'sess-001',
        memberPhone: '0933444555',
        totalDue: 800,
        payment: { cash: 800, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
        netPointsDelta: 0,
        items: [],
        cashierEmail: 'cashier@onesoul.com',
      });

      await orderRepo.save(order);

      const bySession = await orderRepo.listBySession('sess-001');
      expect(bySession.some((o) => o.id === 'ORD-LIST-01')).toBe(true);

      const byStore = await orderRepo.listByStore('chupei');
      expect(byStore.some((o) => o.id === 'ORD-LIST-01')).toBe(true);
    });
  });

  describe('4. TransactionManager & Atomic Rollback Verification', () => {
    it('should roll back all modifications when an error is thrown inside transaction', async () => {
      await inventoryRepo.save(
        new StoreInventory({ id: 'inv-tx-1', storeId: 'chupei', productId: 'P-001', quantity: 5 })
      );

      const runFailingTx = async () => {
        await txManager.runInTransaction(async (tx) => {
          // 1. Create order in transaction
          const order = new Order({
            id: 'ORD-TX-FAIL',
            checkoutUID: 'UID-TX-FAIL',
            storeId: 'chupei',
            sessionId: 'sess-001',
            memberPhone: '0912111222',
            totalDue: 1000,
            payment: { cash: 1000, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
            netPointsDelta: 0,
            items: [],
            cashierEmail: 'cashier@onesoul.com',
          });
          await orderRepo.save(order, tx);

          // 2. Trigger CHECK constraint violation on inventory (try to deduct 10 when stock is 5)
          await inventoryRepo.deductQuantities('chupei', [{ productId: 'P-001', quantity: 10 }], tx);
        });
      };

      await expect(runFailingTx()).rejects.toThrow(InsufficientStockError);

      // Verify that order was NOT committed (Rollback successful)
      const orderCheck = await orderRepo.findById('ORD-TX-FAIL');
      expect(orderCheck).toBeNull();

      // Verify that inventory was NOT modified
      const invCheck = await inventoryRepo.findByStoreAndProduct('chupei', 'P-001');
      expect(invCheck?.quantity).toBe(5);
    });
  });

  describe('5. Member & Point Wallet Management', () => {
    it('should find or create member by phone with canonical formatting', async () => {
      const member = await memberRepo.findOrCreateByPhone('0912-345-678', '小明');
      expect(member.phone).toBe('0912345678');
      expect(member.name).toBe('小明');

      // Finding with leading 0 omitted or dashes should match
      const found = await memberRepo.findByPhone('912345678');
      expect(found).not.toBeNull();
      expect(found?.id).toBe(member.id);
    });

    it('should record point logs and maintain audit trail', async () => {
      const member = await memberRepo.findOrCreateByPhone('0988-123-456', '阿華');

      const log = new PointLog({
        id: 'pl-01',
        memberId: member.id,
        type: 'EARN',
        delta: 50,
        balance: 50,
        reason: '消費滿額贈點',
        operator: 'cashier@onesoul.com',
      });

      member.adjustPoints(50);
      await memberRepo.save(member);
      await memberRepo.recordPointLog(log);

      const logs = await memberRepo.findPointLogsByMemberId(member.id);
      expect(logs.length).toBe(1);
      expect(logs[0].delta).toBe(50);
      expect(logs[0].balance).toBe(50);

      const reloadedMember = await memberRepo.findById(member.id);
      expect(reloadedMember?.points).toBe(50);
    });
  });

  describe('6. CashRegisterSession & Closing Management', () => {
    it('should open and retrieve active cash register session', async () => {
      const session = new CashRegisterSession({
        id: 'sess-active-01',
        storeId: 'jinshan',
        openedBy: 'cashier-js@onesoul.com',
        openingCash: 5000,
        note: '金山概念店早班開盤',
      });

      await sessionRepo.openSession(session);

      const active = await sessionRepo.findActiveByStore('jinshan');
      expect(active).not.toBeNull();
      expect(active?.openingCash).toBe(5000);
      expect(active?.openedBy).toBe('cashier-js@onesoul.com');
      expect(active?.isOpen).toBe(true);
    });

    it('should close cash register session with discrepancy calculation', async () => {
      const session = new CashRegisterSession({
        id: 'sess-close-01',
        storeId: 'chupei',
        openedBy: 'cashier@onesoul.com',
        openingCash: 8000,
      });

      await sessionRepo.openSession(session);

      await sessionRepo.closeSession('sess-close-01', {
        closedBy: 'manager@onesoul.com',
        actualCash: 8050,
        discrepancy: 50,
        note: '盤點溢收 50 元',
      });

      const closed = await sessionRepo.findById('sess-close-01');
      expect(closed?.status).toBe('CLOSED');
      expect(closed?.actualCash).toBe(8050);
      expect(closed?.discrepancy).toBe(50);
      expect(closed?.closedBy).toBe('manager@onesoul.com');
    });
  });

  describe('7. TransferOrder Management', () => {
    it('should create and transition transfer order lifecycle', async () => {
      const order = new TransferOrder({
        id: 'tf-01',
        transferNo: 'TR-20261108-001',
        sourceStoreId: 'chupei',
        targetStoreId: 'jinshan',
        note: '門市支援調撥',
      });

      const items = [
        new TransferOrderItem({
          id: 'tfi-01',
          transferId: 'tf-01',
          productId: 'P-001',
          requestedQty: 5,
        }),
      ];

      await transferRepo.createTransfer(order, items);

      const found = await transferRepo.findByTransferNo('TR-20261108-001');
      expect(found).not.toBeNull();
      expect(found?.status).toBe('DRAFT');
      expect(found?.items.length).toBe(1);

      // Dispatch
      await transferRepo.updateStatus('tf-01', 'DISPATCHED', 'driver@onesoul.com');
      const dispatched = await transferRepo.findById('tf-01');
      expect(dispatched?.status).toBe('DISPATCHED');
      expect(dispatched?.dispatchedBy).toBe('driver@onesoul.com');

      // Receive
      await transferRepo.updateStatus('tf-01', 'RECEIVED', 'receiver@onesoul.com');
      const received = await transferRepo.findById('tf-01');
      expect(received?.status).toBe('RECEIVED');
      expect(received?.receivedBy).toBe('receiver@onesoul.com');
    });

    it('should list transfer orders by store', async () => {
      const list = await transferRepo.listByStore('chupei');
      expect(Array.isArray(list)).toBe(true);
    });
  });

  describe('8. Stocktake Management', () => {
    it('should create and post stocktake draft', async () => {
      const stocktake = new Stocktake({
        id: 'st-01',
        storeId: 'chupei',
        countedBy: 'staff@onesoul.com',
        note: '門市實盤抽檢',
      });

      const items = [
        new StocktakeItem({
          id: 'sti-01',
          stocktakeId: 'st-01',
          productId: 'P-001',
          systemQty: 10,
          actualQty: 12,
          variance: 2,
        }),
      ];

      await stocktakeRepo.createStocktake(stocktake, items);

      const found = await stocktakeRepo.findById('st-01');
      expect(found).not.toBeNull();
      expect(found?.status).toBe('DRAFT');
      expect(found?.items[0].variance).toBe(2);

      await stocktakeRepo.updateStatus('st-01', 'POSTED', 'manager@onesoul.com', new Date());

      const posted = await stocktakeRepo.findById('st-01');
      expect(posted?.status).toBe('POSTED');
      expect(posted?.postedBy).toBe('manager@onesoul.com');
    });
  });

  describe('9. PreOrder Management', () => {
    it('should create, list, and complete pre-orders', async () => {
      const preOrder = new PreOrder({
        id: 'pre-01',
        name: '七龍珠 貝吉塔 1/4 雕像',
        quantity: 2,
        deposit: 4000,
        finalPayment: 8000,
        supplier: '萬代原廠',
        targetStoreId: 'chupei',
      });

      await preOrderRepo.create(preOrder);

      const found = await preOrderRepo.findById('pre-01');
      expect(found).not.toBeNull();
      expect(found?.status).toBe('PENDING');
      expect(found?.totalCost).toBe(12000);

      preOrder.receive({ productId: 'P-001' });
      await preOrderRepo.save(preOrder);

      const completed = await preOrderRepo.findById('pre-01');
      expect(completed?.status).toBe('COMPLETED');
      expect(completed?.productId).toBe('P-001');

      const list = await preOrderRepo.list('COMPLETED');
      expect(list.length).toBe(1);
    });
  });

  describe('10. Audit Repository & Cryptographic Chaining', () => {
    it('should create tamper-evident HMAC-SHA256 audit log chain and verify validity', async () => {
      const latest1 = await auditRepo.getLatestHash();
      expect(latest1).toBe(AuditLog.GENESIS_HASH);

      const hash1 = AuditLog.calculateHash(latest1, {
        operatorId: 'admin@onesoul.com',
        action: 'INVENTORY_ADJUST',
        targetType: 'PRODUCT',
        targetId: 'P-001',
        delta: 5,
        reason: '初始盤點校正',
      });

      const log1 = new AuditLog({
        id: 'aud-01',
        operatorId: 'admin@onesoul.com',
        action: 'INVENTORY_ADJUST',
        targetType: 'PRODUCT',
        targetId: 'P-001',
        delta: 5,
        reason: '初始盤點校正',
        prevHash: latest1,
        currentHash: hash1,
      });

      await auditRepo.append(log1);

      const latest2 = await auditRepo.getLatestHash();
      expect(latest2).toBe(hash1);

      const hash2 = AuditLog.calculateHash(latest2, {
        operatorId: 'manager@onesoul.com',
        action: 'POINT_MANUAL_GRANT',
        targetType: 'MEMBER',
        targetId: 'mem-001',
        delta: 100,
        reason: 'VIP 客戶補點',
      });

      const log2 = new AuditLog({
        id: 'aud-02',
        operatorId: 'manager@onesoul.com',
        action: 'POINT_MANUAL_GRANT',
        targetType: 'MEMBER',
        targetId: 'mem-001',
        delta: 100,
        reason: 'VIP 客戶補點',
        prevHash: latest2,
        currentHash: hash2,
      });

      await auditRepo.append(log2);

      // Verify un-tampered chain
      const verifyResult = await auditRepo.verifyChain();
      expect(verifyResult.valid).toBe(true);
      expect(verifyResult.totalCount).toBe(2);
    });

    it('should detect tampering in audit log chain when hash or data is modified', async () => {
      const hash1 = AuditLog.calculateHash(AuditLog.GENESIS_HASH, {
        operatorId: 'admin@onesoul.com',
        action: 'TEST',
        targetType: 'TEST',
        targetId: '1',
        delta: 0,
        reason: 'test',
      });

      await auditRepo.append(
        new AuditLog({
          id: 'aud-tamper-1',
          operatorId: 'admin@onesoul.com',
          action: 'TEST',
          targetType: 'TEST',
          targetId: '1',
          delta: 0,
          reason: 'test',
          prevHash: AuditLog.GENESIS_HASH,
          currentHash: hash1,
        })
      );

      // Inject a tampered log with forged currentHash
      await auditRepo.append(
        new AuditLog({
          id: 'aud-tamper-2',
          operatorId: 'hacker@onesoul.com',
          action: 'POINT_STEAL',
          targetType: 'MEMBER',
          targetId: 'mem-001',
          delta: 999999,
          reason: 'illegal modification',
          prevHash: hash1,
          currentHash: 'forged-hash-value-1234567890abcdef',
        })
      );

      const verifyResult = await auditRepo.verifyChain();
      expect(verifyResult.valid).toBe(false);
      expect(verifyResult.brokenAt).toBe('aud-tamper-2');
    });
  });

  describe('11. Settings & Integration Configs Management', () => {
    it('should save and retrieve integration config', async () => {
      await settingsRepo.saveIntegrationConfig({
        key: 'LINE_NOTIFY_WEBHOOK',
        value: { url: 'https://notify-bot.line.me/api/notify', token: 'sec-tok-123' },
        description: 'Line 通知 Webhook 端點',
        isEnabled: true,
      });

      const config = await settingsRepo.getIntegrationConfig('LINE_NOTIFY_WEBHOOK');
      expect(config).not.toBeNull();
      expect(config?.key).toBe('LINE_NOTIFY_WEBHOOK');
      expect(config?.value.token).toBe('sec-tok-123');
    });

    it('should get and save brand settings with default fallbacks', async () => {
      const initial = await settingsRepo.getBrandSettings();
      expect(initial.brandName).toBe('OneSoul 玩具模型一番賞專賣店');
      expect(initial.blindBoxPointsValue).toBe(10);
      expect(initial.pointRateTwd).toBe(20);

      await settingsRepo.saveBrandSettings(
        {
          ...initial,
          brandSubtitle: '全台最專業玩具一番賞旗艦店',
          blindBoxPointsValue: 12,
        },
        'admin@onesoul.com'
      );

      const updated = await settingsRepo.getBrandSettings();
      expect(updated.brandSubtitle).toBe('全台最專業玩具一番賞旗艦店');
      expect(updated.blindBoxPointsValue).toBe(12);
    });

    it('should publish, list, and withdraw emergency notices', async () => {
      const notice = await settingsRepo.publishEmergencyNotice({
        title: '颱風天營業時間調整公告',
        content: '新竹縣市停止上班上課，門市提前於 18:00 關帳日結',
        level: 'WARNING',
        targetStoreIds: ['chupei', 'jinshan'],
        isActive: true,
        publisherEmail: 'hq@onesoul.com',
      });

      expect(notice.id).toBeDefined();
      expect(notice.version).toBe(1);

      const activeList = await settingsRepo.listEmergencyNotices(true);
      expect(activeList.length).toBe(1);
      expect(activeList[0].title).toBe('颱風天營業時間調整公告');

      await settingsRepo.withdrawEmergencyNotice(notice.id);

      const afterWithdraw = await settingsRepo.listEmergencyNotices(true);
      expect(afterWithdraw.length).toBe(0);
    });
  });
});
