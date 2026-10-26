import { describe, it, expect, beforeAll } from 'vitest';
import { buildApp } from '../src/app';
import { prisma } from '../src/plugins/prisma';
import type { FastifyInstance } from 'fastify';

describe('OneSoul POS 配賞工作台 API 整合測試 (Prize Allocation Workbench)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  it('1. 門市即時現貨看板查詢: 應正確回傳庫存 >= 1 之商品與多門市現貨分佈', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/allocation/live-stock?minQty=1',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.stores).toBeDefined();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.totalCount).toBeGreaterThan(0);

    // 每一筆現貨商品的總庫存應 >= 1
    body.data.forEach((item: any) => {
      expect(item.totalStock).toBeGreaterThanOrEqual(1);
      expect(item.name).toBeDefined();
      expect(item.storeStocks).toBeDefined();
    });
  });

  it('2. 取得配賞範本庫與草稿箱: 應內建 80 抽標準賞、120 抽豪華 GK 等經典配置', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/allocation/plans',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.templates)).toBe(true);
    expect(body.templates.length).toBeGreaterThanOrEqual(3);

    const tpl80 = body.templates.find((t: any) => t.id === 'tpl-80-standard');
    expect(tpl80).toBeDefined();
    expect(tpl80.totalDraws).toBe(80);
    expect(tpl80.price1).toBe(350);
    expect(tpl80.price3).toBe(1020);
    expect(tpl80.price5).toBe(1660);
    expect(tpl80.price10).toBe(3150);
  });

  it('3. 儲存配賞草稿: 應成功暫存方案與賞位結構', async () => {
    const draftPayload = {
      name: '測試草稿-鬼滅大賞100抽',
      storeId: 'chupei',
      status: 'DRAFT',
      totalDraws: 100,
      price1: 400,
      price3: 1160,
      price5: 1900,
      price10: 3600,
      isTenPlusOne: false,
      items: [
        { prizeGrade: 'A', prizeName: 'A賞 炭治郎', productId: 'GK001', draws: 1, costPrice: 8000, points: 200 },
        { prizeGrade: '保底', prizeName: '非GK保底', productId: '0p', draws: 99, costPrice: 1, points: 1, isNonGk: true },
      ],
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/allocation/plans',
      payload: draftPayload,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBeDefined();
    expect(body.data.name).toBe('測試草稿-鬼滅大賞100抽');
  });

  it('4. 開套防呆校驗: 抽數未平帳或無實體大獎時應精確阻擋並報錯', async () => {
    // 總抽數 100 但只配了 50 抽
    const resMismatched = await app.inject({
      method: 'POST',
      url: '/api/admin/allocation/plans/publish',
      payload: {
        name: '未平帳套組',
        storeId: 'chupei',
        totalDraws: 100,
        price1: 300,
        items: [
          { prizeGrade: 'A', prizeName: 'A賞', productId: 'GK001', draws: 50, costPrice: 5000, points: 100 },
        ],
      },
    });

    expect(resMismatched.statusCode).toBe(400);
    expect(resMismatched.json().message).toContain('抽數未平帳');

    // 全部都為非GK保底、無實體公仔
    const resNoPrize = await app.inject({
      method: 'POST',
      url: '/api/admin/allocation/plans/publish',
      payload: {
        name: '全保底無公仔套組',
        storeId: 'chupei',
        totalDraws: 100,
        price1: 300,
        items: [
          { prizeGrade: '保底', prizeName: '非GK', productId: '0p', draws: 100, costPrice: 1, points: 1, isNonGk: true },
        ],
      },
    });

    expect(resNoPrize.statusCode).toBe(400);
    expect(resNoPrize.json().message).toContain('必須至少配置 1 款實體公仔大獎');
  });

  it('5. 一鍵發布上線開套: 應成功建立 LuckyBag、各賞明細與審計日誌', async () => {
    const publishPayload = {
      name: '航海王極限開套測試',
      storeId: 'chupei',
      totalDraws: 80,
      price1: 350,
      price3: 1020,
      price5: 1660,
      price10: 3150,
      items: [
        { prizeGrade: 'A', prizeName: 'A賞 魯夫 MASTERLISE', productId: 'GK001', draws: 1, costPrice: 8000, points: 150 },
        { prizeGrade: 'B', prizeName: 'B賞 壓克力立牌', productId: 'GEN001', draws: 4, costPrice: 150, points: 5 },
        { prizeGrade: '保底', prizeName: '非GK保底', productId: '0p', draws: 75, costPrice: 1, points: 1, isNonGk: true },
      ],
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/allocation/plans/publish',
      payload: publishPayload,
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data[0].bagId).toBeDefined();
    expect(body.data[0].name).toBe('航海王極限開套測試');
    expect(body.data[0].totalDraws).toBe(80);
  });

  it('6. 批次開多套 (batchCount: 3): 應一次性生成 3 套獨立套組並自動編號', async () => {
    const multiSetPayload = {
      name: '鬼滅之刃無限列車',
      storeId: 'chupei',
      totalDraws: 100,
      price1: 300,
      batchCount: 3,
      items: [
        { prizeGrade: '1', prizeName: '1號賞 煉獄杏壽郎 GK', productId: 'GK001', draws: 1, costPrice: 8500, points: 200 },
        { prizeGrade: 'X', prizeName: 'X賞 盲盒公仔', productId: 'GEN001', draws: 10, costPrice: 180, points: 10 },
        { prizeGrade: 'Z', prizeName: 'Z賞 非GK保底小賞', productId: '0p', draws: 89, costPrice: 1, points: 1, isNonGk: true },
      ],
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/allocation/plans/publish',
      payload: multiSetPayload,
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.length).toBe(3);
    expect(body.data[0].name).toBe('鬼滅之刃無限列車 #1');
    expect(body.data[1].name).toBe('鬼滅之刃無限列車 #2');
    expect(body.data[2].name).toBe('鬼滅之刃無限列車 #3');
  });

  it('7. 支援 3000 抽巨型套組與 Sheet 歷史賞位 (數字 1~3, X 盲盒, Z 小賞)', async () => {
    const megaSetPayload = {
      name: '2026全店年節特級一番賞 3000抽',
      storeId: 'chupei',
      totalDraws: 3000,
      price1: 600,
      items: [
        { prizeGrade: '1', prizeName: '1號賞 神級限量等身大胸像', productId: 'GK001', draws: 1, costPrice: 65000, points: 3000 },
        { prizeGrade: '2', prizeName: '2號賞 究極巨型雕像 (3款)', productId: '3233', draws: 3, costPrice: 22000, points: 900 },
        { prizeGrade: '3', prizeName: '3號賞 高階精品GK (6款)', productId: '2880', draws: 6, costPrice: 8500, points: 350 },
        { prizeGrade: 'X', prizeName: 'X賞 全館任選盲盒大賞', productId: 'GEN001', draws: 150, costPrice: 200, points: 10 },
        { prizeGrade: 'Z', prizeName: 'Z賞 非GK保底小賞 / 點數大放送', productId: '0p', draws: 2840, costPrice: 1, points: 1, isNonGk: true },
      ],
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/allocation/plans/publish',
      payload: megaSetPayload,
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data[0].totalDraws).toBe(3000);
    expect(body.data[0].name).toContain('3000抽');
  });

  it('8. 即時現貨看板庫存與在場已配統計: 正確統計 allocatedCount 與 totalAllocated，並支援門市獨立篩選', async () => {
    // 查詢全門市現貨看板
    const resAll = await app.inject({
      method: 'GET',
      url: '/api/admin/allocation/live-stock?minQty=1',
    });
    expect(resAll.statusCode).toBe(200);
    const bodyAll = resAll.json();
    expect(bodyAll.success).toBe(true);

    const gkProd = bodyAll.data.find((p: any) => p.totalStock >= 1) || bodyAll.data[0];
    expect(gkProd).toBeDefined();
    expect(gkProd.totalStock).toBeGreaterThanOrEqual(1);
    expect(gkProd.storeStocks).toBeDefined();
    expect(typeof gkProd.totalAllocated).toBe('number');
    expect(gkProd.allocatedCount).toBe(gkProd.totalAllocated);

    const testPid = gkProd.id;

    // 查詢特定門市 (chupei)
    const resChupei = await app.inject({
      method: 'GET',
      url: '/api/admin/allocation/live-stock?storeId=chupei&minQty=1',
    });
    expect(resChupei.statusCode).toBe(200);
    const bodyChupei = resChupei.json();
    const gkChupei = bodyChupei.data.find((p: any) => p.id === testPid);
    expect(gkChupei).toBeDefined();
    expect(gkChupei.stock).toBe(gkChupei.storeStocks.chupei);
    expect(gkChupei.allocatedCount).toBe(gkChupei.storeAllocated?.chupei || 0);
  });

  it('9. 在場超配彈性調度: 當在場已配量 > 實體庫存時，isOverAllocated 標記為 true 但不阻擋配賞流程', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/allocation/live-stock?minQty=1',
    });
    const body = res.json();
    body.data.forEach((item: any) => {
      expect(typeof item.isOverAllocated).toBe('boolean');
      if (item.allocatedCount > item.stock) {
        expect(item.isOverAllocated).toBe(true);
      }
    });
  });

  it('10. 草稿箱與暫存掛單持久化: 支援 isParked 狀態儲存與讀取', async () => {
    const parkedPlan = {
      id: 'plan-parked-test',
      name: '臨時有事先放著-巨型海賊套',
      storeId: 'chupei',
      isParked: true,
      totalDraws: 100,
      price1: 350,
      items: [
        { prizeGrade: '1', prizeName: '1號賞 巨型魯夫', productId: 'GK001', draws: 1, costPrice: 8000, points: 200 },
        { prizeGrade: 'Z', prizeName: 'Z賞 非GK保底', productId: '0p', draws: 99, costPrice: 1, points: 1, isNonGk: true },
      ],
    };

    const saveRes = await app.inject({
      method: 'POST',
      url: '/api/admin/allocation/plans',
      payload: parkedPlan,
    });
    expect(saveRes.statusCode).toBe(200);

    const getRes = await app.inject({
      method: 'GET',
      url: '/api/admin/allocation/plans',
    });
    expect(getRes.statusCode).toBe(200);
    const drafts = getRes.json().drafts;
    const found = drafts.find((d: any) => d.id === 'plan-parked-test');
    expect(found).toBeDefined();
    expect(found.isParked).toBe(true);
  });

  it('11. 門市現貨配賞預設只配 GK 雕像: 帶入 mainCategory=GK 確保完全排除盲盒', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/allocation/live-stock?mainCategory=GK&minQty=1',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    body.data.forEach((item: any) => {
      expect(item.mainCategory).toBe('GK');
      expect(item.category).not.toBe('BLIND_BOX');
    });
  });

  it('12. 發布限定點數套與 X/Z 賞點數規格: 應正確寫入 isPointsSet 與 10P/1P 點數設定', async () => {
    const pointsPlan = {
      name: '限定點數套-海賊王特輯',
      storeId: 'chupei',
      totalDraws: 100,
      price1: 400,
      isPointsSet: true,
      blindBoxPointsValue: 10,
      items: [
        { prizeGrade: '1', prizeName: '1號賞 魯夫頂級雕像', productId: 'GK001', draws: 1, costPrice: 8000, points: 200 },
        { prizeGrade: 'X', prizeName: 'X賞 任選盲盒一個', productId: 'X', draws: 5, costPrice: 200, points: 10 },
        { prizeGrade: 'Z', prizeName: 'Z賞 非GK保底小賞', productId: '0p', draws: 94, costPrice: 1, points: 1, isNonGk: true },
      ],
    };

    const publishRes = await app.inject({
      method: 'POST',
      url: '/api/admin/allocation/plans/publish',
      payload: pointsPlan,
    });
    expect(publishRes.statusCode).toBe(201);
    const result = publishRes.json();
    expect(result.success).toBe(true);
    expect(result.data[0].bagId).toBeDefined();

    const bagId = result.data[0].bagId;
    const bag = await (prisma as any).luckyBag.findUnique({ where: { id: bagId } });
    expect(bag).toBeDefined();
    expect(bag.isPointsSet).toBe(true);

    const prizes = await (prisma as any).luckyBagPrize.findMany({ where: { bagId } });
    const xPrize = prizes.find((p: any) => p.prize === 'X' || p.prizeGrade === 'X');
    expect(xPrize).toBeDefined();
    expect(xPrize.points).toBe(10);

    const zPrize = prizes.find((p: any) => p.prize === 'Z' || p.prizeGrade === 'Z');
    expect(zPrize).toBeDefined();
    expect(zPrize.points).toBe(1);
  });
});

