// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendPrintJob, PRINT_AGENT_URL, PRINT_TIMEOUT_MS } from '../services/printClient';

describe('printClient (POS Localhost Print Agent Client)', () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    globalThis.fetch = mockFetch;
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockReceipt = {
    orderId: 'ord-test-888',
    orderNumber: 'ord-test-888',
    storeId: 'chupei',
    items: [
      {
        type: 'lottery' as const,
        name: '海賊王一番賞',
        prize: 'A',
        prizeName: '魯夫模型',
        draws: 2,
        amount: 700,
      },
      {
        type: 'merchandise' as const,
        name: '泡泡瑪特盲盒',
        quantity: 1,
        amount: 300,
      },
    ],
    summary: {
      dueAmount: 1000,
      pointsChange: 10,
    },
    payment: {
      cash: 1000,
      receivedAmount: 1000,
      pointsUsed: 0,
    },
  };

  it('成功出單時發送 POST 請求至 127.0.0.1:18181/print，回傳 success: true', async () => {
    const mockPrintedAt = '2026-11-18T23:35:00.000Z';
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true, printedAt: mockPrintedAt }),
    } as Response);

    const result = await sendPrintJob(mockReceipt);

    expect(result.success).toBe(true);
    expect(result.printedAt).toBe(mockPrintedAt);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe(PRINT_AGENT_URL);
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');

    const parsedBody = JSON.parse(options.body);
    expect(parsedBody.orderId).toBe('ord-test-888');
    expect(parsedBody.storeId).toBe('chupei');
    expect(parsedBody.items).toHaveLength(2);
    expect(parsedBody.printedAt).toBeDefined();
  });

  it('若收據未提供 printedAt，自動注入當前 ISO 時間戳記', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true }),
    } as Response);

    const receiptWithoutTimestamp = { ...mockReceipt, printedAt: undefined };
    await sendPrintJob(receiptWithoutTimestamp);

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.printedAt).toBeDefined();
    expect(new Date(body.printedAt).getTime()).toBeGreaterThan(0);
  });

  it('當 Print Agent 回應非 2xx (如 500 錯誤) 時，非同步吞吐錯誤並回傳 success: false，絕不拋出例外', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Printer paper out / ESC/POS error'),
    } as Response);

    const result = await sendPrintJob(mockReceipt);

    expect(result.success).toBe(false);
    expect(result.error).toContain('HTTP 500');
    expect(consoleWarnSpy).toHaveBeenCalled();
  });

  it('當本機 Print Agent 未啟動 (網路連線被拒 / Failed to fetch) 時，安全捕獲並回傳 success: false', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch (ECONNREFUSED 127.0.0.1:18181)'));

    const result = await sendPrintJob(mockReceipt);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to fetch');
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[PrintClient] Non-blocking print failure')
    );
  });

  it('當出單請求超過 2 秒超時 (Timeout / AbortError) 時，捕獲超時並回傳語意化錯誤', async () => {
    const abortErr = new Error('The operation was aborted due to timeout');
    abortErr.name = 'TimeoutError';
    mockFetch.mockRejectedValueOnce(abortErr);

    const result = await sendPrintJob(mockReceipt);

    expect(result.success).toBe(false);
    expect(result.error).toContain('timed out');
    expect(consoleWarnSpy).toHaveBeenCalled();
  });

  it('不變量守衛：任何出單失敗皆為 non-blocking，絕不拋出例外中斷呼叫端流程', async () => {
    mockFetch.mockImplementationOnce(() => {
      throw new Error('Fatal socket collapse');
    });

    await expect(sendPrintJob(mockReceipt)).resolves.toEqual({
      success: false,
      error: 'Fatal socket collapse',
    });
  });
});
