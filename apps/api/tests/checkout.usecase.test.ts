import { describe, it, expect, beforeEach } from 'vitest';
import {
  CheckoutUseCase,
  InMemoryOrderRepository,
  InMemoryInventoryRepository,
  InMemoryLuckyBagRepository,
  InMemoryMemberRepository,
  InMemorySessionRepository,
  InMemoryTransactionManager,
  Product,
  StoreInventory,
  LuckyBag,
  LuckyBagPrize,
  Member,
} from '../src';
import { isOk, isErr } from '@onesoul/shared';

describe('CheckoutUseCase', () => {
  let checkoutUseCase: CheckoutUseCase;
  let orderRepo: InMemoryOrderRepository;
  let invRepo: InMemoryInventoryRepository;
  let luckyBagRepo: InMemoryLuckyBagRepository;
  let memberRepo: InMemoryMemberRepository;
  let sessionRepo: InMemorySessionRepository;
  let txManager: InMemoryTransactionManager;

  beforeEach(async () => {
    orderRepo = new InMemoryOrderRepository();
    invRepo = new InMemoryInventoryRepository();
    luckyBagRepo = new InMemoryLuckyBagRepository();
    memberRepo = new InMemoryMemberRepository();
    sessionRepo = new InMemorySessionRepository();
    txManager = new InMemoryTransactionManager();

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

    // Seed master data
    await invRepo.saveProduct(
      new Product({ id: 'GK-4100', name: '大賞 GK 雕像 魯夫', costPrice: 2000, sellingPrice: 3500 })
    );
    await invRepo.saveProduct(
      new Product({ id: 'PROD-001', name: '一般收藏模型', costPrice: 300, sellingPrice: 500 })
    );
    await invRepo.save(
      new StoreInventory({ id: 'inv-1', storeId: 'chupei', productId: 'GK-4100', quantity: 5 })
    );
    await invRepo.save(
      new StoreInventory({ id: 'inv-2', storeId: 'chupei', productId: 'PROD-001', quantity: 10 })
    );

    // Seed member
    await memberRepo.save(
      new Member({ id: 'mem-1', phone: '0912345678', name: '王小明', points: 100 })
    );

    // Seed lucky bags
    await luckyBagRepo.saveBagWithPrizes(
      new LuckyBag({
        id: 'lb-regular',
        storeId: 'chupei',
        name: '海賊王 GK 一般套',
        unitPrice: 350,
        isPointsSet: false,
      }),
      [
        new LuckyBagPrize({
          id: 'prz-a',
          bagId: 'lb-regular',
          prizeGrade: 'A',
          prizeName: '大賞 GK 雕像 魯夫',
          productId: 'GK-4100',
          draws: 2,
          drawnCount: 0,
        }),
        new LuckyBagPrize({
          id: 'prz-x',
          bagId: 'lb-regular',
          prizeGrade: 'X',
          prizeName: '盲盒賞',
          productId: null,
          draws: 20,
          drawnCount: 0,
        }),
        new LuckyBagPrize({
          id: 'prz-z',
          bagId: 'lb-regular',
          prizeGrade: 'Z',
          prizeName: '保底小賞',
          productId: null,
          draws: 58,
          drawnCount: 0,
        }),
      ]
    );

    await luckyBagRepo.saveBagWithPrizes(
      new LuckyBag({
        id: 'lb-points',
        storeId: 'chupei',
        name: '海賊王 純點數套',
        unitPrice: 350,
        isPointsSet: true,
      }),
      [
        new LuckyBagPrize({
          id: 'prz-pts-a',
          bagId: 'lb-points',
          prizeGrade: 'A',
          prizeName: '大賞 GK 雕像 魯夫',
          productId: 'GK-4100',
          draws: 2,
          drawnCount: 0,
        }),
      ]
    );
  });

  describe('1. Retail Merchandise Checkout', () => {
    it('successfully checks out retail merchandise with cash and reduces store inventory', async () => {
      const result = await checkoutUseCase.execute({
        storeId: 'chupei',
        customer: { phone: '0912345678', name: '王小明' },
        merchandises: [
          {
            productId: 'PROD-001',
            quantity: 2,
            paymentType: '現金',
            unitPrice: 500,
            amount: 1000,
          },
        ],
        payment: { cash: 1000, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
        cashierEmail: 'cashier@onesoul.tw',
      });

      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      expect(result.data.totalDue).toBe(1000);
      expect(result.data.netPointsDelta).toBe(0);

      // Verify inventory deducted
      const inv = await invRepo.findByStoreAndProduct('chupei', 'PROD-001');
      expect(inv?.quantity).toBe(8); // 10 - 2 = 8

      // Verify inventory log recorded
      const logs = await invRepo.findLogsByStore('chupei');
      expect(logs.length).toBe(1);
      expect(logs[0].changeType).toBe('SALE');
      expect(logs[0].delta).toBe(-2);
    });

    it('supports special virtual items 88888 (add points) and 99999 (deduct points)', async () => {
      const result = await checkoutUseCase.execute({
        storeId: 'chupei',
        customer: { phone: '0912345678', name: '王小明' },
        merchandises: [
          {
            productId: '88888',
            quantity: 25,
            paymentType: '現金',
            unitPrice: 0,
            amount: 0,
          },
        ],
        payment: { cash: 0, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
        cashierEmail: 'cashier@onesoul.tw',
      });

      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      expect(result.data.netPointsDelta).toBe(25);
      expect(result.data.memberPoints).toBe(125); // 100 + 25
    });
  });

  describe('2. Lottery Checkout (TAKE_AWAY vs POINTS)', () => {
    it('deducts StoreInventory when prize is TAKE_AWAY with physical GK', async () => {
      const result = await checkoutUseCase.execute({
        storeId: 'chupei',
        customer: { phone: '0912345678', name: '王小明' },
        lotteries: [
          {
            bagId: 'lb-regular',
            prizeGrade: 'A',
            draws: 1,
            pickType: 'TAKE_AWAY',
            unitPrice: 350,
            amount: 350,
          },
        ],
        payment: { cash: 350, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
        cashierEmail: 'cashier@onesoul.tw',
      });

      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      // Prize drawnCount incremented
      const prize = await luckyBagRepo.findPrize('lb-regular', 'A');
      expect(prize?.drawnCount).toBe(1);

      // Store inventory deducted
      const inv = await invRepo.findByStoreAndProduct('chupei', 'GK-4100');
      expect(inv?.quantity).toBe(4); // 5 - 1 = 4
    });

    it('does NOT deduct StoreInventory when prize is converted to POINTS (X=10P, Z=1P)', async () => {
      const result = await checkoutUseCase.execute({
        storeId: 'chupei',
        customer: { phone: '0912345678', name: '王小明' },
        lotteries: [
          {
            bagId: 'lb-regular',
            prizeGrade: 'X',
            draws: 2,
            pickType: 'POINTS',
            unitPrice: 350,
            amount: 700,
          },
          {
            bagId: 'lb-regular',
            prizeGrade: 'Z',
            draws: 3,
            pickType: 'POINTS',
            unitPrice: 350,
            amount: 1050,
          },
        ],
        payment: { cash: 1750, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
        cashierEmail: 'cashier@onesoul.tw',
      });

      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      // X: 2 draws * 10 = 20 pts, Z: 3 draws * 1 = 3 pts => total netPointsDelta = +23
      expect(result.data.netPointsDelta).toBe(23);
      expect(result.data.memberPoints).toBe(123); // 100 + 23

      // GK inventory unchanged
      const inv = await invRepo.findByStoreAndProduct('chupei', 'GK-4100');
      expect(inv?.quantity).toBe(5);
    });
  });

  describe('3. Points Set Checkout (Invariant #2)', () => {
    it('requires $0 amount and deducts floor(unitPrice / 20) * draws points from member', async () => {
      // Unit price 350, 2 draws => points cost = floor(350/20) * 2 = 17 * 2 = 34
      const result = await checkoutUseCase.execute({
        storeId: 'chupei',
        customer: { phone: '0912345678', name: '王小明' },
        lotteries: [
          {
            bagId: 'lb-points',
            prizeGrade: 'A',
            draws: 2,
            pickType: 'TAKE_AWAY',
            unitPrice: 350,
            amount: 0,
            isPointsSet: true,
          },
        ],
        payment: { cash: 0, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
        cashierEmail: 'cashier@onesoul.tw',
      });

      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      expect(result.data.totalDue).toBe(0);
      expect(result.data.netPointsDelta).toBe(-34);
      expect(result.data.memberPoints).toBe(66); // 100 - 34

      // Physical GK deducted 2 units
      const inv = await invRepo.findByStoreAndProduct('chupei', 'GK-4100');
      expect(inv?.quantity).toBe(3); // 5 - 2 = 3
    });
  });

  describe('4. Invariant #1: Walk-In Block', () => {
    it('blocks walk-in customers from using points or drawing points sets', async () => {
      const result = await checkoutUseCase.execute({
        storeId: 'chupei',
        customer: { phone: '111111' },
        payment: { cash: 100, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 10 },
        cashierEmail: 'cashier@onesoul.tw',
      });

      expect(isErr(result)).toBe(true);
      if (!isErr(result)) return;
      expect(result.error.code).toBe('INVARIANT_VIOLATION');
    });

    it('blocks walk-in customers from drawing points sets even with $0 cash', async () => {
      const result = await checkoutUseCase.execute({
        storeId: 'chupei',
        customer: { phone: 'WALKIN' },
        lotteries: [
          {
            bagId: 'lb-points',
            prizeGrade: 'A',
            draws: 1,
            pickType: 'TAKE_AWAY',
            unitPrice: 350,
            amount: 0,
            isPointsSet: true,
          },
        ],
        payment: { cash: 0, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
        cashierEmail: 'cashier@onesoul.tw',
      });

      expect(isErr(result)).toBe(true);
    });
  });

  describe('5. Idempotency & Auto Session', () => {
    it('auto creates an open session if none exists for store', async () => {
      const activeSessionBefore = await sessionRepo.findActiveByStore('chupei');
      expect(activeSessionBefore).toBeNull();

      const result = await checkoutUseCase.execute({
        storeId: 'chupei',
        customer: { phone: '0912345678' },
        merchandises: [
          { productId: 'PROD-001', quantity: 1, paymentType: '現金', unitPrice: 500, amount: 500 },
        ],
        payment: { cash: 500, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
        cashierEmail: 'cashier@onesoul.tw',
      });

      expect(isOk(result)).toBe(true);
      const activeSessionAfter = await sessionRepo.findActiveByStore('chupei');
      expect(activeSessionAfter).not.toBeNull();
      expect(activeSessionAfter?.isOpen).toBe(true);
    });

    it('returns idempotent response without duplicate execution on same checkoutUID', async () => {
      const uid = 'idemp-checkout-uid-999';

      const firstCall = await checkoutUseCase.execute({
        storeId: 'chupei',
        customer: { phone: '0912345678' },
        merchandises: [
          { productId: 'PROD-001', quantity: 1, paymentType: '現金', unitPrice: 500, amount: 500 },
        ],
        payment: { cash: 500, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
        cashierEmail: 'cashier@onesoul.tw',
        checkoutUID: uid,
      });

      expect(isOk(firstCall)).toBe(true);
      const invAfterFirst = await invRepo.findByStoreAndProduct('chupei', 'PROD-001');
      expect(invAfterFirst?.quantity).toBe(9);

      // Repeat with same checkoutUID
      const secondCall = await checkoutUseCase.execute({
        storeId: 'chupei',
        customer: { phone: '0912345678' },
        merchandises: [
          { productId: 'PROD-001', quantity: 1, paymentType: '現金', unitPrice: 500, amount: 500 },
        ],
        payment: { cash: 500, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
        cashierEmail: 'cashier@onesoul.tw',
        checkoutUID: uid,
      });

      expect(isOk(secondCall)).toBe(true);
      if (!isOk(secondCall)) return;
      expect(secondCall.data.message).toContain('冪等響應');

      // Inventory should NOT be deducted twice!
      const invAfterSecond = await invRepo.findByStoreAndProduct('chupei', 'PROD-001');
      expect(invAfterSecond?.quantity).toBe(9);
    });
  });

  describe('6. Soft Void Order & Rollbacks', () => {
    it('voids completed order, rolls back points, and restores physical inventory', async () => {
      const uid = 'order-to-void-001';

      // 1. Checkout: buy 1 PROD-001 ($500) and draw 1 A-Prize TAKE_AWAY ($350)
      const res = await checkoutUseCase.execute({
        storeId: 'chupei',
        customer: { phone: '0912345678' },
        lotteries: [
          {
            bagId: 'lb-regular',
            prizeGrade: 'A',
            draws: 1,
            pickType: 'TAKE_AWAY',
            unitPrice: 350,
            amount: 350,
          },
        ],
        merchandises: [
          { productId: 'PROD-001', quantity: 1, paymentType: '現金', unitPrice: 500, amount: 500 },
        ],
        payment: { cash: 850, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
        cashierEmail: 'cashier@onesoul.tw',
        checkoutUID: uid,
      });

      expect(isOk(res)).toBe(true);
      expect((await invRepo.findByStoreAndProduct('chupei', 'GK-4100'))?.quantity).toBe(4);
      expect((await invRepo.findByStoreAndProduct('chupei', 'PROD-001'))?.quantity).toBe(9);
      expect((await luckyBagRepo.findPrize('lb-regular', 'A'))?.drawnCount).toBe(1);

      // 2. Void order
      const voidRes = await checkoutUseCase.voidOrder(uid, '客人手滑刷錯品項', 'manager@onesoul.tw');
      expect(isOk(voidRes)).toBe(true);

      // 3. Verify rollbacks
      expect((await invRepo.findByStoreAndProduct('chupei', 'GK-4100'))?.quantity).toBe(5); // restored
      expect((await invRepo.findByStoreAndProduct('chupei', 'PROD-001'))?.quantity).toBe(10); // restored
      expect((await luckyBagRepo.findPrize('lb-regular', 'A'))?.drawnCount).toBe(0); // restored

      const order = await orderRepo.findByCheckoutUID(uid);
      expect(order?.status).toBe('CANCELLED');
      expect(order?.voidReason).toBe('客人手滑刷錯品項');
    });
  });

  describe('7. Failure Boundaries & Rollbacks', () => {
    it('rolls back completely when overdrawing prizes', async () => {
      // Prize A only has 2 draws. Attempt to draw 3.
      const res = await checkoutUseCase.execute({
        storeId: 'chupei',
        customer: { phone: '0912345678' },
        lotteries: [
          {
            bagId: 'lb-regular',
            prizeGrade: 'A',
            draws: 3,
            pickType: 'TAKE_AWAY',
            unitPrice: 350,
            amount: 1050,
          },
        ],
        payment: { cash: 1050, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
        cashierEmail: 'cashier@onesoul.tw',
      });

      expect(isErr(res)).toBe(true);
      if (!isErr(res)) return;
      expect(res.error.code).toBe('OVERDRAW_ERROR');

      // Verify no changes persisted
      expect((await luckyBagRepo.findPrize('lb-regular', 'A'))?.drawnCount).toBe(0);
      expect((await invRepo.findByStoreAndProduct('chupei', 'GK-4100'))?.quantity).toBe(5);
    });

    it('rolls back completely when member points are insufficient', async () => {
      // Member has 100 points. Attempt to use 200 points.
      const res = await checkoutUseCase.execute({
        storeId: 'chupei',
        customer: { phone: '0912345678' },
        merchandises: [
          { productId: 'PROD-001', quantity: 1, paymentType: '點數', unitPrice: 200, amount: 0, totalPoints: 200 },
        ],
        payment: { cash: 0, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
        cashierEmail: 'cashier@onesoul.tw',
      });

      expect(isErr(res)).toBe(true);
      if (!isErr(res)) return;
      expect(res.error.code).toBe('INSUFFICIENT_POINTS');

      // Verify member points unchanged
      const member = await memberRepo.findById('mem-1');
      expect(member?.points).toBe(100);
      // Inventory unchanged
      expect((await invRepo.findByStoreAndProduct('chupei', 'PROD-001'))?.quantity).toBe(10);
    });
  });

  describe('8. Concurrency & Unified Lock Order (Invariant #3)', () => {
    it('unifies deductions across mixed lottery TAKE_AWAY and retail merchandise in dictionary order', async () => {
      // Order contains both lottery take-away (GK-4100) and retail merchandise (PROD-001)
      const res = await checkoutUseCase.execute({
        storeId: 'chupei',
        customer: { phone: '0912345678' },
        lotteries: [
          {
            bagId: 'lb-regular',
            prizeGrade: 'A',
            draws: 1,
            pickType: 'TAKE_AWAY',
            unitPrice: 350,
            amount: 350,
          },
        ],
        merchandises: [
          {
            productId: 'PROD-001',
            quantity: 2,
            paymentType: '現金',
            unitPrice: 500,
            amount: 1000,
          },
        ],
        payment: { cash: 1350, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
        cashierEmail: 'cashier@onesoul.tw',
      });

      expect(isOk(res)).toBe(true);
      if (!isOk(res)) return;

      // Both inventories deducted correctly
      expect((await invRepo.findByStoreAndProduct('chupei', 'GK-4100'))?.quantity).toBe(4);
      expect((await invRepo.findByStoreAndProduct('chupei', 'PROD-001'))?.quantity).toBe(8);

      // Verify inventory logs
      const logs = await invRepo.findLogsByStore('chupei', 10);
      const saleLogs = logs.filter((l) => l.orderId === res.data.checkoutUID);
      expect(saleLogs.length).toBe(2);
      // Invariant #3: GK-4100 precedes PROD-001 in alphabetical dictionary order
      expect(saleLogs.map((l) => l.productId).sort()).toEqual(['GK-4100', 'PROD-001']);
    });
  });

  describe('9. Invariant #1 Advanced Walk-In Protections', () => {
    it('rejects walk-in checkout on points set even if client omits isPointsSet flag', async () => {
      // External attacker sends raw request without isPointsSet
      const res = await checkoutUseCase.execute({
        storeId: 'chupei',
        customer: { phone: 'WALKIN' },
        lotteries: [
          {
            bagId: 'lb-points',
            prizeGrade: 'A',
            draws: 1,
            pickType: 'TAKE_AWAY',
            unitPrice: 350,
            amount: 0,
          },
        ],
        payment: { cash: 0, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
        cashierEmail: 'cashier@onesoul.tw',
      });

      expect(isErr(res)).toBe(true);
      if (!isErr(res)) return;
      expect(res.error.code).toBe('INVARIANT_VIOLATION');
    });

    it('rejects walk-in customer choosing pickType: POINTS', async () => {
      const res = await checkoutUseCase.execute({
        storeId: 'chupei',
        customer: { phone: '111111' },
        lotteries: [
          {
            bagId: 'lb-regular',
            prizeGrade: 'Z',
            draws: 1,
            pickType: 'POINTS',
            unitPrice: 350,
            amount: 350,
          },
        ],
        payment: { cash: 350, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
        cashierEmail: 'cashier@onesoul.tw',
      });

      expect(isErr(res)).toBe(true);
      if (!isErr(res)) return;
      expect(res.error.code).toBe('INVARIANT_VIOLATION');
    });
  });

  describe('10. Deep Rollback & Member Stats Reversion', () => {
    it('restores Order status to COMPLETED when voidOrder fails midway (deep clone rollback)', async () => {
      // 1. Create a successful order
      const checkoutRes = await checkoutUseCase.execute({
        storeId: 'chupei',
        customer: { phone: '0912345678' },
        merchandises: [
          {
            productId: 'PROD-001',
            quantity: 1,
            paymentType: '現金',
            unitPrice: 500,
            amount: 500,
          },
        ],
        payment: { cash: 500, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
        cashierEmail: 'cashier@onesoul.tw',
      });
      expect(isOk(checkoutRes)).toBe(true);
      const uid = checkoutRes.data!.checkoutUID;

      // 2. Temporarily sabotaging memberRepo.save inside transaction to simulate abort
      const origSave = memberRepo.save.bind(memberRepo);
      memberRepo.save = async () => {
        throw new Error('SIMULATED_DB_FAILURE_MIDWAY');
      };

      try {
        const voidRes = await checkoutUseCase.voidOrder(uid, '測試失敗回滾', 'admin@onesoul.tw');
        expect(isErr(voidRes)).toBe(true);
      } finally {
        memberRepo.save = origSave;
      }

      // 3. Verify Order status in InMemoryOrderRepository was rolled back to COMPLETED
      const order = await orderRepo.findByCheckoutUID(uid);
      expect(order?.status).toBe('COMPLETED');
      expect(order?.voidReason).toBeNull();
    });

    it('reverts member totalSpent and orderCount when order is voided', async () => {
      const initialMember = await memberRepo.findById('mem-1');
      const startSpent = initialMember!.totalSpent;
      const startCount = initialMember!.orderCount;

      const checkoutRes = await checkoutUseCase.execute({
        storeId: 'chupei',
        customer: { phone: '0912345678' },
        merchandises: [
          {
            productId: 'PROD-001',
            quantity: 1,
            paymentType: '現金',
            unitPrice: 500,
            amount: 500,
          },
        ],
        payment: { cash: 500, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
        cashierEmail: 'cashier@onesoul.tw',
      });
      expect(isOk(checkoutRes)).toBe(true);

      const memberAfter = await memberRepo.findById('mem-1');
      expect(memberAfter!.totalSpent).toBe(startSpent + 500);
      expect(memberAfter!.orderCount).toBe(startCount + 1);

      // Void the order
      const voidRes = await checkoutUseCase.voidOrder(
        checkoutRes.data!.checkoutUID,
        '退貨作廢',
        'admin@onesoul.tw'
      );
      expect(isOk(voidRes)).toBe(true);

      const memberReverted = await memberRepo.findById('mem-1');
      expect(memberReverted!.totalSpent).toBe(startSpent);
      expect(memberReverted!.orderCount).toBe(startCount);
    });
  });
});
