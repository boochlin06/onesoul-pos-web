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
import { recordAuditLog } from '../../../backend/src/modules/admin/audit.service';

describe('Tier 1: Feature Coverage - Audit Log & Cryptographic Chain (審計日誌與密碼學防篡改鏈)', () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    resetTestStore();
    app = buildApp();
  });

  it('F38/F39-1: 審計日誌分頁與多維度查詢 (GET /api/admin/audit-logs)', async () => {
    const store = getTestStore();

    // 建立數筆測試審計日誌
    await recordAuditLog(mockPrisma as any, {
      operatorId: 'admin@onesoul.com',
      action: 'MEMBER_POINT_ADJUST',
      targetType: 'Member',
      targetId: 'mem-001',
      delta: 50,
      reason: 'VIP 活動補發點數',
    });

    await recordAuditLog(mockPrisma as any, {
      operatorId: 'manager@onesoul.com',
      action: 'STOCK_DELTA_ADJUST',
      targetType: 'StoreInventory',
      targetId: 'inv-001',
      delta: -1,
      reason: '盤損報廢',
    });

    // 1. 全量查詢
    const resAll = await authInject(app, {
      method: 'GET',
      url: '/api/admin/audit-logs?pageSize=10',
    });
    expect(resAll.statusCode).toBe(200);
    const bodyAll = JSON.parse(resAll.body);
    expect(bodyAll.success).toBe(true);
    expect(bodyAll.meta.total).toBeGreaterThanOrEqual(2);

    // 2. 條件篩選 targetType=Member
    const resFilter = await authInject(app, {
      method: 'GET',
      url: '/api/admin/audit-logs?targetType=Member',
    });
    const bodyFilter = JSON.parse(resFilter.body);
    expect(bodyFilter.data.every((l: any) => l.targetType === 'Member')).toBe(true);
    expect(bodyFilter.data.some((l: any) => l.targetId === 'mem-001')).toBe(true);

    // 3. 條件篩選 operatorId=manager@onesoul.com
    const resOp = await authInject(app, {
      method: 'GET',
      url: '/api/admin/audit-logs?operatorId=manager@onesoul.com',
    });
    const bodyOp = JSON.parse(resOp.body);
    expect(bodyOp.data.length).toBe(1);
    expect(bodyOp.data[0].action).toBe('STOCK_DELTA_ADJUST');
  });

  it('F38/F39-2: 審計日誌 Genesis 創世區塊與鏈式哈希初始驗證', async () => {
    const store = getTestStore();
    store.auditLogs = [];

    const genesisLog = await recordAuditLog(mockPrisma as any, {
      operatorId: 'system',
      action: 'GENESIS_INIT',
      targetType: 'System',
      targetId: 'sys-001',
      delta: 0,
      reason: '系統初始創世審計錨點',
    });

    expect(genesisLog.prevHash).toBe('0000000000000000000000000000000000000000000000000000000000000000');
    const expectedHash = computeAuditHash(
      '0000000000000000000000000000000000000000000000000000000000000000',
      'system',
      'GENESIS_INIT',
      'System',
      'sys-001',
      0,
      '系統初始創世審計錨點',
    );
    expect(genesisLog.currentHash).toBe(expectedHash);
  });

  it('F38/F39-3: 連續業務操作之不可篡改鏈 (Hash Chain Continuum)', async () => {
    const store = getTestStore();
    store.auditLogs = [];

    // 執行 3 筆相依業務審計記錄
    const log1 = await recordAuditLog(mockPrisma as any, {
      operatorId: 'admin@onesoul.com',
      action: 'STOCK_IN',
      targetType: 'StoreInventory',
      targetId: 'inv-4108',
      delta: 5,
      reason: '預購進貨入庫 5 件',
    });

    const log2 = await recordAuditLog(mockPrisma as any, {
      operatorId: 'cashier@onesoul.com',
      action: 'ORDER_CHECKOUT',
      targetType: 'Order',
      targetId: 'ord-001',
      delta: -1,
      reason: '門市結帳售出 1 件',
    });

    const log3 = await recordAuditLog(mockPrisma as any, {
      operatorId: 'admin@onesoul.com',
      action: 'VOID_ORDER',
      targetType: 'Order',
      targetId: 'ord-001',
      delta: 1,
      reason: '顧客誤抽作廢沖正',
    });

    // 驗證鏈結完整性: log2.prevHash === log1.currentHash, log3.prevHash === log2.currentHash
    expect(log2.prevHash).toBe(log1.currentHash);
    expect(log3.prevHash).toBe(log2.currentHash);

    // 驗證各節點 HMAC-SHA256 均精確可重算
    const expectedHash2 = computeAuditHash(
      log1.currentHash,
      'cashier@onesoul.com',
      'ORDER_CHECKOUT',
      'Order',
      'ord-001',
      -1,
      '門市結帳售出 1 件',
    );
    expect(log2.currentHash).toBe(expectedHash2);

    const expectedHash3 = computeAuditHash(
      log2.currentHash,
      'admin@onesoul.com',
      'VOID_ORDER',
      'Order',
      'ord-001',
      1,
      '顧客誤抽作廢沖正',
    );
    expect(log3.currentHash).toBe(expectedHash3);
  });

  it('F38/F39-4: 審計日誌防篡改檢測 (Tamper-Evidence Verification)', async () => {
    const store = getTestStore();
    store.auditLogs = [];

    await recordAuditLog(mockPrisma as any, {
      operatorId: 'admin@onesoul.com',
      action: 'MEMBER_POINT_ADJUST',
      targetType: 'Member',
      targetId: 'mem-001',
      delta: 100,
      reason: '消費贈點 100 點',
    });

    await recordAuditLog(mockPrisma as any, {
      operatorId: 'admin@onesoul.com',
      action: 'MEMBER_POINT_ADJUST',
      targetType: 'Member',
      targetId: 'mem-001',
      delta: -50,
      reason: '兌換商品扣除 50 點',
    });

    // 模擬惡意內部資料庫竄改：直接將第 1 筆日誌的 delta 由 100 改成 1000
    store.auditLogs[0].delta = 1000;

    // 驗證篡改檢測函式：重算第 1 筆 hash 應與 stored currentHash 不符
    const tamperedLog = store.auditLogs[0];
    const recomputedHash = computeAuditHash(
      tamperedLog.prevHash,
      tamperedLog.operatorId,
      tamperedLog.action,
      tamperedLog.targetType,
      tamperedLog.targetId,
      tamperedLog.delta,
      tamperedLog.reason,
    );

    expect(tamperedLog.currentHash).not.toBe(recomputedHash);
  });

  it('F38/F39-5: 授權存取保護與未授權攔截 (401/403 RBAC Guard)', async () => {
    // 1. 帶非白名單信箱存取審計日誌 -> 403
    const resForbidden = await app.inject({
      method: 'GET',
      url: '/api/admin/audit-logs',
      headers: {
        'x-caller-email': 'hacker@external.com',
      },
    });
    expect(resForbidden.statusCode).toBe(403);
    const bodyForbidden = JSON.parse(resForbidden.body);
    expect(bodyForbidden.success).toBe(false);

    // 2. 帶一般門市店員信箱存取管理員審計日誌 (非大師管理員) -> 403
    const resStaff = await app.inject({
      method: 'GET',
      url: '/api/admin/audit-logs',
      headers: {
        'x-caller-email': 'staff@onesoul.com',
      },
    });
    expect(resStaff.statusCode).toBe(403);
    const bodyStaff = JSON.parse(resStaff.body);
    expect(bodyStaff.message).toContain('權限不足');

    // 3. 帶合法大師管理員信箱存取 -> 200
    const resAdmin = await app.inject({
      method: 'GET',
      url: '/api/admin/audit-logs',
      headers: {
        'x-caller-email': 'admin@onesoul.com',
      },
    });
    expect(resAdmin.statusCode).toBe(200);
  });
});
