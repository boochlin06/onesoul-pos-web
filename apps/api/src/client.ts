import { hc } from 'hono/client';
import type { AppType } from './routes';

export type { AppType };

export interface OneSoulClientOptions {
  getStoreId?: () => string | null | undefined;
  getToken?: () => string | null | undefined;
  fetch?: typeof fetch;
  headers?: Record<string, string> | (() => Record<string, string>);
}

/**
 * 建立具備 100% 端到端型別安全約束之 OneSoul 邊緣 API Client
 */
export function createOneSoulClient(baseUrl: string, options?: OneSoulClientOptions) {
  return hc<AppType>(baseUrl, {
    fetch: options?.fetch,
    headers: () => {
      const customHeaders =
        typeof options?.headers === 'function'
          ? options.headers()
          : options?.headers || {};

      const headers: Record<string, string> = { ...customHeaders };
      const storeId = options?.getStoreId?.();
      if (storeId) {
        headers['X-Store-Id'] = storeId;
      }
      const token = options?.getToken?.();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      return headers;
    },
  });
}

export type OneSoulClient = ReturnType<typeof createOneSoulClient>;
