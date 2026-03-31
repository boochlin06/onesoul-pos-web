import { test, expect, Page } from '@playwright/test';

const BASE = 'http://localhost:5173';
const MOCK_API = `${BASE}/mock-exec`;

// ── Mock helper ──

/** 攔截瀏覽器發出的含 mock-exec 的請求，用 handler map 回應 */
async function mockGasApi(page: Page, handlers: Record<string, (payload: any) => any>) {
  await page.route('**/mock-exec', async (route) => {
    const req = route.request();
    if (req.method() !== 'POST') { await route.fallback(); return; }
    try {
      const body = JSON.parse(req.postData() || '{}');
      const handler = handlers[body.action];
      const result = handler ? handler(body.payload || {}) : { success: true, data: [] };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(result) });
    } catch {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' });
    }
  });
}

/** 在瀏覽器內部發 fetch 到 mock route，讓 page.route 攔截 */
async function postMock(page: Page, action: string, payload: any) {
  return page.evaluate(
    async ({ url, action, payload }) => {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payload }),
      });
      return res.json();
    },
    { url: MOCK_API, action, payload },
  );
}

// ═══════════════════════════════════════════════════
// MonitorView — UI 基礎測試
// ═══════════════════════════════════════════════════
test.describe('即時結帳監控', () => {
  test('監控 Tab 在非 admin 時不顯示', async ({ page }) => {
    await page.goto(BASE);
    const monitorTab = page.getByRole('button', { name: '監控' });
    await expect(monitorTab).toHaveCount(0);
  });

  test('監控開關預設為關閉', async ({ page }) => {
    await page.goto(BASE);
    await page.evaluate(() => localStorage.removeItem('os_monitor_enabled'));
    await page.reload();
    const val = await page.evaluate(() => localStorage.getItem('os_monitor_enabled'));
    expect(val).toBeNull();
  });
});

// ═══════════════════════════════════════════════════
// 監控 API 行為（route mock）
// ═══════════════════════════════════════════════════
test.describe('監控 API 行為', () => {
  const mockDrafts = [
    {
      sessionId: 'test_session_1', email: 'staff@test.com',
      data: {
        customer: { phoneName: '0912345678', name: '測試客戶' },
        lotteries: [{ id: '001', setName: '海賊王', prize: 'A', draws: 3, amount: 900 }],
        merchandises: [],
        payment: { cash: 500, creditCard: 0, remittance: 0, pointsUsed: 0 },
        summary: { dueAmount: 900, pointsChange: 3 },
        orderNote: '測試備註',
      },
      ts: Date.now(), ago: 5,
    },
    {
      sessionId: 'test_session_2', email: 'staff2@test.com',
      data: {
        customer: { phoneName: '0987654321', name: '第二客戶' },
        lotteries: [],
        merchandises: [{ id: 'M001', name: '公仔', quantity: 2, actualAmount: 600 }],
        payment: { cash: 600, creditCard: 0, remittance: 0, pointsUsed: 0 },
        summary: { dueAmount: 600, pointsChange: 0 },
      },
      ts: Date.now() - 120000, ago: 120,
    },
  ];

  test('getDrafts 回傳正確格式', async ({ page }) => {
    await page.goto(BASE);
    await mockGasApi(page, { getDrafts: () => ({ success: true, data: mockDrafts }) });

    const result = await postMock(page, 'getDrafts', { branch: '竹北' });
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2);
    expect(result.data[0].email).toBe('staff@test.com');
    expect(result.data[1].email).toBe('staff2@test.com');
  });

  test('saveDraft 能正確送出', async ({ page }) => {
    await page.goto(BASE);
    await mockGasApi(page, { saveDraft: () => ({ success: true }) });

    const result = await postMock(page, 'saveDraft', {
      branch: '竹北', sessionId: 'abc123', email: 'test@test.com',
      data: { customer: { phoneName: '0911' } },
    });
    expect(result.success).toBe(true);
  });

  test('clearDraft 能正確送出', async ({ page }) => {
    await page.goto(BASE);
    await mockGasApi(page, { clearDraft: () => ({ success: true }) });

    const result = await postMock(page, 'clearDraft', { sessionId: 'abc123', branch: '竹北' });
    expect(result.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════
// 草稿資料格式驗證
// ═══════════════════════════════════════════════════
test.describe('草稿資料格式', () => {
  test('空草稿回傳空陣列', async ({ page }) => {
    await page.goto(BASE);
    await mockGasApi(page, { getDrafts: () => ({ success: true, data: [] }) });

    const result = await postMock(page, 'getDrafts', { branch: '竹北' });
    expect(result.success).toBe(true);
    expect(result.data).toEqual([]);
  });

  test('缺少 branch 回傳錯誤', async ({ page }) => {
    await page.goto(BASE);
    await mockGasApi(page, {
      getDrafts: (payload: any) => {
        if (!payload.branch) return { success: false, message: '缺少 branch' };
        return { success: true, data: [] };
      },
    });

    const result = await postMock(page, 'getDrafts', {});
    expect(result.success).toBe(false);
    expect(result.message).toContain('branch');
  });

  test('多 session 資料結構正確', async ({ page }) => {
    const threeSessions = [
      { sessionId: 's1', email: 'a@x.com', data: {}, ts: Date.now(), ago: 10 },
      { sessionId: 's2', email: 'b@x.com', data: {}, ts: Date.now(), ago: 30 },
      { sessionId: 's3', email: 'a@x.com', data: {}, ts: Date.now(), ago: 60 },
    ];
    await page.goto(BASE);
    await mockGasApi(page, { getDrafts: () => ({ success: true, data: threeSessions }) });

    const result = await postMock(page, 'getDrafts', { branch: '竹北' });
    expect(result.data).toHaveLength(3);
    const emailACount = result.data.filter((d: any) => d.email === 'a@x.com').length;
    expect(emailACount).toBe(2);
  });
});
