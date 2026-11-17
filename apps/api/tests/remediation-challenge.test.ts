import { describe, it, expect, beforeEach } from 'vitest';
import {
  AuditUseCase,
  InMemoryAuditRepository,
  AuditLog,
  InventoryUseCase,
  MemberUseCase,
  SessionUseCase,
  PreOrderUseCase,
  CheckoutUseCase,
  InMemoryInventoryRepository,
  InMemoryTransferRepository,
  InMemoryStocktakeRepository,
  InMemoryMemberRepository,
  InMemoryOrderRepository,
  InMemorySessionRepository,
  InMemoryPreOrderRepository,
  InMemoryLuckyBagRepository,
  InMemoryTransactionManager,
  Product,
  StoreInventory,
  InventoryLog,
  Member,
  CashRegisterSession,
  PreOrder,
  LuckyBag,
  LuckyBagPrize,
  Order,
  OrderItem,
  PhoneNumber,
  sortProductIdsForLock,
} from '../src';
import { isOk, isErr } from '@onesoul/shared';

describe('Adversarial Challenge: Remediation Audit Chain, Concurrency Lock & Rollback', () => {
  describe('Area 1: Cryptographic HMAC-SHA256 Audit Chain Attacks', () => {
    let auditRepo: InMemoryAuditRepository;
    let auditUseCase: AuditUseCase;
    const testSecret = 'onesoul-audit-key-2026';

    beforeEach(() => {
      auditRepo = new InMemoryAuditRepository(testSecret);
      auditUseCase = new AuditUseCase(auditRepo, testSecret);
    });

    it('verifies untampered linear HMAC-SHA256 chain across all 4 usecases', async () => {
      const txManager = new InMemoryTransactionManager();
      const invRepo = new InMemoryInventoryRepository();
      const transferRepo = new InMemoryTransferRepository();
      const stocktakeRepo = new InMemoryStocktakeRepository();
      const memberRepo = new InMemoryMemberRepository();
      const orderRepo = new InMemoryOrderRepository();
      const sessionRepo = new InMemorySessionRepository();
      const preOrderRepo = new InMemoryPreOrderRepository();

      txManager.register(auditRepo);
      txManager.register(invRepo);
      txManager.register(memberRepo);
      txManager.register(sessionRepo);
      txManager.register(preOrderRepo);

      const inventoryUseCase = new InventoryUseCase(invRepo, transferRepo, stocktakeRepo, auditRepo, txManager);
      const memberUseCase = new MemberUseCase(memberRepo, orderRepo, auditRepo, txManager);
      const sessionUseCase = new SessionUseCase(sessionRepo, orderRepo, auditRepo, txManager);
      const preOrderUseCase = new PreOrderUseCase(preOrderRepo, invRepo, auditRepo, txManager);

      // Seed data
      await invRepo.saveProduct(new Product({ id: 'GK-99', name: '大賞 GK 雕像 索隆', costPrice: 2000, sellingPrice: 3500 }));
      await invRepo.save(new StoreInventory({ id: 'inv-99', storeId: 'chupei', productId: 'GK-99', quantity: 10 }));
      await memberRepo.save(new Member({ id: 'mem-99', phone: '0988777666', name: '林小明', points: 100 }));
      await sessionRepo.save(new CashRegisterSession({ id: 'sess-99', storeId: 'chupei', openedBy: 'cashier@onesoul.tw', openingCash: 8000 }));
      await preOrderRepo.save(new PreOrder({ id: 'po-99', targetStoreId: 'chupei', supplier: '萬代', name: 'GK 雕像 鳴人', quantity: 5, totalCost: 10000, deposit: 2000 }));

      // 1. Inventory operation
      const r1 = await inventoryUseCase.adjustStock({
        storeId: 'chupei',
        productId: 'GK-99',
        delta: 3,
        reason: '進貨入庫手動調整',
        operator: 'manager@onesoul.tw',
      });
      expect(isOk(r1)).toBe(true);

      // 2. Member operation
      const r2 = await memberUseCase.adjustPoints({
        memberId: 'mem-99',
        delta: 50,
        reason: '會員點數儲值補償',
        operator: 'manager@onesoul.tw',
      });
      expect(isOk(r2)).toBe(true);

      // 3. Session operation
      const r3 = await sessionUseCase.closeSession({
        sessionId: 'sess-99',
        closedBy: 'cashier@onesoul.tw',
        actualCash: 8000,
        note: '收銀班次日結關帳',
      });
      expect(isOk(r3)).toBe(true);

      // 4. PreOrder operation
      const r4 = await preOrderUseCase.receivePreOrder('po-99', {
        targetStoreId: 'chupei',
        productId: 'GK-100',
        sellingPrice: 4000,
        operator: 'warehouse@onesoul.tw',
      });
      expect(isOk(r4)).toBe(true);

      // Verify intact linear chain
      const verifyRes = await auditUseCase.verifyChain();
      expect(isOk(verifyRes)).toBe(true);
      if (!isOk(verifyRes)) return;
      expect(verifyRes.data.valid).toBe(true);
      expect(verifyRes.data.totalCount).toBe(4);

      // Inspect individual blocks in exact insertion order
      const directLogs = (auditRepo as any).logs as AuditLog[];
      expect(directLogs.length).toBe(4);
      expect(directLogs[0].prevHash).toBe(AuditLog.GENESIS_HASH);
      expect(directLogs[1].prevHash).toBe(directLogs[0].currentHash);
      expect(directLogs[2].prevHash).toBe(directLogs[1].currentHash);
      expect(directLogs[3].prevHash).toBe(directLogs[2].currentHash);
    });

    it('catches forged audit log inserted with broken hash', async () => {
      // 1. Create 3 valid logs
      for (let i = 1; i <= 3; i++) {
        await auditUseCase.recordLog({
          operatorId: `op-${i}`,
          action: `ACTION_${i}`,
          targetType: 'MEMBER',
          targetId: `target-${i}`,
          delta: i * 10,
          reason: `正常業務操作 ${i}`,
        });
      }

      const validCheck = await auditUseCase.verifyChain();
      expect(isOk(validCheck)).toBe(true);
      if (!isOk(validCheck)) return;
      expect(validCheck.data.valid).toBe(true);
      expect(validCheck.data.totalCount).toBe(3);

      // 2. Insert a forged log with fake currentHash into repository
      const latestHash = await auditRepo.getLatestHash();
      const forgedLog = new AuditLog({
        id: 'forged-log-001',
        operatorId: 'attacker@evil.com',
        action: 'UNAUTHORIZED_EXPULSION',
        targetType: 'STORE_INVENTORY',
        targetId: 'chupei:GK-99',
        delta: -99,
        reason: '惡意偷盜出庫',
        prevHash: latestHash,
        currentHash: 'badf00dbadf00dbadf00dbadf00dbadf00dbadf00dbadf00dbadf00dbadf00d',
      });
      await auditRepo.append(forgedLog);

      // 3. verifyChain must catch forged block
      const tamperedCheck = await auditUseCase.verifyChain();
      expect(isOk(tamperedCheck)).toBe(true);
      if (!isOk(tamperedCheck)) return;
      expect(tamperedCheck.data.valid).toBe(false);
      expect(tamperedCheck.data.brokenAt).toBe('forged-log-001');
    });

    it('catches in-place tampering of delta or reason in an existing block', async () => {
      await auditUseCase.recordLog({
        operatorId: 'op-1',
        action: 'STOCK_ADJUST',
        targetType: 'STORE_INVENTORY',
        targetId: 'prod-1',
        delta: 1,
        reason: '初始調整',
      });
      const log2 = await auditUseCase.recordLog({
        operatorId: 'op-2',
        action: 'STOCK_ADJUST',
        targetType: 'STORE_INVENTORY',
        targetId: 'prod-2',
        delta: 2,
        reason: '正常調整',
      });
      await auditUseCase.recordLog({
        operatorId: 'op-3',
        action: 'STOCK_ADJUST',
        targetType: 'STORE_INVENTORY',
        targetId: 'prod-3',
        delta: 3,
        reason: '後續調整',
      });

      expect(isOk(log2)).toBe(true);
      if (!isOk(log2)) return;

      // Tamper delta from 2 to 2000
      (log2.data as any).delta = 2000;

      const checkTampered = await auditUseCase.verifyChain();
      expect(isOk(checkTampered)).toBe(true);
      if (!isOk(checkTampered)) return;
      expect(checkTampered.data.valid).toBe(false);
      expect(checkTampered.data.brokenAt).toBe(log2.data.id);
    });

    it('catches severed link when an intermediate block is excised', async () => {
      const logsCreated: AuditLog[] = [];
      for (let i = 1; i <= 4; i++) {
        const res = await auditUseCase.recordLog({
          operatorId: `op-${i}`,
          action: 'LOG',
          targetType: 'SYS',
          targetId: `id-${i}`,
          reason: `操作 ${i}`,
        });
        if (isOk(res)) logsCreated.push(res.data);
      }

      // Maliciously remove block 2 from internal array
      const allLogs = (auditRepo as any).logs as AuditLog[];
      expect(allLogs.length).toBe(4);
      allLogs.splice(1, 1); // remove index 1 (log 2)
      expect(allLogs.length).toBe(3);

      // Now block 3 (now index 1) prevHash points to log 2, but log 1 is previous!
      const checkBroken = await auditUseCase.verifyChain();
      expect(isOk(checkBroken)).toBe(true);
      if (!isOk(checkBroken)) return;
      expect(checkBroken.data.valid).toBe(false);
      expect(checkBroken.data.brokenAt).toBe(logsCreated[2].id);
    });

    it('rejects chain verification if secret key does not match', async () => {
      await auditUseCase.recordLog({
        operatorId: 'op-1',
        action: 'OP',
        targetType: 'TYPE',
        targetId: 'id-1',
        reason: '正常操作',
      });

      // Verify using a repo created with mismatched secret
      const attackerRepo = new InMemoryAuditRepository('wrong-secret-key-666');
      const forgedLog = (await auditRepo.list())[0];
      await attackerRepo.append(forgedLog);

      const attackerVerify = await attackerRepo.verifyChain();
      expect(attackerVerify.valid).toBe(false);
      expect(attackerVerify.brokenAt).toBe(forgedLog.id);
    });

    it('handles empty chain without errors', async () => {
      const emptyCheck = await auditUseCase.verifyChain();
      expect(isOk(emptyCheck)).toBe(true);
      if (!isOk(emptyCheck)) return;
      expect(emptyCheck.data.valid).toBe(true);
      expect(emptyCheck.data.totalCount).toBe(0);
    });
  });

  describe('Area 2: Concurrency Lock Ordering & Multi-Item Rollback Attacks', () => {
    it('strictly enforces sortProductIdsForLock alphabetical ordering on reversed and duplicate product IDs', () => {
      const reversedIds = ['PROD-Z', 'PROD-Y', 'PROD-M', 'PROD-B', 'PROD-A'];
      const sorted = sortProductIdsForLock(reversedIds);
      expect(sorted).toEqual(['PROD-A', 'PROD-B', 'PROD-M', 'PROD-Y', 'PROD-Z']);

      // Messy array with duplicates, nulls, undefined, and empty whitespace
      const messyIds = [
        'GK-900',
        null,
        'GK-100',
        undefined,
        '',
        'GK-900',
        '   ',
        'GK-500',
        'GK-100',
      ];
      const sortedMessy = sortProductIdsForLock(messyIds);
      expect(sortedMessy).toEqual(['GK-100', 'GK-500', 'GK-900']);
    });

    it('executes mixed cart lottery and merchandise deductions in strict alphabetical order', async () => {
      const txManager = new InMemoryTransactionManager();
      const orderRepo = new InMemoryOrderRepository();
      const invRepo = new InMemoryInventoryRepository();
      const luckyBagRepo = new InMemoryLuckyBagRepository();
      const memberRepo = new InMemoryMemberRepository();
      const sessionRepo = new InMemorySessionRepository();

      txManager.register(orderRepo);
      txManager.register(invRepo);
      txManager.register(luckyBagRepo);
      txManager.register(memberRepo);
      txManager.register(sessionRepo);

      const checkoutUseCase = new CheckoutUseCase(
        orderRepo,
        invRepo,
        luckyBagRepo,
        memberRepo,
        sessionRepo,
        txManager
      );

      // Seed session
      await sessionRepo.save(
        new CashRegisterSession({
          id: 'sess-lock',
          storeId: 'chupei',
          openedBy: 'cashier@onesoul.tw',
          openingCash: 8000,
        })
      );

      // Seed 4 products in StoreInventory
      // Intentionally create IDs: 'PROD-Z', 'PROD-M', 'PROD-B', 'PROD-A'
      const productIds = ['PROD-Z', 'PROD-M', 'PROD-B', 'PROD-A'];
      for (const pid of productIds) {
        await invRepo.saveProduct(
          new Product({ id: pid, name: `商品 ${pid}`, costPrice: 100, sellingPrice: 200 })
        );
        await invRepo.save(
          new StoreInventory({ id: `inv-${pid}`, storeId: 'chupei', productId: pid, quantity: 10 })
        );
      }

      // Seed lucky bag with grand prize mapped to PROD-Z
      const bag = new LuckyBag({
        id: 'lb-lock',
        storeId: 'chupei',
        name: '一番賞 鎖定測試套',
        unitPrice: 200,
      });
      const prizes = [
        new LuckyBagPrize({
          id: 'pz-a',
          bagId: 'lb-lock',
          prizeGrade: 'A',
          prizeName: '大賞 GK 雕像 Z',
          draws: 2,
          drawnCount: 0,
          productId: 'PROD-Z',
        }),
      ];
      await luckyBagRepo.saveBagWithPrizes(bag, prizes);

      // Spy on deductQuantities to observe locking order
      const deductionCallOrder: string[][] = [];
      const origDeduct = invRepo.deductQuantities.bind(invRepo);
      invRepo.deductQuantities = async (storeId: string, deductions: { productId: string; quantity: number }[]) => {
        deductionCallOrder.push(deductions.map((d) => d.productId));
        return origDeduct(storeId, deductions);
      };

      // Execute mixed checkout:
      // Item 1: Lottery A (productId: 'PROD-Z')
      // Item 2: Retail merchandise (productId: 'PROD-M')
      // Item 3: Retail merchandise (productId: 'PROD-B')
      // Item 4: Retail merchandise (productId: 'PROD-A')
      // Input array is completely reversed from alphabetical order!
      const res = await checkoutUseCase.execute({
        storeId: 'chupei',
        customer: { phone: '0912345678' },
        lotteries: [
          {
            bagId: 'lb-lock',
            prizeGrade: 'A',
            draws: 1,
            pickType: 'TAKE_AWAY',
            unitPrice: 200,
            amount: 200,
          },
        ],
        merchandises: [
          { productId: 'PROD-M', quantity: 1, paymentType: '現金', unitPrice: 200, amount: 200 },
          { productId: 'PROD-B', quantity: 2, paymentType: '現金', unitPrice: 200, amount: 400 },
          { productId: 'PROD-A', quantity: 1, paymentType: '現金', unitPrice: 200, amount: 200 },
        ],
        payment: { cash: 1000, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
        cashierEmail: 'cashier@onesoul.tw',
      });

      expect(isOk(res)).toBe(true);

      // Verify that deductQuantities received the deduplicated, strictly alphabetical list
      expect(deductionCallOrder.length).toBe(1);
      expect(deductionCallOrder[0]).toEqual(['PROD-A', 'PROD-B', 'PROD-M', 'PROD-Z']);

      // Verify all inventory deductions succeeded
      expect((await invRepo.findByStoreAndProduct('chupei', 'PROD-A'))?.quantity).toBe(9);
      expect((await invRepo.findByStoreAndProduct('chupei', 'PROD-B'))?.quantity).toBe(8);
      expect((await invRepo.findByStoreAndProduct('chupei', 'PROD-M'))?.quantity).toBe(9);
      expect((await invRepo.findByStoreAndProduct('chupei', 'PROD-Z'))?.quantity).toBe(9);
    });

    it('ensures zero state leakage when transaction aborts midway through multi-item checkout', async () => {
      const txManager = new InMemoryTransactionManager();
      const orderRepo = new InMemoryOrderRepository();
      const invRepo = new InMemoryInventoryRepository();
      const luckyBagRepo = new InMemoryLuckyBagRepository();
      const memberRepo = new InMemoryMemberRepository();
      const sessionRepo = new InMemorySessionRepository();

      txManager.register(orderRepo);
      txManager.register(invRepo);
      txManager.register(luckyBagRepo);
      txManager.register(memberRepo);
      txManager.register(sessionRepo);

      const checkoutUseCase = new CheckoutUseCase(
        orderRepo,
        invRepo,
        luckyBagRepo,
        memberRepo,
        sessionRepo,
        txManager
      );

      await sessionRepo.save(
        new CashRegisterSession({
          id: 'sess-fail',
          storeId: 'chupei',
          openedBy: 'cashier@onesoul.tw',
          openingCash: 8000,
        })
      );

      // Product 1 has plenty of stock (10)
      await invRepo.saveProduct(new Product({ id: 'PROD-1', name: '商品 1', costPrice: 100, sellingPrice: 300 }));
      await invRepo.save(new StoreInventory({ id: 'inv-1', storeId: 'chupei', productId: 'PROD-1', quantity: 10 }));

      // Product 2 has insufficient stock (only 1, but order requests 5!)
      await invRepo.saveProduct(new Product({ id: 'PROD-2', name: '商品 2', costPrice: 100, sellingPrice: 300 }));
      await invRepo.save(new StoreInventory({ id: 'inv-2', storeId: 'chupei', productId: 'PROD-2', quantity: 1 }));

      const res = await checkoutUseCase.execute({
        storeId: 'chupei',
        customer: { phone: '0912345678' },
        merchandises: [
          { productId: 'PROD-1', quantity: 2, paymentType: '現金', unitPrice: 300, amount: 600 },
          { productId: 'PROD-2', quantity: 5, paymentType: '現金', unitPrice: 300, amount: 1500 },
        ],
        payment: { cash: 2100, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
        cashierEmail: 'cashier@onesoul.tw',
      });

      // Must fail with INSUFFICIENT_STOCK
      expect(isErr(res)).toBe(true);
      if (!isErr(res)) return;
      expect(res.error.code).toBe('INSUFFICIENT_STOCK');

      // Product 1 stock MUST NOT be partially deducted
      const inv1 = await invRepo.findByStoreAndProduct('chupei', 'PROD-1');
      expect(inv1?.quantity).toBe(10);

      // Product 2 stock must remain 1
      const inv2 = await invRepo.findByStoreAndProduct('chupei', 'PROD-2');
      expect(inv2?.quantity).toBe(1);

      // No inventory logs should exist
      const logs = await invRepo.findLogsByStore('chupei');
      expect(logs.length).toBe(0);

      // No orders should exist
      const orders = await orderRepo.listByStore('chupei');
      expect(orders.length).toBe(0);
    });
  });

  describe('Area 3: In-Place Mutation Rollback in Repositories', () => {
    it('restores InMemoryOrderRepository snapshot completely on transaction abort during voidOrder', async () => {
      const txManager = new InMemoryTransactionManager();
      const orderRepo = new InMemoryOrderRepository();
      const invRepo = new InMemoryInventoryRepository();
      const luckyBagRepo = new InMemoryLuckyBagRepository();
      const memberRepo = new InMemoryMemberRepository();
      const sessionRepo = new InMemorySessionRepository();

      txManager.register(orderRepo);
      txManager.register(invRepo);
      txManager.register(luckyBagRepo);
      txManager.register(memberRepo);
      txManager.register(sessionRepo);

      const checkoutUseCase = new CheckoutUseCase(
        orderRepo,
        invRepo,
        luckyBagRepo,
        memberRepo,
        sessionRepo,
        txManager
      );

      await sessionRepo.save(
        new CashRegisterSession({
          id: 'sess-rb',
          storeId: 'chupei',
          openedBy: 'cashier@onesoul.tw',
          openingCash: 8000,
        })
      );
      await invRepo.saveProduct(new Product({ id: 'P-1', name: '商品 1', costPrice: 100, sellingPrice: 500 }));
      await invRepo.save(new StoreInventory({ id: 'inv-p1', storeId: 'chupei', productId: 'P-1', quantity: 10 }));

      // Complete an initial order
      const uid = 'order-deep-clone-rollback-999';
      const checkoutRes = await checkoutUseCase.execute({
        storeId: 'chupei',
        customer: { phone: '0912345678' },
        merchandises: [
          { productId: 'P-1', quantity: 2, paymentType: '現金', unitPrice: 500, amount: 1000 },
        ],
        payment: { cash: 1000, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
        cashierEmail: 'cashier@onesoul.tw',
        checkoutUID: uid,
      });

      expect(isOk(checkoutRes)).toBe(true);
      const originalOrder = await orderRepo.findByCheckoutUID(uid);
      expect(originalOrder?.status).toBe('COMPLETED');
      expect(originalOrder?.voidReason).toBeNull();
      expect(originalOrder?.voidedAt).toBeNull();

      // Sabotage inventoryRepo.addQuantities to throw an error during voidOrder rollback
      const origAdd = invRepo.addQuantities.bind(invRepo);
      invRepo.addQuantities = async () => {
        throw new Error('DATABASE_CONNECTION_LOST_DURING_VOID');
      };

      try {
        const voidRes = await checkoutUseCase.voidOrder(uid, '顧客反悔退款', 'manager@onesoul.tw');
        expect(isErr(voidRes)).toBe(true);
      } finally {
        invRepo.addQuantities = origAdd;
      }

      // Verify that InMemoryOrderRepository rolled back order state from snapshot
      const orderAfterRollback = await orderRepo.findByCheckoutUID(uid);
      expect(orderAfterRollback?.status).toBe('COMPLETED');
      expect(orderAfterRollback?.voidReason).toBeNull();
      expect(orderAfterRollback?.voidedAt).toBeNull();
      expect(orderAfterRollback?.voidedBy).toBeNull();

      // Verify inv quantity was NOT refunded due to abort
      const invAfterAbort = await invRepo.findByStoreAndProduct('chupei', 'P-1');
      expect(invAfterAbort?.quantity).toBe(8); // Still 8 from initial checkout
    });

    it('proves Order.clone creates an isolated reference that protects against object mutation', () => {
      const order = new Order({
        id: 'ord-orig',
        checkoutUID: 'uid-orig',
        storeId: 'chupei',
        sessionId: 'sess-1',
        memberPhone: new PhoneNumber('0912345678'),
        memberId: 'mem-1',
        totalDue: 500,
        receivedAmount: 500,
        payment: { cash: 500, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
        netPointsDelta: 0,
        items: [
          new OrderItem({
            id: 'item-1',
            orderId: 'uid-orig',
            itemType: 'MERCHANDISE',
            productId: 'PROD-1',
            quantity: 1,
            unitPrice: 500,
            amount: 500,
            pointsImpact: 0,
          }),
        ],
        cashierEmail: 'cashier@onesoul.tw',
      });

      const cloned = order.clone();
      expect(cloned.id).toBe(order.id);
      expect(cloned.status).toBe('COMPLETED');

      // Mutate original order
      order.void('測試作廢', 'admin@onesoul.tw');
      expect(order.status).toBe('CANCELLED');

      // Cloned order MUST remain unaffected
      expect(cloned.status).toBe('COMPLETED');
      expect(cloned.voidReason).toBeNull();
      expect(cloned.voidedAt).toBeNull();

      // Mutate items on original
      (order.items[0] as any).quantity = 999;
      expect(cloned.items[0].quantity).toBe(1);
    });

    it('restores InMemoryInventoryRepository in-place deductions and discards logs on transaction abort', async () => {
      const txManager = new InMemoryTransactionManager();
      const invRepo = new InMemoryInventoryRepository();
      txManager.register(invRepo);

      await invRepo.saveProduct(new Product({ id: 'GK-TEST', name: '大賞 GK 雕像 測試', costPrice: 1000, sellingPrice: 2000 }));
      await invRepo.save(new StoreInventory({ id: 'inv-t1', storeId: 'chupei', productId: 'GK-TEST', quantity: 15 }));

      // Execute a transaction that mutates inventory, writes logs, but aborts
      await expect(
        txManager.runInTransaction(async () => {
          await invRepo.deductQuantities('chupei', [{ productId: 'GK-TEST', quantity: 5 }]);

          // Verify in-place mutation happened inside transaction
          const innerInv = await invRepo.findByStoreAndProduct('chupei', 'GK-TEST');
          expect(innerInv?.quantity).toBe(10);

          await invRepo.recordLog(
            new InventoryLog({
              id: 'log-temp',
              storeId: 'chupei',
              productId: 'GK-TEST',
              changeType: 'SALE',
              delta: -5,
              balance: 10,
              orderId: 'temp-ord',
              operator: 'tester',
              reason: '測試交易中途失敗',
            })
          );

          // Now abort
          throw new Error('SIMULATED_TRANSACTION_FAILURE');
        })
      ).rejects.toThrow('SIMULATED_TRANSACTION_FAILURE');

      // Verify that after rollback:
      // 1. Inventory quantity is restored from 10 back to 15
      const restoredInv = await invRepo.findByStoreAndProduct('chupei', 'GK-TEST');
      expect(restoredInv?.quantity).toBe(15);

      // 2. Uncommitted inventory logs are completely discarded
      const logs = await invRepo.findLogsByStore('chupei');
      expect(logs.length).toBe(0);
    });

    it('restores InMemoryLuckyBagRepository drawnCount and status on transaction abort', async () => {
      const txManager = new InMemoryTransactionManager();
      const luckyBagRepo = new InMemoryLuckyBagRepository();
      txManager.register(luckyBagRepo);

      const bag = new LuckyBag({
        id: 'lb-abort-test',
        storeId: 'chupei',
        name: '一番賞 復原測試套',
        unitPrice: 200,
      });
      const prizes = [
        new LuckyBagPrize({
          id: 'pz-abort-a',
          bagId: 'lb-abort-test',
          prizeGrade: 'A',
          prizeName: '大賞 GK 雕像 測試',
          draws: 1,
          drawnCount: 0,
          productId: 'GK-TEST',
        }),
      ];
      await luckyBagRepo.saveBagWithPrizes(bag, prizes);

      await expect(
        txManager.runInTransaction(async () => {
          // Increment drawnCount to deplete the bag
          await luckyBagRepo.incrementDrawnCount('lb-abort-test', 'A', 1);

          const innerPrize = await luckyBagRepo.findPrize('lb-abort-test', 'A');
          expect(innerPrize?.drawnCount).toBe(1);

          const innerBag = await luckyBagRepo.findById('lb-abort-test');
          expect(innerBag?.status).toBe('DEPLETED');

          throw new Error('ROLLBACK_LUCKY_BAG');
        })
      ).rejects.toThrow('ROLLBACK_LUCKY_BAG');

      // After abort: prize drawnCount should be 0, bag status should be ACTIVE
      const restoredPrize = await luckyBagRepo.findPrize('lb-abort-test', 'A');
      expect(restoredPrize?.drawnCount).toBe(0);

      const restoredBag = await luckyBagRepo.findById('lb-abort-test');
      expect(restoredBag?.status).toBe('ACTIVE');
    });
  });

  describe('Area 4: Walk-In Points Penetration & Forged Payload Attacks (Invariant #1)', () => {
    let checkoutUseCase: CheckoutUseCase;
    let invRepo: InMemoryInventoryRepository;
    let luckyBagRepo: InMemoryLuckyBagRepository;

    beforeEach(async () => {
      const txManager = new InMemoryTransactionManager();
      const orderRepo = new InMemoryOrderRepository();
      invRepo = new InMemoryInventoryRepository();
      luckyBagRepo = new InMemoryLuckyBagRepository();
      const memberRepo = new InMemoryMemberRepository();
      const sessionRepo = new InMemorySessionRepository();

      txManager.register(orderRepo);
      txManager.register(invRepo);
      txManager.register(luckyBagRepo);
      txManager.register(memberRepo);
      txManager.register(sessionRepo);

      checkoutUseCase = new CheckoutUseCase(
        orderRepo,
        invRepo,
        luckyBagRepo,
        memberRepo,
        sessionRepo,
        txManager
      );

      await sessionRepo.save(
        new CashRegisterSession({
          id: 'sess-walkin',
          storeId: 'chupei',
          openedBy: 'cashier@onesoul.tw',
          openingCash: 8000,
        })
      );

      // Seed regular product
      await invRepo.saveProduct(new Product({ id: 'GK-NORM', name: '大賞 GK 雕像 正常', costPrice: 500, sellingPrice: 1000 }));
      await invRepo.save(new StoreInventory({ id: 'inv-norm', storeId: 'chupei', productId: 'GK-NORM', quantity: 10 }));

      // Seed points bag (isPointsSet: true)
      const pointsBag = new LuckyBag({
        id: 'lb-points-set',
        storeId: 'chupei',
        name: '限定點數套 一番賞',
        unitPrice: 200,
        isPointsSet: true,
      });
      const pointsPrizes = [
        new LuckyBagPrize({
          id: 'pz-pts-a',
          bagId: 'lb-points-set',
          prizeGrade: 'A',
          prizeName: '大賞 GK 雕像 點數限定',
          draws: 2,
          drawnCount: 0,
          productId: 'GK-NORM',
        }),
      ];
      await luckyBagRepo.saveBagWithPrizes(pointsBag, pointsPrizes);

      // Seed regular bag (isPointsSet: false) with X and Z small prizes
      const regularBag = new LuckyBag({
        id: 'lb-reg-set',
        storeId: 'chupei',
        name: '一般一番賞',
        unitPrice: 300,
        isPointsSet: false,
      });
      const regPrizes = [
        new LuckyBagPrize({
          id: 'pz-reg-a',
          bagId: 'lb-reg-set',
          prizeGrade: 'A',
          prizeName: '大賞 GK 雕像 正常',
          draws: 2,
          drawnCount: 0,
          productId: 'GK-NORM',
        }),
        new LuckyBagPrize({
          id: 'pz-reg-z',
          bagId: 'lb-reg-set',
          prizeGrade: 'Z',
          prizeName: '徽章保底小賞',
          draws: 8,
          drawnCount: 0,
          productId: 'z',
          points: 1,
        }),
      ];
      await luckyBagRepo.saveBagWithPrizes(regularBag, regPrizes);
    });

    const walkInPhones = [
      'WALKIN',
      'walk-in',
      '111111',
      '222222',
      '333333',
      '88888',
      '99999',
      '000000',
      '散客',
      '現場散客',
      '\u975e\u6703\u54e1',
      '\u81e8\u6642\u5ba2',
      '\u8a2a\u5ba2',
      '  111111  ',
      '',
      undefined,
    ];

    it('rejects forged payload that omits isPointsSet flag when drawing from a points set', async () => {
      for (const phone of walkInPhones) {
        // Attacker intentionally omits isPointsSet: true in payload
        const res = await checkoutUseCase.execute({
          storeId: 'chupei',
          customer: { phone },
          lotteries: [
            {
              bagId: 'lb-points-set',
              prizeGrade: 'A',
              draws: 1,
              pickType: 'TAKE_AWAY',
              unitPrice: 200,
              amount: 0,
            },
          ],
          payment: { cash: 0, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
          cashierEmail: 'cashier@onesoul.tw',
        });

        expect(isErr(res)).toBe(true);
        if (!isErr(res)) return;
        expect(res.error.code).toBe('INVARIANT_VIOLATION');
        expect(res.error.message).toContain('散客無會員帳號，嚴禁使用點數扣抵或抽取點數套');
      }

      // Confirm StoreInventory for GK-NORM remained completely untouched
      const inv = await invRepo.findByStoreAndProduct('chupei', 'GK-NORM');
      expect(inv?.quantity).toBe(10);
    });

    it('rejects walk-in choosing pickType: POINTS to convert small prizes into points', async () => {
      for (const phone of walkInPhones) {
        const res = await checkoutUseCase.execute({
          storeId: 'chupei',
          customer: { phone },
          lotteries: [
            {
              bagId: 'lb-reg-set',
              prizeGrade: 'Z',
              draws: 1,
              pickType: 'POINTS', // Maliciously trying to get points without member account
              unitPrice: 300,
              amount: 300,
            },
          ],
          payment: { cash: 300, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
          cashierEmail: 'cashier@onesoul.tw',
        });

        expect(isErr(res)).toBe(true);
        if (!isErr(res)) return;
        expect(res.error.code).toBe('INVARIANT_VIOLATION');
      }
    });

    it('rejects walk-in attempting to sneak in pointsUsed in payment payload', async () => {
      for (const phone of walkInPhones) {
        const res = await checkoutUseCase.execute({
          storeId: 'chupei',
          customer: { phone },
          merchandises: [
            { productId: 'GK-NORM', quantity: 1, paymentType: '現金', unitPrice: 1000, amount: 990 },
          ],
          payment: { cash: 990, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 10 },
          cashierEmail: 'cashier@onesoul.tw',
        });

        expect(isErr(res)).toBe(true);
        if (!isErr(res)) return;
        expect(res.error.code).toBe('INVARIANT_VIOLATION');
      }
    });

    it('rejects mixed cart where a single lottery item has pickType: POINTS while others are cash', async () => {
      const res = await checkoutUseCase.execute({
        storeId: 'chupei',
        customer: { phone: '111111' },
        lotteries: [
          // Item 1: Valid cash draw
          {
            bagId: 'lb-reg-set',
            prizeGrade: 'A',
            draws: 1,
            pickType: 'TAKE_AWAY',
            unitPrice: 300,
            amount: 300,
          },
          // Item 2: Forged pickType POINTS
          {
            bagId: 'lb-reg-set',
            prizeGrade: 'Z',
            draws: 1,
            pickType: 'POINTS',
            unitPrice: 300,
            amount: 300,
          },
        ],
        payment: { cash: 600, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
        cashierEmail: 'cashier@onesoul.tw',
      });

      expect(isErr(res)).toBe(true);
      if (!isErr(res)) return;
      expect(res.error.code).toBe('INVARIANT_VIOLATION');

      // Neither A prize drawnCount nor store inventory should be mutated
      const prizeA = await luckyBagRepo.findPrize('lb-reg-set', 'A');
      expect(prizeA?.drawnCount).toBe(0);
      const inv = await invRepo.findByStoreAndProduct('chupei', 'GK-NORM');
      expect(inv?.quantity).toBe(10);
    });
  });
});
