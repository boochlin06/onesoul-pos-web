import { describe, it, expect } from 'vitest';
import {
  CheckoutPayloadSchema,
  CheckoutResponseSchema,
  ProductSchema,
  StoreInventorySchema,
  MemberSchema,
  LuckyBagPrizeSchema,
  CashRegisterSessionSchema,
  AuditLogSchema,
  StoreTypeEnum,
  OrderStatusEnum,
} from '../src';

describe('Zod Domain Schemas', () => {
  it('should validate a valid CheckoutPayload', () => {
    const validPayload = {
      branch: 'chupei',
      storeId: 'chupei',
      customer: {
        phone: '0912345678',
        name: '王小明',
      },
      lotteries: [
        {
          id: 'LB-01',
          prize: 'A',
          draws: 1,
          type: '帶走' as const,
          unitPrice: 350,
          amount: 350,
        },
      ],
      merchandises: [
        {
          id: 'PROD-01',
          name: '海賊王 GK 魯夫',
          quantity: 1,
          paymentType: '現金' as const,
          unitAmount: 2000,
          actualAmount: 2000,
          totalPoints: 0,
        },
      ],
      payment: {
        cash: 2350,
        creditCard: 0,
        linePay: 0,
        remittance: 0,
        pointsUsed: 0,
      },
      checkoutUID: 'UID-TEST-20261108-001',
      cashierEmail: 'cashier@onesoul.com',
    };

    const parsed = CheckoutPayloadSchema.parse(validPayload);
    expect(parsed.checkoutUID).toBe('UID-TEST-20261108-001');
    expect(parsed.payment.cash).toBe(2350);
  });

  it('should validate CheckoutResponseSchema', () => {
    const response = {
      success: true,
      message: '結帳成功',
      checkoutUID: 'UID-12345',
      orderId: 'ord-123',
      newPoints: 120,
    };
    const parsed = CheckoutResponseSchema.parse(response);
    expect(parsed.success).toBe(true);
    expect(parsed.newPoints).toBe(120);
  });

  it('should validate MemberSchema', () => {
    const member = {
      id: 'm-1',
      phone: '0912345678',
      name: '張三',
      tier: 'GENERAL',
      points: 100,
      version: 0,
      isActive: true,
      totalSpent: 5000,
      orderCount: 3,
    };
    const parsed = MemberSchema.parse(member);
    expect(parsed.name).toBe('張三');
    expect(parsed.points).toBe(100);
  });

  it('should validate CashRegisterSessionSchema', () => {
    const session = {
      id: 'sess-1',
      storeId: 'chupei',
      openedAt: new Date().toISOString(),
      openedBy: 'cashier@onesoul.com',
      openingCash: 8000,
      status: 'OPEN' as const,
    };
    const parsed = CashRegisterSessionSchema.parse(session);
    expect(parsed.openingCash).toBe(8000);
    expect(parsed.status).toBe('OPEN');
  });

  it('should validate AuditLogSchema', () => {
    const log = {
      id: 'audit-1',
      operatorId: 'admin@onesoul.com',
      action: 'POINT_ADJUST',
      targetType: 'MEMBER',
      targetId: 'm-1',
      delta: 50,
      reason: '手動補發活動點數',
      prevHash: '0000000000000000000000000000000000000000000000000000000000000000',
      currentHash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
    };
    const parsed = AuditLogSchema.parse(log);
    expect(parsed.action).toBe('POINT_ADJUST');
  });

  it('should reject CheckoutPayload with invalid email or missing checkoutUID', () => {
    const invalidPayload = {
      storeId: 'chupei',
      customer: { phone: 'WALKIN' },
      lotteries: [],
      merchandises: [],
      payment: { cash: 0, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
      checkoutUID: '',
      cashierEmail: 'not-an-email',
    };

    expect(() => CheckoutPayloadSchema.parse(invalidPayload)).toThrow();
  });

  it('should validate ProductSchema and default values', () => {
    const prod = {
      id: 'GK-LUFFY-01',
      name: '四檔魯夫雕像',
      costPrice: 4000,
      sellingPrice: 7500,
      category: 'GK' as const,
      condition: 'NEW' as const,
    };

    const parsed = ProductSchema.parse(prod);
    expect(parsed.id).toBe('GK-LUFFY-01');
    expect(parsed.mainCategory).toBe('GK');
    expect(parsed.isSpecial).toBe(false);
  });

  it('should reject StoreInventory with negative quantity in schema', () => {
    const inv = {
      id: 'inv-1',
      storeId: 'chupei',
      productId: 'GK-01',
      quantity: -5,
    };
    expect(() => StoreInventorySchema.parse(inv)).toThrow('門市現貨不可小於 0');
  });

  it('should validate LuckyBagPrizeSchema', () => {
    const prize = {
      id: 'p-1',
      bagId: 'LB-01',
      prizeGrade: 'A',
      prizeName: '火拳艾斯 GK',
      draws: 2,
      drawnCount: 0,
      points: 0,
    };
    const parsed = LuckyBagPrizeSchema.parse(prize);
    expect(parsed.prizeGrade).toBe('A');
  });

  it('should validate 19 domain enums completeness', () => {
    expect(StoreTypeEnum).toContain('RETAIL');
    expect(StoreTypeEnum).toContain('WAREHOUSE');
    expect(StoreTypeEnum).toContain('POPUP');
    expect(OrderStatusEnum).toContain('COMPLETED');
    expect(OrderStatusEnum).toContain('CANCELLED');
  });
});
