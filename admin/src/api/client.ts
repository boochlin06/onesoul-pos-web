// OneSoul Admin API Client
const API_BASE = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:3000/api'
  : '/api';

export async function apiRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const headers = {
    'Content-Type': 'application/json',
    'x-caller-email': 'admin@onesoul.com',
    ...(options.headers || {}),
  };

  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    let errorMsg = `HTTP ${res.status}: ${res.statusText}`;
    try {
      const errJson = await res.json();
      errorMsg = errJson.message || errorMsg;
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }
  return res.json();
}

// ── 會員 API ──────────────────────────────────────────────────
export const membersApi = {
  list: (params: { q?: string; tier?: string; page?: number; pageSize?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.q) query.set('q', params.q);
    if (params.tier) query.set('tier', params.tier);
    if (params.page) query.set('page', String(params.page));
    if (params.pageSize) query.set('pageSize', String(params.pageSize));
    return apiRequest(`/admin/members?${query.toString()}`);
  },
  adjustPoints: (id: string, delta: number, reason: string) => {
    return apiRequest(`/admin/members/${id}/adjust-points`, {
      method: 'POST',
      body: JSON.stringify({ delta, reason }),
    });
  },
  history: (id: string) => apiRequest(`/admin/members/${id}/history`),
};

// ── 庫存與商品 API ──────────────────────────────────────────────
export const inventoryApi = {
  summary: (params: { q?: string; category?: string; lowStockOnly?: boolean; page?: number; pageSize?: number; sortBy?: string; sortOrder?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.q) query.set('q', params.q);
    if (params.category) query.set('category', params.category);
    if (params.lowStockOnly) query.set('lowStockOnly', 'true');
    if (params.page !== undefined) query.set('page', String(params.page));
    if (params.pageSize !== undefined) query.set('pageSize', String(params.pageSize));
    if (params.sortBy) query.set('sortBy', params.sortBy);
    if (params.sortOrder) query.set('sortOrder', params.sortOrder);
    return apiRequest(`/admin/inventory/summary?${query.toString()}`);
  },
  createProduct: (data: any) => {
    return apiRequest('/admin/inventory/products', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  updateProduct: (id: string, data: any) => {
    return apiRequest(`/admin/inventory/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  adjustStock: (storeId: string, productId: string, delta: number, reason: string) => {
    return apiRequest('/admin/inventory/adjust-stock', {
      method: 'POST',
      body: JSON.stringify({ storeId, productId, delta, reason }),
    });
  },
  bulkImport: (items: any[]) => {
    return apiRequest('/admin/inventory/products/bulk-import', {
      method: 'POST',
      body: JSON.stringify({ items }),
    });
  },
};

// ── 一番賞 API ──────────────────────────────────────────────────
export const lotteryApi = {
  simulate: (unitPrice: number, prizes: Array<{ grade: string; name: string; cost: number; draws: number }>) => {
    return apiRequest('/admin/lottery/simulate', {
      method: 'POST',
      body: JSON.stringify({ unitPrice, prizes }),
    });
  },
  overview: (paramsOrStoreId?: string | { storeId?: string; filter?: string; search?: string }) => {
    const query = new URLSearchParams();
    if (typeof paramsOrStoreId === 'string') {
      if (paramsOrStoreId) query.set('storeId', paramsOrStoreId);
    } else if (paramsOrStoreId) {
      if (paramsOrStoreId.storeId) query.set('storeId', paramsOrStoreId.storeId);
      if (paramsOrStoreId.filter) query.set('filter', paramsOrStoreId.filter);
      if (paramsOrStoreId.search) query.set('search', paramsOrStoreId.search);
    }
    const qs = query.toString();
    return apiRequest(`/admin/lottery/overview${qs ? `?${qs}` : ''}`);
  },
  updateBox: (id: string, data: any) => {
    return apiRequest(`/admin/lottery/boxes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
  updatePrize: (id: string, data: any) => {
    return apiRequest(`/admin/lottery/prizes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
  togglePrize: (id: string) => {
    return apiRequest(`/admin/lottery/prizes/${id}/toggle`, {
      method: 'POST',
    });
  },
  addPrize: (boxId: string, data: any) => {
    return apiRequest(`/admin/lottery/boxes/${boxId}/prizes`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  deletePrize: (id: string) => {
    return apiRequest(`/admin/lottery/prizes/${id}`, {
      method: 'DELETE',
    });
  },
  createBox: (data: any) => {
    return apiRequest('/admin/lottery/boxes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  voidBox: (id: string, reason: string) => {
    return apiRequest(`/admin/lottery/boxes/${id}/void`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },
};

// ── 報表與銷售 API ──────────────────────────────────────────────
export const reportsApi = {
  sales: (params: { storeId?: string; startDate?: string; endDate?: string; paymentMethod?: string; page?: number; pageSize?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.storeId) query.set('storeId', params.storeId);
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);
    if (params.paymentMethod) query.set('paymentMethod', params.paymentMethod);
    if (params.page) query.set('page', String(params.page));
    if (params.pageSize) query.set('pageSize', String(params.pageSize));
    return apiRequest(`/admin/reports/sales?${query.toString()}`);
  },
  analytics: (storeId?: string, days = '7') => {
    const query = new URLSearchParams();
    if (storeId) query.set('storeId', storeId);
    query.set('days', days);
    return apiRequest(`/admin/reports/analytics?${query.toString()}`);
  },
  voidOrder: (id: string, voidReason: string) => {
    return apiRequest(`/admin/reports/orders/${id}/void`, {
      method: 'POST',
      body: JSON.stringify({ voidReason }),
    });
  },
  getExportUrl: (resource: 'members' | 'inventory' | 'sales' | 'audit-logs') => {
    return `${API_BASE}/admin/export/${resource}`;
  },
};

// ── 班表考勤 API ────────────────────────────────────────────────
export const scheduleApi = {
  getMonth: (storeId: string, yearMonth: string) => {
    return apiRequest(`/admin/schedule/month?storeId=${storeId}&yearMonth=${yearMonth}`);
  },
  batchUpdate: (storeId: string, days: Array<{ date: string; staffName: string; staffEmail?: string; shiftType: string; isClosed?: boolean; note?: string }>) => {
    return apiRequest('/admin/schedule/days', {
      method: 'PUT',
      body: JSON.stringify({ storeId, days }),
    });
  },
  clockIn: (storeId: string, staffName: string, clockInTime?: string) => {
    return apiRequest('/admin/attendance/clock-in', {
      method: 'POST',
      body: JSON.stringify({ storeId, staffName, clockInTime }),
    });
  },
  listAttendance: (storeId?: string, date?: string) => {
    const query = new URLSearchParams();
    if (storeId) query.set('storeId', storeId);
    if (date) query.set('date', date);
    return apiRequest(`/admin/attendance/records?${query.toString()}`);
  },
};

// ── 系統設定與公告 API ──────────────────────────────────────────
export const settingsApi = {
  getIntegrations: () => apiRequest('/admin/settings/integrations'),
  saveIntegration: (key: string, value: any, description?: string, isEnabled = true) => {
    return apiRequest('/admin/settings/integrations', {
      method: 'PUT',
      body: JSON.stringify({ key, value, description, isEnabled }),
    });
  },
  publishNotice: (data: { title: string; content: string; level?: string; targetStoreIds?: string[] }) => {
    return apiRequest('/admin/settings/emergency-notices', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  getNotices: () => apiRequest('/admin/settings/emergency-notices'),
};

// ── 審計日誌 API ────────────────────────────────────────────────
export const auditApi = {
  list: (params: { targetType?: string; targetId?: string; operatorId?: string; take?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.targetType) query.set('targetType', params.targetType);
    if (params.targetId) query.set('targetId', params.targetId);
    if (params.operatorId) query.set('operatorId', params.operatorId);
    if (params.take) query.set('take', String(params.take));
    return apiRequest(`/admin/audit-logs?${query.toString()}`);
  },
};

// ── 開關帳與盤點 API (來自 v1 POS 核心端點) ────────────────────
export const posCoreApi = {
  getSessions: (storeId?: string) => apiRequest(`/v1/sessions/current${storeId ? `?storeId=${storeId}` : ''}`),
  getStocktakes: () => apiRequest('/v1/stocktakes'),
  getStores: () => apiRequest('/v1/stores'),
};

// ── Google Sheets 全量一鍵極速遷移 API ──────────────────────────
export const migrationApi = {
  getStatus: () => apiRequest('/admin/migration/status'),
  runMigration: (options: { dryRun?: boolean; source?: string } = {}) => {
    return apiRequest('/admin/migration/run', {
      method: 'POST',
      body: JSON.stringify(options),
    });
  },
  getHistory: () => apiRequest('/admin/migration/history'),
  getProgressStreamUrl: () => `${API_BASE}/admin/migration/progress`,
};
