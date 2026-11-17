import type { ErrorHandler, NotFoundHandler } from 'hono';
import { ZodError } from 'zod';
import {
  AppError,
  ValidationError,
  InvariantViolationError,
  NotFoundError,
  ConflictError,
  UnauthorizedError,
  ForbiddenError,
  InsufficientStockError,
  InsufficientPointsError,
  OverdrawError,
} from '@onesoul/shared';
import type { AppContext } from '../types/env';
import { sanitizeLogData, writeStructuredLog } from './logger';

/**
 * 散客點數穿透專屬領域例外 (Invariant #1)
 */
export class WalkInForbiddenError extends InvariantViolationError {
  constructor(message = '散客無會員帳號，嚴禁使用點數扣抵或抽取限定點數套，請先為顧客建檔綁定會員手機號碼。') {
    super(message, { code: 'WALK_IN_FORBIDDEN' });
    (this as any).code = 'WALK_IN_FORBIDDEN';
  }
}

/**
 * 併發衝突與資料庫鎖爭用例外 (Invariant #3)
 */
export class ConcurrencyError extends ConflictError {
  constructor(message = '門市交易併發衝突或資源鎖定逾時，請稍後重試。', details?: Record<string, unknown>) {
    super(message, details);
    (this as any).code = 'CONCURRENCY_ERROR';
  }
}

/**
 * 領域例外與 D1 原生約束狀態碼解析器
 */
export function resolveErrorHttpDetails(error: unknown): {
  statusCode: number;
  code: string;
  message: string;
  details?: any;
} {
  // 1. Zod 驗證錯誤
  if (error instanceof ZodError) {
    return {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: '請求參數格式驗證失敗',
      details: error.flatten(),
    };
  }

  // 2. 特殊領域例外
  if (error instanceof WalkInForbiddenError) {
    return {
      statusCode: 400,
      code: 'WALK_IN_FORBIDDEN',
      message: error.message,
      details: error.details,
    };
  }

  if (error instanceof ConcurrencyError) {
    return {
      statusCode: 409,
      code: 'CONCURRENCY_ERROR',
      message: error.message,
      details: error.details,
    };
  }

  if (error instanceof InsufficientStockError) {
    return {
      statusCode: 422,
      code: 'INSUFFICIENT_STOCK',
      message: error.message,
      details: error.details,
    };
  }

  if (error instanceof InsufficientPointsError) {
    return {
      statusCode: 422,
      code: 'INSUFFICIENT_POINTS',
      message: error.message,
      details: error.details,
    };
  }

  if (error instanceof OverdrawError) {
    return {
      statusCode: 422,
      code: 'OVERDRAW_ERROR',
      message: error.message,
      details: error.details,
    };
  }

  if (error instanceof InvariantViolationError) {
    return {
      statusCode: 400,
      code: error.code || 'INVARIANT_VIOLATION',
      message: error.message,
      details: error.details,
    };
  }

  if (error instanceof ValidationError) {
    return {
      statusCode: 400,
      code: error.code || 'VALIDATION_ERROR',
      message: error.message,
      details: error.details,
    };
  }

  if (error instanceof NotFoundError) {
    return {
      statusCode: 404,
      code: error.code || 'NOT_FOUND',
      message: error.message,
      details: error.details,
    };
  }

  if (error instanceof ConflictError) {
    return {
      statusCode: 409,
      code: error.code || 'CONFLICT',
      message: error.message,
      details: error.details,
    };
  }

  if (error instanceof UnauthorizedError) {
    return {
      statusCode: 401,
      code: error.code || 'UNAUTHORIZED',
      message: error.message,
      details: error.details,
    };
  }

  if (error instanceof ForbiddenError) {
    return {
      statusCode: 403,
      code: error.code || 'FORBIDDEN',
      message: error.message,
      details: error.details,
    };
  }

  if (error instanceof AppError) {
    return {
      statusCode: error.statusCode || 400,
      code: error.code || 'APP_ERROR',
      message: error.message,
      details: error.details,
    };
  }

  // 3. D1 SQLite 原生異常文字特徵轉譯
  const rawMsg = error instanceof Error ? error.message : String(error);

  if (rawMsg.includes('CHECK constraint failed') && rawMsg.includes('quantity >= 0')) {
    return {
      statusCode: 422,
      code: 'INSUFFICIENT_STOCK',
      message: '門市現貨不足，無法完成扣減。',
    };
  }

  if (rawMsg.includes('CHECK constraint failed') && rawMsg.includes('drawn_count <= draws')) {
    return {
      statusCode: 422,
      code: 'OVERDRAW_ERROR',
      message: '獎項抽數已達上限，不可超抽。',
    };
  }

  if (rawMsg.includes('UNIQUE constraint failed') && rawMsg.includes('checkout_uid')) {
    return {
      statusCode: 409,
      code: 'DUPLICATE_CHECKOUT',
      message: '重複結帳請求，此 checkoutUID 已經存在。',
    };
  }

  if (rawMsg.includes('SQLITE_BUSY') || rawMsg.includes('database is locked')) {
    return {
      statusCode: 409,
      code: 'CONCURRENCY_ERROR',
      message: '門市交易併發衝突，資料庫鎖定中，請稍後重試。',
    };
  }

  if (rawMsg.includes('FOREIGN KEY constraint failed')) {
    return {
      statusCode: 400,
      code: 'FOREIGN_KEY_VIOLATION',
      message: '關聯資料外鍵約束失敗，所引用的關聯實體不存在。',
    };
  }

  // 4. 預設 500 未預期錯誤
  return {
    statusCode: 500,
    code: 'INTERNAL_SERVER_ERROR',
    message: rawMsg || '系統發生內部錯誤，請聯繫技術支援。',
  };
}

/**
 * 全域例外處理器 (Global Error Handler)
 */
export const globalErrorHandler: ErrorHandler<AppContext> = (err, c) => {
  const traceId = c.get('traceId') || c.get('requestId') || crypto.randomUUID();
  const { statusCode, code, message, details } = resolveErrorHttpDetails(err);

  writeStructuredLog({
    timestamp: new Date().toISOString(),
    level: statusCode >= 500 ? 'error' : 'warn',
    requestId: traceId,
    traceId,
    method: c.req.method,
    path: c.req.path,
    status: statusCode,
    durationMs: Math.round((performance.now() - (c.get('startTime') || performance.now())) * 100) / 100,
    storeId: c.get('storeId') || null,
    message: `[ExceptionHandler] ${code}: ${message}`,
    details: sanitizeLogData({
      errorName: (err as any)?.name,
      stack: statusCode >= 500 ? (err as any)?.stack : undefined,
      rawDetails: details,
    }),
  });

  return c.json(
    {
      success: false as const,
      error: {
        code,
        message,
        ...(details ? { details: sanitizeLogData(details) } : {}),
      },
      traceId,
    },
    statusCode as any
  );
};

/**
 * 404 找不到端點處理器
 */
export const notFoundHandler: NotFoundHandler<AppContext> = (c) => {
  const traceId = c.get('traceId') || c.get('requestId') || crypto.randomUUID();
  return c.json(
    {
      success: false as const,
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: `端點不存在: [${c.req.method}] ${c.req.path}`,
      },
      traceId,
    },
    404
  );
};
