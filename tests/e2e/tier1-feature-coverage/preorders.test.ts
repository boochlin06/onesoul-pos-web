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

describe('Tier 1: Feature Coverage - PreOrders (廠商預購單管理)', () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    resetTestStore();
    app = buildApp();
  });

  it('F22-1: 推薦接續 GK 貨號 (GET /preorders/suggest-next-id)，自動避開虛擬條目與盲盒號', async () => {
    const res = await authInject(app, {
      method: 'GET',
      url: '/api/admin/preorders/suggest-next-id',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.suggestedId).toBeDefined();
    // 應推薦數值型 GK 序號 (如 4109)
    expect(parseInt(body.suggestedId, 10)).toBeGreaterThanOrEqual(4100);
  });

  it('F22-2: 新增廠商預購單 (POST /preorders)，記錄預付訂金且狀態初始為 PENDING', async () => {
    const store = getTestStore();

    const payload = {
      name: '鬼滅之刃 猗窩座 破壞殺・滅式 GK',
      version: '標準限定版',
      quantity: 3,
      deposit: 3000,
      supplier: '玩譯模型',
      targetStoreId: 'chupei',
      note: '預計12月發貨',
    };

    const res = await authInject(app, {
      method: 'POST',
      url: '/api/admin/preorders',
      payload,
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.id).toBeDefined();
    expect(body.data.status).toBe('PENDING');

    const po = store.preOrders.find((it) => it.id === body.data.id);
    expect(po).toBeDefined();
    expect(po!.deposit).toBe(3000);
  });

  it('F22-3: 查詢預購單清單 (GET /preorders?status=PENDING)，回傳分頁數據與統計摘要', async () => {
    const res = await authInject(app, {
      method: 'GET',
      url: '/api/admin/preorders?status=PENDING',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.summary).toBeDefined();
    expect(body.summary.pendingCount).toBeGreaterThanOrEqual(1);
    expect(body.summary.totalDepositPending).toBeGreaterThanOrEqual(2000);
  });

  it('F22-4: 補款驗收入庫 (POST /preorders/:id/receive)，計算單件成本並原子建立 Product 與 StoreInventory', async () => {
    const store = getTestStore();
    const poId = 'po-001'; // 預付 2000，2 隻

    // 補款 4000，運費 500 => 總成本 6500，單件成本 ceil(6500 / 2) = 3250
    const receivePayload = {
      finalPayment: 4000,
      shippingFee: 500,
      productId: '4115',
      sellingPrice: 7500,
      targetStoreId: 'chupei',
      note: '到貨驗收完好無缺損',
    };

    const res = await authInject(app, {
      method: 'POST',
      url: `/api/admin/preorders/${poId}/receive`,
      payload: receivePayload,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.preOrder.status).toBe('COMPLETED');
    expect(body.data.product.costPrice).toBe(3250);

    // 驗證原子建立了 Product
    const prod = store.products.find((p) => p.id === '4115');
    expect(prod).toBeDefined();
    expect(prod!.costPrice).toBe(3250);
    expect(prod!.sellingPrice).toBe(7500);

    // 驗證原子建立了 StoreInventory
    const inv = store.inventories.find((i) => i.storeId === 'chupei' && i.productId === '4115');
    expect(inv).toBeDefined();
    expect(inv!.quantity).toBe(2);

    // 驗證寫入入庫日誌與審計日誌
    expect(store.inventoryLogs.some((l) => l.productId === '4115' && l.changeType === 'PURCHASE_IN')).toBe(true);
  });

  it('F22-5: 預購單重複驗收防呆，已 COMPLETED 之預購單再次驗收應拋出 400 錯誤', async () => {
    const store = getTestStore();
    // 將 po-001 標記為 COMPLETED
    const po = store.preOrders.find((it) => it.id === 'po-001')!;
    po.status = 'COMPLETED';

    const res = await authInject(app, {
      method: 'POST',
      url: `/api/admin/preorders/po-001/receive`,
      payload: {
        finalPayment: 4000,
        shippingFee: 500,
        productId: '4116',
        sellingPrice: 7500,
        targetStoreId: 'chupei',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.message).toContain('不可重複驗收入庫');
  });
});
