import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'node:http';
import { createPrintServer, ALLOWED_PRINT_ORIGINS } from '../../../scripts/print-agent.mjs';

describe('Print Agent Daemon (PNA & Origin Whitelist Security)', () => {
  let server: Server;
  const TEST_PORT = 18199;
  const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

  beforeAll(async () => {
    server = createPrintServer();
    await new Promise<void>((resolve) => {
      server.listen(TEST_PORT, '127.0.0.1', () => resolve());
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it('白名單不包含萬用字元 *，僅包含受信任前端來源', () => {
    expect(ALLOWED_PRINT_ORIGINS.has('*')).toBe(false);
    expect(ALLOWED_PRINT_ORIGINS.has('http://localhost:5173')).toBe(true);
    expect(ALLOWED_PRINT_ORIGINS.has('http://localhost:5174')).toBe(true);
    expect(ALLOWED_PRINT_ORIGINS.has('https://boochlin06.github.io')).toBe(true);
  });

  it('非白名單 Origin (如 http://evil.com) 發送 OPTIONS 預檢請求時應被阻斷回傳 403 Forbidden', async () => {
    const res = await fetch(`${BASE_URL}/print`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://evil.com',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Private-Network': 'true',
      },
    });

    expect(res.status).toBe(403);
    const body = await res.json() as { success: boolean; error: string };
    expect(body.success).toBe(false);
    expect(body.error).toBe('Forbidden');
  });

  it('非白名單 Origin 發送 POST /print 嘗試惡意出單時，應立即被阻斷回傳 403 Forbidden', async () => {
    const res = await fetch(`${BASE_URL}/print`, {
      method: 'POST',
      headers: {
        'Origin': 'http://evil.com',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        orderId: 'attack-ord-001',
        items: [{ name: 'Malicious Print', amount: 0 }],
      }),
    });

    expect(res.status).toBe(403);
    const body = await res.json() as { success: boolean; error: string };
    expect(body.success).toBe(false);
    expect(body.error).toBe('Forbidden');
  });

  it('白名單 Origin (http://localhost:5173) 發送 OPTIONS 預檢請求時回傳 204 並注入完整 PNA 標頭', async () => {
    const res = await fetch(`${BASE_URL}/print`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:5173',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Private-Network': 'true',
      },
    });

    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
    expect(res.headers.get('Access-Control-Allow-Private-Network')).toBe('true');
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
  });

  it('白名單 Origin (http://localhost:5173) 發送 POST /print 成功出單並回傳 200 與 PNA 標頭', async () => {
    const res = await fetch(`${BASE_URL}/print`, {
      method: 'POST',
      headers: {
        'Origin': 'http://localhost:5173',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        orderId: 'ord-test-pna-001',
        storeId: 'chupei',
        items: [{ name: '測試商品', amount: 500 }],
      }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
    expect(res.headers.get('Access-Control-Allow-Private-Network')).toBe('true');
    const body = await res.json() as { success: boolean; orderId: string };
    expect(body.success).toBe(true);
    expect(body.orderId).toBe('ord-test-pna-001');
  });

  it('本地請求未帶 Origin (如本機 CLI / curl) 允許正常出單與健康檢查', async () => {
    const healthRes = await fetch(`${BASE_URL}/health`);
    expect(healthRes.status).toBe(200);
    const health = await healthRes.json() as { status: string; agent: string };
    expect(health.status).toBe('ok');
    expect(health.agent).toBe('onesoul-print-agent');
  });
});
