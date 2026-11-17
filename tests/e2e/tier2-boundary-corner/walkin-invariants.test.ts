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

describe('Tier 2: Boundary & Corner - Walk-In Invariants (散客零元購阻斷不變量 #1)', () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    resetTestStore();
    app = buildApp();
  });

  it('TC-BND-01: 散客電話 111111 企圖使用 pointsUsed > 0 折抵現金，後端強制作廢阻斷 (HTTP 400)', async () => {
    const res = await authInject(app, {
      method: 'POST',
      url: '/api/v1/orders/checkout',
      payload: {
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
          pointsChange: -50,
        },
        payment: {
          receivedAmount: 450,
          cash: 450,
          pointsUsed: 50,
        },
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.message).toContain('散客不可使用點數折抵');
  });

  it('TC-BND-02: 散客電話 222222 企圖將商品以 paymentType = 點數 兌換，應嚴格拒絕 (HTTP 400)', async () => {
    const res = await authInject(app, {
      method: 'POST',
      url: '/api/v1/orders/checkout',
      payload: {
        branch: '竹北',
        customer: { phone: '222222', name: '現場散客' },
        lotteries: [],
        merchandises: [
          {
            id: '4108',
            name: '航海王 GK 雕像 魯夫',
            quantity: 1,
            unitPrice: 500,
            actualAmount: 0,
            paymentType: '點數',
          },
        ],
        summary: {
          dueAmount: 0,
          pointsChange: -100,
        },
        payment: {
          receivedAmount: 0,
          cash: 0,
        },
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.message).toContain('散客不可使用點數折抵');
  });

  it('TC-BND-03: 顧客姓名標示為 現場散客 且抽籤 paymentType = 點數，應拋出 400 錯誤', async () => {
    const res = await authInject(app, {
      method: 'POST',
      url: '/api/v1/orders/checkout',
      payload: {
        branch: '竹北',
        customer: { phone: '0900000000', name: '現場散客' },
        lotteries: [
          {
            id: 'LB001',
            prize: 'A',
            draws: 1,
            prizeName: '火拳艾斯 景品',
            type: '點數',
            unitPrice: 350,
            amount: 0,
            pointsCost: 0,
            totalPoints: 10,
          },
        ],
        merchandises: [],
        summary: {
          dueAmount: 0,
          pointsChange: 10,
        },
        payment: {
          receivedAmount: 0,
          cash: 0,
        },
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.message).toContain('散客不可使用點數折抵');
  });

  it('TC-BND-04: 散客 (WALKIN) 試圖參與限定點數套 (pointsCost > 0 / remark: 點數套)，後端應拒絕', async () => {
    const res = await authInject(app, {
      method: 'POST',
      url: '/api/v1/orders/checkout',
      payload: {
        branch: '竹北',
        customer: { phone: 'WALKIN', name: 'WALKIN' },
        lotteries: [
          {
            id: 'LB001',
            prize: 'A',
            draws: 1,
            prizeName: '火拳艾斯 景品',
            type: '帶走',
            unitPrice: 350,
            amount: 0,
            pointsCost: 17,
            totalPoints: 0,
            remark: '點數套',
          },
        ],
        merchandises: [],
        summary: {
          dueAmount: 0,
          pointsChange: -17,
        },
        payment: {
          receivedAmount: 0,
          cash: 0,
        },
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.message).toContain('散客不可使用點數折抵');
  });

  it('TC-BND-05: 散客電話 99999 送出 pointsChange < 0 之結帳總結，應遭阻斷 (HTTP 400)', async () => {
    const res = await authInject(app, {
      method: 'POST',
      url: '/api/v1/orders/checkout',
      payload: {
        branch: '竹北',
        customer: { phone: '99999', name: '臨時客' },
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
          pointsChange: -10,
        },
        payment: {
          receivedAmount: 500,
          cash: 500,
        },
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.message).toContain('散客不可使用點數折抵');
  });

  it('TC-BND-06: 合法散客純現金結帳 (dueAmount > 0, pointsUsed = 0, pointsChange = 0)，成功通過且無點數異動', async () => {
    const store = getTestStore();
    const initialQty = store.inventories.find((i) => i.storeId === 'chupei' && i.productId === '4108')!.quantity;

    const res = await authInject(app, {
      method: 'POST',
      url: '/api/v1/orders/checkout',
      payload: {
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
          pointsUsed: 0,
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);

    // 庫存正常扣減 1
    const finalQty = store.inventories.find((i) => i.storeId === 'chupei' && i.productId === '4108')!.quantity;
    expect(finalQty).toBe(initialQty - 1);
  });
});
