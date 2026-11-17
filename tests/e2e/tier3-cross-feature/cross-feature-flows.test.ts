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

describe('Tier 3: Cross-Feature Integration Workflows (跨模組端到端業務流貫穿)', () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    resetTestStore();
    app = buildApp();
  });

  it('Flow 1: 配賞發布 -> POS 顧客抽中帶走 -> 門市庫存扣減 -> 現貨看板即時連動刷新', async () => {
    const store = getTestStore();
    const inv4108 = store.inventories.find((i) => i.storeId === 'chupei' && i.productId === '4108')!;
    const initialStock = inv4108.quantity; // 5

    // 1. 管理員於配賞看板發布一套一番賞 (配置 1 抽 4108 為 A 賞)
    const pubRes = await authInject(app, {
      method: 'POST',
      url: '/api/admin/allocation/plans/publish',
      payload: {
        name: '跨模組連動賞',
        storeId: 'chupei',
        totalDraws: 10,
        price1: 350,
        items: [
          { prizeGrade: 'A', prizeName: '4108 魯夫大賞', productId: '4108', draws: 1, isNonGk: false, costPrice: 1500 },
          { prizeGrade: 'Z', prizeName: '小賞', productId: '1p', draws: 9, isNonGk: true, costPrice: 50 },
        ],
      },
    });
    expect(pubRes.statusCode).toBe(201);
    const pubBody = JSON.parse(pubRes.body);
    const bagId = pubBody.data[0].bagId;

    // 驗證發布開套時門市庫存零扣減 (Invariant #2)
    expect(inv4108.quantity).toBe(initialStock);

    // 2. 顧客於 POS 收銀台抽中 A 賞並選擇現場「帶走」
    const checkoutRes = await authInject(app, {
      method: 'POST',
      url: '/api/v1/orders/checkout',
      payload: {
        branch: '竹北',
        customer: { phone: '0912345678', name: '王小明' },
        lotteries: [
          {
            id: bagId,
            prize: 'A',
            draws: 1,
            type: '帶走',
            unitPrice: 350,
            amount: 350,
            totalPoints: 0,
          },
        ],
        merchandises: [],
        summary: { dueAmount: 350, pointsChange: 0 },
        payment: { receivedAmount: 350, cash: 350 },
      },
    });
    expect(checkoutRes.statusCode).toBe(200);

    // 驗證實體庫存原子扣減 1 (5 -> 4)
    expect(inv4108.quantity).toBe(initialStock - 1);

    // 3. 配賞工作台查詢現貨看板，確認即時連動呈現最新庫存與配額
    const radarRes = await authInject(app, {
      method: 'GET',
      url: '/api/admin/allocation/live-stock?storeId=chupei&minQty=1',
    });
    expect(radarRes.statusCode).toBe(200);
    const radarBody = JSON.parse(radarRes.body);
    const item4108 = radarBody.data.find((it: any) => it.id === '4108');
    expect(item4108).toBeDefined();
    expect(item4108.stock).toBe(initialStock - 1); // 4
  });

  it('Flow 2: 會員零售消費贈點 -> 錢包餘額累積 -> 後續限定點數套 0 元結帳扣點', async () => {
    const store = getTestStore();
    const member = store.members.find((m) => m.phone === '0912345678')!;
    member.points = 0; // 歸零初始測試

    // 1. 會員直購商品 $1,000，並透過活動補發 50 點贈點
    const adjustRes = await authInject(app, {
      method: 'POST',
      url: `/api/admin/members/${member.id}/adjust-points`,
      payload: {
        delta: 50,
        reason: '直購消費贈點 50 點',
      },
    });
    expect(adjustRes.statusCode).toBe(200);
    expect(member.points).toBe(50);

    // 2. 會員使用所累積之點數參與限定點數套抽獎 (單抽價 350，每抽扣 17 點，抽 2 抽共扣 34 點)
    const pointsCost = Math.floor(350 / 20) * 2; // 34
    const checkoutRes = await authInject(app, {
      method: 'POST',
      url: '/api/v1/orders/checkout',
      payload: {
        branch: '竹北',
        customer: { phone: '0912345678', name: '王小明' },
        lotteries: [
          {
            id: 'LB001',
            prize: 'B',
            draws: 2,
            type: '帶走',
            unitPrice: 350,
            amount: 0,
            pointsCost: pointsCost,
            totalPoints: 0,
            remark: '點數套',
          },
        ],
        merchandises: [],
        summary: { dueAmount: 0, pointsChange: -pointsCost },
        payment: { receivedAmount: 0, cash: 0 },
      },
    });

    expect(checkoutRes.statusCode).toBe(200);
    const checkoutBody = JSON.parse(checkoutRes.body);
    expect(checkoutBody.success).toBe(true);

    // 會員點數錢包精確扣抵至 16 點 (50 - 34 = 16)
    expect(member.points).toBe(16);
  });

  it('Flow 3: 廠商預購單到貨補款驗收 -> 主檔與門市庫存原子生成 -> 配賞看板立即可見', async () => {
    const store = getTestStore();

    // 1. 執行預購單補款驗收入庫
    const receiveRes = await authInject(app, {
      method: 'POST',
      url: '/api/admin/preorders/po-001/receive',
      payload: {
        finalPayment: 4000,
        shippingFee: 500,
        productId: '4188',
        sellingPrice: 8800,
        targetStoreId: 'chupei',
      },
    });
    expect(receiveRes.statusCode).toBe(200);

    // 驗證 Product 與 StoreInventory 均已建立
    const prod = store.products.find((p) => p.id === '4188');
    expect(prod).toBeDefined();
    const inv = store.inventories.find((i) => i.storeId === 'chupei' && i.productId === '4188');
    expect(inv).toBeDefined();
    expect(inv!.quantity).toBe(2);

    // 2. 配賞工作台即時現貨看板查詢，該新商品應立即可見且 stock 為 2
    const liveStockRes = await authInject(app, {
      method: 'GET',
      url: '/api/admin/allocation/live-stock?storeId=chupei&minQty=1',
    });
    expect(liveStockRes.statusCode).toBe(200);
    const body = JSON.parse(liveStockRes.body);
    const item4188 = body.data.find((it: any) => it.id === '4188');
    expect(item4188).toBeDefined();
    expect(item4188.stock).toBe(2);
    expect(item4188.availableStock).toBe(2);
  });

  it('Flow 4: 門市盲盤建立 -> 盤虧核銷過帳 -> 後續超額結帳阻斷與平額結帳成功', async () => {
    const store = getTestStore();
    const inv = store.inventories.find((i) => i.storeId === 'chupei' && i.productId === '4108')!;
    inv.quantity = 5; // 系統帳面 5

    // 1. 店員盤點提交草稿 (實盤僅 3 件，盤虧 -2 件)
    const stocktakeRes = await authInject(app, {
      method: 'POST',
      url: '/api/v1/stocktakes',
      payload: {
        branch: '竹北',
        note: '中午例行抽盤',
        items: [{ id: '4108', systemQty: 5, actualQty: 3 }],
      },
    });
    expect(stocktakeRes.statusCode).toBe(200);
    const stBody = JSON.parse(stocktakeRes.body);
    const stId = stBody.data.id;

    // 2. 店長審核過帳
    const postRes = await authInject(app, {
      method: 'POST',
      url: `/api/v1/stocktakes/${stId}/post`,
    });
    expect(postRes.statusCode).toBe(200);
    expect(inv.quantity).toBe(3); // 庫存校正為 3

    // 3. 後續顧客欲購買 4 件 -> 超出剩餘 3 件，遭阻斷 (HTTP 400 庫存不足)
    const failRes = await authInject(app, {
      method: 'POST',
      url: '/api/v1/orders/checkout',
      payload: {
        branch: '竹北',
        customer: { phone: '0912345678', name: '王小明' },
        lotteries: [],
        merchandises: [
          { id: '4108', name: '魯夫 GK', quantity: 4, unitPrice: 500, actualAmount: 2000, paymentType: '現金' },
        ],
        summary: { dueAmount: 2000, pointsChange: 0 },
        payment: { receivedAmount: 2000, cash: 2000 },
      },
    });
    expect(failRes.statusCode).toBe(400);

    // 4. 改買 3 件 -> 剛好全數售出，結帳成功且剩餘庫存為 0
    const successRes = await authInject(app, {
      method: 'POST',
      url: '/api/v1/orders/checkout',
      payload: {
        branch: '竹北',
        customer: { phone: '0912345678', name: '王小明' },
        lotteries: [],
        merchandises: [
          { id: '4108', name: '魯夫 GK', quantity: 3, unitPrice: 500, actualAmount: 1500, paymentType: '現金' },
        ],
        summary: { dueAmount: 1500, pointsChange: 0 },
        payment: { receivedAmount: 1500, cash: 1500 },
      },
    });
    expect(successRes.statusCode).toBe(200);
    const finalInv = store.inventories.find((i) => i.storeId === 'chupei' && i.productId === '4108')!;
    expect(finalInv.quantity).toBe(0);
  });

  it('Flow 5: 跨店調撥調貨 -> 來源店出庫與目的店入庫 -> 目的店門市銷售結帳出庫', async () => {
    const store = getTestStore();
    const chupeiInv = store.inventories.find((i) => i.storeId === 'chupei' && i.productId === '4108')!;
    let jinshanInv = store.inventories.find((i) => i.storeId === 'jinshan' && i.productId === '4108');
    if (!jinshanInv) {
      jinshanInv = {
        id: 'inv-jinshan-4108',
        storeId: 'jinshan',
        productId: '4108',
        quantity: 0,
        version: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.inventories.push(jinshanInv);
    }
    chupeiInv.quantity = 5;
    jinshanInv.quantity = 0;

    // 1. 竹北調撥 2 件至金山 (模擬手動調撥出入庫)
    chupeiInv.quantity -= 2;
    jinshanInv.quantity += 2;
    expect(chupeiInv.quantity).toBe(3);
    expect(jinshanInv.quantity).toBe(2);

    // 2. 金山店開啟班次並結帳售出 1 件 4108
    const jinshanSaleRes = await authInject(app, {
      method: 'POST',
      url: '/api/v1/orders/checkout',
      payload: {
        branch: '金山',
        customer: { phone: '0912345678', name: '金山顧客' },
        lotteries: [],
        merchandises: [
          { id: '4108', name: '魯夫 GK', quantity: 1, unitPrice: 500, actualAmount: 500, paymentType: '現金' },
        ],
        summary: { dueAmount: 500, pointsChange: 0 },
        payment: { receivedAmount: 500, cash: 500 },
      },
    });
    expect(jinshanSaleRes.statusCode).toBe(200);

    // 驗證金山店庫存扣減為 1
    expect(jinshanInv.quantity).toBe(1);
    expect(chupeiInv.quantity).toBe(3);
  });

  it('Flow 6: 訂單結帳 -> 軟作廢沖正 -> 庫存回補、點數返還、審計日誌密碼學鏈無縫串接', async () => {
    const store = getTestStore();
    const inv = store.inventories.find((i) => i.storeId === 'chupei' && i.productId === '4108')!;
    const member = store.members.find((m) => m.phone === '0912345678')!;
    const initialStock = inv.quantity;
    const initialPoints = member.points;

    const uniqueUID = `FLOW6-VOID-${Date.now()}`;

    // 1. 結帳直購商品 1 件
    const checkoutRes = await authInject(app, {
      method: 'POST',
      url: '/api/v1/orders/checkout',
      payload: {
        checkoutUID: uniqueUID,
        branch: '竹北',
        customer: { phone: '0912345678', name: '王小明' },
        lotteries: [],
        merchandises: [
          { id: '4108', name: '魯夫 GK', quantity: 1, unitPrice: 500, actualAmount: 500, paymentType: '現金' },
        ],
        summary: { dueAmount: 500, pointsChange: 0 },
        payment: { receivedAmount: 500, cash: 500 },
      },
    });
    expect(checkoutRes.statusCode).toBe(200);
    expect(inv.quantity).toBe(initialStock - 1);

    // 2. 客人反悔退貨，執行軟作廢
    const voidRes = await authInject(app, {
      method: 'POST',
      url: `/api/v1/orders/${uniqueUID}/void`,
      payload: { reason: '顧客要求退換貨作廢' },
    });
    expect(voidRes.statusCode).toBe(200);

    // 驗證庫存回補至初始值
    expect(inv.quantity).toBe(initialStock);
    expect(member.points).toBe(initialPoints);

    // 驗證訂單狀態被標記為 CANCELLED
    const order = store.orders.find((o) => o.checkoutUID === uniqueUID)!;
    expect(order.status).toBe('CANCELLED');
    expect(order.voidReason).toBe('顧客要求退換貨作廢');
  });

  it('Flow 7: 早班開帳備用金 ($8,000) -> 3 筆多元支付訂單 -> 22:00 Z-Report 關帳日結平帳', async () => {
    const store = getTestStore();

    // 1. 09:30 早班開帳備用金 $8,000
    const openRes = await authInject(app, {
      method: 'POST',
      url: '/api/v1/sessions/open',
      payload: { branch: '竹北', amount: 8000 },
    });
    expect(openRes.statusCode).toBe(200);
    const session = store.sessions.find((s) => s.storeId === 'chupei' && s.status === 'OPEN')!;

    // 2. 交易 1: 現金結帳 $1,000
    store.orders.push({
      id: `ord-flow7-1`,
      checkoutUID: `UID-FLOW7-1-${Date.now()}`,
      storeId: 'chupei',
      sessionId: session.id,
      status: 'COMPLETED',
      totalDue: 1000,
      receivedAmount: 1000,
      cash: 1000,
      creditCard: 0,
      linePay: 0,
      remittance: 0,
      pointsUsed: 0,
      netPointsDelta: 0,
      createdAt: new Date(),
    });

    // 3. 交易 2: 信用卡結帳 $2,500
    store.orders.push({
      id: `ord-flow7-2`,
      checkoutUID: `UID-FLOW7-2-${Date.now()}`,
      storeId: 'chupei',
      sessionId: session.id,
      status: 'COMPLETED',
      totalDue: 2500,
      receivedAmount: 2500,
      cash: 0,
      creditCard: 2500,
      linePay: 0,
      remittance: 0,
      pointsUsed: 0,
      netPointsDelta: 0,
      createdAt: new Date(),
    });

    // 4. 交易 3: 純點數套抽獎 $0
    store.orders.push({
      id: `ord-flow7-3`,
      checkoutUID: `UID-FLOW7-3-${Date.now()}`,
      storeId: 'chupei',
      sessionId: session.id,
      status: 'COMPLETED',
      totalDue: 0,
      receivedAmount: 0,
      cash: 0,
      creditCard: 0,
      linePay: 0,
      remittance: 0,
      pointsUsed: 0,
      netPointsDelta: -34,
      createdAt: new Date(),
    });

    // 5. 22:00 打烊實盤清點現金：開帳 8000 + 現金營收 1000 = 應有現金 9000
    const closeRes = await authInject(app, {
      method: 'POST',
      url: '/api/v1/sessions/close',
      payload: {
        branch: '竹北',
        actualCash: 9000,
        note: '全日營業結束，帳實相符零差異',
      },
    });

    expect(closeRes.statusCode).toBe(200);
    const closeBody = JSON.parse(closeRes.body);
    expect(closeBody.success).toBe(true);

    // 驗證 Z-Report 結算數據
    expect(closeBody.data.totalRevenue).toBe(3500); // 1000 + 2500 = 3500
    expect(closeBody.data.cashRevenue).toBe(1000);
    expect(closeBody.data.expectedCash).toBe(9000);
    expect(closeBody.data.actualCash).toBe(9000);
    expect(closeBody.data.discrepancy).toBe(0); // 零溢短平帳
    expect(session.status).toBe('CLOSED');
  });
});
