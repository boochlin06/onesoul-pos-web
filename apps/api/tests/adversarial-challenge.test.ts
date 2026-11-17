import { describe, it, expect, beforeEach } from 'vitest';
import {
  CheckoutUseCase,
  AllocationUseCase,
  InventoryUseCase,
  MemberUseCase,
  InMemoryOrderRepository,
  InMemoryInventoryRepository,
  InMemoryLuckyBagRepository,
  InMemoryMemberRepository,
  InMemorySessionRepository,
  InMemoryTransferRepository,
  InMemoryStocktakeRepository,
  InMemoryAuditRepository,
  InMemoryTransactionManager,
  Product,
  StoreInventory,
  LuckyBag,
  LuckyBagPrize,
  Member,
} from '../src';
import { isOk, isErr } from '@onesoul/shared';

describe('Adversarial Stress Test: Milestone 2 Use Cases & Invariants', () => {
  let orderRepo: InMemoryOrderRepository;
  let invRepo: InMemoryInventoryRepository;
  let luckyBagRepo: InMemoryLuckyBagRepository;
  let memberRepo: InMemoryMemberRepository;
  let sessionRepo: InMemorySessionRepository;
  let transferRepo: InMemoryTransferRepository;
  let stocktakeRepo: InMemoryStocktakeRepository;
  let auditRepo: InMemoryAuditRepository;
  let txManager: InMemoryTransactionManager;

  let checkoutUseCase: CheckoutUseCase;
  let allocationUseCase: AllocationUseCase;
  let inventoryUseCase: InventoryUseCase;
  let memberUseCase: MemberUseCase;

  beforeEach(async () => {
    orderRepo = new InMemoryOrderRepository();
    invRepo = new InMemoryInventoryRepository();
    luckyBagRepo = new InMemoryLuckyBagRepository();
    memberRepo = new InMemoryMemberRepository();
    sessionRepo = new InMemorySessionRepository();
    transferRepo = new InMemoryTransferRepository();
    stocktakeRepo = new InMemoryStocktakeRepository();
    auditRepo = new InMemoryAuditRepository();
    txManager = new InMemoryTransactionManager();

    txManager.register(orderRepo);
    txManager.register(invRepo);
    txManager.register(luckyBagRepo);
    txManager.register(memberRepo);
    txManager.register(sessionRepo);
    txManager.register(transferRepo);
    txManager.register(stocktakeRepo);
    txManager.register(auditRepo);

    checkoutUseCase = new CheckoutUseCase(
      orderRepo,
      invRepo,
      luckyBagRepo,
      memberRepo,
      sessionRepo,
      txManager
    );

    allocationUseCase = new AllocationUseCase(
      luckyBagRepo,
      invRepo,
      txManager
    );

    inventoryUseCase = new InventoryUseCase(
      invRepo,
      transferRepo,
      stocktakeRepo,
      auditRepo,
      txManager
    );

    memberUseCase = new MemberUseCase(
      memberRepo,
      orderRepo,
      auditRepo,
      txManager
    );

    // Master data
    await invRepo.saveProduct(
      new Product({ id: 'GK-LUFFY', name: 'GK 四檔魯夫雕像', costPrice: 3000, sellingPrice: 5000 })
    );
    await invRepo.saveProduct(
      new Product({ id: 'GK-ZORO', name: 'GK 索隆阿修羅', costPrice: 2800, sellingPrice: 4800 })
    );
    await invRepo.saveProduct(
      new Product({ id: 'MERCH-01', name: '航海王盲盒第一彈', costPrice: 150, sellingPrice: 250 })
    );
    await invRepo.saveProduct(
      new Product({ id: 'MERCH-02', name: '壓克力立牌', costPrice: 60, sellingPrice: 120 })
    );

    // Initial store inventory
    await invRepo.save(
      new StoreInventory({ id: 'inv-luffy-cp', storeId: 'chupei', productId: 'GK-LUFFY', quantity: 5 })
    );
    await invRepo.save(
      new StoreInventory({ id: 'inv-zoro-cp', storeId: 'chupei', productId: 'GK-ZORO', quantity: 3 })
    );
    await invRepo.save(
      new StoreInventory({ id: 'inv-m1-cp', storeId: 'chupei', productId: 'MERCH-01', quantity: 20 })
    );
    await invRepo.save(
      new StoreInventory({ id: 'inv-m2-cp', storeId: 'chupei', productId: 'MERCH-02', quantity: 15 })
    );

    // Seed regular member
    await memberRepo.save(
      new Member({ id: 'mem-vip', phone: '0988777666', name: '黃金會員', points: 200 })
    );

    // Seed Lucky Bag 1: Regular
    await luckyBagRepo.saveBagWithPrizes(
      new LuckyBag({
        id: 'LB-ADV-01',
        storeId: 'chupei',
        name: '航海王頂級對決套',
        unitPrice: 400,
        isPointsSet: false,
      }),
      [
        new LuckyBagPrize({
          id: 'prz-luffy-a',
          bagId: 'LB-ADV-01',
          prizeGrade: 'A',
          prizeName: 'GK 四檔魯夫雕像',
          productId: 'GK-LUFFY',
          draws: 2,
          drawnCount: 0,
        }),
        new LuckyBagPrize({
          id: 'prz-zoro-b',
          bagId: 'LB-ADV-01',
          prizeGrade: 'B',
          prizeName: 'GK 索隆阿修羅',
          productId: 'GK-ZORO',
          draws: 2,
          drawnCount: 0,
        }),
        new LuckyBagPrize({
          id: 'prz-x-blind',
          bagId: 'LB-ADV-01',
          prizeGrade: 'X',
          prizeName: '盲盒賞',
          productId: null,
          points: 10,
          draws: 20,
          drawnCount: 0,
        }),
        new LuckyBagPrize({
          id: 'prz-z-badge',
          bagId: 'LB-ADV-01',
          prizeGrade: 'Z',
          prizeName: '徽章保底小賞',
          productId: null,
          points: 1,
          draws: 56,
          drawnCount: 0,
        }),
      ]
    );

    // Seed Lucky Bag 2: Points Set
    await luckyBagRepo.saveBagWithPrizes(
      new LuckyBag({
        id: 'LB-ADV-PTS',
        storeId: 'chupei',
        name: '海賊王純點數套',
        unitPrice: 400,
        isPointsSet: true,
      }),
      [
        new LuckyBagPrize({
          id: 'prz-pts-luffy',
          bagId: 'LB-ADV-PTS',
          prizeGrade: 'A',
          prizeName: 'GK 四檔魯夫雕像',
          productId: 'GK-LUFFY',
          draws: 2,
          drawnCount: 0,
        }),
      ]
    );
  });

  // ============================================================================
  // 1. Walk-In Attacks: 100% Rejection Matrix
  // ============================================================================
  describe('1. Invariant #1 Walk-in Attacks Penetration Matrix', () => {
    const walkInIdentifiers = [
      '111111',
      'WALKIN',
      '散客',
      '000000',
      '99999',
      '88888',
      '222222',
      '333333',
      '888888',
      '999999',
      '現場散客',
      '\u975e\u6703\u54e1',
      '\u81e8\u6642\u5ba2',
      '\u8a2a\u5ba2',
      '  111111  ',
      'walk-in',
      undefined,
      '',
    ];

    describe('Vector 1A: Payment pointsUsed > 0', () => {
      for (const phone of walkInIdentifiers) {
        it(`rejects walk-in phone "${phone ?? 'undefined'}" with pointsUsed > 0`, async () => {
          const res = await checkoutUseCase.execute({
            storeId: 'chupei',
            customer: { phone },
            merchandises: [
              { productId: 'MERCH-01', quantity: 1, paymentType: '現金', unitPrice: 250, amount: 250 },
            ],
            payment: { cash: 240, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 10 },
            cashierEmail: 'cashier@onesoul.tw',
          });

          expect(isErr(res)).toBe(true);
          if (isErr(res)) {
            expect(res.error.code).toBe('INVARIANT_VIOLATION');
          }
        });
      }
    });

    describe('Vector 1B: Points Set Draw Attempt', () => {
      for (const phone of walkInIdentifiers) {
        it(`rejects walk-in phone "${phone ?? 'undefined'}" attempting to draw points set`, async () => {
          const res = await checkoutUseCase.execute({
            storeId: 'chupei',
            customer: { phone },
            lotteries: [
              {
                bagId: 'LB-ADV-PTS',
                prizeGrade: 'A',
                draws: 1,
                pickType: 'TAKE_AWAY',
                unitPrice: 400,
                amount: 0,
                isPointsSet: true,
              },
            ],
            payment: { cash: 0, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
            cashierEmail: 'cashier@onesoul.tw',
          });

          expect(isErr(res)).toBe(true);
          if (isErr(res)) {
            expect(res.error.code).toBe('INVARIANT_VIOLATION');
          }
        });
      }
    });

    describe('Vector 1C: Merchandise Paid by Points', () => {
      for (const phone of walkInIdentifiers) {
        it(`rejects walk-in phone "${phone ?? 'undefined'}" buying merchandise with paymentType="點數"`, async () => {
          const res = await checkoutUseCase.execute({
            storeId: 'chupei',
            customer: { phone },
            merchandises: [
              {
                productId: 'MERCH-02',
                quantity: 1,
                paymentType: '點數',
                unitPrice: 120,
                amount: 0,
                totalPoints: 120,
              },
            ],
            payment: { cash: 0, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
            cashierEmail: 'cashier@onesoul.tw',
          });

          expect(isErr(res)).toBe(true);
          if (isErr(res)) {
            expect(res.error.code).toBe('INVARIANT_VIOLATION');
          }
        });
      }
    });

    describe('Vector 1D: Member Registration Rejection for Walk-Ins', () => {
      const walkInRegisterAttempts = ['111111', 'WALKIN', '散客', '000000', '99999', '88888'];
      for (const phone of walkInRegisterAttempts) {
        it(`rejects creating a regular member with walk-in phone "${phone}"`, async () => {
          const res = await memberUseCase.createMember({
            phone,
            name: '偽裝散客',
          });

          expect(isErr(res)).toBe(true);
          if (isErr(res)) {
            expect(res.error.code).toBe('VALIDATION_ERROR');
          }
        });
      }
    });
  });

  // ============================================================================
  // 2. Overdraw Attack: draws > remainingDraws
  // ============================================================================
  describe('2. Overdraw Attack & Zero State Corruption', () => {
    it('rejects drawing more than remaining draws in a single request', async () => {
      // Prize A has 2 draws available. Request 3.
      const res = await checkoutUseCase.execute({
        storeId: 'chupei',
        customer: { phone: '0988777666' },
        lotteries: [
          {
            bagId: 'LB-ADV-01',
            prizeGrade: 'A',
            draws: 3,
            pickType: 'TAKE_AWAY',
            unitPrice: 400,
            amount: 1200,
          },
        ],
        payment: { cash: 1200, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
        cashierEmail: 'cashier@onesoul.tw',
      });

      expect(isErr(res)).toBe(true);
      if (isErr(res)) {
        expect(res.error.code).toBe('OVERDRAW_ERROR');
      }

      // Invariant check: zero state corruption
      const prize = await luckyBagRepo.findPrize('LB-ADV-01', 'A');
      expect(prize?.drawnCount).toBe(0);
      expect(prize?.remainingDraws).toBe(2);

      const inv = await invRepo.findByStoreAndProduct('chupei', 'GK-LUFFY');
      expect(inv?.quantity).toBe(5); // untouched
    });

    it('rejects sequential overdraw after valid draws', async () => {
      // Step 1: Draw 2 draws of Prize B (索隆, 2 draws available).
      const step1 = await checkoutUseCase.execute({
        storeId: 'chupei',
        customer: { phone: '0988777666' },
        lotteries: [
          {
            bagId: 'LB-ADV-01',
            prizeGrade: 'B',
            draws: 2,
            pickType: 'TAKE_AWAY',
            unitPrice: 400,
            amount: 800,
          },
        ],
        payment: { cash: 800, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
        cashierEmail: 'cashier@onesoul.tw',
      });

      expect(isOk(step1)).toBe(true);
      const prizeBAfter1 = await luckyBagRepo.findPrize('LB-ADV-01', 'B');
      expect(prizeBAfter1?.drawnCount).toBe(2);
      expect(prizeBAfter1?.remainingDraws).toBe(0);

      // Step 2: Attempt to draw 1 more draw of Prize B.
      const step2 = await checkoutUseCase.execute({
        storeId: 'chupei',
        customer: { phone: '0988777666' },
        lotteries: [
          {
            bagId: 'LB-ADV-01',
            prizeGrade: 'B',
            draws: 1,
            pickType: 'TAKE_AWAY',
            unitPrice: 400,
            amount: 400,
          },
        ],
        payment: { cash: 400, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
        cashierEmail: 'cashier@onesoul.tw',
      });

      expect(isErr(step2)).toBe(true);
      if (isErr(step2)) {
        expect(step2.error.code).toBe('OVERDRAW_ERROR');
      }

      // Verify Prize B remains at drawnCount = 2
      const prizeBFinal = await luckyBagRepo.findPrize('LB-ADV-01', 'B');
      expect(prizeBFinal?.drawnCount).toBe(2);
    });

    it('rolls back previous cart items when a subsequent lottery item overdraws', async () => {
      // Cart has 1 valid Prize A draw AND 1 invalid Prize B draw (attempting 5 draws when only 2 exist)
      const res = await checkoutUseCase.execute({
        storeId: 'chupei',
        customer: { phone: '0988777666' },
        lotteries: [
          {
            bagId: 'LB-ADV-01',
            prizeGrade: 'A',
            draws: 1,
            pickType: 'TAKE_AWAY',
            unitPrice: 400,
            amount: 400,
          },
          {
            bagId: 'LB-ADV-01',
            prizeGrade: 'B',
            draws: 5, // OVERDRAW!
            pickType: 'TAKE_AWAY',
            unitPrice: 400,
            amount: 2000,
          },
        ],
        payment: { cash: 2400, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
        cashierEmail: 'cashier@onesoul.tw',
      });

      expect(isErr(res)).toBe(true);
      if (isErr(res)) {
        expect(res.error.code).toBe('OVERDRAW_ERROR');
      }

      // Check Prize A was ROLLED BACK and NOT incremented
      const prizeA = await luckyBagRepo.findPrize('LB-ADV-01', 'A');
      expect(prizeA?.drawnCount).toBe(0);

      // Check GK-LUFFY stock was NOT deducted
      const invLuffy = await invRepo.findByStoreAndProduct('chupei', 'GK-LUFFY');
      expect(invLuffy?.quantity).toBe(5);
    });

    it('rejects non-positive draws (draws <= 0)', async () => {
      const resZero = await checkoutUseCase.execute({
        storeId: 'chupei',
        customer: { phone: '0988777666' },
        lotteries: [
          {
            bagId: 'LB-ADV-01',
            prizeGrade: 'A',
            draws: 0,
            pickType: 'TAKE_AWAY',
            unitPrice: 400,
            amount: 0,
          },
        ],
        payment: { cash: 0, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
        cashierEmail: 'cashier@onesoul.tw',
      });

      expect(isErr(resZero)).toBe(true);

      const resNegative = await checkoutUseCase.execute({
        storeId: 'chupei',
        customer: { phone: '0988777666' },
        lotteries: [
          {
            bagId: 'LB-ADV-01',
            prizeGrade: 'A',
            draws: -2,
            pickType: 'TAKE_AWAY',
            unitPrice: 400,
            amount: 0,
          },
        ],
        payment: { cash: 0, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
        cashierEmail: 'cashier@onesoul.tw',
      });

      expect(isErr(resNegative)).toBe(true);
    });
  });

  // ============================================================================
  // 3. Insufficient Stock Attack: quantity > store inventory
  // ============================================================================
  describe('3. Insufficient Stock Attack & Transaction Rollback', () => {
    it('rejects order with quantity > store inventory and rolls back completely', async () => {
      // MERCH-01 stock is 20. Request 21.
      const res = await checkoutUseCase.execute({
        storeId: 'chupei',
        customer: { phone: '0988777666' },
        merchandises: [
          {
            productId: 'MERCH-01',
            quantity: 21,
            paymentType: '現金',
            unitPrice: 250,
            amount: 5250,
          },
        ],
        payment: { cash: 5250, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
        cashierEmail: 'cashier@onesoul.tw',
      });

      expect(isErr(res)).toBe(true);
      if (isErr(res)) {
        expect(res.error.code).toBe('INSUFFICIENT_STOCK');
      }

      // Verify inventory intact
      const inv = await invRepo.findByStoreAndProduct('chupei', 'MERCH-01');
      expect(inv?.quantity).toBe(20);

      // Verify no inventory logs created
      const logs = await invRepo.findLogsByStore('chupei');
      expect(logs.length).toBe(0);
    });

    it('ensures zero partial deduction on multi-item checkout when one item lacks stock', async () => {
      // Item 1 (MERCH-01, stock 20, request 5) -> has stock
      // Item 2 (MERCH-02, stock 15, request 16) -> insufficient stock!
      const res = await checkoutUseCase.execute({
        storeId: 'chupei',
        customer: { phone: '0988777666' },
        merchandises: [
          {
            productId: 'MERCH-01',
            quantity: 5,
            paymentType: '現金',
            unitPrice: 250,
            amount: 1250,
          },
          {
            productId: 'MERCH-02',
            quantity: 16,
            paymentType: '現金',
            unitPrice: 120,
            amount: 1920,
          },
        ],
        payment: { cash: 3170, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
        cashierEmail: 'cashier@onesoul.tw',
      });

      expect(isErr(res)).toBe(true);
      if (isErr(res)) {
        expect(res.error.code).toBe('INSUFFICIENT_STOCK');
      }

      // Neither item 1 nor item 2 should be changed!
      const inv1 = await invRepo.findByStoreAndProduct('chupei', 'MERCH-01');
      expect(inv1?.quantity).toBe(20); // NOT 15!

      const inv2 = await invRepo.findByStoreAndProduct('chupei', 'MERCH-02');
      expect(inv2?.quantity).toBe(15);
    });

    it('rejects TAKE_AWAY lottery draw when GK physical stock is insufficient', async () => {
      // Modify GK-ZORO stock to 1
      const invZoro = await invRepo.findByStoreAndProduct('chupei', 'GK-ZORO');
      invZoro?.deduct(2); // 3 - 2 = 1 left
      await invRepo.save(invZoro!);

      // Prize B has 2 draws available, but store physical stock is only 1!
      const res = await checkoutUseCase.execute({
        storeId: 'chupei',
        customer: { phone: '0988777666' },
        lotteries: [
          {
            bagId: 'LB-ADV-01',
            prizeGrade: 'B',
            draws: 2,
            pickType: 'TAKE_AWAY',
            unitPrice: 400,
            amount: 800,
          },
        ],
        payment: { cash: 800, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
        cashierEmail: 'cashier@onesoul.tw',
      });

      expect(isErr(res)).toBe(true);
      if (isErr(res)) {
        expect(res.error.code).toBe('INSUFFICIENT_STOCK');
      }

      // Prize B drawnCount rolled back to 0
      const prizeB = await luckyBagRepo.findPrize('LB-ADV-01', 'B');
      expect(prizeB?.drawnCount).toBe(0);

      // Inventory remains 1
      const invZoroFinal = await invRepo.findByStoreAndProduct('chupei', 'GK-ZORO');
      expect(invZoroFinal?.quantity).toBe(1);
    });
  });

  // ============================================================================
  // 4. Duplicate checkoutUID Idempotency Attack
  // ============================================================================
  describe('4. Duplicate checkoutUID Idempotency Attack', () => {
    it('handles duplicate checkoutUID idempotently without double-deduction', async () => {
      const fixedUID = 'IDEMP-ATTACK-001';

      // 1st request
      const res1 = await checkoutUseCase.execute({
        storeId: 'chupei',
        customer: { phone: '0988777666' },
        merchandises: [
          { productId: 'MERCH-01', quantity: 2, paymentType: '現金', unitPrice: 250, amount: 500 },
        ],
        payment: { cash: 500, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
        cashierEmail: 'cashier@onesoul.tw',
        checkoutUID: fixedUID,
      });

      expect(isOk(res1)).toBe(true);
      const invAfter1 = await invRepo.findByStoreAndProduct('chupei', 'MERCH-01');
      expect(invAfter1?.quantity).toBe(18); // 20 - 2 = 18

      // 2nd request with exact same UID
      const res2 = await checkoutUseCase.execute({
        storeId: 'chupei',
        customer: { phone: '0988777666' },
        merchandises: [
          { productId: 'MERCH-01', quantity: 2, paymentType: '現金', unitPrice: 250, amount: 500 },
        ],
        payment: { cash: 500, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
        cashierEmail: 'cashier@onesoul.tw',
        checkoutUID: fixedUID,
      });

      expect(isOk(res2)).toBe(true);
      if (isOk(res2)) {
        expect(res2.data.message).toContain('冪等響應');
        expect(res2.data.checkoutUID).toBe(fixedUID);
      }

      // Crucial: stock must still be 18, NOT 16!
      const invAfter2 = await invRepo.findByStoreAndProduct('chupei', 'MERCH-01');
      expect(invAfter2?.quantity).toBe(18);
    });

    it('resists replay tampering: modified payload with duplicate UID returns original order and does not execute modified items', async () => {
      const replayUID = 'IDEMP-TAMPER-002';

      // Original call: buy 1 MERCH-02 ($120)
      const resOriginal = await checkoutUseCase.execute({
        storeId: 'chupei',
        customer: { phone: '0988777666' },
        merchandises: [
          { productId: 'MERCH-02', quantity: 1, paymentType: '現金', unitPrice: 120, amount: 120 },
        ],
        payment: { cash: 120, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
        cashierEmail: 'cashier@onesoul.tw',
        checkoutUID: replayUID,
      });

      expect(isOk(resOriginal)).toBe(true);

      // Malicious replay call: claims 10 GK-LUFFY items with same UID
      const resTampered = await checkoutUseCase.execute({
        storeId: 'chupei',
        customer: { phone: '0988777666' },
        merchandises: [
          { productId: 'GK-LUFFY', quantity: 10, paymentType: '現金', unitPrice: 5000, amount: 50000 },
        ],
        payment: { cash: 50000, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
        cashierEmail: 'cashier@onesoul.tw',
        checkoutUID: replayUID,
      });

      expect(isOk(resTampered)).toBe(true);
      if (isOk(resTampered)) {
        expect(resTampered.data.totalDue).toBe(120); // Returns original order due, not $50000!
        expect(resTampered.data.message).toContain('冪等響應');
      }

      // Verify GK-LUFFY stock is completely untouched
      const invLuffy = await invRepo.findByStoreAndProduct('chupei', 'GK-LUFFY');
      expect(invLuffy?.quantity).toBe(5);
    });
  });

  // ============================================================================
  // 5. AllocationUseCase: Invariant #2 & Live Stock Over-Allocation Radar
  // ============================================================================
  describe('5. AllocationUseCase Invariant #2 & Over-Allocation Radar', () => {
    it('guarantees publishPlan NEVER modifies StoreInventory', async () => {
      // Snapshot inventory before publish
      const luffyBefore = (await invRepo.findByStoreAndProduct('chupei', 'GK-LUFFY'))?.quantity ?? 0;
      const zoroBefore = (await invRepo.findByStoreAndProduct('chupei', 'GK-ZORO'))?.quantity ?? 0;
      expect(luffyBefore).toBe(5);
      expect(zoroBefore).toBe(3);

      // Publish 5 batches of a multi-GK plan
      const publishRes = await allocationUseCase.publishPlan({
        storeId: 'chupei',
        name: '五連開多套海賊王',
        totalDraws: 80,
        unitPrice: 400,
        batchCount: 5,
        blindBoxPoints: 10,
        items: [
          { grade: 'A', name: '魯夫大賞', productId: 'GK-LUFFY', draws: 2 },
          { grade: 'B', name: '索隆大賞', productId: 'GK-ZORO', draws: 2 },
          { grade: 'X', name: '盲盒賞', productId: 'blind_box', draws: 20 },
          { grade: 'Z', name: '小賞', productId: '0p', draws: 56, isNonGk: true },
        ],
      });

      expect(isOk(publishRes)).toBe(true);
      if (isOk(publishRes)) {
        expect(publishRes.data.publishedCount).toBe(5);
        expect(publishRes.data.bagIds.length).toBe(5);
      }

      // Invariant #2 assertion: StoreInventory MUST BE IDENTICAL
      const luffyAfter = (await invRepo.findByStoreAndProduct('chupei', 'GK-LUFFY'))?.quantity ?? 0;
      const zoroAfter = (await invRepo.findByStoreAndProduct('chupei', 'GK-ZORO'))?.quantity ?? 0;
      expect(luffyAfter).toBe(luffyBefore);
      expect(zoroAfter).toBe(zoroBefore);
    });

    it('accurately computes live stock over-allocation warning and dynamic availableStock', async () => {
      // GK-ZORO stock is 3 in chupei.
      // LB-ADV-01 has 2 draws allocated of GK-ZORO.
      // Let's add another bag that allocates 2 more draws of GK-ZORO -> total allocated = 4 > 3!
      await luckyBagRepo.saveBagWithPrizes(
        new LuckyBag({
          id: 'LB-EXTRA-ZORO',
          storeId: 'chupei',
          name: '索隆專屬加開套',
          unitPrice: 400,
          isPointsSet: false,
        }),
        [
          new LuckyBagPrize({
            id: 'prz-extra-zoro',
            bagId: 'LB-EXTRA-ZORO',
            prizeGrade: 'A',
            prizeName: 'GK 索隆阿修羅',
            productId: 'GK-ZORO',
            draws: 2,
            drawnCount: 0,
          }),
        ]
      );

      // Radar evaluation:
      // GK-ZORO stock = 3, allocated = 2 (LB-ADV-01) + 2 (LB-EXTRA-ZORO) = 4.
      // isOverAllocated must be true, availableStock must be 0 (Math.max(0, 3 - 4)).
      const radar1 = await allocationUseCase.calculateLiveStockRadar('chupei', { q: 'GK-ZORO' });
      expect(isOk(radar1)).toBe(true);
      if (isOk(radar1)) {
        const item = radar1.data.find((i) => i.id === 'GK-ZORO');
        expect(item).toBeDefined();
        expect(item?.stock).toBe(3);
        expect(item?.allocatedCount).toBe(4);
        expect(item?.availableStock).toBe(0);
        expect(item?.isOverAllocated).toBe(true);
      }

      // Now draw 2 draws from LB-ADV-01 Prize B (so remainingDraws drops from 2 to 0)
      const prizeB = await luckyBagRepo.findPrize('LB-ADV-01', 'B');
      prizeB?.incrementDrawnCount(2);

      // Re-evaluate radar:
      // Now allocated = 0 + 2 = 2 <= 3.
      // isOverAllocated must be false, availableStock = 3 - 2 = 1.
      const radar2 = await allocationUseCase.calculateLiveStockRadar('chupei', { q: 'GK-ZORO' });
      expect(isOk(radar2)).toBe(true);
      if (isOk(radar2)) {
        const item = radar2.data.find((i) => i.id === 'GK-ZORO');
        expect(item).toBeDefined();
        expect(item?.stock).toBe(3);
        expect(item?.allocatedCount).toBe(2);
        expect(item?.availableStock).toBe(1);
        expect(item?.isOverAllocated).toBe(false);
      }
    });
  });

  // ============================================================================
  // 6. InventoryUseCase & MemberUseCase Boundary Attacks
  // ============================================================================
  describe('6. InventoryUseCase & MemberUseCase Boundary Invariants', () => {
    describe('InventoryUseCase Boundary Attacks', () => {
      it('rejects manual stock adjustment resulting in negative inventory', async () => {
        // MERCH-01 stock is 20. Try delta = -21.
        const res = await inventoryUseCase.adjustStock({
          storeId: 'chupei',
          productId: 'MERCH-01',
          delta: -21,
          reason: '盤虧調整過度',
          operator: 'admin@onesoul.tw',
        });

        expect(isErr(res)).toBe(true);
        if (isErr(res)) {
          expect(res.error.code).toBe('INSUFFICIENT_STOCK');
        }

        // Verify stock untouched
        const inv = await invRepo.findByStoreAndProduct('chupei', 'MERCH-01');
        expect(inv?.quantity).toBe(20);
      });

      it('rejects delta = 0 for stock adjustment', async () => {
        const res = await inventoryUseCase.adjustStock({
          storeId: 'chupei',
          productId: 'MERCH-01',
          delta: 0,
          reason: '無效調整',
          operator: 'admin@onesoul.tw',
        });

        expect(isErr(res)).toBe(true);
        if (isErr(res)) {
          expect(res.error.code).toBe('VALIDATION_ERROR');
        }
      });

      it('rejects negative adjustment on non-existent product in store', async () => {
        const res = await inventoryUseCase.adjustStock({
          storeId: 'chupei',
          productId: 'GHOST-PROD',
          delta: -5,
          reason: '幽靈商品出庫',
          operator: 'admin@onesoul.tw',
        });

        expect(isErr(res)).toBe(true);
        if (isErr(res)) {
          expect(res.error.code).toBe('INSUFFICIENT_STOCK');
        }
      });

      it('rejects dispatching a transfer order when source store inventory is insufficient', async () => {
        // Create transfer order requesting 50 units of MERCH-01 from chupei (which only has 20)
        const createRes = await inventoryUseCase.createTransfer({
          sourceStoreId: 'chupei',
          targetStoreId: 'jinshan',
          operator: 'manager@onesoul.tw',
          items: [{ productId: 'MERCH-01', requestedQty: 50 }],
        });

        expect(isOk(createRes)).toBe(true);
        if (!isOk(createRes)) return;

        const dispatchRes = await inventoryUseCase.dispatchTransfer(
          createRes.data.id,
          'manager@onesoul.tw'
        );

        expect(isErr(dispatchRes)).toBe(true);
        if (isErr(dispatchRes)) {
          expect(dispatchRes.error.code).toBe('INSUFFICIENT_STOCK');
        }

        // Source store inventory remains 20
        const inv = await invRepo.findByStoreAndProduct('chupei', 'MERCH-01');
        expect(inv?.quantity).toBe(20);
      });
    });

    describe('MemberUseCase Boundary Attacks', () => {
      it('rejects member point adjustment resulting in points < 0', async () => {
        // Member mem-vip has 200 points. Try delta = -201.
        const res = await memberUseCase.adjustPoints({
          memberId: 'mem-vip',
          delta: -201,
          reason: '扣除過量點數測試',
          operator: 'admin@onesoul.tw',
        });

        expect(isErr(res)).toBe(true);
        if (isErr(res)) {
          expect(res.error.code).toBe('INSUFFICIENT_POINTS');
        }

        // Verify member points unchanged
        const member = await memberRepo.findById('mem-vip');
        expect(member?.points).toBe(200);

        // Verify no point log created
        const logs = await memberRepo.findPointLogsByMemberId('mem-vip');
        expect(logs.length).toBe(0);
      });

      it('rejects point delta = 0', async () => {
        const res = await memberUseCase.adjustPoints({
          memberId: 'mem-vip',
          delta: 0,
          reason: '零異動測試說明',
          operator: 'admin@onesoul.tw',
        });

        expect(isErr(res)).toBe(true);
        if (isErr(res)) {
          expect(res.error.code).toBe('VALIDATION_ERROR');
        }
      });

      it('rejects duplicate member phone registration with leading zero parity check', async () => {
        // Existing member phone is '0988777666'
        // Attempt to register with '988777666' (missing leading zero)
        const res = await memberUseCase.createMember({
          phone: '988777666',
          name: '重複註冊者',
        });

        expect(isErr(res)).toBe(true);
        if (isErr(res)) {
          expect(res.error.code).toBe('CONFLICT');
        }
      });
    });
  });

  // ============================================================================
  // 7. Soft Void Order & Double-Void Attack
  // ============================================================================
  describe('7. Soft Void Order & Double-Void Attack', () => {
    it('completes order, voids it, and rejects double-void attack', async () => {
      const voidUID = 'VOID-DOUBLE-ATTACK-01';

      // 1. Checkout
      const checkoutRes = await checkoutUseCase.execute({
        storeId: 'chupei',
        customer: { phone: '0988777666' },
        merchandises: [
          { productId: 'MERCH-01', quantity: 2, paymentType: '現金', unitPrice: 250, amount: 500 },
        ],
        payment: { cash: 500, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
        cashierEmail: 'cashier@onesoul.tw',
        checkoutUID: voidUID,
      });

      expect(isOk(checkoutRes)).toBe(true);
      expect((await invRepo.findByStoreAndProduct('chupei', 'MERCH-01'))?.quantity).toBe(18);

      // 2. Void 1st time -> should succeed and restore stock to 20
      const void1 = await checkoutUseCase.voidOrder(voidUID, '客人退貨', 'manager@onesoul.tw');
      expect(isOk(void1)).toBe(true);
      expect((await invRepo.findByStoreAndProduct('chupei', 'MERCH-01'))?.quantity).toBe(20);

      // 3. Void 2nd time -> double void attack must be rejected!
      const void2 = await checkoutUseCase.voidOrder(voidUID, '重複作廢攻擊', 'manager@onesoul.tw');
      expect(isErr(void2)).toBe(true);
      if (isErr(void2)) {
        expect(void2.error.code).toBe('INVARIANT_VIOLATION');
      }

      // Stock must NOT be refunded again (stays 20, not 22)
      expect((await invRepo.findByStoreAndProduct('chupei', 'MERCH-01'))?.quantity).toBe(20);
    });

    it('rejects voiding non-existent order', async () => {
      const res = await checkoutUseCase.voidOrder('NON-EXISTENT-UID', '測試', 'manager@onesoul.tw');
      expect(isErr(res)).toBe(true);
      if (isErr(res)) {
        expect(res.error.code).toBe('NOT_FOUND');
      }
    });
  });
});
