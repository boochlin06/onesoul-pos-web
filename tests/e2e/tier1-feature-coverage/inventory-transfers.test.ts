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

describe('Tier 1: Feature Coverage - Inventory & Stocktakes (庫存管理與門市盤點)', () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    resetTestStore();
    app = buildApp();
  });

  it('F18/F19-1: 門市庫存對照總覽查詢 (GET /inventory/summary)，呈現各門市現貨分佈', async () => {
    const res = await authInject(app, {
      method: 'GET',
      url: '/api/admin/inventory/summary',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);

    const prod4108 = body.data.find((it: any) => it.id === '4108');
    expect(prod4108).toBeDefined();
    expect(prod4108.storeStocks.chupei).toBe(5);
    expect(prod4108.storeStocks.jinshan).toBe(2);
    expect(prod4108.totalStock).toBe(7);
  });

  it('F18/F19-2: 單品手動調帳 (POST /inventory/adjust-stock)，原子更新庫存並記錄流水與審計日誌', async () => {
    const store = getTestStore();
    const beforeStock = store.inventories.find((i) => i.storeId === 'chupei' && i.productId === 'GEN001')!.quantity;

    const res = await authInject(app, {
      method: 'POST',
      url: '/api/admin/inventory/adjust-stock',
      payload: {
        storeId: 'chupei',
        productId: 'GEN001',
        newQuantity: 65, // 從 50 調整至 65 (+15)
        reason: '門市實物到貨清點手動入庫',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.finalQty).toBe(65);

    // 驗證庫存主檔已更新
    const afterStock = store.inventories.find((i) => i.storeId === 'chupei' && i.productId === 'GEN001')!.quantity;
    expect(afterStock).toBe(65);

    // 驗證寫入 InventoryLog
    const invLog = store.inventoryLogs.find((l) => l.productId === 'GEN001' && l.changeType === 'MANUAL_ADJUST');
    expect(invLog).toBeDefined();
    expect(invLog!.delta).toBe(15);

    // 驗證寫入 AuditLog (STOCK_DELTA_ADJUST)
    const audit = store.auditLogs.find((a) => a.action === 'STOCK_DELTA_ADJUST' && a.targetId === 'chupei:GEN001');
    expect(audit).toBeDefined();
    expect(audit!.delta).toBe(15);
  });

  it('F18/F19-3: 手動建立商品主檔與期初庫存 (POST /inventory/products)，原子建立 Product 與 StoreInventory', async () => {
    const store = getTestStore();

    const newProductPayload = {
      id: 'GK-TEST-888',
      name: '咒術迴戰 五條悟 領域展開 GK',
      category: 'GK',
      sellingPrice: 16800,
      costPrice: 9000,
      suggestedPoints: 336,
      initialStocks: {
        chupei: 4,
        jinshan: 2,
      },
    };

    const res = await authInject(app, {
      method: 'POST',
      url: '/api/admin/inventory/products',
      payload: newProductPayload,
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);

    // 驗證 Product 主檔已新增
    const prod = store.products.find((p) => p.id === 'GK-TEST-888');
    expect(prod).toBeDefined();
    expect(prod!.sellingPrice).toBe(16800);

    // 驗證雙門市 StoreInventory 均已建立
    const cpInv = store.inventories.find((i) => i.storeId === 'chupei' && i.productId === 'GK-TEST-888');
    const jsInv = store.inventories.find((i) => i.storeId === 'jinshan' && i.productId === 'GK-TEST-888');
    expect(cpInv?.quantity).toBe(4);
    expect(jsInv?.quantity).toBe(2);
  });

  it('F18/F19-4: 門市盤點盲點草稿建立 (POST /api/v1/stocktakes)，正確記錄系統數、實盤數與盈虧差異', async () => {
    const store = getTestStore();

    const stocktakePayload = {
      branch: '竹北',
      note: '週日例行盤點盲點錄入',
      items: [
        { id: 'GK001', systemQty: 5, actualQty: 4, itemRemark: '疑似樣品損耗 -1' },
        { id: 'GEN001', systemQty: 50, actualQty: 52, itemRemark: '溢餘 +2' },
      ],
    };

    const res = await authInject(app, {
      method: 'POST',
      url: '/api/v1/stocktakes',
      payload: stocktakePayload,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.id).toBeDefined();

    const savedSt = store.stocktakes.find((s) => s.id === body.data.id);
    expect(savedSt).toBeDefined();
    expect(savedSt!.status).toBe('DRAFT');

    // 驗證盤點明細與差異核算
    const gkItem = store.stocktakeItems.find((it) => it.stocktakeId === body.data.id && it.productId === 'GK001');
    const genItem = store.stocktakeItems.find((it) => it.stocktakeId === body.data.id && it.productId === 'GEN001');
    expect(gkItem?.variance).toBe(-1); // 4 - 5 = -1
    expect(genItem?.variance).toBe(2);  // 52 - 50 = +2
  });

  it('F18/F19-5: 店長審核盤點過帳 (POST /stocktakes/:id/post)，原子校正門市庫存並防範重複審核', async () => {
    const store = getTestStore();

    // 先建立盤點單草稿
    const createRes = await authInject(app, {
      method: 'POST',
      url: '/api/v1/stocktakes',
      payload: {
        branch: '竹北',
        note: '盤點差異過帳測試',
        items: [
          { id: 'GK001', systemQty: 5, actualQty: 6, itemRemark: '尋回盤盈 1 隻' },
        ],
      },
    });
    const stId = JSON.parse(createRes.body).data.id;
    const initialGkStock = store.inventories.find((i) => i.storeId === 'chupei' && i.productId === 'GK001')!.quantity;

    // 執行審核過帳
    const postRes = await authInject(app, {
      method: 'POST',
      url: `/api/v1/stocktakes/${stId}/post`,
    });

    expect(postRes.statusCode).toBe(200);

    // 驗證盤點單狀態已變為 POSTED
    const st = store.stocktakes.find((s) => s.id === stId);
    expect(st!.status).toBe('POSTED');

    // 驗證門市庫存已原子修正 (+1, 5 -> 6)
    const afterGkStock = store.inventories.find((i) => i.storeId === 'chupei' && i.productId === 'GK001')!.quantity;
    expect(afterGkStock).toBe(initialGkStock + 1);

    // 驗證寫入 STOCKTAKE_ADJUST 異動日誌
    const invLog = store.inventoryLogs.find((l) => l.stocktakeId === stId && l.changeType === 'STOCKTAKE_ADJUST');
    expect(invLog).toBeDefined();
    expect(invLog!.delta).toBe(1);

    // 重複審核應被拒絕 (400 錯誤)
    const rePostRes = await authInject(app, {
      method: 'POST',
      url: `/api/v1/stocktakes/${stId}/post`,
    });
    expect(rePostRes.statusCode).toBe(400);
  });
});
