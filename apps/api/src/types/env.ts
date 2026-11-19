import type { D1Database, KVNamespace, R2Bucket, Queue } from '@cloudflare/workers-types';
import type { OneSoulD1Database } from '@onesoul/db';

export const VALID_STORE_IDS = ['chupei', 'jinshan', 'warehouse-main'] as const;
export type TenantStoreId = (typeof VALID_STORE_IDS)[number];

export interface TenantContext {
  storeId: TenantStoreId;
  storeDb: OneSoulD1Database;
  coordinatorDb: OneSoulD1Database;
  rawStoreD1: D1Database;
  rawCoordinatorD1: D1Database;
}

export interface WorkerEnv {
  // 單一 D1 資料庫 Binding ($0 architecture)
  DB?: D1Database;

  // 向下相容過渡綁定 (既有測試相容)
  DB_CHUPEI?: D1Database;
  DB_JINSHAN?: D1Database;
  DB_WAREHOUSE?: D1Database;
  DB_COORDINATOR?: D1Database;

  // KV Namespaces
  CONFIG_KV?: KVNamespace;
  SESSION_KV?: KVNamespace;

  // R2 Buckets
  ASSETS_BUCKET?: R2Bucket;

  // Queues (向下相容)
  ZREPORT_QUEUE?: Queue;
  TRANSFER_QUEUE?: Queue;

  // 環境變數與安全金鑰
  ENVIRONMENT?: string;
  DEFAULT_STORE_ID?: string;
  ALLOWED_ORIGINS?: string;
  AUDIT_SECRET?: string;
  CF_ACCESS_TEAM_NAME?: string;
  CF_ACCESS_AUD?: string;
  CF_ACCESS_JWKS?: string;
  CF_ACCESS_CERTS_URL?: string;
  LOG_LEVEL?: 'debug' | 'info' | 'warn' | 'error';
}

export interface AppVariables {
  traceId: string;
  requestId?: string;
  startTime?: number;
  callerEmail?: string;
  isAdmin?: boolean;
  tenant?: TenantContext;
  storeId?: TenantStoreId;
  storeDb?: OneSoulD1Database;
  coordinatorDb?: OneSoulD1Database;
  services?: any;
}

export interface AppContext {
  Bindings: WorkerEnv;
  Variables: AppVariables;
}
