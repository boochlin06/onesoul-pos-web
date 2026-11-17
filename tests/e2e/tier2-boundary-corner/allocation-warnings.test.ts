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

describe('Tier 2: Boundary & Corner - Allocation Warnings & Invariants (配賞看板邊界與開套不變量 #2)', () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    resetTestStore();
    app = buildApp();
  });

  it('TC-ALC-01: 現貨雷達超配警戒 (isOverAllocated = true)：當已配抽數大於門市庫存時標記警示', async () => {
    const store = getTestStore();
    // 現有 4108 在竹北店庫存為 5 件
    // 建立一個在場活躍套組，配置 8 抽 4108 (大於庫存 5 件)
    const overBag = {
      id: `bag-over-${Date.now()}`,
      storeId: 'chupei',
      name: '超配測試套',
      status: 'ACTIVE',
      totalDraws: 8,
      drawnCount: 0,
      price1: 300,
    };
    store.luckyBags.push(overBag);
    store.luckyBagPrizes.push({
      id: `prize-over-1`,
      bagId: overBag.id,
      prizeGrade: 'A',
      prizeName: '超額大賞',
      productId: '4108',
      draws: 8,
      drawnCount: 0,
      points: 0,
    });

    const res = await authInject(app, {
      method: 'GET',
      url: '/api/admin/allocation/live-stock?storeId=chupei&minQty=1',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    const item4108 = body.data.find((it: any) => it.id === '4108');
    expect(item4108).toBeDefined();
    expect(item4108.stock).toBe(5);
    expect(item4108.allocatedCount).toBeGreaterThanOrEqual(8);
    // 警戒欄位 isOverAllocated 必須為 true！
    expect(item4108.isOverAllocated).toBe(true);
    // availableStock 防負數，必須截斷為 0
    expect(item4108.availableStock).toBe(0);
  });

  it('TC-ALC-02: 開套發布防呆：未配置實體公仔大獎時拋出 400 錯誤', async () => {
    const res = await authInject(app, {
      method: 'POST',
      url: '/api/admin/allocation/plans/publish',
      payload: {
        name: '純盲盒與小賞套 (無實體 GK)',
        storeId: 'chupei',
        totalDraws: 10,
        price1: 350,
        items: [
          { prizeGrade: 'X', prizeName: '盲盒賞', productId: '0p', draws: 5, isNonGk: true, costPrice: 100 },
          { prizeGrade: 'Z', prizeName: '安慰獎', productId: '1p', draws: 5, isNonGk: true, costPrice: 30 },
        ],
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.message).toContain('套組中必須至少配置 1 款實體公仔大獎');
  });

  it('TC-ALC-03: 開套發布防呆：獎項抽數總和未平帳時拋出 400 錯誤 (sumDraws !== totalDraws)', async () => {
    const res = await authInject(app, {
      method: 'POST',
      url: '/api/admin/allocation/plans/publish',
      payload: {
        name: '抽數未平帳測試套',
        storeId: 'chupei',
        totalDraws: 10, // 宣稱總抽數 10
        price1: 350,
        items: [
          { prizeGrade: 'A', prizeName: '大賞', productId: '4108', draws: 1, isNonGk: false, costPrice: 1500 },
          { prizeGrade: 'Z', prizeName: '小賞', productId: '1p', draws: 8, isNonGk: true, costPrice: 50 },
          // 1 + 8 = 9，與總抽數 10 不符
        ],
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.message).toContain('抽數未平帳');
  });

  it('TC-ALC-04: X 賞等價盲盒點數與 Z 賞保底 1 點預設解析與注入', async () => {
    const res = await authInject(app, {
      method: 'POST',
      url: '/api/admin/allocation/plans/publish',
      payload: {
        name: 'XZ 賞點數注入測試套',
        storeId: 'chupei',
        totalDraws: 10,
        price1: 350,
        blindBoxPointsValue: 12, // 自訂 X 賞等價 12 點
        items: [
          { prizeGrade: 'A', prizeName: '大賞 GK', productId: '4108', draws: 1, isNonGk: false, costPrice: 1500 },
          { prizeGrade: 'X', prizeName: '盲盒賞', productId: '0p', draws: 4, isNonGk: true, costPrice: 200 },
          { prizeGrade: 'Z', prizeName: '小賞', productId: '1p', draws: 5, isNonGk: true, costPrice: 50 },
        ],
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);

    const store = getTestStore();
    const createdBag = body.data[0];
    const bagPrizes = store.luckyBagPrizes.filter((p) => p.bagId === createdBag.bagId);

    // 驗證 X 賞自動注入 12 點
    const xPrize = bagPrizes.find((p) => p.prizeGrade === 'X')!;
    expect(xPrize.points).toBe(12);

    // 驗證 Z 賞自動注入 1 點
    const zPrize = bagPrizes.find((p) => p.prizeGrade === 'Z')!;
    expect(zPrize.points).toBe(1);
  });

  it('TC-ALC-05: 批次開多套 (batchCount = 2) 產出 #1, #2 獨立套組與籤位', async () => {
    const res = await authInject(app, {
      method: 'POST',
      url: '/api/admin/allocation/plans/publish',
      payload: {
        name: '海賊王同開雙套',
        storeId: 'chupei',
        totalDraws: 10,
        price1: 350,
        batchCount: 2, // 一次開 2 套
        items: [
          { prizeGrade: 'A', prizeName: '大賞 GK', productId: '4108', draws: 2, isNonGk: false, costPrice: 1500 },
          { prizeGrade: 'Z', prizeName: '小賞', productId: '1p', draws: 8, isNonGk: true, costPrice: 50 },
        ],
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.length).toBe(2);
    expect(body.data[0].name).toContain('#1');
    expect(body.data[1].name).toContain('#2');
    expect(body.data[0].bagId).toBeDefined();
    expect(body.data[0].bagId).not.toBe(body.data[1].bagId);
  });

  it('TC-ALC-06: 開套發布不可破壞門市實體庫存不變量 (Invariant #2：發布前後 StoreInventory 零扣減)', async () => {
    const store = getTestStore();
    const inv = store.inventories.find((i) => i.storeId === 'chupei' && i.productId === '4108')!;
    const stockBefore = inv.quantity;

    const res = await authInject(app, {
      method: 'POST',
      url: '/api/admin/allocation/plans/publish',
      payload: {
        name: '不變量驗證套',
        storeId: 'chupei',
        totalDraws: 10,
        price1: 350,
        items: [
          { prizeGrade: 'A', prizeName: '大賞 GK', productId: '4108', draws: 3, isNonGk: false, costPrice: 1500 },
          { prizeGrade: 'Z', prizeName: '小賞', productId: '1p', draws: 7, isNonGk: true, costPrice: 50 },
        ],
      },
    });

    expect(res.statusCode).toBe(201);
    // 核心不變量 Invariant #2: 發布開套絕不扣除 StoreInventory！
    expect(inv.quantity).toBe(stockBefore);
  });
});
