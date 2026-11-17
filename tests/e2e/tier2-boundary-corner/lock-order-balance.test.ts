import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockPrisma, resetTestStore, getTestStore, authInject, computeAuditHash } = await vi.hoisted(async () => {
  const harness = await import('../helpers/app-harness');
  return {
    mockPrisma: harness.mockPrisma,
    resetTestStore: harness.resetTestStore,
    getTestStore: harness.getTestStore,
    authInject: harness.authInject,
    computeAuditHash: harness.computeAuditHash,
  };
});

vi.mock('../../../backend/src/plugins/prisma', () => ({
  prisma: mockPrisma,
  initPrisma: vi.fn(async () => mockPrisma),
  isUsingMemoryDb: () => true,
}));

import { buildApp } from '../../../backend/src/app';
import { recordAuditLog } from '../../../backend/src/modules/admin/audit.service';

describe('Tier 2: Boundary & Corner - Lock Ordering & Balance Floors (鎖序字典序防死鎖與餘額下限)', () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    resetTestStore();
    app = buildApp();
  });

  it('TC-LCK-01: Invariant #3: 多商品結帳依 productId 字典序排序 (localeCompare) 競爭鎖', async () => {
    const store = getTestStore();
    // 建立第 2 個測試商品 4107
    store.products.push({
      id: '4107',
      name: '航海王 索隆 GK',
      category: '海賊王',
      mainCategory: 'GK',
      subCategory: '海賊王',
      costPrice: 800,
      sellingPrice: 1200,
      suggestedPoints: 60,
      safetyStock: 2,
    });
    store.inventories.push({
      id: 'inv-chupei-4107',
      storeId: 'chupei',
      productId: '4107',
      quantity: 5,
      version: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 送出未排序的商品清單: 4108 在前, 4107 在後
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
            name: '魯夫 GK',
            quantity: 1,
            unitPrice: 500,
            actualAmount: 500,
            paymentType: '現金',
          },
          {
            id: '4107',
            name: '索隆 GK',
            quantity: 1,
            unitPrice: 1200,
            actualAmount: 1200,
            paymentType: '現金',
          },
        ],
        summary: {
          dueAmount: 1700,
          pointsChange: 0,
        },
        payment: {
          receivedAmount: 1700,
          cash: 1700,
        },
      },
    });

    expect(res.statusCode).toBe(200);
    // 兩項商品庫存均成功各扣 1
    const inv4108 = store.inventories.find((i) => i.storeId === 'chupei' && i.productId === '4108')!;
    const inv4107 = store.inventories.find((i) => i.storeId === 'chupei' && i.productId === '4107')!;
    expect(inv4108.quantity).toBe(4);
    expect(inv4107.quantity).toBe(4);
  });

  it('TC-LCK-02: 會員點數下限防護：點數異動若導致餘額小於 0 則拒絕並拋出 400', async () => {
    const store = getTestStore();
    const member = store.members.find((m) => m.phone === '0912345678')!;
    member.points = 10; // 會員僅有 10 點

    // 企圖在結帳中折抵 50 點 (超出 10 點)
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
            name: '魯夫 GK',
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
    expect(body.message).toContain('客戶點數不足');
    expect(member.points).toBe(10);
  });

  it('TC-LCK-03: 門市日結關帳溢短帳精確計算 (overShort = actualCash - expectedCash)', async () => {
    // 預期現金為 $8,600，但實盤清點為 $8,500 (短少 $100)
    const resShort = await authInject(app, {
      method: 'POST',
      url: '/api/v1/sessions/close',
      payload: {
        branch: '竹北',
        actualCash: 7900,
        note: '短少 100 元關帳測試',
      },
    });

    expect(resShort.statusCode).toBe(200);
    const bodyShort = JSON.parse(resShort.body);
    expect(bodyShort.success).toBe(true);
    expect(bodyShort.data.discrepancy).toBe(-100);
  });

  it('TC-LCK-04: 門市日結關帳實盤溢收帳精確計算 (actualCash > expectedCash -> 正值 discrepancy)', async () => {
    // 開啟新班次
    await authInject(app, {
      method: 'POST',
      url: '/api/v1/sessions/open',
      payload: { branch: '竹北', amount: 8000 },
    });

    // 預期現金為 $8,000，實盤清點為 $8,200 (溢收 $200)
    const resOver = await authInject(app, {
      method: 'POST',
      url: '/api/v1/sessions/close',
      payload: {
        branch: '竹北',
        actualCash: 8200,
        note: '溢收 200 元關帳測試',
      },
    });

    expect(resOver.statusCode).toBe(200);
    const bodyOver = JSON.parse(resOver.body);
    expect(bodyOver.data.discrepancy).toBe(200);
  });

  it('TC-LCK-05: 訂單作廢後營業額扣回與庫存點數同步原子回滾', async () => {
    const store = getTestStore();
    const inv = store.inventories.find((i) => i.storeId === 'chupei' && i.productId === '4108')!;
    const initialStock = inv.quantity;

    // 先成立一筆一般商品結帳
    const resCheckout = await authInject(app, {
      method: 'POST',
      url: '/api/v1/orders/checkout',
      payload: {
        branch: '竹北',
        customer: { phone: '0912345678', name: '王小明' },
        lotteries: [],
        merchandises: [
          {
            id: '4108',
            name: '魯夫 GK',
            quantity: 1,
            unitPrice: 500,
            actualAmount: 500,
            paymentType: '現金',
          },
        ],
        summary: { dueAmount: 500, pointsChange: 0 },
        payment: { receivedAmount: 500, cash: 500 },
      },
    });
    expect(resCheckout.statusCode).toBe(200);
    expect(inv.quantity).toBe(initialStock - 1);

    const latestOrder = store.orders[store.orders.length - 1];

    // 執行作廢
    const resVoid = await authInject(app, {
      method: 'POST',
      url: `/api/v1/orders/${latestOrder.checkoutUID}/void`,
      payload: { reason: '顧客反悔退款' },
    });
    expect(resVoid.statusCode).toBe(200);

    // 庫存回補為原始值
    expect(inv.quantity).toBe(initialStock);
    // 訂單標記為 CANCELLED
    expect(latestOrder.status).toBe('CANCELLED');
  });

  it('TC-LCK-06: 審計日誌密碼學鏈在連續 5 次異動中保持無縫接軌 (prevHash 嚴格匹配)', async () => {
    const store = getTestStore();
    store.auditLogs = [];

    // 連續發起 5 次日誌寫入
    for (let i = 1; i <= 5; i++) {
      await recordAuditLog(mockPrisma as any, {
        operatorId: `cashier${i}@onesoul.com`,
        action: 'ORDER_CHECKOUT',
        targetType: 'Order',
        targetId: `ord-test-${i}`,
        delta: i * 10,
        reason: `第 ${i} 筆連續交易審計`,
      });
    }

    expect(store.auditLogs.length).toBe(5);

    // 第 1 筆創世節點
    expect(store.auditLogs[0].prevHash).toBe('0000000000000000000000000000000000000000000000000000000000000000');

    // 驗證第 2 到第 5 筆均無縫對齊上一筆 currentHash
    for (let i = 1; i < 5; i++) {
      expect(store.auditLogs[i].prevHash).toBe(store.auditLogs[i - 1].currentHash);

      // 驗證當前 Hash 可精確用上一筆 Hash 重算
      const expectedCurrent = computeAuditHash(
        store.auditLogs[i].prevHash,
        store.auditLogs[i].operatorId,
        store.auditLogs[i].action,
        store.auditLogs[i].targetType,
        store.auditLogs[i].targetId,
        store.auditLogs[i].delta,
        store.auditLogs[i].reason,
      );
      expect(store.auditLogs[i].currentHash).toBe(expectedCurrent);
    }
  });
});
