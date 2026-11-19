import { createMiddleware } from 'hono/factory';
import { createD1Client, type OneSoulD1Database } from '@onesoul/db';
import type { D1Database } from '@cloudflare/workers-types';
import type { AppContext, TenantStoreId, TenantContext, WorkerEnv } from '../types/env';

// WeakMap 快取以避免每次請求重複實例化 Drizzle Client
const clientCache = new WeakMap<D1Database, OneSoulD1Database>();

export function getOrCreateDrizzleClient(d1: D1Database): OneSoulD1Database {
  let client = clientCache.get(d1);
  if (!client) {
    client = createD1Client(d1);
    clientCache.set(d1, client);
  }
  return client;
}

/**
 * 門市識別碼正規化函式
 */
export function normalizeStoreId(input?: string | null): TenantStoreId | null {
  if (!input) return null;
  const clean = input.trim().toLowerCase();
  switch (clean) {
    case 'chupei':
    case 'cp01':
    case '竹北':
    case '竹北旗艦店':
      return 'chupei';
    case 'jinshan':
    case 'js01':
    case '金山':
    case '金山概念店':
      return 'jinshan';
    case 'warehouse-main':
    case 'warehouse':
    case 'wh01':
    case '總倉':
    case '中央總倉':
      return 'warehouse-main';
    default:
      return null;
  }
}

/**
 * 依據正規化門市 ID 解析對應的 D1 資料庫綁定
 */
export function resolveStoreD1Binding(env: WorkerEnv, storeId: TenantStoreId): D1Database | null {
  if (env.DB) {
    return env.DB;
  }
  switch (storeId) {
    case 'chupei':
      return env.DB_CHUPEI || null;
    case 'jinshan':
      return env.DB_JINSHAN || null;
    case 'warehouse-main':
      return env.DB_WAREHOUSE || null;
    default:
      return null;
  }
}

/**
 * 解析當前請求對應之租戶資料庫連線
 */
export function resolveTenantD1(c: any): TenantContext {
  const existing = c.get?.('tenant');
  if (existing) {
    return existing;
  }

  const rawHeader = c.req?.header?.('X-Store-Id') || c.req?.header?.('x-store-id');
  if (!rawHeader) {
    throw new Error('ERR_MISSING_STORE_ID: Missing required store ID in header (X-Store-Id)');
  }
  const normalized = normalizeStoreId(rawHeader);
  if (!normalized) {
    throw new Error(`ERR_INVALID_STORE_ID: Invalid store ID in header: ${rawHeader}`);
  }
  const env: WorkerEnv = c.env || {};
  const rawStoreD1 = resolveStoreD1Binding(env, normalized);
  if (!rawStoreD1) {
    throw new Error(`ERR_STORE_DB_UNAVAILABLE: D1 binding unavailable for store ${normalized}`);
  }
  const rawCoordinatorD1 = env.DB_COORDINATOR || rawStoreD1;

  const storeDb = getOrCreateDrizzleClient(rawStoreD1);
  const coordinatorDb = getOrCreateDrizzleClient(rawCoordinatorD1);

  return {
    storeId: normalized,
    storeDb,
    coordinatorDb,
    rawStoreD1,
    rawCoordinatorD1,
  };
}

/**
 * 租戶動態解析中介層 (Dynamic Tenant Resolver Middleware)
 * 驗證 X-Store-Id 標頭、綁定實體 D1 SQLite，並注入 Request Context
 */
export const tenantMiddleware = (options: { required?: boolean } = { required: true }) =>
  createMiddleware<AppContext>(async (c, next) => {
    const rawHeader = c.req.header('X-Store-Id') || c.req.header('x-store-id');
    const traceId = c.get('traceId') || crypto.randomUUID();

    // 1. 若標頭缺失
    if (!rawHeader) {
      if (!options.required) {
        // 全域無需特定門市的端點（如 /api/doc, /health），僅注入 coordinatorDb
        if (c.env.DB_COORDINATOR) {
          const coordDb = getOrCreateDrizzleClient(c.env.DB_COORDINATOR);
          c.set('coordinatorDb', coordDb);
        }
        return await next();
      }

      return c.json(
        {
          success: false,
          error: {
            code: 'ERR_MISSING_STORE_ID',
            message: '缺少必要門市標頭 (Missing required header: X-Store-Id)',
          },
          traceId,
        },
        400
      );
    }

    // 2. 正規化並檢查是否為合法門市
    const normalizedStoreId = normalizeStoreId(rawHeader);
    if (!normalizedStoreId) {
      return c.json(
        {
          success: false,
          error: {
            code: 'ERR_INVALID_STORE_ID',
            message: `無效或不支援的門市識別碼 (Invalid store ID: ${rawHeader})`,
          },
          traceId,
        },
        400
      );
    }

    // 3. 解析實體 D1 綁定
    const storeD1 = resolveStoreD1Binding(c.env, normalizedStoreId);
    if (!storeD1) {
      return c.json(
        {
          success: false,
          error: {
            code: 'ERR_STORE_DB_UNAVAILABLE',
            message: `門市資料庫連線未配置 (D1 binding unavailable for store: ${normalizedStoreId})`,
          },
          traceId,
        },
        500
      );
    }

    const coordinatorD1 = c.env.DB_COORDINATOR || storeD1;

    // 4. 取得快取的 Drizzle Clients
    const storeDb = getOrCreateDrizzleClient(storeD1);
    const coordinatorDb = getOrCreateDrizzleClient(coordinatorD1);

    const tenantContext: TenantContext = {
      storeId: normalizedStoreId,
      storeDb,
      coordinatorDb,
      rawStoreD1: storeD1,
      rawCoordinatorD1: coordinatorD1,
    };

    // 5. 注入 Context Variables
    c.set('tenant', tenantContext);
    c.set('storeId', normalizedStoreId);
    c.set('storeDb', storeDb);
    c.set('coordinatorDb', coordinatorDb);

    await next();
  });
