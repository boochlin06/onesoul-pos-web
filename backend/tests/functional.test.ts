import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockPrisma, memoryStore, resetMemoryStore } = vi.hoisted(() => {
  const store = {
    members: [] as any[],
    stores: [] as any[],
    sessions: [] as any[],
    products: [] as any[],
    inventories: [] as any[],
    blindBoxes: [] as any[],
    luckyBags: [] as any[],
    luckyBagPrizes: [] as any[],
    orders: [] as any[],
    pointLogs: [] as any[],
    inventoryLogs: [] as any[],
    stocktakes: [] as any[],
    stocktakeItems: [] as any[],
    voidSetLogs: [] as any[],
    attendances: [] as any[],
    schedules: [] as any[],
  };

  function reset() {
    store.members = [
      { id: 'm1', phone: '0912345678', name: '王小明', points: 500, registeredAt: new Date(), createdAt: new Date(), updatedAt: new Date() },
      { id: 'm2', phone: '0987654321', name: '李小華', points: 120, registeredAt: new Date(), createdAt: new Date(), updatedAt: new Date() },
    ];
    store.stores = [
      { id: 'chupei', name: '竹北店', code: 'CHUPEI', isActive: true, openTime: '14:00', standardHours: 8, lateGraceMinutes: 15, createdAt: new Date(), updatedAt: new Date() },
      { id: 'jinshan', name: '金山店', code: 'JINSHAN', isActive: true, openTime: '16:00', standardHours: 6, lateGraceMinutes: 15, createdAt: new Date(), updatedAt: new Date() },
    ];
    store.sessions = [
      { id: 'sess-1', storeId: 'chupei', openingCash: 3000, openedBy: 'onesoul.chupei@gmail.com', status: 'OPEN', openedAt: new Date(), orders: [] },
    ];
    store.products = [
      { id: '88888', name: '手動加點', category: 'GENERAL', isSpecial: true, sellingPrice: 0, costPrice: 0, suggestedPoints: 0 },
      { id: '99999', name: '手動扣點', category: 'GENERAL', isSpecial: true, sellingPrice: 0, costPrice: 0, suggestedPoints: 0 },
      { id: 'GK001', name: '海賊王 魯夫 GK', category: 'GK', isSpecial: false, sellingPrice: 15000, costPrice: 8000, suggestedPoints: 300 },
      { id: 'GEN001', name: '展示盒', category: 'GENERAL', isSpecial: false, sellingPrice: 300, costPrice: 150, suggestedPoints: 5 },
    ];
    store.inventories = [
      { id: 'inv-1', storeId: 'chupei', productId: 'GK001', quantity: 10, safetyStock: 1 },
      { id: 'inv-2', storeId: 'chupei', productId: 'GEN001', quantity: 50, safetyStock: 5 },
    ];
    store.blindBoxes = [
      { id: 'BB001', name: 'Labubu', points: 10, manualPrice: 350, cost: 200, inventory: 20, remaining: 20 },
    ];
    store.luckyBags = [
      { id: '1', storeId: 'chupei', name: '海賊王一番賞新年套', unitPrice: 350, isPointsSet: false, status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date() },
    ];
    store.luckyBagPrizes = [
      { id: 'p1', bagId: '1', prizeGrade: 'A', prizeName: 'A賞 魯夫 MASTERLISE', productId: 'GK001', points: 150, draws: 2, drawnCount: 0, updatedAt: new Date() },
      { id: 'p2', bagId: '1', prizeGrade: 'B', prizeName: 'B賞 索隆 MASTERLISE', productId: null, points: 100, draws: 3, drawnCount: 0, updatedAt: new Date() },
    ];
    store.orders = [];
    store.pointLogs = [];
    store.inventoryLogs = [];
    store.stocktakes = [];
    store.stocktakeItems = [];
    store.voidSetLogs = [];
    store.attendances = [];
    store.schedules = [];
  }

  const mock = {
    store: {
      findMany: vi.fn(async () => store.stores),
      findUnique: vi.fn(async ({ where }: any) => store.stores.find((s) => s.id === where.id) || null),
    },
    member: {
      findMany: vi.fn(async () => store.members),
      findFirst: vi.fn(async ({ where }: any) => {
        if (where.OR) {
          return store.members.find((m) => where.OR.some((cond: any) => cond.phone === m.phone)) || null;
        }
        return null;
      }),
      findUnique: vi.fn(async ({ where }: any) => store.members.find((m) => m.phone === where.phone) || null),
      create: vi.fn(async ({ data }: any) => {
        const created = { id: `m-${Date.now()}`, ...data, registeredAt: new Date(), createdAt: new Date(), updatedAt: new Date() };
        store.members.push(created);
        return created;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const m = store.members.find((it) => it.id === where.id);
        if (m) Object.assign(m, data);
        return m;
      }),
    },
    cashRegisterSession: {
      findFirst: vi.fn(async ({ where }: any) => {
        return store.sessions.find((s) => s.storeId === where.storeId && (where.status ? s.status === where.status : true)) || null;
      }),
      create: vi.fn(async ({ data }: any) => {
        const s = { id: `sess-${Date.now()}`, ...data, openedAt: new Date() };
        store.sessions.push(s);
        return s;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const s = store.sessions.find((it) => it.id === where.id);
        if (s) Object.assign(s, data);
        return s;
      }),
    },
    product: {
      findMany: vi.fn(async () => store.products),
    },
    storeInventory: {
      findMany: vi.fn(async ({ where }: any) => {
        return store.inventories
          .filter((inv) => (where.storeId ? inv.storeId === where.storeId : true))
          .map((inv) => ({
            ...inv,
            product: store.products.find((p) => p.id === inv.productId) || { name: 'Unknown', category: 'GENERAL', suggestedPoints: 0 },
            store: store.stores.find((s) => s.id === inv.storeId) || { name: '竹北店' },
          }));
      }),
      findUnique: vi.fn(async ({ where }: any) => {
        return store.inventories.find(
          (it) => it.storeId === where.storeId_productId.storeId && it.productId === where.storeId_productId.productId
        ) || null;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const inv = store.inventories.find((it) => it.id === where.id);
        if (inv) {
          if (data.quantity && typeof data.quantity === 'object' && 'increment' in data.quantity) {
            inv.quantity += data.quantity.increment;
          } else if (data.quantity && typeof data.quantity === 'object' && 'decrement' in data.quantity) {
            inv.quantity -= data.quantity.decrement;
          } else {
            Object.assign(inv, data);
          }
        }
        return inv;
      }),
    },
    blindBox: {
      findMany: vi.fn(async () => store.blindBoxes),
    },
    luckyBag: {
      findMany: vi.fn(async () => {
        return store.luckyBags.map((b) => ({
          ...b,
          prizes: store.luckyBagPrizes.filter((p) => p.bagId === b.id),
          store: store.stores.find((s) => s.id === b.storeId) || { name: '竹北店' },
        }));
      }),
      findUnique: vi.fn(async ({ where }: any) => {
        const b = store.luckyBags.find((it) => it.id === where.id);
        if (!b) return null;
        return {
          ...b,
          prizes: store.luckyBagPrizes.filter((p) => p.bagId === b.id),
          store: store.stores.find((s) => s.id === b.storeId) || { name: '竹北店' },
        };
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const b = store.luckyBags.find((it) => it.id === where.id);
        if (b) Object.assign(b, data);
        return b;
      }),
    },
    luckyBagPrize: {
      findFirst: vi.fn(async ({ where }: any) => {
        return store.luckyBagPrizes.find(
          (p) => p.bagId === where.bagId && p.prizeGrade.toLowerCase() === where.prizeGrade.equals.toLowerCase()
        ) || null;
      }),
      findMany: vi.fn(async () => store.luckyBagPrizes),
      update: vi.fn(async ({ where, data }: any) => {
        const p = store.luckyBagPrizes.find((it) => it.id === where.id);
        if (p) {
          if (data.drawnCount?.increment) p.drawnCount += data.drawnCount.increment;
          else Object.assign(p, data);
        }
        return p;
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        const targets = store.luckyBagPrizes.filter(
          (p) => p.bagId === where.bagId && p.prizeGrade.toLowerCase() === where.prizeGrade.equals.toLowerCase()
        );
        targets.forEach((p) => {
          if (data.drawnCount?.decrement) p.drawnCount -= data.drawnCount.decrement;
        });
        return { count: targets.length };
      }),
    },
    order: {
      findUnique: vi.fn(async ({ where }: any) => {
        const o = store.orders.find((it) => it.checkoutUID === where.checkoutUID);
        if (!o) return null;
        return {
          ...o,
          member: store.members.find((m) => m.id === o.memberId) || null,
          store: store.stores.find((s) => s.id === o.storeId) || { name: '竹北店' },
        };
      }),
      findMany: vi.fn(async ({ where }: any) => {
        return store.orders
          .filter((o) => {
            if (where?.sessionId && o.sessionId !== where.sessionId) return false;
            if (where?.memberId && o.memberId !== where.memberId) return false;
            if (where?.status && o.status !== where.status) return false;
            return true;
          })
          .map((o) => ({
            ...o,
            member: store.members.find((m) => m.id === o.memberId) || null,
            store: store.stores.find((s) => s.id === o.storeId) || { name: '竹北店' },
          }));
      }),
      create: vi.fn(async ({ data }: any) => {
        const created = { id: `ord-${Date.now()}`, ...data, items: [], createdAt: new Date(), updatedAt: new Date() };
        store.orders.push(created);
        return created;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const o = store.orders.find((it) => it.id === where.id);
        if (o) Object.assign(o, data);
        return o;
      }),
    },
    orderItem: {
      create: vi.fn(async ({ data }: any) => {
        const order = store.orders.find((o) => o.id === data.orderId);
        if (order) order.items.push(data);
        return data;
      }),
    },
    pointLog: {
      create: vi.fn(async ({ data }: any) => {
        store.pointLogs.push(data);
        return data;
      }),
    },
    inventoryLog: {
      create: vi.fn(async ({ data }: any) => {
        store.inventoryLogs.push(data);
        return data;
      }),
    },
    stocktake: {
      create: vi.fn(async ({ data }: any) => {
        const s = { id: `st-${Date.now()}`, ...data, items: [], createdAt: new Date() };
        store.stocktakes.push(s);
        return s;
      }),
      findUnique: vi.fn(async ({ where }: any) => {
        const s = store.stocktakes.find((it) => it.id === where.id);
        if (!s) return null;
        return {
          ...s,
          items: store.stocktakeItems.filter((it) => it.stocktakeId === s.id),
        };
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const s = store.stocktakes.find((it) => it.id === where.id);
        if (s) Object.assign(s, data);
        return s;
      }),
    },
    stocktakeItem: {
      create: vi.fn(async ({ data }: any) => {
        store.stocktakeItems.push(data);
        return data;
      }),
    },
    voidSetLog: {
      create: vi.fn(async ({ data }: any) => {
        store.voidSetLogs.push(data);
        return data;
      }),
    },
    $transaction: vi.fn(async (cb: any) => {
      return cb(mock);
    }),
  };

  return { mockPrisma: mock, memoryStore: store, resetMemoryStore: reset };
});

