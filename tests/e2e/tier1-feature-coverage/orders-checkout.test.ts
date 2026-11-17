import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockPrisma, resetTestStore, getTestStore, authInject } = await vi.hoisted(async () => {
  const harness = await import('../helpers/app-harness');
  return {
    mockPrisma: harness.mockPrisma,
    resetTestStore: harness.resetTestStore,
    getTestStore: harness.getTestStore,
    authInject: harness.authInject,
  };
});

vi.mock('../../../backend/src/plugins/prisma', () => ({
  prisma: mockPrisma,
  initPrisma: vi.fn(async () => mockPrisma),
  isUsingMemoryDb: () => true,
}));

import { buildApp } from '../../../backend/src/app';

describe('Tier 1: Feature Coverage - Orders & Checkout (收銀結帳核心)', () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    resetTestStore();
    app = buildApp();
  });

  it('F12-1: 門市一般商品多品項現金結帳，正確建立訂單並扣減庫存', async () => {
    const store = getTestStore();
    const initialInv = store.inventories.find((i) => i.storeId === 'chupei' && i.productId === 'GEN001')!.quantity;

    const checkoutPayload = {
      branch: '竹北',
      customer: {
        phone: '0912345678',
        name: '王小明',
      },
      lotteries: [],
      merchandises: [
        {
          id: 'GEN001',
          name: '壓克力高級展示盒',
          quantity: 2,
          unitAmount: 300,
          actualAmount: 600,
          totalPoints: 0,
          paymentType: '現金' as const,
        },
      ],
      payment: {
        receivedAmount: 600,
        cash: 600,
        remittance: 0,
        creditCard: 0,
        linePay: 0,
        pointsUsed: 0,
      },
      summary: {
        dueAmount: 600,
        pointsChange: 0,
      },
      checkoutUID: '0912345678_2026-10-10_000001',
    };

    const res = await authInject(app, {
      method: 'POST',
      url: '/api/v1/orders/checkout',
      payload: checkoutPayload,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.checkoutUID).toBe(checkoutPayload.checkoutUID);

    // 驗證庫存真實扣減 (50 -> 48)
    const afterInv = store.inventories.find((i) => i.storeId === 'chupei' && i.productId === 'GEN001')!.quantity;
    expect(afterInv).toBe(initialInv - 2);

    // 驗證訂單主檔與銷售流水
    expect(store.orders.length).toBe(1);
    expect(store.orders[0].receivedAmount).toBe(600);
    expect(store.orders[0].cash).toBe(600);
    expect(store.inventoryLogs.some((l) => l.productId === 'GEN001' && l.delta === -2)).toBe(true);
  });

  it('F12-2: 一番賞單抽抽中 A 賞現場「帶走」，增加已抽數並原子扣減實體門市庫存', async () => {
    const store = getTestStore();
    const initialGkStock = store.inventories.find((i) => i.storeId === 'chupei' && i.productId === 'GK001')!.quantity;
    const initialPrizeDrawn = store.luckyBagPrizes.find((p) => p.bagId === 'LB001' && p.prizeGrade === 'A')!.drawnCount;

    const checkoutPayload = {
      branch: '竹北',
      customer: {
        phone: '0912345678',
        name: '王小明',
      },
      lotteries: [
        {
          id: 'LB001',
          prize: 'A',
          draws: 1,
          type: '帶走' as const,
          unitPrice: 350,
          amount: 350,
          pointsCost: 0,
          totalPoints: 0,
        },
      ],
      merchandises: [],
      payment: {
        receivedAmount: 350,
        cash: 350,
        remittance: 0,
        creditCard: 0,
        linePay: 0,
        pointsUsed: 0,
      },
      summary: {
        dueAmount: 350,
        pointsChange: 0,
      },
      checkoutUID: '0912345678_2026-10-10_000002',
    };

    const res = await authInject(app, {
      method: 'POST',
      url: '/api/v1/orders/checkout',
      payload: checkoutPayload,
    });

    expect(res.statusCode).toBe(200);

    // 驗證獎項已抽數增加
    const prize = store.luckyBagPrizes.find((p) => p.bagId === 'LB001' && p.prizeGrade === 'A')!;
    expect(prize.drawnCount).toBe(initialPrizeDrawn + 1);

    // 驗證實體 GK 公仔庫存扣除 (5 -> 4)
    const afterGkStock = store.inventories.find((i) => i.storeId === 'chupei' && i.productId === 'GK001')!.quantity;
    expect(afterGkStock).toBe(initialGkStock - 1);
  });

  it('F12-3: 一番賞抽中小賞選擇「換點數（不帶走）」，公仔留店不扣庫存且會員點數增加', async () => {
    const store = getTestStore();
    const member = store.members.find((m) => m.phone === '0912345678')!;
    const initialPoints = member.points;

    const checkoutPayload = {
      branch: '竹北',
      customer: {
        phone: '0912345678',
        name: '王小明',
      },
      lotteries: [
        {
          id: 'LB001',
          prize: 'B',
          draws: 1,
          type: '點數' as const,
          unitPrice: 350,
          amount: 350,
          pointsCost: 0,
          totalPoints: 100, // B賞換 100 點
        },
      ],
      merchandises: [],
      payment: {
        receivedAmount: 350,
        cash: 350,
        remittance: 0,
        creditCard: 0,
        linePay: 0,
        pointsUsed: 0,
      },
      summary: {
        dueAmount: 350,
        pointsChange: 100,
      },
      checkoutUID: '0912345678_2026-10-10_000003',
    };

    const res = await authInject(app, {
      method: 'POST',
      url: '/api/v1/orders/checkout',
      payload: checkoutPayload,
    });

    expect(res.statusCode).toBe(200);

    // 驗證點數增加 (500 + 100 = 600)
    expect(member.points).toBe(initialPoints + 100);
    // 驗證有寫入 PointLog
    expect(store.pointLogs.some((l) => l.memberId === member.id && l.delta === 100)).toBe(true);
  });

  it('F12-4: 支援多元支付混合拆帳（現金 + 信用卡 + LinePay = 應付金額）', async () => {
    const store = getTestStore();

    const checkoutPayload = {
      branch: '竹北',
      customer: {
        phone: '0912345678',
        name: '王小明',
      },
      lotteries: [
        {
          id: 'LB001',
          prize: 'X',
          draws: 1,
          type: '帶走' as const,
          unitPrice: 350,
          amount: 350,
          pointsCost: 0,
          totalPoints: 0,
        },
      ],
      merchandises: [],
      payment: {
        receivedAmount: 350,
        cash: 150,
        creditCard: 100,
        linePay: 100,
        remittance: 0,
        pointsUsed: 0,
      },
      summary: {
        dueAmount: 350,
        pointsChange: 0,
      },
      checkoutUID: '0912345678_2026-10-10_000004',
    };

    const res = await authInject(app, {
      method: 'POST',
      url: '/api/v1/orders/checkout',
      payload: checkoutPayload,
    });

    expect(res.statusCode).toBe(200);
    const order = store.orders.find((o) => o.checkoutUID === checkoutPayload.checkoutUID)!;
    expect(order.cash).toBe(150);
    expect(order.creditCard).toBe(100);
    expect(order.linePay).toBe(100);
    expect(order.receivedAmount).toBe(350);
  });

  it('F12-5: 訂單軟作廢 (Soft Void)，標記 CANCELLED 並原子回補門市庫存與回滾籤位', async () => {
    const store = getTestStore();
    const checkoutUID = '0912345678_2026-10-10_000005';

    // 先建立一筆成功訂單
    const checkoutRes = await authInject(app, {
      method: 'POST',
      url: '/api/v1/orders/checkout',
      payload: {
        branch: '竹北',
        customer: { phone: '0912345678', name: '王小明' },
        lotteries: [
          { id: 'LB001', prize: 'A', draws: 1, type: '帶走', unitPrice: 350, amount: 350, pointsCost: 0, totalPoints: 0 },
        ],
        merchandises: [],
        payment: { receivedAmount: 350, cash: 350, remittance: 0, creditCard: 0, linePay: 0, pointsUsed: 0 },
        summary: { dueAmount: 350, pointsChange: 0 },
        checkoutUID,
      },
    });
    expect(checkoutRes.statusCode).toBe(200);

    const stockBeforeVoid = store.inventories.find((i) => i.storeId === 'chupei' && i.productId === 'GK001')!.quantity;
    const drawnBeforeVoid = store.luckyBagPrizes.find((p) => p.bagId === 'LB001' && p.prizeGrade === 'A')!.drawnCount;

    // 呼叫軟作廢端點
    const voidRes = await authInject(app, {
      method: 'POST',
      url: `/api/v1/orders/${checkoutUID}/void`,
      payload: {
        reason: '顧客買錯公仔退貨',
      },
    });

    expect(voidRes.statusCode).toBe(200);

    // 驗證訂單狀態變為 CANCELLED
    const order = store.orders.find((o) => o.checkoutUID === checkoutUID)!;
    expect(order.status).toBe('CANCELLED');
    expect(order.voidReason).toBe('顧客買錯公仔退貨');

    // 驗證門市庫存原子加回 1 件
    const stockAfterVoid = store.inventories.find((i) => i.storeId === 'chupei' && i.productId === 'GK001')!.quantity;
    expect(stockAfterVoid).toBe(stockBeforeVoid + 1);

    // 驗證籤位 drawnCount 扣回 1
    const drawnAfterVoid = store.luckyBagPrizes.find((p) => p.bagId === 'LB001' && p.prizeGrade === 'A')!.drawnCount;
    expect(drawnAfterVoid).toBe(drawnBeforeVoid - 1);
  });
});
