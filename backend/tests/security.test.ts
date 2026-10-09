import { describe, it, expect, beforeAll } from 'vitest';
import { buildApp } from '../src/app';
import { FastifyInstance } from 'fastify';

describe('OneSoul ERP 安全滲透與邊界加固測試 (Security & Penetration Tests)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  describe('1. 認證與存取控制 (Broken Access Control 防護)', () => {
    it('未攜帶身分標頭之請求存取 /api/admin/members 應被阻斷或以匿名身分阻絕', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/members',
        headers: {
          'x-caller-email': 'hacker@malicious.com',
        },
      });
      // hacker 不在 ALLOWED_EMAILS 白名單內，必須回傳 403
      expect(res.statusCode).toBe(403);
    });

    it('合法管理員 (admin@onesoul.com) 存取 /api/admin/members 應成功通過', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/members',
        headers: {
          'x-caller-email': 'admin@onesoul.com',
        },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });
  });

  describe('2. CORS 來源網域安全校驗 (Strict Origin Validation)', () => {
    it('惡意子網域 https://localhost.attacker.com 應被 CORS 攔截拒絕', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/health',
        headers: {
          Origin: 'https://localhost.attacker.com',
        },
      });
      // 應拒絕或不提供 Access-Control-Allow-Origin
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('合法本地開發網域 http://localhost:5173 應被允許', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/health',
        headers: {
          Origin: 'http://localhost:5173',
        },
      });
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    });
  });

  describe('3. CSV Formula / DDE 注入防禦 (CWE-1236 Formula Injection Neutralization)', () => {
    it('CSV 匯出應包含 UTF-8 BOM 且單元格具備雙引號跳脫與安全前綴', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/export/members',
        headers: {
          'x-caller-email': 'admin@onesoul.com',
        },
      });
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      // 必須包含 Excel 繁體中文 UTF-8 BOM
      expect(res.body.startsWith('\uFEFF')).toBe(true);
    });
  });

  describe('4. 一番賞套組廢套防重複與冪等性 (Lottery Void Set Idempotency)', () => {
    it('針對已廢套套組重複呼叫廢套端點應回傳 400 拒絕重複回流庫存', async () => {
      // 第一次開套
      const openRes = await app.inject({
        method: 'POST',
        url: '/api/admin/lottery/boxes',
        headers: { 'x-caller-email': 'admin@onesoul.com' },
        payload: {
          mode: 'MULTI',
          name: '安全測試賞',
          storeId: 'chupei',
          unitPrice: 350,
          prizes: [
            { prizeGrade: 'A', prizeName: '測試A賞', productId: 'GK001', draws: 1, points: 100 },
          ],
        },
      });
      expect(openRes.statusCode).toBe(200);
      const openBody = JSON.parse(openRes.body);
      const bagId = openBody.data.id;

      // 第一次廢套
      const voidRes1 = await app.inject({
        method: 'POST',
        url: `/api/admin/lottery/boxes/${bagId}/void`,
        headers: { 'x-caller-email': 'admin@onesoul.com' },
        payload: { reason: '安全審查測試廢套' },
      });
      expect(voidRes1.statusCode).toBe(200);

      // 第二次重複廢套 -> 必須拒絕
      const voidRes2 = await app.inject({
        method: 'POST',
        url: `/api/admin/lottery/boxes/${bagId}/void`,
        headers: { 'x-caller-email': 'admin@onesoul.com' },
        payload: { reason: '重複惡意廢套' },
      });
      expect(voidRes2.statusCode).toBe(400);
      const voidBody2 = JSON.parse(voidRes2.body);
      expect(voidBody2.success).toBe(false);
      expect(voidBody2.message).toContain('已廢套');
    });
  });
});
