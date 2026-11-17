import { describe, it, expect } from 'vitest';
import {
  CheckoutPayloadSchema,
  LuckyBagSchema,
  PublishPlansPayloadSchema,
  CheckoutLotteryItemSchema,
  CheckoutMerchandiseItemSchema,
  ProductSchema,
  CreateMemberSchema,
  MemberSchema,
  StoreInventorySchema,
  LuckyBagPrizeSchema,
  OrderSchema,
  CheckoutPaymentSchema,
  AdjustPointsPayloadSchema,
  OrderVoidPayloadSchema,
} from '../src/schemas';

describe('Empirical Adversarial Zod Schemas Challenge', () => {
  describe('1. Negative Unit Price & Amount Rejection', () => {
    it('should REJECT negative unitPrice in LuckyBagSchema (-1, -350)', () => {
      const bagNegative1 = {
        id: 'LB-01',
        storeId: 'chupei',
        name: '一番賞套組',
        unitPrice: -1,
      };
      expect(() => LuckyBagSchema.parse(bagNegative1)).toThrow();

      const bagNegative350 = {
        id: 'LB-01',
        storeId: 'chupei',
        name: '一番賞套組',
        unitPrice: -350,
      };
      expect(() => LuckyBagSchema.parse(bagNegative350)).toThrow();
    });

    it('should REJECT negative unitPrice in PublishPlansPayloadSchema', () => {
      const plan = {
        storeId: 'chupei',
        name: '海賊王全套開抽',
        unitPrice: -100,
        setCount: 1,
        items: [
          {
            grade: 'A',
            name: '大賞魯夫',
            draws: 2,
            points: 0,
            cost: 1000,
          },
        ],
        operator: 'admin@onesoul.com',
      };
      expect(() => PublishPlansPayloadSchema.parse(plan)).toThrow();
    });

    it('should REJECT negative unitPrice & amount in CheckoutLotteryItemSchema', () => {
      const lotteryItemNegativePrice = {
        id: 'LB-01',
        prize: 'A',
        draws: 1,
        type: '帶走' as const,
        unitPrice: -350,
        amount: 350,
      };
      expect(() => CheckoutLotteryItemSchema.parse(lotteryItemNegativePrice)).toThrow();

      const lotteryItemNegativeAmount = {
        id: 'LB-01',
        prize: 'A',
        draws: 1,
        type: '帶走' as const,
        unitPrice: 350,
        amount: -350,
      };
      expect(() => CheckoutLotteryItemSchema.parse(lotteryItemNegativeAmount)).toThrow();
    });

    it('should REJECT negative unitAmount & actualAmount in CheckoutMerchandiseItemSchema', () => {
      const merchNegativeUnit = {
        id: 'P-01',
        name: '四檔魯夫',
        quantity: 1,
        unitAmount: -1000,
        actualAmount: 1000,
      };
      expect(() => CheckoutMerchandiseItemSchema.parse(merchNegativeUnit)).toThrow();

      const merchNegativeActual = {
        id: 'P-01',
        name: '四檔魯夫',
        quantity: 1,
        unitAmount: 1000,
        actualAmount: -500,
      };
      expect(() => CheckoutMerchandiseItemSchema.parse(merchNegativeActual)).toThrow();
    });

    it('should REJECT negative payment amounts in CheckoutPaymentSchema', () => {
      expect(() => CheckoutPaymentSchema.parse({ cash: -100 })).toThrow();
      expect(() => CheckoutPaymentSchema.parse({ creditCard: -500 })).toThrow();
      expect(() => CheckoutPaymentSchema.parse({ linePay: -200 })).toThrow();
      expect(() => CheckoutPaymentSchema.parse({ pointsUsed: -10 })).toThrow();
    });

    it('should REJECT negative costPrice, sellingPrice, and suggestedPoints in ProductSchema', () => {
      expect(() =>
        ProductSchema.parse({
          id: 'P-01',
          name: '商品A',
          costPrice: -1,
        })
      ).toThrow();

      expect(() =>
        ProductSchema.parse({
          id: 'P-01',
          name: '商品A',
          sellingPrice: -10,
        })
      ).toThrow();

      expect(() =>
        ProductSchema.parse({
          id: 'P-01',
          name: '商品A',
          suggestedPoints: -5,
        })
      ).toThrow();
    });
  });

  describe('2. Invalid Phone String Rejection', () => {
    it('should REJECT empty phone string in CreateMemberSchema', () => {
      const member = {
        phone: '',
        name: '王小明',
      };
      expect(() => CreateMemberSchema.parse(member)).toThrow(/手機號碼長度至少需 6 碼/);
    });

    it('should REJECT too short phone string in CreateMemberSchema (e.g. 3-5 digits)', () => {
      expect(() => CreateMemberSchema.parse({ phone: '123', name: '王小明' })).toThrow(
        /手機號碼長度至少需 6 碼/
      );
      expect(() => CreateMemberSchema.parse({ phone: '0912', name: '王小明' })).toThrow(
        /手機號碼長度至少需 6 碼/
      );
    });

    it('should REJECT empty phone string in MemberSchema', () => {
      const fullMember = {
        id: 'm-001',
        phone: '',
        name: '王小明',
        tier: 'GENERAL',
        points: 100,
      };
      expect(() => MemberSchema.parse(fullMember)).toThrow();
    });

    it('should REJECT non-string phone types in CheckoutPayloadSchema customer', () => {
      const payloadWithNumericPhone = {
        branch: 'chupei',
        storeId: 'chupei',
        customer: {
          phone: 912345678 as any,
        },
        lotteries: [],
        merchandises: [],
        payment: { cash: 0, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
        checkoutUID: 'UID-TEST-001',
        cashierEmail: 'cashier@onesoul.com',
      };
      expect(() => CheckoutPayloadSchema.parse(payloadWithNumericPhone)).toThrow();
    });
  });

  describe('3. Missing checkoutUID Rejection', () => {
    it('should REJECT empty string checkoutUID in CheckoutPayloadSchema', () => {
      const payload = {
        branch: 'chupei',
        storeId: 'chupei',
        customer: { phone: 'WALKIN' },
        lotteries: [],
        merchandises: [],
        payment: { cash: 0, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
        checkoutUID: '',
        cashierEmail: 'cashier@onesoul.com',
      };
      expect(() => CheckoutPayloadSchema.parse(payload)).toThrow(/checkoutUID 唯一冪等鍵不可為空/);
    });

    it('should REJECT undefined / omitted checkoutUID in CheckoutPayloadSchema', () => {
      const payload = {
        branch: 'chupei',
        storeId: 'chupei',
        customer: { phone: 'WALKIN' },
        lotteries: [],
        merchandises: [],
        payment: { cash: 0, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
        cashierEmail: 'cashier@onesoul.com',
      };
      expect(() => CheckoutPayloadSchema.parse(payload)).toThrow();
    });

    it('should REJECT missing checkoutUID in OrderSchema', () => {
      const order = {
        id: 'ord-001',
        storeId: 'chupei',
        sessionId: 'sess-001',
        status: 'COMPLETED' as const,
        totalDue: 0,
        receivedAmount: 0,
        cash: 0,
        creditCard: 0,
        linePay: 0,
        remittance: 0,
        pointsUsed: 0,
        netPointsDelta: 0,
        cashierEmail: 'cashier@onesoul.com',
        createdAt: '2026-11-08T00:00:00Z',
        updatedAt: '2026-11-08T00:00:00Z',
      };
      expect(() => OrderSchema.parse(order)).toThrow();
    });
  });

  describe('4. Additional Adversarial Validation Vectors', () => {
    it('should REJECT negative inventory quantity in StoreInventorySchema', () => {
      const inv = {
        id: 'inv-1',
        storeId: 'chupei',
        productId: 'P-001',
        quantity: -10,
      };
      expect(() => StoreInventorySchema.parse(inv)).toThrow(/門市現貨不可小於 0/);
    });

    it('should REJECT non-integer float quantities in StoreInventorySchema', () => {
      const inv = {
        id: 'inv-1',
        storeId: 'chupei',
        productId: 'P-001',
        quantity: 5.5,
      };
      expect(() => StoreInventorySchema.parse(inv)).toThrow();
    });

    it('should REJECT non-integer float draws in CheckoutLotteryItemSchema', () => {
      const item = {
        id: 'LB-01',
        prize: 'A',
        draws: 2.5,
        type: '帶走' as const,
        unitPrice: 350,
        amount: 875,
      };
      expect(() => CheckoutLotteryItemSchema.parse(item)).toThrow();
    });

    it('should REJECT zero draws in LuckyBagPrizeSchema (draws < 1)', () => {
      const prize = {
        id: 'p-01',
        bagId: 'LB-01',
        prizeGrade: 'A',
        prizeName: '大賞',
        draws: 0,
      };
      expect(() => LuckyBagPrizeSchema.parse(prize)).toThrow();
    });

    it('should REJECT negative drawnCount in LuckyBagPrizeSchema', () => {
      const prize = {
        id: 'p-01',
        bagId: 'LB-01',
        prizeGrade: 'A',
        prizeName: '大賞',
        draws: 10,
        drawnCount: -1,
      };
      expect(() => LuckyBagPrizeSchema.parse(prize)).toThrow();
    });

    it('should REJECT invalid email for cashier in CheckoutPayloadSchema', () => {
      const payload = {
        branch: 'chupei',
        storeId: 'chupei',
        customer: { phone: 'WALKIN' },
        lotteries: [],
        merchandises: [],
        payment: { cash: 0, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
        checkoutUID: 'UID-TEST-002',
        cashierEmail: 'attacker-not-email',
      };
      expect(() => CheckoutPayloadSchema.parse(payload)).toThrow(/收銀員帳號格式不正確/);
    });

    it('should REJECT zero delta in AdjustPointsPayloadSchema', () => {
      const adjustZero = {
        delta: 0,
        reason: '系統補償手續費',
        operator: 'admin@onesoul.com',
      };
      expect(() => AdjustPointsPayloadSchema.parse(adjustZero)).toThrow(/異動點數不可為 0/);
    });

    it('should REJECT short reason (< 4 chars) in AdjustPointsPayloadSchema', () => {
      const adjustShortReason = {
        delta: 10,
        reason: '補點',
        operator: 'admin@onesoul.com',
      };
      expect(() => AdjustPointsPayloadSchema.parse(adjustShortReason)).toThrow(
        /調整理由至少需 4 個字元/
      );
    });

    it('should REJECT short voidReason (< 2 chars) in OrderVoidPayloadSchema', () => {
      const voidPayload = {
        voidReason: '錯',
        voidedBy: 'admin@onesoul.com',
      };
      expect(() => OrderVoidPayloadSchema.parse(voidPayload)).toThrow(
        /請填寫至少 2 字之作廢原因/
      );
    });

    it('should REJECT setCount > 50 or < 1 in PublishPlansPayloadSchema', () => {
      const planOver50 = {
        storeId: 'chupei',
        name: '超量套組',
        unitPrice: 350,
        setCount: 51,
        items: [{ grade: 'A', name: '賞品', draws: 1, points: 0, cost: 0 }],
        operator: 'admin@onesoul.com',
      };
      expect(() => PublishPlansPayloadSchema.parse(planOver50)).toThrow();

      const planZero = {
        ...planOver50,
        setCount: 0,
      };
      expect(() => PublishPlansPayloadSchema.parse(planZero)).toThrow();
    });
  });
});
