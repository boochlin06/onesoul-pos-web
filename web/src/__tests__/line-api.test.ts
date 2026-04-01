// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../hooks/useAuth', () => ({ getIdToken: () => 'fake-token' }));

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

import { apiGetLineChannels, apiSendLineMessage } from '../services/api';

// ═══════════════════════════════════════════════════
// apiGetLineChannels
// ═══════════════════════════════════════════════════
describe('apiGetLineChannels', () => {
  it('成功回傳 channel 清單', async () => {
    const channels = [
      { value: 'all', label: '全體通知群' },
      { value: 'admin', label: '老闆' },
    ];
    mockJsonResponse({ success: true, data: channels });

    const result = await apiGetLineChannels();
    expect(result.success).toBe(true);
    expect(result.data).toEqual(channels);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.action).toBe('getLineChannels');
  });

  it('後端回傳失敗', async () => {
    mockJsonResponse({ success: false, message: '無權限' });

    const result = await apiGetLineChannels();
    expect(result.success).toBe(false);
  });

  it('Sheet 沒有設定 → 回傳空陣列', async () => {
    mockJsonResponse({ success: true, data: [] });

    const result = await apiGetLineChannels();
    expect(result.data).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════
// apiSendLineMessage
// ═══════════════════════════════════════════════════
describe('apiSendLineMessage', () => {
  it('發送訊息帶 channel + message', async () => {
    mockJsonResponse({ success: true, message: '已發送到 [all]' });

    const result = await apiSendLineMessage('all', '測試訊息');
    expect(result.success).toBe(true);
    expect(result.message).toBe('已發送到 [all]');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.action).toBe('sendLineMessage');
    expect(body.payload.channel).toBe('all');
    expect(body.payload.message).toBe('測試訊息');
  });

  it('無權限 → 回傳失敗', async () => {
    mockJsonResponse({ success: false, message: '無權限發送 LINE 訊息' });

    const result = await apiSendLineMessage('all', 'test');
    expect(result.success).toBe(false);
    expect(result.message).toContain('無權限');
  });

  it('空 channel → 回傳失敗', async () => {
    mockJsonResponse({ success: false, message: '請選擇發送目標' });

    const result = await apiSendLineMessage('', 'test');
    expect(result.success).toBe(false);
  });

  it('空訊息 → 回傳失敗', async () => {
    mockJsonResponse({ success: false, message: '訊息內容不可為空' });

    const result = await apiSendLineMessage('admin', '');
    expect(result.success).toBe(false);
  });

  it('發送到不同 channel', async () => {
    mockJsonResponse({ success: true, message: '已發送到 [竹北]' });

    const result = await apiSendLineMessage('竹北', '竹北測試');
    expect(result.success).toBe(true);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.payload.channel).toBe('竹北');
  });

  it('fetch 失敗 → 拋出錯誤', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network Error'));

    await expect(apiSendLineMessage('all', 'test')).rejects.toThrow('Network Error');
  });
});

// ═══════════════════════════════════════════════════
// apiGetQuotaUsage
// ═══════════════════════════════════════════════════
import { apiGetQuotaUsage } from '../services/api';

describe('apiGetQuotaUsage', () => {
  it('成功回傳用量數據', async () => {
    const quotaData = {
      gasApiToday: 142,
      gasApiMonth: 3200,
      linePushToday: 3,
      lineReplyToday: 1,
      urlFetchToday: 4,
      linePushMonth: 15,
      linePushLimit: 200,
      urlFetchLimit: 20000,
    };
    mockJsonResponse({ success: true, data: quotaData });

    const result = await apiGetQuotaUsage();
    expect(result.success).toBe(true);
    expect(result.data).toEqual(quotaData);
    expect(result.data.linePushLimit).toBe(200);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.action).toBe('getQuotaUsage');
  });

  it('無權限 → 回傳失敗', async () => {
    mockJsonResponse({ success: false, message: '無權限' });

    const result = await apiGetQuotaUsage();
    expect(result.success).toBe(false);
  });
});
