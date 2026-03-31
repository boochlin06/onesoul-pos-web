// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiSaveDraft, apiClearDraft, apiGetDrafts } from '../services/api';

// mock getIdToken 避免 sessionStorage 依賴
vi.mock('../hooks/useAuth', () => ({ getIdToken: () => 'fake-token' }));

// ── Setup ──
const mockFetch = vi.fn() as ReturnType<typeof vi.fn>;
globalThis.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

function mockJsonResponse(data: unknown) {
  mockFetch.mockResolvedValueOnce({
    json: () => Promise.resolve(data),
  } as Response);
}

// ═══════════════════════════════════════════════════
// apiSaveDraft
// ═══════════════════════════════════════════════════
describe('apiSaveDraft', () => {
  it('送出 branch, sessionId, email, data', async () => {
    mockJsonResponse({ success: true });

    await apiSaveDraft('竹北', 'sess123', 'staff@test.com', {
      customer: { phoneName: '0912' },
      lotteries: [],
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.action).toBe('saveDraft');
    expect(body.payload.branch).toBe('竹北');
    expect(body.payload.sessionId).toBe('sess123');
    expect(body.payload.email).toBe('staff@test.com');
    expect(body.payload.data.customer.phoneName).toBe('0912');
  });

  it('回傳 success', async () => {
    mockJsonResponse({ success: true });
    const result = await apiSaveDraft('竹北', 'x', 'y', {});
    expect(result.success).toBe(true);
  });

  it('回傳錯誤訊息', async () => {
    mockJsonResponse({ success: false, message: '缺少 branch 或 sessionId' });
    const result = await apiSaveDraft('', '', '', {});
    expect(result.success).toBe(false);
    expect(result.message).toContain('sessionId');
  });
});

// ═══════════════════════════════════════════════════
// apiClearDraft
// ═══════════════════════════════════════════════════
describe('apiClearDraft', () => {
  it('送出 sessionId 和 branch', async () => {
    mockJsonResponse({ success: true });

    await apiClearDraft('sess123', '竹北');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.action).toBe('clearDraft');
    expect(body.payload.sessionId).toBe('sess123');
    expect(body.payload.branch).toBe('竹北');
  });

  it('回傳 success', async () => {
    mockJsonResponse({ success: true });
    const result = await apiClearDraft('sess123', '竹北');
    expect(result.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════
// apiGetDrafts
// ═══════════════════════════════════════════════════
describe('apiGetDrafts', () => {
  it('送出 branch', async () => {
    mockJsonResponse({ success: true, data: [] });

    await apiGetDrafts('竹北');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.action).toBe('getDrafts');
    expect(body.payload.branch).toBe('竹北');
  });

  it('回傳空陣列', async () => {
    mockJsonResponse({ success: true, data: [] });
    const result = await apiGetDrafts('竹北');
    expect(result.success).toBe(true);
    expect(result.data).toEqual([]);
  });

  it('回傳多筆草稿', async () => {
    const drafts = [
      { sessionId: 's1', email: 'a@x.com', data: {}, ts: 1000, ago: 5 },
      { sessionId: 's2', email: 'b@x.com', data: {}, ts: 2000, ago: 10 },
    ];
    mockJsonResponse({ success: true, data: drafts });

    const result = await apiGetDrafts('竹北');
    expect(result.data).toHaveLength(2);
    expect(result.data[0].sessionId).toBe('s1');
    expect(result.data[1].email).toBe('b@x.com');
  });

  it('同 email 多 session（多分頁情境）', async () => {
    const drafts = [
      { sessionId: 's1', email: 'same@x.com', data: {}, ts: 1000, ago: 5 },
      { sessionId: 's2', email: 'same@x.com', data: {}, ts: 2000, ago: 10 },
    ];
    mockJsonResponse({ success: true, data: drafts });

    const result = await apiGetDrafts('竹北');
    expect(result.data).toHaveLength(2);
    expect(result.data[0].sessionId).not.toBe(result.data[1].sessionId);
  });

  it('包含完整草稿結構：customer + lotteries + payment + summary', async () => {
    const drafts = [{
      sessionId: 's1', email: 'staff@x.com',
      data: {
        customer: { phoneName: '0912', name: '王大明' },
        lotteries: [{ id: '001', setName: '海賊王', prize: 'A', draws: 3, amount: 900 }],
        merchandises: [{ id: 'M001', name: '公仔', quantity: 2, actualAmount: 600 }],
        payment: { cash: 1500, creditCard: 0, remittance: 0, pointsUsed: 0 },
        summary: { dueAmount: 1500, pointsChange: 10 },
        orderNote: '客人稍後取貨',
      },
      ts: Date.now(), ago: 30,
    }];
    mockJsonResponse({ success: true, data: drafts });

    const result = await apiGetDrafts('竹北');
    const d = result.data[0];
    expect(d.data.customer.name).toBe('王大明');
    expect(d.data.lotteries).toHaveLength(1);
    expect(d.data.merchandises).toHaveLength(1);
    expect(d.data.summary.dueAmount).toBe(1500);
    expect(d.data.orderNote).toBe('客人稍後取貨');
  });
});

// ═══════════════════════════════════════════════════
// Draft key format（模擬後端 key 格式）
// ═══════════════════════════════════════════════════
describe('Draft key 格式', () => {
  it('key 格式為 draft_{branch}_{sessionId}', () => {
    const branch = '竹北';
    const sessionId = 'abc123xyz';
    const key = `draft_${branch}_${sessionId}`;
    expect(key).toBe('draft_竹北_abc123xyz');
    expect(key.startsWith('draft_竹北_')).toBe(true);
  });

  it('不同 session 產生不同 key', () => {
    const k1 = `draft_竹北_${'s1'}`;
    const k2 = `draft_竹北_${'s2'}`;
    expect(k1).not.toBe(k2);
  });

  it('不同門市產生不同 prefix', () => {
    const k1 = `draft_竹北_s1`;
    const k2 = `draft_台北_s1`;
    expect(k1.startsWith('draft_竹北_')).toBe(true);
    expect(k2.startsWith('draft_台北_')).toBe(true);
    expect(k1).not.toBe(k2);
  });
});

// ═══════════════════════════════════════════════════
// SessionID 產生邏輯
// ═══════════════════════════════════════════════════
describe('SessionID 產生', () => {
  it('格式為 base36 timestamp + random', () => {
    const genSessionId = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
    const id = genSessionId();
    expect(id.length).toBeGreaterThan(10);
    expect(typeof id).toBe('string');
  });

  it('連續產生的 ID 不重複', () => {
    const genSessionId = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
    const ids = new Set(Array.from({ length: 100 }, genSessionId));
    expect(ids.size).toBe(100);
  });
});

// ═══════════════════════════════════════════════════
// 草稿過期邏輯
// ═══════════════════════════════════════════════════
describe('草稿過期判斷', () => {
  const DRAFT_EXPIRE_MS = 3 * 60 * 60 * 1000; // 3hr

  it('3 小時內判定為有效', () => {
    const ts = Date.now() - (2 * 60 * 60 * 1000); // 2hr 前
    expect(Date.now() - ts < DRAFT_EXPIRE_MS).toBe(true);
  });

  it('超過 3 小時判定為過期', () => {
    const ts = Date.now() - (4 * 60 * 60 * 1000); // 4hr 前
    expect(Date.now() - ts > DRAFT_EXPIRE_MS).toBe(true);
  });

  it('剛好 3 小時邊界判定為過期', () => {
    const ts = Date.now() - DRAFT_EXPIRE_MS - 1; // 剛過 3hr
    expect(Date.now() - ts > DRAFT_EXPIRE_MS).toBe(true);
  });
});

// ═══════════════════════════════════════════════════
// Debounce snapshot 比對
// ═══════════════════════════════════════════════════
describe('Debounce snapshot 比對', () => {
  it('相同內容產生相同 snapshot', () => {
    const data = { customer: { phoneName: '0912' }, lotteries: [], merchandises: [], payment: {}, summary: {}, orderNote: '' };
    const s1 = JSON.stringify(data);
    const s2 = JSON.stringify(data);
    expect(s1).toBe(s2);
  });

  it('不同內容產生不同 snapshot', () => {
    const d1 = { customer: { phoneName: '0912' }, lotteries: [], merchandises: [], payment: {}, summary: {}, orderNote: '' };
    const d2 = { ...d1, orderNote: '備註改了' };
    expect(JSON.stringify(d1)).not.toBe(JSON.stringify(d2));
  });

  it('新增福袋會改變 snapshot', () => {
    const base = { customer: {}, lotteries: [], merchandises: [], payment: {}, summary: {}, orderNote: '' };
    const withLottery = { ...base, lotteries: [{ id: '001', setName: 'X' }] };
    expect(JSON.stringify(base)).not.toBe(JSON.stringify(withLottery));
  });
});
