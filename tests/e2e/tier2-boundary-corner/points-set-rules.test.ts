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

describe('Tier 2: Boundary & Corner - Points Set Rules (限定點數套業務規則)', () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    resetTestStore();
    app = buildApp();
  });

  it('TC-PTS-01: 限定點數套應付總額必為 $0，且扣點精確依循 floor(單抽價/20) * 抽數', async () => {
    const store = getTestStore();
    const member = store.members.find((m) => m.phone === '0912345678')!;
    member.points = 100;

    // 單抽價 350 -> floor(350/20) = 17 點/抽。2 抽共消耗 34 點
    const pointsCost = Math.floor(350 / 20) * 2; // 34
    const res = await authInject(app, {
      method: 'POST',
      url: '/api/v1/orders/checkout',
      payload: {
        branch: '竹北',
        customer: { phone: '0912345678', name: '王小明' },
        lotteries: [
          {
            id: 'LB001',
            boxNo: 'ONE-001',
            setName: '航海王特別限定點數套',
            prize: 'A',
            prizeName: '火拳艾斯 景品',
            unitPrice: 350,
            draws: 2,
            type: '帶走',
            amount: 0,
            pointsCost: pointsCost,
            totalPoints: 0,
            remark: '點數套',
          },
        ],
        merchandises: [],
        summary: {
          dueAmount: 0,
          pointsChange: -pointsCost,
        },
        payment: {
          receivedAmount: 0,
          cash: 0,
          pointsUsed: 0,
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    // 會員點數應扣除 34 點，餘 66 點
    expect(member.points).toBe(66);
  });

  it('TC-PTS-02: 會員點數不足時，限定點數套結帳交易完整回滾 (HTTP 400 客戶點數不足)', async () => {
    const store = getTestStore();
    const member = store.members.find((m) => m.phone === '0912345678')!;
    member.points = 20; // 僅有 20 點，不足 34 點

    const prize = store.luckyBagPrizes.find((p) => p.bagId === 'LB001' && p.prizeGrade === 'A')!;
    const initialDrawn = prize.drawnCount;

    const res = await authInject(app, {
      method: 'POST',
      url: '/api/v1/orders/checkout',
      payload: {
        branch: '竹北',
        customer: { phone: '0912345678', name: '王小明' },
        lotteries: [
          {
            id: 'LB001',
            boxNo: 'ONE-001',
            setName: '航海王特別限定點數套',
            prize: 'A',
            prizeName: '火拳艾斯 景品',
            unitPrice: 350,
            draws: 2,
            type: '帶走',
            amount: 0,
            pointsCost: 34,
            totalPoints: 0,
            remark: '點數套',
          },
        ],
        merchandises: [],
        summary: {
          dueAmount: 0,
          pointsChange: -34,
        },
        payment: {
          receivedAmount: 0,
          cash: 0,
        },
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.message).toContain('客戶點數不足');

    // 驗證狀態完全回滾
    expect(member.points).toBe(20);
    expect(prize.drawnCount).toBe(initialDrawn);
  });

  it('TC-PTS-03: 限定點數套抽中大賞現場帶走，預設提貨模式為「帶走」且 totalPoints = 0 (不誤發額外點數)', async () => {
    const store = getTestStore();
    const member = store.members.find((m) => m.phone === '0912345678')!;
    member.points = 100;

    const inv = store.inventories.find((i) => i.storeId === 'chupei' && i.productId === 'GK001')!;
    const initialStock = inv.quantity;

    const res = await authInject(app, {
      method: 'POST',
      url: '/api/v1/orders/checkout',
      payload: {
        branch: '竹北',
        customer: { phone: '0912345678', name: '王小明' },
        lotteries: [
          {
            id: 'LB001',
            boxNo: 'ONE-001',
            setName: '航海王特別限定點數套',
            prize: 'A',
            prizeName: '火拳艾斯 景品',
            unitPrice: 350,
            draws: 1,
            type: '帶走',
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

    expect(res.statusCode).toBe(200);
    // 實體庫存原子扣減 1
    expect(inv.quantity).toBe(initialStock - 1);
    // 點數純扣除 17，無額外加發
    expect(member.points).toBe(83);
  });

  it('TC-PTS-04: 限定點數套抽中小賞選擇「換點數 (POINTS)」，實物留存店內不扣庫存並折抵淨點數', async () => {
    const store = getTestStore();
    const member = store.members.find((m) => m.phone === '0912345678')!;
    member.points = 100;

    const res = await authInject(app, {
      method: 'POST',
      url: '/api/v1/orders/checkout',
      payload: {
        branch: '竹北',
        customer: { phone: '0912345678', name: '王小明' },
        lotteries: [
          {
            id: 'LB001',
            boxNo: 'ONE-001',
            setName: '航海王特別限定點數套',
            prize: 'B',
            prizeName: '小賞',
            unitPrice: 350,
            draws: 1,
            type: '點數', // 客人選擇折換點數 (小賞預設 1 點)
            amount: 0,
            pointsCost: 17,
            totalPoints: 1, // 補償 1 點
            remark: '點數套',
          },
        ],
        merchandises: [],
        summary: {
          dueAmount: 0,
          pointsChange: -16, // -17 + 1 = -16
        },
        payment: {
          receivedAmount: 0,
          cash: 0,
        },
      },
    });

    expect(res.statusCode).toBe(200);
    // 點數淨扣除 16 點 (100 - 16 = 84)
    expect(member.points).toBe(84);
  });

  it('TC-PTS-05: 一番賞防超抽驗證 (Anti-Overdraw Guard)，欲抽數超過獎項剩餘抽數拋出 400', async () => {
    const store = getTestStore();
    const prize = store.luckyBagPrizes.find((p) => p.bagId === 'LB001' && p.prizeGrade === 'A')!;
    // 設定此獎項僅剩 1 抽 (draws: 2, drawnCount: 1)
    prize.draws = 2;
    prize.drawnCount = 1;

    const res = await authInject(app, {
      method: 'POST',
      url: '/api/v1/orders/checkout',
      payload: {
        branch: '竹北',
        customer: { phone: '0912345678', name: '王小明' },
        lotteries: [
          {
            id: 'LB001',
            boxNo: 'ONE-001',
            setName: '航海王一番賞',
            prize: 'A',
            prizeName: '火拳艾斯 景品',
            unitPrice: 350,
            draws: 2, // 欲抽 2 抽，但僅剩 1 抽
            type: '帶走',
            amount: 700,
            totalPoints: 0,
          },
        ],
        merchandises: [],
        summary: {
          dueAmount: 700,
          pointsChange: 0,
        },
        payment: {
          receivedAmount: 700,
          cash: 700,
        },
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.message).toContain('剩餘抽數不足');
  });

  it('TC-PTS-06: 限定點數套 0 元結帳與多元支付零元防呆，不污染門市實收現金', async () => {
    const store = getTestStore();
    const member = store.members.find((m) => m.phone === '0912345678')!;
    member.points = 50;

    const session = store.sessions.find((s) => s.storeId === 'chupei' && s.status === 'OPEN')!;
    const initialExpected = session.expectedCash;

    const res = await authInject(app, {
      method: 'POST',
      url: '/api/v1/orders/checkout',
      payload: {
        branch: '竹北',
        customer: { phone: '0912345678', name: '王小明' },
        lotteries: [
          {
            id: 'LB001',
            boxNo: 'ONE-001',
            setName: '航海王特別限定點數套',
            prize: 'A',
            prizeName: '火拳艾斯 景品',
            unitPrice: 350,
            draws: 1,
            type: '帶走',
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
          creditCard: 0,
          linePay: 0,
        },
      },
    });

    expect(res.statusCode).toBe(200);
    // 營業班次應有現金未增加
    expect(session.expectedCash).toBe(initialExpected);
  });
});
