// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EdgePosClient } from '../services/edgeClient';

describe('EdgePosClient (Cloudflare Workers & Pages Integration)', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    mockFetch = vi.fn();
    globalThis.fetch = mockFetch;
  });

  function mockJsonResponse(data: unknown, status = 200) {
    mockFetch.mockResolvedValueOnce({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(data),
    } as Response);
  }

  it('預設租戶為 chupei，並於 Request 注入 X-Store-Id 標頭', async () => {
    mockJsonResponse({ status: 'ok' });
    const client = new EdgePosClient({ baseUrl: 'https://api.onesoul.tw' });

    await client.health();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.onesoul.tw/health');
    expect(options.headers['X-Store-Id']).toBe('chupei');
  });

  it('動態切換門市租戶 (金山)，自動同步至 localStorage 並反映於後續請求', async () => {
    mockJsonResponse({ success: true, data: [] });
    const client = new EdgePosClient({ baseUrl: 'https://api.onesoul.tw' });

    client.setStoreId('jinshan');
    expect(localStorage.getItem('onesoul_store_id')).toBe('jinshan');

    await client.getLuckyBags();
    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers['X-Store-Id']).toBe('jinshan');
  });

  it('結帳請求 (POST /api/v1/orders/checkout) 正確序列化 Payload', async () => {
    mockJsonResponse({ success: true, data: { orderId: 'ord-123' } });
    const client = new EdgePosClient({ baseUrl: 'https://api.onesoul.tw' });

    const payload = {
      checkoutUID: 'uid-test-1',
      customer: { phone: '0912345678', name: '王小明' },
      payment: { cash: 500, pointsUsed: 0 },
    };

    const res = await client.checkout(payload);
    expect(res.success).toBe(true);

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.onesoul.tw/api/v1/orders/checkout');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual(payload);
  });

  it('後端返回非 2xx 時，拋出語意化錯誤訊息', async () => {
    mockJsonResponse(
      {
        success: false,
        error: { code: 'INVARIANT_VIOLATION', message: '散客無會員帳號，嚴禁使用點數扣抵' },
      },
      400
    );

    const client = new EdgePosClient({ baseUrl: 'https://api.onesoul.tw' });

    await expect(
      client.checkout({ customer: { phone: '111111' }, payment: { pointsUsed: 10 } })
    ).rejects.toThrow('散客無會員帳號，嚴禁使用點數扣抵');
  });
});
