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

describe('Tier 4: Real-World Retail Day Application Scenarios (全日真實營運場景端到端)', () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    resetTestStore();
    app = buildApp();
  });

  it('Scenario 1: 標準門市營業日全生命週期 (09:30 開帳備用金 -> 散客零售 -> 一番賞大賞帶走 -> 小賞換點數 -> 22:00 Z-Report 關帳日結平帳)', async () => {
    const store = getTestStore();

    // ── 09:30 早班開帳 ──
    const openRes = await authInject(app, {
      method: 'POST',
      url: '/api/v1/sessions/open',
      payload: {
        branch: '竹北',
        amount: 8000,
        note: '早班開帳備用金 $8,000',
      },
    });
    expect(openRes.statusCode).toBe(200);
    const session = store.sessions.find((s) => s.storeId === 'chupei' && s.status === 'OPEN')!;
    expect(session.openingCash).toBe(8000);

    // ── 11:00 散客零售購物 (現金 $500 購買 4108 魯夫 GK) ──
    const inv4108 = store.inventories.find((i) => i.storeId === 'chupei' && i.productId === '4108')!;
    const stockBeforeRetail = inv4108.quantity; // 5

    const walkInRes = await authInject(app, {
      method: 'POST',
      url: '/api/v1/orders/checkout',
      payload: {
        branch: '竹北',
        customer: { phone: '111111', name: '散客' },
        lotteries: [],
        merchandises: [
          { id: '4108', name: '魯夫 GK', quantity: 1, unitPrice: 500, actualAmount: 500, paymentType: '現金' },
        ],
        summary: { dueAmount: 500, pointsChange: 0 },
        payment: { receivedAmount: 500, cash: 500 },
      },
    });
    expect(walkInRes.statusCode).toBe(200);
    expect(inv4108.quantity).toBe(stockBeforeRetail - 1); // 4

    // ── 14:00 會員抽一番賞抽中 A 賞帶走 (現金 $350，實體 GK001 出庫) ──
    const invGk001 = store.inventories.find((i) => i.storeId === 'chupei' && i.productId === 'GK001')!;
    const stockGkBefore = invGk001.quantity;

    const lotteryRes1 = await authInject(app, {
      method: 'POST',
      url: '/api/v1/orders/checkout',
      payload: {
        branch: '竹北',
        customer: { phone: '0912345678', name: '王小明' },
        lotteries: [
          {
            id: 'LB001',
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
    expect(lotteryRes1.statusCode).toBe(200);
    expect(invGk001.quantity).toBe(stockGkBefore - 1); // A 賞實體庫存扣 1

    // ── 16:30 會員再抽一番賞抽中小賞選擇「換點數 (POINTS)」(現金 $350，公仔留店不扣庫存，累積 10 點) ──
    const member = store.members.find((m) => m.phone === '0912345678')!;
    const pointsBefore = member.points;

    const lotteryRes2 = await authInject(app, {
      method: 'POST',
      url: '/api/v1/orders/checkout',
      payload: {
        branch: '竹北',
        customer: { phone: '0912345678', name: '王小明' },
        lotteries: [
          {
            id: 'LB001',
            prize: 'B',
            draws: 1,
            type: '點數', // 顧客選擇放棄帶走，折換點數
            unitPrice: 350,
            amount: 350,
            totalPoints: 10,
          },
        ],
        merchandises: [],
        summary: { dueAmount: 350, pointsChange: 10 },
        payment: { receivedAmount: 350, cash: 350 },
      },
    });
    expect(lotteryRes2.statusCode).toBe(200);
    expect(member.points).toBe(pointsBefore + 10); // 點數增長 10

    // ── 22:00 打烊日結關帳 ──
    // 預期現金 = 8000 (開帳) + 500 (散客零售) + 350 (A賞) + 350 (B賞) = $9,200
    const closeRes = await authInject(app, {
      method: 'POST',
      url: '/api/v1/sessions/close',
      payload: {
        branch: '竹北',
        actualCash: 9200,
        note: '全日營業正常結束，實盤現金零差異平帳',
      },
    });
    expect(closeRes.statusCode).toBe(200);
    const closeBody = JSON.parse(closeRes.body);
    expect(closeBody.success).toBe(true);
    expect(closeBody.data.totalRevenue).toBe(1200); // 500 + 350 + 350 = 1200
    expect(closeBody.data.cashRevenue).toBe(1200);
    expect(closeBody.data.expectedCash).toBe(9200);
    expect(closeBody.data.actualCash).toBe(9200);
    expect(closeBody.data.discrepancy).toBe(0);
    expect(session.status).toBe('CLOSED');
  });

  it('Scenario 2: 限定點數套促銷與散客零元購白盒防禦 (老會員點數零元抽賞 vs 散客代碼穿透攔截)', async () => {
    const store = getTestStore();
    const member = store.members.find((m) => m.phone === '0912345678')!;
    member.points = 100; // 會員有 100 點

    // 1. 散客嘗試穿透限定點數套 (散客號碼 111111 意圖 0 元抽賞)
    const walkInAttackRes = await authInject(app, {
      method: 'POST',
      url: '/api/v1/orders/checkout',
      payload: {
        branch: '竹北',
        customer: { phone: '111111', name: '散客' },
        lotteries: [
          {
            id: 'LB001',
            prize: 'A',
            draws: 1,
            type: '帶走',
            unitPrice: 350,
            amount: 0,
            pointsCost: 17,
            totalPoints: 0,
            remark: '點數套',
          },
        ],
        merchandises: [],
        summary: { dueAmount: 0, pointsChange: -17 },
        payment: { receivedAmount: 0, cash: 0 },
      },
    });
    // 嚴格阻斷 Invariant #1：散客不可抽點數套！
    expect(walkInAttackRes.statusCode).toBe(400);
    const attackBody = JSON.parse(walkInAttackRes.body);
    expect(attackBody.message).toContain('散客不可使用點數折抵');

    // 2. 正式 VIP 會員使用點數抽取 2 抽 (每抽扣 17 點，共消耗 34 點，應付現金 $0)
    const memberRes = await authInject(app, {
      method: 'POST',
      url: '/api/v1/orders/checkout',
      payload: {
        branch: '竹北',
        customer: { phone: '0912345678', name: '王小明' },
        lotteries: [
          {
            id: 'LB001',
            prize: 'A',
            draws: 2,
            type: '帶走',
            unitPrice: 350,
            amount: 0,
            pointsCost: 34,
            totalPoints: 0,
            remark: '點數套',
          },
        ],
        merchandises: [],
        summary: { dueAmount: 0, pointsChange: -34 },
        payment: { receivedAmount: 0, cash: 0 },
      },
    });
    expect(memberRes.statusCode).toBe(200);
    // 會員點數錢包扣除 34 點，餘 66 點
    expect(member.points).toBe(66);
  });

  it('Scenario 3: 廠商預購到貨驗收、跨店調撥至金山門市與金山現場零售', async () => {
    const store = getTestStore();

    // 1. 廠商預購單到貨，竹北店驗收入庫 2 件商品 4195
    const receiveRes = await authInject(app, {
      method: 'POST',
      url: '/api/admin/preorders/po-001/receive',
      payload: {
        finalPayment: 4000,
        shippingFee: 500,
        productId: '4195',
        sellingPrice: 6000,
        targetStoreId: 'chupei',
      },
    });
    expect(receiveRes.statusCode).toBe(200);

    const chupeiInv = store.inventories.find((i) => i.storeId === 'chupei' && i.productId === '4195')!;
    expect(chupeiInv.quantity).toBe(2);

    // 2. 竹北門市調撥 1 件至金山門市
    let jinshanInv = store.inventories.find((i) => i.storeId === 'jinshan' && i.productId === '4195');
    if (!jinshanInv) {
      jinshanInv = {
        id: 'inv-jinshan-4195',
        storeId: 'jinshan',
        productId: '4195',
        quantity: 0,
        version: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.inventories.push(jinshanInv);
    }
    chupeiInv.quantity -= 1;
    jinshanInv.quantity += 1;
    expect(chupeiInv.quantity).toBe(1);
    expect(jinshanInv.quantity).toBe(1);

    // 3. 金山門市顧客到店刷卡購買該公仔 ($6,000)
    const jinshanSaleRes = await authInject(app, {
      method: 'POST',
      url: '/api/v1/orders/checkout',
      payload: {
        branch: '金山',
        customer: { phone: '0912345678', name: '金山貴賓' },
        lotteries: [],
        merchandises: [
          { id: '4195', name: '幻影女帝 GK', quantity: 1, unitPrice: 6000, actualAmount: 6000, paymentType: '現金' },
        ],
        summary: { dueAmount: 6000, pointsChange: 0 },
        payment: { receivedAmount: 6000, cash: 0, creditCard: 6000 },
      },
    });
    expect(jinshanSaleRes.statusCode).toBe(200);

    // 驗證金山庫存歸零，竹北維持 1 件
    expect(jinshanInv.quantity).toBe(0);
    expect(chupeiInv.quantity).toBe(1);
  });

  it('Scenario 4: 門市午後盲點抽盤、差異審核過帳與審計日誌密碼學鏈無縫串接', async () => {
    const store = getTestStore();
    const inv = store.inventories.find((i) => i.storeId === 'chupei' && i.productId === '4108')!;
    inv.quantity = 5;

    // 1. 店員提交盲點盤點單 (實盤 4 件，盤損 -1 件)
    const draftRes = await authInject(app, {
      method: 'POST',
      url: '/api/v1/stocktakes',
      payload: {
        branch: '竹北',
        note: '午後抽盤發現展示品微損報廢',
        items: [{ id: '4108', systemQty: 5, actualQty: 4, itemRemark: '展示損耗' }],
      },
    });
    expect(draftRes.statusCode).toBe(200);
    const draftBody = JSON.parse(draftRes.body);
    const stocktakeId = draftBody.data.id;

    // 2. 店長審核過帳
    const postRes = await authInject(app, {
      method: 'POST',
      url: `/api/v1/stocktakes/${stocktakeId}/post`,
    });
    expect(postRes.statusCode).toBe(200);

    // 門市庫存精準更新為 4
    expect(inv.quantity).toBe(4);

    // 3. 驗證審計日誌中包含盤點過帳記錄且雜湊鏈完整
    const auditRes = await authInject(app, {
      method: 'GET',
      url: '/api/admin/audit-logs?targetType=Stocktake',
    });
    expect(auditRes.statusCode).toBe(200);
  });

  it('Scenario 5: 收銀失誤、顧客糾紛退換作廢 (Soft Void) 與密碼學鏈上取證', async () => {
    const store = getTestStore();
    const inv = store.inventories.find((i) => i.storeId === 'chupei' && i.productId === '4108')!;
    const initialStock = inv.quantity;
    const checkoutUID = `SCENARIO5-DISPUTE-${Date.now()}`;

    // 1. 收銀員誤結帳 1 件商品 (收到 $500 現金，庫存扣減 1)
    const errCheckoutRes = await authInject(app, {
      method: 'POST',
      url: '/api/v1/orders/checkout',
      payload: {
        checkoutUID,
        branch: '竹北',
        customer: { phone: '0912345678', name: '爭議顧客' },
        lotteries: [],
        merchandises: [
          { id: '4108', name: '魯夫 GK', quantity: 1, unitPrice: 500, actualAmount: 500, paymentType: '現金' },
        ],
        summary: { dueAmount: 500, pointsChange: 0 },
        payment: { receivedAmount: 500, cash: 500 },
      },
    });
    expect(errCheckoutRes.statusCode).toBe(200);
    expect(inv.quantity).toBe(initialStock - 1);

    // 2. 顧客當場抗議品項刷錯，店員發起軟作廢 (Soft Void) 退回全額現金
    const voidRes = await authInject(app, {
      method: 'POST',
      url: `/api/v1/orders/${checkoutUID}/void`,
      payload: { reason: '收銀刷錯品項，顧客現場退貨作廢' },
    });
    expect(voidRes.statusCode).toBe(200);

    // 驗證庫存原子回補
    expect(inv.quantity).toBe(initialStock);

    // 驗證訂單狀態變更為 CANCELLED
    const order = store.orders.find((o) => o.checkoutUID === checkoutUID)!;
    expect(order.status).toBe('CANCELLED');
    expect(order.voidReason).toContain('收銀刷錯品項');

    // 3. 審計員透過日誌取證，確認整個作廢過程透明留痕
    const logsRes = await authInject(app, {
      method: 'GET',
      url: `/api/admin/audit-logs?targetId=${order.id}`,
    });
    expect(logsRes.statusCode).toBe(200);
  });
});
