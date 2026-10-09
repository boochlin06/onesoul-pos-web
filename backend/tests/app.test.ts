import { describe, it, expect } from 'vitest';
import { buildApp } from '../src/app';

describe('Fastify Application & MASVS Security Headers', () => {
  it('GET /health 應回傳 200 與正常狀態', async () => {
    const app = buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeDefined();
  });

  it('MASVS-NETWORK: 應具備基礎安全防護標頭 (Helmet)', async () => {
    const app = buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(res.headers['x-dns-prefetch-control']).toBe('off');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['x-download-options']).toBe('noopen');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('MASVS-NETWORK: 許可的 CORS 來源應順利通過', async () => {
    const app = buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/health',
      headers: {
        origin: 'http://localhost:5173',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });
});
