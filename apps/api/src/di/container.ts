import type { Context } from 'hono';
import type { Result, AppError } from '@onesoul/shared';
import type { AppContext, TenantContext } from '../types/env';
import { resolveTenantD1 } from '../middleware/tenant';

// Core Ports
import type {
  OrderRepository,
  InventoryRepository,
  LuckyBagRepository,
  MemberRepository,
  SessionRepository,
  TransferRepository,
  StocktakeRepository,
  PreOrderRepository,
  AuditRepository,
  SettingsRepository,
  TransactionManager,
} from '../core/ports';

// D1 Adapters
import {
  D1TransactionManager,
  D1OrderRepository,
  D1InventoryRepository,
  D1LuckyBagRepository,
  D1MemberRepository,
  D1SessionRepository,
  D1TransferRepository,
  D1StocktakeRepository,
  D1PreOrderRepository,
  D1AuditRepository,
  D1SettingsRepository,
} from '../adapters/d1';

// Domain Use Cases
import {
  CheckoutUseCase,
  AllocationUseCase,
  InventoryUseCase,
  MemberUseCase,
  SessionUseCase,
  PreOrderUseCase,
  AuditUseCase,
} from '../core/usecases';

export interface AppRepositories {
  order: OrderRepository;
  inventory: InventoryRepository;
  luckyBag: LuckyBagRepository;
  member: MemberRepository;
  session: SessionRepository;
  transfer: TransferRepository;
  stocktake: StocktakeRepository;
  preOrder: PreOrderRepository;
  audit: AuditRepository;
  settings: SettingsRepository;
}

export interface AppUseCases {
  checkout: CheckoutUseCase;
  allocation: AllocationUseCase;
  inventory: InventoryUseCase;
  member: MemberUseCase;
  session: SessionUseCase;
  preOrder: PreOrderUseCase;
  audit: AuditUseCase;
}

export interface AppServices {
  tenant: TenantContext;
  txManager: TransactionManager;
  repos: AppRepositories;
  useCases: AppUseCases;
}

/**
 * 依據當前請求之租戶資料庫連線，合成依賴注入樹
 */
export function createCompositionRoot(tenant: TenantContext): AppServices {
  const db = tenant.storeDb;
  const txManager = new D1TransactionManager(db);

  // 1. Outbound Adapters (10 D1 Repositories)
  const orderRepo = new D1OrderRepository(db);
  const inventoryRepo = new D1InventoryRepository(db);
  const luckyBagRepo = new D1LuckyBagRepository(db);
  const memberRepo = new D1MemberRepository(db);
  const sessionRepo = new D1SessionRepository(db);
  const transferRepo = new D1TransferRepository(db);
  const stocktakeRepo = new D1StocktakeRepository(db);
  const preOrderRepo = new D1PreOrderRepository(db);
  const auditRepo = new D1AuditRepository(db);
  const settingsRepo = new D1SettingsRepository(db);

  // 2. Application Core (7 Use Cases)
  const checkout = new CheckoutUseCase(
    orderRepo,
    inventoryRepo,
    luckyBagRepo,
    memberRepo,
    sessionRepo,
    txManager
  );

  const allocation = new AllocationUseCase(
    luckyBagRepo,
    inventoryRepo,
    txManager
  );

  const inventory = new InventoryUseCase(
    inventoryRepo,
    transferRepo,
    stocktakeRepo,
    auditRepo,
    txManager
  );

  const member = new MemberUseCase(
    memberRepo,
    orderRepo,
    auditRepo,
    txManager
  );

  const session = new SessionUseCase(
    sessionRepo,
    orderRepo,
    auditRepo,
    txManager
  );

  const preOrder = new PreOrderUseCase(
    preOrderRepo,
    inventoryRepo,
    auditRepo,
    txManager
  );

  const audit = new AuditUseCase(auditRepo);

  return {
    tenant,
    txManager,
    repos: {
      order: orderRepo,
      inventory: inventoryRepo,
      luckyBag: luckyBagRepo,
      member: memberRepo,
      session: sessionRepo,
      transfer: transferRepo,
      stocktake: stocktakeRepo,
      preOrder: preOrderRepo,
      audit: auditRepo,
      settings: settingsRepo,
    },
    useCases: {
      checkout,
      allocation,
      inventory,
      member,
      session,
      preOrder,
      audit,
    },
  };
}

/**
 * 在 Hono 請求上下文中解析或獲取快取的 Services
 */
export function getServices(c: Context<AppContext>): AppServices {
  let services = c.get('services');
  if (!services) {
    const tenant = resolveTenantD1(c);
    services = createCompositionRoot(tenant);
    c.set('services', services);
  }
  return services;
}

/**
 * 統一 Result Pattern 回應處理器
 */
export function handleResult<T>(
  c: Context<AppContext>,
  result: Result<T, AppError>,
  successStatusCode: 200 | 201 = 200
): any {
  const traceId = c.get('traceId') || crypto.randomUUID();

  if (result.success) {
    return c.json(
      {
        success: true as const,
        data: result.data,
        traceId,
      },
      successStatusCode
    );
  }

  const { error } = result;
  return c.json(
    {
      success: false as const,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
      traceId,
    },
    (error.statusCode || 400) as any
  );
}