vi.mock('../src/plugins/prisma', () => ({
  prisma: mockPrisma,
}));

import { buildApp } from '../src/app';

describe('OneSoul POS 功能性全流程整合測試 (E2E Functional Tests)', () => {
  let app: ReturnType<typeof buildApp>;

  function authInject(opts: any) {
    return app.inject({
      ...opts,
      headers: {
        'x-caller-email': 'onesoul.chupei@gmail.com',
        ...(opts.headers || {}),
      },
    });
  }

  beforeEach(() => {
    resetMemoryStore();
    app = buildApp();
  });

  // ─────────────────────────────────────────────────────────────
  // 1. 會員管理功能性測試 (Members)
  // ─────────────────────────────────────────────────────────────
  describe('會員管理 (Members)', () => {
    it('應能列出所有會員資料 (相容 MemberEntry 格式)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/members',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.length).toBe(2);
      expect(body.data[0].name).toBe('王小明');
      expect(body.data[0].phone).toBe('0912345678');
    });

    it('應支援去前導 0 查詢電話 (912345678 查到 0912345678)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/members/912345678',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.name).toBe('王小明');
      expect(body.data.points).toBe(500);
    });

    it('應能註冊新會員，且點數預設為 0', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/members',
        payload: {
          phone: '0955667788',
          name: '新顧客',
          gender: '男',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.phone).toBe('0955667788');
      expect(body.data.points).toBe(0);
    });

    it('重複電話註冊應回傳 409 衝突防呆', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/members',
        payload: {
          phone: '0912345678',
          name: '重複的王小明',
        },
      });

      expect(res.statusCode).toBe(409);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.message).toContain('已註冊');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 2. 開關帳與交班功能性測試 (Shift Sessions & Z-Report)
  // ─────────────────────────────────────────────────────────────
  describe('開關帳與交班 (Sessions & Z-Report)', () => {
    it('應能取得門市當前活躍班次與開帳零錢備金', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/sessions/active?branch=竹北',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.amount).toBe(3000);
      expect(body.session.status).toBe('OPEN');
    });

    it('應能更新或建立開帳零錢備金', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/sessions/open',
        payload: {
          branch: '竹北',
          amount: 5000,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.openingCash).toBe(5000);
    });

    it('打烊關帳 (closeDay) 應計算應收現金與溢短差額，並封存 Z-Report', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/sessions/close',
        payload: {
          branch: '竹北',
          actualCash: 2950,
          note: '今日打烊短少50元零錢',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('CLOSED');
      expect(body.data.discrepancy).toBe(-50); // 2950 - 3000 = -50
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 3. 結帳交易與冪等性測試 (Checkout & Idempotency)
  // ─────────────────────────────────────────────────────────────
  describe('結帳交易核心 (Orders & Checkout)', () => {
    it('應成功結帳：抽中 A 賞帶走，扣減門市庫存並增加獎項已抽數與點數', async () => {
      const checkoutUID = '0912345678_2026-10-09_165000';
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/orders/checkout',
        payload: {
          branch: '竹北',
          customer: {
            phone: '0912345678',
            name: '王小明',
            currentPoints: 500,
          },
          lotteries: [
            {
              id: '1',
              setName: '海賊王一番賞新年套',
              prize: 'A',
              prizeName: 'A賞 魯夫 MASTERLISE',
              draws: 1,
              type: '帶走',
              unitPrice: 350,
              amount: 350,
              totalPoints: 0,
            },
          ],
          merchandises: [
            {
              id: 'GEN001',
              name: '展示盒',
              quantity: 1,
              paymentType: '現金',
              unitAmount: 300,
              actualAmount: 300,
              totalPoints: 0,
            },
          ],
          payment: {
            receivedAmount: 650,
            cash: 650,
            creditCard: 0,
            remittance: 0,
            pointsUsed: 0,
          },
          summary: {
            dueAmount: 650,
            pointsChange: 10,
          },
          checkoutUID,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.checkoutUID).toBe(checkoutUID);
      expect(body.newPoints).toBe(510); // 500 + 10 = 510

      // 檢查 GK001 實體商品庫存是否從 10 扣為 9
      const inv = memoryStore.inventories.find((it) => it.productId === 'GK001');
      expect(inv?.quantity).toBe(9);

      // 檢查 A 賞已抽數是否從 0 增為 1
      const prize = memoryStore.luckyBagPrizes.find((p) => p.prizeGrade === 'A');
      expect(prize?.drawnCount).toBe(1);
    });

    it('iCHEF 冪等防護：重複發送相同 checkoutUID 應回傳 200 OK 且不重複扣庫存與點數', async () => {
      const checkoutUID = '0912345678_2026-10-09_165000';

      // 預先塞入已完成的訂單
      memoryStore.orders.push({
        id: 'ord-existing',
        checkoutUID,
        storeId: 'chupei',
        status: 'COMPLETED',
        memberId: 'm1',
        receivedAmount: 650,
        cash: 650,
        netPointsDelta: 10,
        items: [],
      });

      const retryRes = await app.inject({
        method: 'POST',
        url: '/api/v1/orders/checkout',
        payload: {
          branch: '竹北',
          customer: { phone: '0912345678' },
          lotteries: [],
          merchandises: [],
          payment: { receivedAmount: 650, cash: 650, creditCard: 0, remittance: 0, pointsUsed: 0 },
          summary: { dueAmount: 650, pointsChange: 10 },
          checkoutUID,
        },
      });

      expect(retryRes.statusCode).toBe(200);
      const body = JSON.parse(retryRes.body);
      expect(body.success).toBe(true);
      expect(body.message).toContain('冪等');

      // 驗證庫存依然是 10，沒有被二次扣除
      const inv = memoryStore.inventories.find((it) => it.productId === 'GK001');
      expect(inv?.quantity).toBe(10);
    });

    it('顧客點數不足時，應拒絕結帳並回傳 400 錯誤', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/orders/checkout',
        payload: {
          branch: '竹北',
          customer: {
            phone: '0987654321', // 李小華 只有 120 點
            name: '李小華',
            currentPoints: 120,
          },
          lotteries: [],
          merchandises: [
            {
              id: 'GEN001',
              name: '展示盒',
              category: 'GENERAL',
              quantity: 1,
              unitPrice: 500,
              actualAmount: 500,
              paymentType: '現金',
            },
          ],
          payment: {
            receivedAmount: 0,
            cash: 0,
            creditCard: 0,
            remittance: 0,
            pointsUsed: 500, // 意圖折抵 500 點
          },
          summary: {
            dueAmount: 500,
            pointsChange: 0,
          },
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.message).toContain('客戶點數不足');
    });

    it('後端金額防竄改重新校驗：若前端送出不實 dueAmount 應回傳 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/orders/checkout',
        payload: {
          branch: '竹北',
          customer: { phone: '0912345678' },
          lotteries: [
            {
              id: '1',
              name: '海賊王一番賞新年套',
              prize: 'A',
              prizeName: 'A賞 魯夫 MASTERLISE',
              type: '帶走',
              draws: 1,
              unitPrice: 350,
              amount: 350,
              pointsImpact: 0,
            },
          ],
          merchandises: [],
          payment: { receivedAmount: 1, cash: 1, creditCard: 0, remittance: 0, pointsUsed: 0 },
          // 意圖竄改金額，應付 350 改送 1 元
          summary: { dueAmount: 1, pointsChange: 0 },
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.message).toContain('金額校驗失敗');
    });

    it('散客未留電話結帳時應生成帶 WALKIN 前綴且具隨機高熵的 checkoutUID，避免同秒併發碰撞', async () => {
      const res1 = await app.inject({
        method: 'POST',
        url: '/api/v1/orders/checkout',
        payload: {
          branch: '竹北',
          customer: { phone: '' },
          lotteries: [],
          merchandises: [
            {
              id: 'GEN001',
              name: '展示盒',
              category: 'GENERAL',
              quantity: 1,
              unitPrice: 300,
              actualAmount: 300,
              paymentType: '現金',
            },
          ],
          payment: { receivedAmount: 300, cash: 300, creditCard: 0, remittance: 0, pointsUsed: 0 },
          summary: { dueAmount: 300, pointsChange: 0 },
        },
      });

      expect(res1.statusCode).toBe(200);
      const body1 = JSON.parse(res1.body);
      expect(body1.checkoutUID).toMatch(/^WALKIN_\d+_[a-z0-9]+$/);

      const res2 = await app.inject({
        method: 'POST',
        url: '/api/v1/orders/checkout',
        payload: {
          branch: '竹北',
          customer: { phone: '' },
          lotteries: [],
          merchandises: [
            {
              id: 'GEN001',
              name: '展示盒',
              category: 'GENERAL',
              quantity: 1,
              unitPrice: 300,
              actualAmount: 300,
              paymentType: '現金',
            },
          ],
          payment: { receivedAmount: 300, cash: 300, creditCard: 0, remittance: 0, pointsUsed: 0 },
          summary: { dueAmount: 300, pointsChange: 0 },
        },
      });

      expect(res2.statusCode).toBe(200);
      const body2 = JSON.parse(res2.body);
      expect(body2.checkoutUID).toMatch(/^WALKIN_\d+_[a-z0-9]+$/);
      expect(body1.checkoutUID).not.toBe(body2.checkoutUID);
    });

    it('一番賞防超抽驗證：欲抽數超過獎項現餘抽數時應拒絕結帳並回傳 400 錯誤', async () => {
      // 獎項 A 賞在 resetMemoryStore 中總共只有 draws: 2, drawnCount: 0
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/orders/checkout',
        payload: {
          branch: '竹北',
          customer: { phone: '0912345678' },
          lotteries: [
            {
              id: '1',
              name: '海賊王一番賞新年套',
              prize: 'A',
              prizeName: 'A賞 魯夫 MASTERLISE',
              type: '帶走',
              draws: 3, // 嘗試抽 3 抽，超過上限 2 抽
              unitPrice: 350,
              amount: 1050,
              pointsImpact: 0,
            },
          ],
          merchandises: [],
          payment: { receivedAmount: 1050, cash: 1050, creditCard: 0, remittance: 0, pointsUsed: 0 },
          summary: { dueAmount: 1050, pointsChange: 0 },
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.message).toContain('剩餘抽數不足');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 4. 當日銷售與軟作廢回滾功能性測試 (Daily Sales & Soft Void)
  // ─────────────────────────────────────────────────────────────
  describe('當日銷售與訂單軟作廢 (Daily Sales & Soft Void)', () => {
    it('應能查詢當日銷售明細列表', async () => {
      // 先塞一筆當班訂單
      memoryStore.orders.push({
        id: 'ord-daily',
        checkoutUID: '0912345678_2026-10-09_111111',
        sessionId: 'sess-1',
        storeId: 'chupei',
        status: 'COMPLETED',
        memberId: 'm1',
        receivedAmount: 350,
        cash: 350,
        creditCard: 0,
        remittance: 0,
        pointsUsed: 0,
        netPointsDelta: 0,
        createdAt: new Date(),
        items: [
          {
            bagId: '1',
            prizeGrade: 'A',
            prizeName: 'A賞',
            pickType: 'TAKE_AWAY',
            draws: 1,
            unitPrice: 350,
            amount: 350,
            pointsImpact: 0,
          },
        ],
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/orders/daily?branch=竹北',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.length).toBe(1);
      expect(body.data[0].checkoutUID).toBe('0912345678_2026-10-09_111111');
    });

    it('作廢訂單時應標記為 CANCELLED，並原子回補商品庫存與退回會員點數', async () => {
      const checkoutUID = '0912345678_2026-10-09_222222';
      // 假設之前結帳贈點 10 點，會員點數變為 510，庫存 GK001 變為 9
      const member = memoryStore.members.find((m) => m.phone === '0912345678');
      if (member) member.points = 510;
      const inv = memoryStore.inventories.find((it) => it.productId === 'GK001');
      if (inv) inv.quantity = 9;

      memoryStore.orders.push({
        id: 'ord-void-target',
        checkoutUID,
        sessionId: 'sess-1',
        storeId: 'chupei',
        status: 'COMPLETED',
        memberId: 'm1',
        receivedAmount: 350,
        cash: 350,
        netPointsDelta: 10,
        createdAt: new Date(),
        items: [
          {
            bagId: '1',
            prizeGrade: 'A',
            productId: 'GK001',
            quantity: 1,
            draws: 1,
            itemType: 'LOTTERY',
          },
        ],
      });

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/orders/${checkoutUID}/void`,
        payload: {
          branch: '竹北',
          reason: '店員操作作廢',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.message).toContain('成功作廢');

      // 檢查訂單狀態已為 CANCELLED
      const order = memoryStore.orders.find((o) => o.checkoutUID === checkoutUID);
      expect(order?.status).toBe('CANCELLED');

      // 檢查 GK001 庫存是否原子回補 (9 -> 10)
      expect(inv?.quantity).toBe(10);

      // 檢查點數是否原子扣回 (510 -> 500)
      expect(member?.points).toBe(500);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 5. 兩階段庫存盤點與過帳功能性測試 (Stocktakes)
  // ─────────────────────────────────────────────────────────────
  describe('兩階段庫存盤點 (Stocktake & Variance Workflow)', () => {
    let stocktakeId: string;

    it('第 1 階段：店員盲盤送出草稿，記錄系統數與實盤數', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/stocktakes',
        payload: {
          branch: '竹北',
          note: '國慶盤點',
          items: [
            {
              id: 'GK001',
              systemQty: 10,
              actualQty: 12, // 盤盈 +2
              itemRemark: '多找到2盒',
            },
            {
              id: 'GEN001',
              systemQty: 50,
              actualQty: 48, // 盤虧 -2
              itemRemark: '破損2盒',
            },
          ],
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('DRAFT');
      stocktakeId = body.data.id;
    });

    it('第 2 階段：店長/大師審核過帳 (POST /post)，原子校正門市庫存', async () => {
      // 獨立提供待審核之草稿盤點單
      const testStocktake = {
        id: 'st-audit-test',
        storeId: 'chupei',
        status: 'DRAFT',
        countedBy: 'clerk@test.com',
      };
      memoryStore.stocktakes.push(testStocktake);
      memoryStore.stocktakeItems.push(
        { id: 'sti-1', stocktakeId: 'st-audit-test', productId: 'GK001', systemQty: 10, actualQty: 12, variance: 2 },
        { id: 'sti-2', stocktakeId: 'st-audit-test', productId: 'GEN001', systemQty: 50, actualQty: 48, variance: -2 }
      );

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/stocktakes/st-audit-test/post',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);

      // 檢查 GK001 庫存是否校正為 12 (盤盈 +2)
      const inv1 = memoryStore.inventories.find((it) => it.productId === 'GK001');
      expect(inv1?.quantity).toBe(12);

      // 檢查 GEN001 庫存是否校正為 48 (盤虧 -2)
      const inv2 = memoryStore.inventories.find((it) => it.productId === 'GEN001');
      expect(inv2?.quantity).toBe(48);

      // 檢查盤點單狀態是否已為 POSTED
      const st = memoryStore.stocktakes.find((it) => it.id === 'st-audit-test');
      expect(st?.status).toBe('POSTED');
    });
  });
});
