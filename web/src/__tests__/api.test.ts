import { describe, it, expect, vi, beforeEach } from 'vitest';
import { gasPost } from '../services/api';

// ── Setup ──
const mockFetch = global.fetch as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockFetch.mockReset();
});

function mockJsonResponse(data: unknown) {
  mockFetch.mockResolvedValueOnce({
    json: () => Promise.resolve(data),
  } as Response);
}

// ═══════════════════════════════════════════════════
// gasPost — 底層 fetch wrapper
// ═══════════════════════════════════════════════════
describe('gasPost', () => {
  it('發送 POST 帶 action + payload + apiKey + idToken', async () => {
    mockJsonResponse({ success: true });

    await gasPost('testAction', { foo: 'bar' });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(options.method).toBe('POST');

    const body = JSON.parse(options.body);
    expect(body.action).toBe('testAction');
    expect(body.payload).toEqual({ foo: 'bar' });
    expect(body.apiKey).toBeDefined();
  });

  it('無 payload 時送空物件', async () => {
    mockJsonResponse({ success: true });

    await gasPost('noPayload');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.payload).toEqual({});
  });

  it('回傳 JSON 結果', async () => {
    mockJsonResponse({ success: true, data: [1, 2, 3] });

    const result = await gasPost('test');
    expect(result).toEqual({ success: true, data: [1, 2, 3] });
  });

  it('fetch 失敗 → 拋出錯誤', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network Error'));

    await expect(gasPost('fail')).rejects.toThrow('Network Error');
  });
});

// ═══════════════════════════════════════════════════
// API 函數測試 — 驗證回傳值轉換
// ═══════════════════════════════════════════════════
import {
  apiGetAllMembers,
  apiGetPrizeLibrary,
  apiGetStockList,
  apiGetBlindBoxList,
} from '../services/api';

describe('API 回傳值轉換', () => {
  it('apiGetAllMembers 成功 → 回傳 data', async () => {
    const mockData = [{ phone: '0912', name: '王' }];
    mockJsonResponse({ success: true, data: mockData });

    const result = await apiGetAllMembers();
    expect(result).toEqual(mockData);
  });

  it('apiGetAllMembers 失敗 → 回傳空陣列', async () => {
    mockJsonResponse({ success: false, message: 'err' });

    const result = await apiGetAllMembers();
    expect(result).toEqual([]);
  });

  it('apiGetAllMembers data 為空 → 回傳空陣列', async () => {
    mockJsonResponse({ success: true, data: [] });

    const result = await apiGetAllMembers();
    expect(result).toEqual([]);
  });

  it('apiGetPrizeLibrary 成功 → 回傳 data', async () => {
    const mockData = [{ setId: 'S1', prize: 'A' }];
    mockJsonResponse({ success: true, data: mockData });

    const result = await apiGetPrizeLibrary();
    expect(result).toEqual(mockData);
  });

  it('apiGetPrizeLibrary 失敗 → 空陣列', async () => {
    mockJsonResponse({ success: false });

    const result = await apiGetPrizeLibrary();
    expect(result).toEqual([]);
  });

  it('apiGetStockList 帶 branch', async () => {
    mockJsonResponse({ success: true, data: [{ id: '001' }] });

    const result = await apiGetStockList('竹北');
    expect(result).toEqual([{ id: '001' }]);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.payload.branch).toBe('竹北');
  });

  it('apiGetBlindBoxList 成功', async () => {
    mockJsonResponse({ success: true, data: [{ id: 'BB001' }] });

    const result = await apiGetBlindBoxList();
    expect(result).toEqual([{ id: 'BB001' }]);
  });
});
