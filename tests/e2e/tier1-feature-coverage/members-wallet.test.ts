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

describe('Tier 1: Feature Coverage - Members & Points Wallet (會員與點數錢包)', () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    resetTestStore();
    app = buildApp();
  });

  it('F20-1: 建立新會員主檔 (POST /api/v1/members)，點數初始為 0 且建檔完整', async () => {
    const store = getTestStore();

    const newMemberPayload = {
      phone: '0922333444',
      name: '張志明',
      gender: '男',
      birthday: '1992-07-07',
      note: '現場臨櫃建檔',
    };

    const res = await authInject(app, {
      method: 'POST',
      url: '/api/v1/members',
      payload: newMemberPayload,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.phone).toBe('0922333444');
    expect(body.data.name).toBe('張志明');
    expect(body.data.points).toBe(0);

    // 驗證存在於資料庫
    const m = store.members.find((it) => it.phone === '0922333444');
    expect(m).toBeDefined();
    expect(m!.points).toBe(0);
  });

  it('F20-2: 會員電話查詢相容去前導 0 (GET /api/v1/members/912345678 查到 0912345678)', async () => {
    const res = await authInject(app, {
      method: 'GET',
      url: '/api/v1/members/912345678', // 無 0 前綴
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.phone).toBe('0912345678');
    expect(body.data.name).toBe('王小明');
    expect(body.data.points).toBe(500);
  });

  it('F20-3: 重複電話註冊防呆 (POST /api/v1/members)，應回傳 409 衝突', async () => {
    const res = await authInject(app, {
      method: 'POST',
      url: '/api/v1/members',
      payload: {
        phone: '0912345678', // 已存在之電話
        name: '重複王小明',
      },
    });

    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.message).toContain('已註冊');
  });

  it('F20-4: 店長手動點數異動 (POST /members/:id/adjust-points)，更新餘額並原子寫入 PointLog 與 AuditLog', async () => {
    const store = getTestStore();
    const member = store.members.find((m) => m.phone === '0912345678')!;
    const initialPoints = member.points;

    const res = await authInject(app, {
      method: 'POST',
      url: `/api/admin/members/${member.id}/adjust-points`,
      payload: {
        delta: 60,
        reason: 'VIP 年度滿額專案手動贈點',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.newPoints).toBe(initialPoints + 60);

    // 驗證會員點數已更新
    expect(member.points).toBe(initialPoints + 60);

    // 驗證 PointLog 複式記帳流水
    const ptLog = store.pointLogs.find((l) => l.memberId === member.id && l.delta === 60);
    expect(ptLog).toBeDefined();
    expect(ptLog!.reason).toBe('VIP 年度滿額專案手動贈點');

    // 驗證 AuditLog 審計日誌
    const audit = store.auditLogs.find((a) => a.action === 'MEMBER_POINT_ADJUST' && a.targetId === member.id);
    expect(audit).toBeDefined();
    expect(audit!.delta).toBe(60);
  });

  it('F20-5: 查詢會員消費明細紀錄 (GET /api/v1/members/:phone/history)，回傳歷史消費條目', async () => {
    const store = getTestStore();
    // 注入一筆會員歷史已完成訂單
    const orderId = 'ord-hist-vip';
    store.orders.push({
      id: orderId,
      checkoutUID: '0912345678_2026-10-09_999999',
      storeId: 'chupei',
      memberId: 'm-vip',
      status: 'COMPLETED',
      totalDue: 350,
      receivedAmount: 350,
      cash: 350,
      creditCard: 0,
      linePay: 0,
      remittance: 0,
      pointsUsed: 0,
      netPointsDelta: 0,
      createdAt: new Date(),
    });
    store.orderItems.push({
      id: 'item-hist-1',
      orderId,
      bagId: 'LB001',
      prizeGrade: 'A',
      prizeName: 'A賞 魯夫 MASTERLISE',
      draws: 1,
      pickType: 'TAKE_AWAY',
      amount: 350,
      pointsImpact: 0,
      remark: '一番賞',
    });

    const res = await authInject(app, {
      method: 'GET',
      url: '/api/v1/members/0912345678/history',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(1);
    expect(body.data[0].prizeName).toBe('A賞 魯夫 MASTERLISE');
    expect(body.data[0].type).toBe('帶走');
  });
});
