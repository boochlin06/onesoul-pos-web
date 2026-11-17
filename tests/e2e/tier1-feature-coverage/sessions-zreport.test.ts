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

describe('Tier 1: Feature Coverage - Sessions & Z-Report (班次管理與日結關帳)', () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    resetTestStore();
    app = buildApp();
  });

  it('F21-1: 門市活躍班次查詢 (GET /api/v1/sessions/active?branch=竹北)，回傳開帳備用金與狀態', async () => {
    const res = await authInject(app, {
      method: 'GET',
      url: '/api/v1/sessions/active?branch=竹北',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.amount).toBe(8000);
    expect(body.session).toBeDefined();
    expect(body.session.status).toBe('OPEN');
  });

  it('F21-2: 早班開櫃錄入備用金 (POST /api/v1/sessions/open)，成功開啟新班次', async () => {
    const store = getTestStore();
    // 清空金山門市 session，模擬尚未開櫃
    store.sessions = store.sessions.filter((s) => s.storeId !== 'jinshan');

    const res = await authInject(app, {
      method: 'POST',
      url: '/api/v1/sessions/open',
      payload: {
        branch: '金山',
        amount: 5000,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.openingCash).toBe(5000);
    expect(body.data.status).toBe('OPEN');

    // 驗證存在於 store
    const s = store.sessions.find((it) => it.storeId === 'jinshan' && it.status === 'OPEN');
    expect(s).toBeDefined();
    expect(s!.openingCash).toBe(5000);
  });

  it('F21-3: 已有進行中班次時呼叫開帳 (POST /open)，應原地更新開帳備金而非重複建立', async () => {
    const store = getTestStore();
    const countBefore = store.sessions.length;

    const res = await authInject(app, {
      method: 'POST',
      url: '/api/v1/sessions/open',
      payload: {
        branch: '竹北',
        amount: 8500, // 從 8000 調整為 8500
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.openingCash).toBe(8500);

    // 驗證總 session 數未增加 (原地更新)
    expect(store.sessions.length).toBe(countBefore);
  });

  it('F21-4: 22:00 打烊日結關帳 (POST /close)，原子結算現金營收、實盤溢短與凍結 Z-Report', async () => {
    const store = getTestStore();
    const activeSession = store.sessions.find((s) => s.storeId === 'chupei' && s.status === 'OPEN')!;

    // 注入一筆當班訂單 (現金 $600)
    store.orders.push({
      id: 'ord-sess-1',
      checkoutUID: '0912345678_2026-10-10_sess1',
      storeId: 'chupei',
      sessionId: activeSession.id,
      status: 'COMPLETED',
      totalDue: 600,
      receivedAmount: 600,
      cash: 600,
      creditCard: 0,
      linePay: 0,
      remittance: 0,
      pointsUsed: 0,
      netPointsDelta: 0,
      createdAt: new Date(),
    });

    // 預期現金 = 8000 + 600 = 8600
    // 實盤現金 = 8600 => 溢短 = 0
    const closeRes = await authInject(app, {
      method: 'POST',
      url: '/api/v1/sessions/close',
      payload: {
        branch: '竹北',
        actualCash: 8600,
        note: '準時打烊對帳，現金 0 差異平帳',
      },
    });

    expect(closeRes.statusCode).toBe(200);
    const body = JSON.parse(closeRes.body);
    expect(body.success).toBe(true);
    expect(body.data.totalRevenue).toBe(600);
    expect(body.data.cashRevenue).toBe(600);
    expect(body.data.expectedCash).toBe(8600);
    expect(body.data.discrepancy).toBe(0);

    // 驗證 session 狀態已凍結為 CLOSED
    expect(activeSession.status).toBe('CLOSED');
  });

  it('F21-5: 當前無進行中班次時執行關帳 (POST /close)，應返回 400 錯誤防呆', async () => {
    const store = getTestStore();
    // 將所有 session 都標為 CLOSED
    store.sessions.forEach((s) => {
      s.status = 'CLOSED';
    });

    const res = await authInject(app, {
      method: 'POST',
      url: '/api/v1/sessions/close',
      payload: {
        branch: '竹北',
        actualCash: 8000,
        note: '無班次關帳嘗試',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.message).toContain('無進行中');
  });
});
