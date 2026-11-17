import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import {
  normalizeStoreId,
  resolveStoreD1Binding,
  resolveTenantD1,
  tenantMiddleware,
  getOrCreateDrizzleClient,
} from '../src/middleware/tenant';
import { createTestD1Database } from './d1-test-harness';
import type { AppContext, WorkerEnv } from '../src/types/env';

describe('Tenant Resolver & Multi-Tenancy Middleware Test Suite', () => {
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

  describe('1. normalizeStoreId', () => {
    it('should normalize valid aliases for chupei', () => {
      expect(normalizeStoreId('chupei')).toBe('chupei');
      expect(normalizeStoreId('CHUPEI')).toBe('chupei');
      expect(normalizeStoreId('cp01')).toBe('chupei');
      expect(normalizeStoreId('CP01')).toBe('chupei');
      expect(normalizeStoreId('竹北')).toBe('chupei');
      expect(normalizeStoreId('竹北旗艦店')).toBe('chupei');
    });

    it('should normalize valid aliases for jinshan', () => {
      expect(normalizeStoreId('jinshan')).toBe('jinshan');
      expect(normalizeStoreId('JINSHAN')).toBe('jinshan');
      expect(normalizeStoreId('js01')).toBe('jinshan');
      expect(normalizeStoreId('JS01')).toBe('jinshan');
      expect(normalizeStoreId('金山')).toBe('jinshan');
      expect(normalizeStoreId('金山概念店')).toBe('jinshan');
    });

    it('should normalize valid aliases for warehouse', () => {
      expect(normalizeStoreId('warehouse-main')).toBe('warehouse-main');
      expect(normalizeStoreId('warehouse')).toBe('warehouse-main');
      expect(normalizeStoreId('wh01')).toBe('warehouse-main');
      expect(normalizeStoreId('WH01')).toBe('warehouse-main');
      expect(normalizeStoreId('總倉')).toBe('warehouse-main');
      expect(normalizeStoreId('中央總倉')).toBe('warehouse-main');
    });

    it('should return null for invalid or empty inputs', () => {
      expect(normalizeStoreId(null)).toBeNull();
      expect(normalizeStoreId(undefined)).toBeNull();
      expect(normalizeStoreId('')).toBeNull();
      expect(normalizeStoreId('unknown-store')).toBeNull();
      expect(normalizeStoreId('taipei-101')).toBeNull();
    });
  });

  describe('2. resolveStoreD1Binding', () => {
    it('should return corresponding D1 database binding', () => {
      expect(resolveStoreD1Binding(env, 'chupei')).toBe(chupeiD1);
      expect(resolveStoreD1Binding(env, 'jinshan')).toBe(jinshanD1);
      expect(resolveStoreD1Binding(env, 'warehouse-main')).toBe(warehouseD1);
    });

    it('should return null if binding is missing', () => {
      const emptyEnv = {} as WorkerEnv;
      expect(resolveStoreD1Binding(emptyEnv, 'chupei')).toBeNull();
    });
  });

  describe('3. WeakMap Client Caching', () => {
    it('should cache and reuse Drizzle instance for the same D1 binding', () => {
      const client1 = getOrCreateDrizzleClient(chupeiD1);
      const client2 = getOrCreateDrizzleClient(chupeiD1);
      expect(client1).toBe(client2); // Identity equality via WeakMap

      const jinshanClient = getOrCreateDrizzleClient(jinshanD1);
      expect(jinshanClient).not.toBe(client1);
    });
  });

  describe('4. tenantMiddleware in Hono', () => {
    const buildApp = (middlewareOpts?: { required?: boolean }) => {
      const app = new Hono<AppContext>();

      app.use('*', tenantMiddleware(middlewareOpts));

      app.get('/api/test/tenant', (c) => {
        const tenant = c.get('tenant');
        const storeId = c.get('storeId');
        return c.json({
          success: true,
          storeId: storeId ?? null,
          hasStoreDb: !!tenant?.storeDb,
          hasCoordinatorDb: !!c.get('coordinatorDb'),
        });
      });


      return app;
    };

    it('should reject request missing X-Store-Id with HTTP 400 ERR_MISSING_STORE_ID', async () => {
      const app = buildApp();
      const res = await app.request('/api/test/tenant', {}, env);

      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('ERR_MISSING_STORE_ID');
    });

    it('should reject request with invalid X-Store-Id with HTTP 400 ERR_INVALID_STORE_ID', async () => {
      const app = buildApp();
      const res = await app.request(
        '/api/test/tenant',
        {
          headers: { 'X-Store-Id': 'nonexistent-taipei-branch' },
        },
        env
      );

      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('ERR_INVALID_STORE_ID');
    });

    it('should return HTTP 500 ERR_STORE_DB_UNAVAILABLE if D1 binding is not configured in env', async () => {
      const app = buildApp();
      const partialEnv: WorkerEnv = {
        DB_CHUPEI: chupeiD1,
        // Missing DB_JINSHAN!
      } as any;

      const res = await app.request(
        '/api/test/tenant',
        {
          headers: { 'X-Store-Id': 'jinshan' },
        },
        partialEnv
      );

      expect(res.status).toBe(500);
      const body = (await res.json()) as any;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('ERR_STORE_DB_UNAVAILABLE');
    });

    it('should successfully resolve tenant and inject databases when X-Store-Id is valid', async () => {
      const app = buildApp();
      const res = await app.request(
        '/api/test/tenant',
        {
          headers: { 'X-Store-Id': 'CP01' },
        },
        env
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.success).toBe(true);
      expect(body.storeId).toBe('chupei');
      expect(body.hasStoreDb).toBe(true);
      expect(body.hasCoordinatorDb).toBe(true);
    });

    it('should allow optional store ID when required=false and inject coordinator DB', async () => {
      const app = buildApp({ required: false });
      const res = await app.request('/api/test/tenant', {}, env);

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.success).toBe(true);
    });
  });

  describe('5. resolveTenantD1 helper', () => {
    it('should extract tenant from mock context', () => {
      const mockContext = {
        req: {
          header: (name: string) => (name.toLowerCase() === 'x-store-id' ? 'jinshan' : null),
        },
        env,
      };

      const result = resolveTenantD1(mockContext);
      expect(result.storeId).toBe('jinshan');
      expect(result.storeDb).toBeDefined();
      expect(result.coordinatorDb).toBeDefined();
    });

    it('should throw ERR_MISSING_STORE_ID when header is missing', () => {
      const mockContext = {
        req: {
          header: () => null,
        },
        env,
      };
      expect(() => resolveTenantD1(mockContext)).toThrow('ERR_MISSING_STORE_ID');
    });

    it('should throw ERR_INVALID_STORE_ID when header is invalid', () => {
      const mockContext = {
        req: {
          header: () => 'invalid-store-xxx',
        },
        env,
      };
      expect(() => resolveTenantD1(mockContext)).toThrow('ERR_INVALID_STORE_ID');
    });
  });
});
