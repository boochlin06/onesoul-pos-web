/**
 * OneSoul POS Localhost Print Client
 *
 * 專為收銀機前端打造，向本機 Print Agent (127.0.0.1:18181) 發送熱感應出單請求。
 * 遵循 Chrome PNA (Private Network Access) 規範。
 * 具備 2 秒超時與非同步吞吐防護 (Fire-and-Forget / Non-Blocking)：
 * 出單機離線或 Agent 未啟動時絕不阻斷或回滾結帳！
 */

export interface PrintReceiptItem {
  type: 'lottery' | 'merchandise';
  name: string;
  prize?: string;
  prizeName?: string;
  draws?: number;
  quantity?: number;
  amount: number;
}

export interface PrintReceiptPayload {
  orderId: string;
  orderNumber?: string;
  storeId: string;
  items: PrintReceiptItem[];
  summary: {
    dueAmount: number;
    pointsChange?: number;
  };
  payment: {
    cash?: number;
    creditCard?: number;
    remittance?: number;
    linePay?: number;
    pointsUsed?: number;
    receivedAmount?: number;
  };
  printedAt?: string;
}

export interface PrintJobResult {
  success: boolean;
  printedAt?: string;
  error?: string;
}

export const PRINT_AGENT_URL = 'http://127.0.0.1:18181/print';
export const PRINT_TIMEOUT_MS = 2000;

/**
 * 建立具備超時之 AbortSignal (兼容標準 AbortSignal.timeout 與 AbortController 回退)
 */
function createTimeoutSignal(timeoutMs: number): { signal: AbortSignal; cleanup: () => void } {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return { signal: AbortSignal.timeout(timeoutMs), cleanup: () => {} };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new Error(`Print request timed out after ${timeoutMs}ms`));
  }, timeoutMs);
  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timer),
  };
}

/**
 * 發送出單工作至本機 Print Agent
 *
 * @param receipt 收據明細資料
 * @returns 出單結果，若失敗回傳 { success: false, error: string }，絕不拋出例外
 */
export async function sendPrintJob(receipt: PrintReceiptPayload | any): Promise<PrintJobResult> {
  const { signal, cleanup } = createTimeoutSignal(PRINT_TIMEOUT_MS);
  try {
    const res = await fetch(PRINT_AGENT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...receipt,
        printedAt: receipt?.printedAt || new Date().toISOString(),
      }),
      signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => `HTTP ${res.status}`);
      console.warn(`[PrintClient] Print Agent responded with status ${res.status}: ${errText}`);
      return {
        success: false,
        error: `Print Agent error: HTTP ${res.status}`,
      };
    }

    const data = await res.json().catch(() => ({ success: true }));
    return {
      success: true,
      printedAt: data.printedAt || new Date().toISOString(),
    };
  } catch (err: any) {
    const isTimeout =
      err?.name === 'TimeoutError' ||
      err?.name === 'AbortError' ||
      err?.message?.includes('timed out');
    const errorMsg = isTimeout
      ? 'Print Agent request timed out (2s)'
      : (err?.message || 'Print Agent unreachable');
    console.warn(`[PrintClient] Non-blocking print failure: ${errorMsg}`);
    return {
      success: false,
      error: errorMsg,
    };
  } finally {
    cleanup();
  }
}
