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

describe('Tier 2: Boundary & Corner - Idempotency & State Machine Guards (冪等性與狀態機保護)', () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    resetTestStore();
    app = buildApp();
  });

  it('TC-IDEM-01: 相同 checkoutUID 重複發送結帳請求，返回 200 冪等成功且不重複扣庫存', async () => {
    const store = getTestStore();
    const inv = store.inventories.find((i) => i.storeId === 'chupei' && i.productId === '4108')!;
    const initialStock = inv.quantity; // 5

    const uniqueUID = `CHECKOUT-TEST-IDEM-${Date.now()}`;
    const payload = {
      checkoutUID: uniqueUID,
      branch: '竹北',
      customer: { phone: '0912345678', name: '王小明' },
      lotteries: [],
      merchandises: [
        {
          id: '4108',
          name: '航海王 GK 雕像 魯夫',
          quantity: 1,
          unitPrice: 500,
          actualAmount: 500,
          paymentType: '現金',
        },
      ],
      summary: {
        dueAmount: 500,
        pointsChange: 0,
      },
      payment: {
        receivedAmount: 500,
        cash: 500,
      },
    };

    // 第一次送出：正常成功結帳
    const res1 = await authInject(app, {
      method: 'POST',
      url: '/api/v1/orders/checkout',
      payload,
    });
    expect(res1.statusCode).toBe(200);
    expect(inv.quantity).toBe(initialStock - 1); // 扣 1

    // 第二次送出 (完全相同 checkoutUID，模擬網路重試/重複點擊)
    const res2 = await authInject(app, {
      method: 'POST',
      url: '/api/v1/orders/checkout',
      payload,
    });
    expect(res2.statusCode).toBe(200);
    const body2 = JSON.parse(res2.body);
    expect(body2.success).toBe(true);
    expect(body2.message).toContain('冪等響應');
    expect(body2.checkoutUID).toBe(uniqueUID);

    // 驗證庫存未被二次扣減！
    expect(inv.quantity).toBe(initialStock - 1);
  });

  it('TC-IDEM-02: 散客未傳 checkoutUID 時自動注入隨機高熵後綴，防止散客結帳碰撞吞單', async () => {
    const store = getTestStore();
    const inv = store.inventories.find((i) => i.storeId === 'chupei' && i.productId === '4108')!;
    const initialOrdersCount = store.orders.length;

    // 兩筆散客結帳均未帶 checkoutUID
    const payloadWalkIn = {
      branch: '竹北',
      customer: { phone: '111111', name: '散客' },
      lotteries: [],
      merchandises: [
        {
          id: '4108',
          name: '航海王 GK 雕像 魯夫',
          quantity: 1,
          unitPrice: 500,
          actualAmount: 500,
          paymentType: '現金',
        },
      ],
      summary: {
        dueAmount: 500,
        pointsChange: 0,
      },
      payment: {
        receivedAmount: 500,
        cash: 500,
      },
    };

    const resA = await authInject(app, {
      method: 'POST',
      url: '/api/v1/orders/checkout',
      payload: payloadWalkIn,
    });
    expect(resA.statusCode).toBe(200);

    const resB = await authInject(app, {
      method: 'POST',
      url: '/api/v1/orders/checkout',
      payload: payloadWalkIn,
    });
    expect(resB.statusCode).toBe(200);

    // 兩筆散客訂單均順利入庫，且各自有不同的 checkoutUID
    expect(store.orders.length).toBe(initialOrdersCount + 2);
    const orderA = store.orders[store.orders.length - 2];
    const orderB = store.orders[store.orders.length - 1];
    expect(orderA.checkoutUID).not.toBe(orderB.checkoutUID);
  });

  it('TC-IDEM-03: 門市盤點單重複過帳狀態機防護，已 POSTED 盤點單再次過帳拋出 400', async () => {
    const store = getTestStore();
    const stocktake = {
      id: `st-idem-${Date.now()}`,
      storeId: 'chupei',
      status: 'POSTED', // 已審核過帳
      note: '先前已完成盤點過帳',
      items: [],
      createdAt: new Date(),
    };
    store.stocktakes.push(stocktake);

    const res = await authInject(app, {
      method: 'POST',
      url: `/api/v1/stocktakes/${stocktake.id}/post`,
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.message).toContain('已審核過帳');
  });

  it('TC-IDEM-04: 廠商預購單重複驗收狀態機防護，已 COMPLETED 預購單再次驗收拋出 400', async () => {
    const store = getTestStore();
    const po = store.preOrders.find((it) => it.id === 'po-001')!;
    po.status = 'COMPLETED';

    const res = await authInject(app, {
      method: 'POST',
      url: `/api/admin/preorders/po-001/receive`,
      payload: {
        finalPayment: 4000,
        shippingFee: 500,
        productId: '4199',
        sellingPrice: 7500,
        targetStoreId: 'chupei',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.message).toContain('不可重複驗收入庫');
  });

  it('TC-IDEM-05: 廠商預購單已取消或非 PENDING 狀態，拒絕重複取消 (HTTP 400)', async () => {
    const store = getTestStore();
    const po = store.preOrders.find((it) => it.id === 'po-001')!;
    po.status = 'CANCELLED';

    const res = await authInject(app, {
      method: 'POST',
      url: `/api/admin/preorders/po-001/cancel`,
      payload: {
        reason: '重複點擊取消',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.message).toContain('非待處理 (PENDING)');
  });

  it('TC-IDEM-06: 門市班次狀態機：不可重疊開啟多個進行中班次，重複開班就地復用與更新備用金', async () => {
    const store = getTestStore();
    const initialSessionCount = store.sessions.length;

    // 對已有進行中班次的竹北門市重複呼叫開帳
    const res = await authInject(app, {
      method: 'POST',
      url: '/api/v1/sessions/open',
      payload: {
        branch: '竹北',
        amount: 10000,
        note: '重疊開班更新備用金',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.message).toContain('更新');

    // 門市活躍班次數量不增生，原地更新開帳備用金為 10,000
    const activeSessions = store.sessions.filter((s) => s.storeId === 'chupei' && s.status === 'OPEN');
    expect(activeSessions.length).toBe(1);
    expect(activeSessions[0].openingCash).toBe(10000);
  });
});
