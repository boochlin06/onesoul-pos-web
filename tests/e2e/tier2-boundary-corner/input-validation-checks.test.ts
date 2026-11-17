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

describe('Tier 2: Boundary & Corner - Input Validation & Transaction Rollback (輸入驗證與事務回滾)', () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    resetTestStore();
    app = buildApp();
  });

  it('TC-VAL-01: 結帳傳入商品數量為 0 或負數 (quantity <= 0)，Zod Schema 攔截 (HTTP 400)', async () => {
    const res = await authInject(app, {
      method: 'POST',
      url: '/api/v1/orders/checkout',
      payload: {
        branch: '竹北',
        customer: { phone: '0912345678', name: '王小明' },
        lotteries: [],
        merchandises: [
          {
            id: '4108',
            name: '航海王 GK 雕像 魯夫',
            quantity: 0, // 非法數量 0
            unitPrice: 500,
            actualAmount: 0,
            paymentType: '現金',
          },
        ],
        summary: {
          dueAmount: 0,
          pointsChange: 0,
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
  });

  it('TC-VAL-02: 結帳應付金額防竄改驗證 (calculatedDue !== dueAmount)，拋出 400 錯誤', async () => {
    // 品項實際金額為 500，但前端送出 summary.dueAmount = 100 意圖少付
    const res = await authInject(app, {
      method: 'POST',
      url: '/api/v1/orders/checkout',
      payload: {
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
          dueAmount: 100, // 竄改金額！
          pointsChange: 0,
        },
        payment: {
          receivedAmount: 100,
          cash: 100,
        },
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.message).toContain('金額校驗失敗');
  });

  it('TC-VAL-03: 門市直購商品庫存不足時整體結帳事務原子回滾，無訂單無庫存殘留 (HTTP 400)', async () => {
    const store = getTestStore();
    const inv = store.inventories.find((i) => i.storeId === 'chupei' && i.productId === '4108')!;
    const initialStock = inv.quantity; // 現有 5
    const initialOrderCount = store.orders.length;

    // 欲購買 99 件，超過現有 5 件
    const res = await authInject(app, {
      method: 'POST',
      url: '/api/v1/orders/checkout',
      payload: {
        branch: '竹北',
        customer: { phone: '0912345678', name: '王小明' },
        lotteries: [],
        merchandises: [
          {
            id: '4108',
            name: '航海王 GK 雕像 魯夫',
            quantity: 99,
            unitPrice: 500,
            actualAmount: 49500,
            paymentType: '現金',
          },
        ],
        summary: {
          dueAmount: 49500,
          pointsChange: 0,
        },
        payment: {
          receivedAmount: 49500,
          cash: 49500,
        },
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.message).toContain('庫存不足');

    // 驗證事務完整回滾：庫存與訂單數量保持原狀
    expect(inv.quantity).toBe(initialStock);
    expect(store.orders.length).toBe(initialOrderCount);
  });

  it('TC-VAL-04: 手動庫存調帳使庫存低於 0 (finalQty < 0)，後端阻斷拋出 400', async () => {
    const store = getTestStore();
    const inv = store.inventories.find((i) => i.storeId === 'chupei' && i.productId === '4108')!;
    const initialQty = inv.quantity;

    const res = await authInject(app, {
      method: 'POST',
      url: '/api/admin/inventory/adjust-stock',
      payload: {
        storeId: 'chupei',
        productId: '4108',
        delta: -999, // 企圖減到負數
        reason: '惡意超額負數調帳',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.message).toContain('不可為負數');
    expect(inv.quantity).toBe(initialQty);
  });

  it('TC-VAL-05: 建立商品主檔未提供品名 (name 必填)，拋出 400 錯誤', async () => {
    const res = await authInject(app, {
      method: 'POST',
      url: '/api/admin/inventory/products',
      payload: {
        id: '4999',
        name: '   ', // 空品名
        category: '海賊王',
        costPrice: 1000,
        sellingPrice: 2000,
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.message).toContain('品名為必填欄位');
  });

  it('TC-VAL-06: 建立商品主檔貨號碰撞衝突 (customId 重複)，拋出 409 衝突錯誤', async () => {
    // 4108 已經存在於商品主檔中
    const res = await authInject(app, {
      method: 'POST',
      url: '/api/admin/inventory/products',
      payload: {
        id: '4108',
        name: '重複貨號商品測試',
        category: '海賊王',
        costPrice: 1000,
        sellingPrice: 2000,
      },
    });

    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.message).toContain('已存在');
  });
});
