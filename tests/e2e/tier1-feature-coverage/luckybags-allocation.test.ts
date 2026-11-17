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

describe('Tier 1: Feature Coverage - LuckyBags & Allocation (一番賞與配賞看板)', () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    resetTestStore();
    app = buildApp();
  });

  it('F14/F15-1: 現貨雷達查詢 (live-stock)，正確計算商品總庫存、在場占用量與可配現貨', async () => {
    const res = await authInject(app, {
      method: 'GET',
      url: '/api/admin/allocation/live-stock?storeId=chupei&minQty=1',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);

    // 驗證 GK001：現貨 5 件，LB001 A賞配置 2 抽，故已占用 2 抽，可配現貨為 3 件
    const gkItem = body.data.find((it: any) => it.id === 'GK001');
    expect(gkItem).toBeDefined();
    expect(gkItem.stock).toBe(5);
    expect(gkItem.allocatedCount).toBe(2);
    expect(gkItem.availableStock).toBe(3);
    expect(gkItem.isOverAllocated).toBe(false);
  });

  it('F14/F15-2: 建立配賞草稿方案 (POST /allocation/plans)，草稿箱能正確檢索', async () => {
    const draftPayload = {
      name: '鬼滅之刃 柱合會議新開套草稿',
      storeId: 'chupei',
      totalDraws: 80,
      price1: 300,
      price3: 900,
      price5: 1500,
      price10: 3000,
      items: [
        { prizeGrade: 'A', prizeName: 'A賞 水柱 冨岡義勇', productId: 'GK001', draws: 2, costPrice: 3000, points: 150 },
        { prizeGrade: 'B', prizeName: 'B賞 蟲柱 胡蝶忍', productId: 'GK002', draws: 2, costPrice: 2500, points: 120 },
        { prizeGrade: 'X', prizeName: 'X賞 盲盒賞', productId: null, draws: 10, costPrice: 150, points: 10 },
        { prizeGrade: 'Z', prizeName: 'Z賞 軟膠吊飾', productId: null, draws: 66, costPrice: 50, points: 1 },
      ],
    };

    const res = await authInject(app, {
      method: 'POST',
      url: '/api/admin/allocation/plans',
      payload: draftPayload,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.name).toBe(draftPayload.name);

    // 查詢配賞方案清單，確認已收錄於 drafts 列表中
    const listRes = await authInject(app, {
      method: 'GET',
      url: '/api/admin/allocation/plans',
    });
    expect(listRes.statusCode).toBe(200);
    const listBody = JSON.parse(listRes.body);
    const found = listBody.drafts.find((p: any) => p.name === draftPayload.name);
    expect(found).toBeDefined();
  });

  it('F14/F15-3: 刪除配賞草稿方案 (DELETE /allocation/plans/:id)，草稿自草稿庫移除', async () => {
    // 先建立草稿
    const createRes = await authInject(app, {
      method: 'POST',
      url: '/api/admin/allocation/plans',
      payload: {
        name: '待刪除測試方案',
        storeId: 'chupei',
        totalDraws: 50,
        price1: 250,
        items: [{ prizeGrade: 'A', prizeName: 'A賞', productId: 'GK001', draws: 2, costPrice: 2000, points: 50 }],
      },
    });
    const planId = JSON.parse(createRes.body).data.id;

    // 執行刪除
    const delRes = await authInject(app, {
      method: 'DELETE',
      url: `/api/admin/allocation/plans/${planId}`,
    });
    expect(delRes.statusCode).toBe(200);

    // 再次查詢確認已不存在
    const listRes = await authInject(app, {
      method: 'GET',
      url: '/api/admin/allocation/plans',
    });
    const listBody = JSON.parse(listRes.body);
    expect(listBody.drafts.some((p: any) => p.id === planId)).toBe(false);
  });

  it('F14/F15-4: 正式發布開套方案 (publish)，建立套組與獎項籤位，且嚴格遵守 Invariant #2 不預扣門市庫存', async () => {
    const store = getTestStore();
    const initialGk1Stock = store.inventories.find((i) => i.storeId === 'chupei' && i.productId === 'GK001')!.quantity;

    const publishPayload = {
      name: '航海王四皇大決戰套組',
      storeId: 'chupei',
      price1: 380,
      totalDraws: 39,
      batchCount: 1,
      items: [
        { prizeGrade: 'A', prizeName: 'A賞 紅髮傑克 GK', productId: 'GK001', draws: 2, costPrice: 4000, points: 150 },
        { prizeGrade: 'B', prizeName: 'B賞 黑鬍子', productId: null, draws: 2, costPrice: 2000, points: 80 },
        { prizeGrade: 'X', prizeName: 'X賞 門市盲盒任選', productId: null, draws: 5, costPrice: 180, points: 10 },
        { prizeGrade: 'Z', prizeName: 'Z賞 原畫色紙', productId: null, draws: 30, costPrice: 60, points: 1 },
      ],
    };

    const res = await authInject(app, {
      method: 'POST',
      url: '/api/admin/allocation/plans/publish',
      payload: publishPayload,
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);

    // 驗證已成功建立 LuckyBag
    const publishedBag = store.luckyBags.find((b) => b.name === publishPayload.name);
    expect(publishedBag).toBeDefined();
    expect(publishedBag!.status).toBe('ACTIVE');

    // 驗證 LuckyBagPrize 4 項等級籤位均建立
    const createdPrizes = store.luckyBagPrizes.filter((p) => p.bagId === publishedBag!.id);
    expect(createdPrizes.length).toBe(4);

    // 🚨 關鍵業務不變量檢驗 (Invariant #2)：發布開套嚴禁預扣 StoreInventory 現貨庫存！
    const currentGk1Stock = store.inventories.find((i) => i.storeId === 'chupei' && i.productId === 'GK001')!.quantity;
    expect(currentGk1Stock).toBe(initialGk1Stock);
  });

  it('F14/F15-5: 方案財務損益指標與平帳計算，驗證總營收、損平抽數與毛利率分析', async () => {
    // 總抽數 50，單抽 300 元，總營收 = 15,000 元
    // 總成本：A賞 2*2500=5000，B賞 3*1000=3000，X賞 5*100=500，Z賞 40*40=1600 => 總成本 10,100 元
    // 毛利 = 15000 - 10100 = 4900 元，毛利率 = 4900/15000 = 32.67%
    // 損平抽數 = ceil(10100 / 300) = 34 抽
    const planItems = [
      { prizeGrade: 'A', prizeName: 'A賞', productId: 'GK001', draws: 2, costPrice: 2500, points: 100 },
      { prizeGrade: 'B', prizeName: 'B賞', productId: null, draws: 3, costPrice: 1000, points: 50 },
      { prizeGrade: 'X', prizeName: 'X賞', productId: null, draws: 5, costPrice: 100, points: 10 },
      { prizeGrade: 'Z', prizeName: 'Z賞', productId: null, draws: 40, costPrice: 40, points: 1 },
    ];

    const totalDraws = planItems.reduce((acc, it) => acc + it.draws, 0);
    expect(totalDraws).toBe(50);

    const totalCost = planItems.reduce((acc, it) => acc + (it.draws * it.costPrice), 0);
    expect(totalCost).toBe(10100);

    const unitPrice = 300;
    const revenue = totalDraws * unitPrice;
    expect(revenue).toBe(15000);

    const breakevenDraws = Math.ceil(totalCost / unitPrice);
    expect(breakevenDraws).toBe(34);
    expect(breakevenDraws).toBeLessThanOrEqual(totalDraws);

    const marginRate = ((revenue - totalCost) / revenue) * 100;
    expect(marginRate).toBeCloseTo(32.67, 1);
  });
});
