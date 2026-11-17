/**
 * OneSoul Edge POS API Client (Cloudflare Workers & Pages)
 *
 * 專為 Cloudflare Pages 邊緣運行的 POS 收銀台打造，
 * 直連 Cloudflare Workers Edge Gateway (/api/v1/*)，
 * 具備 X-Store-Id 租戶動態隔離與 MASVS-NETWORK 安全標頭。
 */

export interface EdgeClientConfig {
  baseUrl?: string;
  storeId?: string;
  token?: string;
}

const DEFAULT_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:3000'
    : '');

export class EdgePosClient {
  private baseUrl: string;
  private storeId: string;
  private token?: string;

  constructor(config?: EdgeClientConfig) {
    this.baseUrl = (config?.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '');
    this.storeId = config?.storeId || (typeof window !== 'undefined' ? localStorage.getItem('onesoul_store_id') || 'chupei' : 'chupei');
    this.token = config?.token;
  }

  setStoreId(storeId: string) {
    this.storeId = storeId;
    if (typeof window !== 'undefined') {
      localStorage.setItem('onesoul_store_id', storeId);
    }
  }

  getStoreId(): string {
    return this.storeId;
  }

  private async request<T = any>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Store-Id': this.storeId,
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      ...((options.headers as Record<string, string>) || {}),
    };

    const res = await fetch(url, { ...options, headers });
    const data = await res.json();
    if (!res.ok) {
      const errMessage = data?.error?.message || data?.message || `HTTP ${res.status}`;
      throw new Error(errMessage);
    }
    return data;
  }

  health() {
    return this.request('/health');
  }

  checkout(payload: any) {
    return this.request('/api/v1/orders/checkout', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  getLuckyBags() {
    return this.request('/api/v1/luckybags');
  }

  getLuckyBagPrizes(luckyBagId: string) {
    return this.request(`/api/v1/luckybags/${luckyBagId}/prizes`);
  }

  getMember(phone: string) {
    return this.request(`/api/v1/members/${phone}`);
  }

  getProductCategories() {
    return this.request('/api/v1/products/categories');
  }

  lookupProducts(keyword: string) {
    return this.request(`/api/v1/products/lookup?keyword=${encodeURIComponent(keyword)}`);
  }

  openSession(payload: { openingCash: number; staffEmail?: string }) {
    return this.request('/api/v1/sessions/open', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  closeSession(payload: { actualCash: number; note?: string }) {
    return this.request('/api/v1/sessions/close', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
}

export const edgePosClient = new EdgePosClient();
