import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import {
  resolveTenantD1,
  tenantMiddleware,
} from '../src/middleware/tenant';
import { createTestD1Database } from './d1-test-harness';
import type { AppContext, WorkerEnv } from '../src/types/env';

describe('Empirical Challenger Suite: resolveTenantD1 Fail-Fast Security & Zero-Fallback', () => {
  let chupeiD1: any;
  let jinshanD1: any;
  let warehouseD1: any;
  let coordinatorD1: any;
  let env: WorkerEnv;

  beforeEach(() => {
    chupeiD1 = createTestD1Database().d1;
    jinshanD1 = createTestD1Database().d1;
    warehouseD1 = createTestD1Database().d1;
    coordinatorD1 = createTestD1Database().d1;

    env = {
      DB_CHUPEI: chupeiD1,
      DB_JINSHAN: jinshanD1,
      DB_WAREHOUSE: warehouseD1,
      DB_COORDINATOR: coordinatorD1,
    };
  });

  describe('Vector 1: Missing Header Rejection (Strict ERR_MISSING_STORE_ID & Zero Chupei Fallback)', () => {
    const missingPayloads = [
      { name: 'null return from header()', fn: () => null },
      { name: 'undefined return from header()', fn: () => undefined },
      { name: 'empty string "" return from header()', fn: () => '' },
      { name: 'req.header is undefined', fn: undefined },
      { name: 'context is completely empty object', fn: 'empty_context' },
    ];

    for (const testCase of missingPayloads) {
      it(`strictly rejects when ${testCase.name}`, () => {
        let mockCtx: any;
        if (testCase.fn === 'empty_context') {
          mockCtx = { env };
        } else if (testCase.fn === undefined) {
          mockCtx = { req: {}, env };
        } else {
          mockCtx = {
            req: {
              header: () => (testCase.fn as any)(),
            },
            env,
          };
        }

        let result: any = null;
        let thrownError: any = null;
        try {
          result = resolveTenantD1(mockCtx);
        } catch (err) {
          thrownError = err;
        }

        // Assertion 1: Must throw an error
        expect(thrownError).toBeDefined();
        expect(thrownError).not.toBeNull();
        expect(thrownError.message).toContain('ERR_MISSING_STORE_ID');

        // Assertion 2: Under no circumstances should result be populated with 'chupei'
        expect(result).toBeNull();
      });
    }
  });

  describe('Vector 2: Malicious & Invalid Header Attack Payloads (Strict ERR_INVALID_STORE_ID & Zero Chupei Fallback)', () => {
    const maliciousPayloads = [
      // Basic invalid strings
      'evil-store',
      'null',
      'undefined',
      'false',
      'true',
      '0',
      '1',
      'NaN',
      'Infinity',
      '[object Object]',
      '{"storeId":"chupei"}',

      // Whitespace and boundary escapes
      '   ',
      '\t\r\n',
      'chupei extra',
      'chupei\0',
      'chupei\u0000',
      'chupei\u200B',
      'ｃｈｕｐｅｉ', // Full-width unicode
      'CHUPEI_FAKE',

      // SQL Injection vectors
      "chupei; DROP TABLE orders; --",
      "chupei' OR 1=1 --",
      'chupei" OR ""="',
      "1; SELECT * FROM sqlite_master",
      "UNION SELECT * FROM stores",
      "' OR '1'='1",

      // Path Traversal & Command Injection vectors
      '../../chupei',
      '/etc/passwd',
      '..\\..\\chupei',
      '/chupei',
      'chupei/../jinshan',
      'chupei|cat /etc/passwd',
      '`chupei`',
      '$(whoami)',

      // Prototype Pollution vectors
      '__proto__',
      'constructor',
      'prototype',
      'toString',
      'valueOf',

      // Near-miss lookalikes
      'chupeii',
      'chupei-01',
      'chupei-retail',
      'chupeix',
      'jinshan-branch',
      'warehouse_main',
      'warehouse-extra',
      'taipei-101',
      'kaohsiung',
      'hsinchu',
    ];

    for (const payload of maliciousPayloads) {
      it(`strictly rejects payload: ${JSON.stringify(payload)}`, () => {
        const mockCtx = {
          req: {
            header: () => payload,
          },
          env,
        };

        let result: any = null;
        let thrownError: any = null;
        try {
          result = resolveTenantD1(mockCtx);
        } catch (err) {
          thrownError = err;
        }

        // Assertion 1: Must throw an error
        expect(thrownError).toBeDefined();
        expect(thrownError).not.toBeNull();

        // If payload is only whitespace, rawHeader might be trimmed or normalized
        if (payload.trim() === '') {
          // normalizeStoreId returns null for empty/whitespace string
          expect(thrownError.message).toContain('ERR_INVALID_STORE_ID');
        } else {
          expect(thrownError.message).toContain('ERR_INVALID_STORE_ID');
          expect(thrownError.message).toContain(payload);
        }

        // Assertion 2: Under no circumstances should result be populated with 'chupei' or any fallback
        expect(result).toBeNull();
      });
    }
  });

  describe('Vector 3: Valid Aliases Resolution & Database Binding Verification', () => {
    const validTestCases = [
      // Chupei aliases
      { alias: 'chupei', expectedStore: 'chupei', expectedDb: 'DB_CHUPEI' },
      { alias: 'CHUPEI', expectedStore: 'chupei', expectedDb: 'DB_CHUPEI' },
      { alias: 'cp01', expectedStore: 'chupei', expectedDb: 'DB_CHUPEI' },
      { alias: 'CP01', expectedStore: 'chupei', expectedDb: 'DB_CHUPEI' },
      { alias: '竹北', expectedStore: 'chupei', expectedDb: 'DB_CHUPEI' },
      { alias: '竹北旗艦店', expectedStore: 'chupei', expectedDb: 'DB_CHUPEI' },
      { alias: '  chupei  ', expectedStore: 'chupei', expectedDb: 'DB_CHUPEI' },

      // Jinshan aliases
      { alias: 'jinshan', expectedStore: 'jinshan', expectedDb: 'DB_JINSHAN' },
      { alias: 'JINSHAN', expectedStore: 'jinshan', expectedDb: 'DB_JINSHAN' },
      { alias: 'js01', expectedStore: 'jinshan', expectedDb: 'DB_JINSHAN' },
      { alias: 'JS01', expectedStore: 'jinshan', expectedDb: 'DB_JINSHAN' },
      { alias: '金山', expectedStore: 'jinshan', expectedDb: 'DB_JINSHAN' },
      { alias: '金山概念店', expectedStore: 'jinshan', expectedDb: 'DB_JINSHAN' },
      { alias: '  jinshan  ', expectedStore: 'jinshan', expectedDb: 'DB_JINSHAN' },

      // Warehouse aliases
      { alias: 'warehouse-main', expectedStore: 'warehouse-main', expectedDb: 'DB_WAREHOUSE' },
      { alias: 'warehouse', expectedStore: 'warehouse-main', expectedDb: 'DB_WAREHOUSE' },
      { alias: 'wh01', expectedStore: 'warehouse-main', expectedDb: 'DB_WAREHOUSE' },
      { alias: 'WH01', expectedStore: 'warehouse-main', expectedDb: 'DB_WAREHOUSE' },
      { alias: '總倉', expectedStore: 'warehouse-main', expectedDb: 'DB_WAREHOUSE' },
      { alias: '中央總倉', expectedStore: 'warehouse-main', expectedDb: 'DB_WAREHOUSE' },
      { alias: '  warehouse  ', expectedStore: 'warehouse-main', expectedDb: 'DB_WAREHOUSE' },
    ];

    for (const tc of validTestCases) {
      it(`correctly normalizes and binds alias: ${tc.alias} -> ${tc.expectedStore}`, () => {
        // Test with X-Store-Id
        const mockCtxUpper = {
          req: {
            header: (h: string) => (h === 'X-Store-Id' ? tc.alias : null),
          },
          env,
        };
        const resUpper = resolveTenantD1(mockCtxUpper);
        expect(resUpper.storeId).toBe(tc.expectedStore);
        expect(resUpper.rawStoreD1).toBe((env as any)[tc.expectedDb]);
        expect(resUpper.storeDb).toBeDefined();

        // Test with x-store-id (lowercase header)
        const mockCtxLower = {
          req: {
            header: (h: string) => (h === 'x-store-id' ? tc.alias : null),
          },
          env,
        };
        const resLower = resolveTenantD1(mockCtxLower);
        expect(resLower.storeId).toBe(tc.expectedStore);
        expect(resLower.rawStoreD1).toBe((env as any)[tc.expectedDb]);
        expect(resLower.storeDb).toBeDefined();
      });
    }
  });

  describe('Vector 4: Missing D1 Binding in WorkerEnv (Strict ERR_STORE_DB_UNAVAILABLE)', () => {
    it('throws ERR_STORE_DB_UNAVAILABLE when DB_CHUPEI is null', () => {
      const brokenEnv: WorkerEnv = {
        DB_CHUPEI: null as any,
        DB_JINSHAN: jinshanD1,
        DB_WAREHOUSE: warehouseD1,
        DB_COORDINATOR: coordinatorD1,
      };
      const mockCtx = {
        req: { header: () => 'chupei' },
        env: brokenEnv,
      };
      expect(() => resolveTenantD1(mockCtx)).toThrow('ERR_STORE_DB_UNAVAILABLE: D1 binding unavailable for store chupei');
    });

    it('throws ERR_STORE_DB_UNAVAILABLE when DB_JINSHAN is undefined', () => {
      const brokenEnv: WorkerEnv = {
        DB_CHUPEI: chupeiD1,
        DB_JINSHAN: undefined as any,
        DB_WAREHOUSE: warehouseD1,
        DB_COORDINATOR: coordinatorD1,
      };
      const mockCtx = {
        req: { header: () => 'jinshan' },
        env: brokenEnv,
      };
      expect(() => resolveTenantD1(mockCtx)).toThrow('ERR_STORE_DB_UNAVAILABLE: D1 binding unavailable for store jinshan');
    });

    it('throws ERR_STORE_DB_UNAVAILABLE when DB_WAREHOUSE is null', () => {
      const brokenEnv: WorkerEnv = {
        DB_CHUPEI: chupeiD1,
        DB_JINSHAN: jinshanD1,
        DB_WAREHOUSE: null as any,
        DB_COORDINATOR: coordinatorD1,
      };
      const mockCtx = {
        req: { header: () => 'warehouse-main' },
        env: brokenEnv,
      };
      expect(() => resolveTenantD1(mockCtx)).toThrow('ERR_STORE_DB_UNAVAILABLE: D1 binding unavailable for store warehouse-main');
    });
  });

  describe('Vector 5: Pre-set Context Cache Integrity', () => {
    it('respects pre-existing valid tenant without touching header', () => {
      const fakeTenant: any = {
        storeId: 'warehouse-main',
        storeDb: {} as any,
        coordinatorDb: {} as any,
        rawStoreD1: warehouseD1,
        rawCoordinatorD1: coordinatorD1,
      };

      const mockCtx = {
        get: (key: string) => (key === 'tenant' ? fakeTenant : undefined),
        req: {
          header: () => {
            throw new Error('HEADER_CALLED_WHEN_CACHE_EXISTS');
          },
        },
        env,
      };

      const resolved = resolveTenantD1(mockCtx);
      expect(resolved).toBe(fakeTenant);
      expect(resolved.storeId).toBe('warehouse-main');
    });
  });

  describe('Vector 6: HTTP-level tenantMiddleware Adversarial Simulation', () => {
    const buildApp = () => {
      const app = new Hono<AppContext>();
      app.use('*', tenantMiddleware({ required: true }));
      app.get('/api/test', (c) => c.json({ success: true, storeId: c.get('storeId') }));
      return app;
    };

    it('returns HTTP 400 ERR_MISSING_STORE_ID on missing header', async () => {
      const app = buildApp();
      const res = await app.request('/api/test', {}, env);
      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('ERR_MISSING_STORE_ID');
      expect(body.storeId).toBeUndefined();
    });

    it('returns HTTP 400 ERR_INVALID_STORE_ID on SQL injection header', async () => {
      const app = buildApp();
      const res = await app.request(
        '/api/test',
        { headers: { 'X-Store-Id': "chupei' OR '1'='1" } },
        env
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('ERR_INVALID_STORE_ID');
      expect(body.storeId).toBeUndefined();
    });

    it('returns HTTP 400 ERR_INVALID_STORE_ID on path traversal header', async () => {
      const app = buildApp();
      const res = await app.request(
        '/api/test',
        { headers: { 'X-Store-Id': '../../etc/passwd' } },
        env
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('ERR_INVALID_STORE_ID');
      expect(body.storeId).toBeUndefined();
    });

    it('returns HTTP 400 ERR_INVALID_STORE_ID on malicious store name "evil-store"', async () => {
      const app = buildApp();
      const res = await app.request(
        '/api/test',
        { headers: { 'X-Store-Id': 'evil-store' } },
        env
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('ERR_INVALID_STORE_ID');
      expect(body.storeId).toBeUndefined();
    });

    it('returns HTTP 200 and assigns correct storeId on valid store header', async () => {
      const app = buildApp();
      const res = await app.request(
        '/api/test',
        { headers: { 'X-Store-Id': 'jinshan' } },
        env
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.success).toBe(true);
      expect(body.storeId).toBe('jinshan');
    });
  });
});
