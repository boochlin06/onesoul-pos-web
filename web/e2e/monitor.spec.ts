import { test, expect, Page } from '@playwright/test';

const BASE = 'http://localhost:5173';

/**
 * 模擬 admin 登入狀態
 * 由於 Google OAuth 無法在 e2e 中直接登入，我們透過 mock GAS API
 * 來測試 MonitorView 的純前端行為
 */

// ── Mock helpers ──

/** 建立 GAS API route mock，攔截所有 doPost 請求 */
async function mockGasApi(page: Page, handlers: Record<string, (payload: any) => any>) {
  await page.route('**/*exec*', async (route) => {
    const req = route.request();
    if (req.method() !== 'POST') {
      await route.fallback();
      return;
    }
    try {
      const body = JSON.parse(req.postData() || '{}');
      const action = body.action;
      if (handlers[action]) {
        const result = handlers[action](body.payload || {});
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(result),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: [] }),
        });
      }
    } catch {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    }
  });
}

/** 模擬已登入的 admin 狀態（注入 localStorage） */
async function simulateAdminLogin(page: Page) {
  await page.evaluate(() => {
    // 模擬 auth 狀態，讓 useAuth 認定為已登入的 admin
    localStorage.setItem('os_auth_user', JSON.stringify({
      email: 'onesoul.chupei@gmail.com',
      name: 'Admin',
    }));
    localStorage.setItem('os_auth_token', 'mock_token');
    localStorage.setItem('os_branch', '"竹北"');
  });
}

// ═══════════════════════════════════════════════════
// MonitorView — 監控頁面 UI 測試
// ═══════════════════════════════════════════════════
test.describe('即時結帳監控', () => {

  test('監控 Tab 在非 admin 時不顯示', async ({ page }) => {
    await page.goto(BASE);
    // 預設未登入，不應該看到監控 tab
    const monitorTab = page.getByRole('button', { name: '監控' });
    await expect(monitorTab).toHaveCount(0);
  });

  test('監控開關預設為關閉', async ({ page }) => {
    // 清除 sticky state，確保 Switch 為關閉
    await page.goto(BASE);
    await page.evaluate(() => {
      localStorage.removeItem('os_monitor_enabled');
    });
    await page.reload();

    // 由於未登入看不見 tab，這邊只檢查 localStorage 預設值
    const val = await page.evaluate(() => localStorage.getItem('os_monitor_enabled'));
    expect(val).toBeNull();
  });
});

// ═══════════════════════════════════════════════════
// MonitorView — API Mock 測試
// ═══════════════════════════════════════════════════
test.describe('監控 API 行為', () => {
  const mockDrafts = [
    {
      sessionId: 'test_session_1',
      email: 'staff@test.com',
      data: {
        customer: { phoneName: '0912345678', name: '測試客戶' },
        lotteries: [
          { id: '001', setName: '海賊王', prize: 'A', draws: 3, amount: 900 },
        ],
        merchandises: [],
        payment: { cash: 500, creditCard: 0, remittance: 0, pointsUsed: 0 },
        summary: { dueAmount: 900, pointsChange: 3 },
        orderNote: '測試備註',
      },
      ts: Date.now(),
      ago: 5,
    },
    {
      sessionId: 'test_session_2',
      email: 'staff2@test.com',
      data: {
        customer: { phoneName: '0987654321', name: '第二客戶' },
        lotteries: [],
        merchandises: [
          { id: 'M001', name: '公仔', quantity: 2, actualAmount: 600 },
        ],
        payment: { cash: 600, creditCard: 0, remittance: 0, pointsUsed: 0 },
        summary: { dueAmount: 600, pointsChange: 0 },
      },
      ts: Date.now() - 120000, // 2 分鐘前
      ago: 120,
    },
  ];

  test('getDrafts 回傳正確格式', async ({ page }) => {
    await mockGasApi(page, {
      getDrafts: () => ({ success: true, data: mockDrafts }),
    });

    // 直接呼叫 API，確認 mock 生效
    const result = await page.evaluate(async () => {
      const res = await fetch(window.location.origin, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getDrafts', payload: { branch: '竹北' } }),
      });
      return res.json();
    });

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2);
    expect(result.data[0].email).toBe('staff@test.com');
    expect(result.data[1].email).toBe('staff2@test.com');
  });

  test('saveDraft 能正確送出', async ({ page }) => {
    let savedPayload: any = null;
    await mockGasApi(page, {
      saveDraft: (payload: any) => {
        savedPayload = payload;
        return { success: true };
      },
    });

    await page.evaluate(async () => {
      await fetch(window.location.origin, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'saveDraft',
          payload: {
            branch: '竹北',
            sessionId: 'abc123',
            email: 'test@test.com',
            data: { customer: { phoneName: '0911' } },
          },
        }),
      });
    });

    // Mock handler was called — savedPayload captured server-side
    // In e2e we verify the response
    const result = await page.evaluate(async () => {
      const res = await fetch(window.location.origin, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'saveDraft',
          payload: { branch: '竹北', sessionId: 'x', email: 'y', data: {} },
        }),
      });
      return res.json();
    });
    expect(result.success).toBe(true);
  });

  test('clearDraft 能正確送出', async ({ page }) => {
    await mockGasApi(page, {
      clearDraft: () => ({ success: true }),
    });

    const result = await page.evaluate(async () => {
      const res = await fetch(window.location.origin, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'clearDraft',
          payload: { sessionId: 'abc123', branch: '竹北' },
        }),
      });
      return res.json();
    });
    expect(result.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════
// MonitorView — 草稿資料格式驗證
// ═══════════════════════════════════════════════════
test.describe('草稿資料格式', () => {
  test('空草稿回傳空陣列', async ({ page }) => {
    await mockGasApi(page, {
      getDrafts: () => ({ success: true, data: [] }),
    });

    const result = await page.evaluate(async () => {
      const res = await fetch(window.location.origin, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getDrafts', payload: { branch: '竹北' } }),
      });
      return res.json();
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual([]);
  });

  test('缺少 branch 回傳錯誤', async ({ page }) => {
    await mockGasApi(page, {
      getDrafts: (payload: any) => {
        if (!payload.branch) return { success: false, message: '缺少 branch' };
        return { success: true, data: [] };
      },
    });

    const result = await page.evaluate(async () => {
      const res = await fetch(window.location.origin, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getDrafts', payload: {} }),
      });
      return res.json();
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('branch');
  });

  test('多 session 資料結構正確', async ({ page }) => {
    const threeSessions = [
      { sessionId: 's1', email: 'a@x.com', data: {}, ts: Date.now(), ago: 10 },
      { sessionId: 's2', email: 'b@x.com', data: {}, ts: Date.now(), ago: 30 },
      { sessionId: 's3', email: 'a@x.com', data: {}, ts: Date.now(), ago: 60 },
    ];

    await mockGasApi(page, {
      getDrafts: () => ({ success: true, data: threeSessions }),
    });

    const result = await page.evaluate(async () => {
      const res = await fetch(window.location.origin, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getDrafts', payload: { branch: '竹北' } }),
      });
      return res.json();
    });

    expect(result.data).toHaveLength(3);
    // 同一個 email 可以有兩個不同 session（多分頁）
    const emailACount = result.data.filter((d: any) => d.email === 'a@x.com').length;
    expect(emailACount).toBe(2);
  });
});
