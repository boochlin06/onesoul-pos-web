import { describe, it, expect, beforeEach } from 'vitest';
import { createTestApp, type TestAppInstance } from './helpers/test-app';

describe('OpenAPI Specification & Swagger UI Tests', () => {
  let harness: TestAppInstance;

  beforeEach(() => {
    harness = createTestApp();
  });

  it('GET /api/doc 回傳合規 OpenAPI 3.1.0 JSON 規格文件', async () => {
    const res = await harness.request('/api/doc', { method: 'GET' }, '');
    expect(res.status).toBe(200);

    const doc = (await res.json()) as any;
    expect(doc.openapi).toBe('3.1.0');
    expect(doc.info.title).toContain('OneSoul');
    expect(doc.paths).toBeDefined();

    // 驗證核心業務路徑均存在於 OpenAPI 規格中
    expect(doc.paths['/health']).toBeDefined();
    expect(doc.paths['/api/v1/orders/checkout']).toBeDefined();
    expect(doc.paths['/api/v1/luckybags']).toBeDefined();
    expect(doc.paths['/api/v1/products']).toBeDefined();
    expect(doc.paths['/api/v1/members']).toBeDefined();
    expect(doc.paths['/api/v1/sessions/open']).toBeDefined();
    expect(doc.paths['/api/v1/stocktakes']).toBeDefined();
    expect(doc.paths['/api/admin/allocation/live-stock']).toBeDefined();
    expect(doc.paths['/api/admin/inventory/summary']).toBeDefined();
    expect(doc.paths['/api/admin/transfers']).toBeDefined();
    expect(doc.paths['/api/admin/preorders']).toBeDefined();
    expect(doc.paths['/api/admin/audit']).toBeDefined();
    expect(doc.paths['/api/admin/settings/brand']).toBeDefined();
  });

  it('GET /api/docs 回傳含有 Swagger UI 之 HTML 頁面', async () => {
    const res = await harness.request('/api/docs', { method: 'GET' }, '');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('swagger');
  });

  it('GET /health 回傳 200 與健康狀態', async () => {
    const res = await harness.request('/health', { method: 'GET' }, '');
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.status).toBe('ok');
    expect(json.timestamp).toBeDefined();
  });

  it('安全標頭中介層正確注入 MASVS-NETWORK 核心安全防護標頭', async () => {
    const res = await harness.request('/health', { method: 'GET' }, '');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(res.headers.get('Permissions-Policy')).toContain('camera=()');
    expect(res.headers.get('X-Request-Id')).toBeDefined();
    expect(res.headers.get('X-Trace-Id')).toBeDefined();
  });

  it('CORS OPTIONS 預檢請求正常響應 204 與 Access-Control 標頭', async () => {
    const res = await harness.request('/api/v1/products', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5173',
      },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
  });
});
