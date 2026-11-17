import { createMiddleware } from 'hono/factory';
import type { AppContext } from '../types/env';

const SENSITIVE_KEY_REGEX = /^(password|passwd|secret|pin|token|authorization|cookie|apiKey|bearer)$/i;
const TAIWAN_PHONE_REGEX = /(?:\+?886|0)9\d{2}[- ]?\d{3}[- ]?\d{3}/g;
const CREDIT_CARD_REGEX = /\b(?:\d{4}[- ]?){3}\d{4}\b/g;

/**
 * 台灣手機號碼脫敏 (保留前 4 碼與後 3 碼，如 0912***678)
 * 排除散客代碼
 */
export function maskPhone(phone: string): string {
  if (!phone) return phone;
  const trimmed = phone.trim();
  if (['111111', '222222', '333333', '88888', '99999', 'WALKIN'].includes(trimmed.toUpperCase())) {
    return trimmed;
  }
  return trimmed.replace(TAIWAN_PHONE_REGEX, (match) => {
    const digits = match.replace(/[- ]/g, '');
    if (digits.length >= 10) {
      const prefix = digits.slice(0, 4);
      const suffix = digits.slice(-3);
      return `${prefix}***${suffix}`;
    }
    return match;
  });
}

/**
 * 信用卡卡號脫敏 (保留末 4 碼)
 */
export function maskCreditCard(card: string): string {
  return card.replace(CREDIT_CARD_REGEX, (match) => {
    const digits = match.replace(/[- ]/g, '');
    const last4 = digits.slice(-4);
    return `****-****-****-${last4}`;
  });
}

/**
 * 遞迴脫敏資料結構 (符合 OWASP MASVS-STORAGE 規範)
 */
export function sanitizeLogData(data: any, depth = 0, maxDepth = 4): any {
  if (data === null || data === undefined) return data;
  if (depth > maxDepth) return '[TRUNCATED_MAX_DEPTH]';

  if (typeof data === 'string') {
    let sanitized = maskPhone(data);
    sanitized = maskCreditCard(sanitized);
    if (/bearer\s+[a-z0-9_\-.]+/i.test(sanitized)) {
      sanitized = sanitized.replace(/bearer\s+[a-z0-9_\-.]+/gi, 'Bearer [REDACTED]');
    }
    return sanitized;
  }

  if (typeof data === 'number' || typeof data === 'boolean') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeLogData(item, depth + 1, maxDepth));
  }

  if (typeof data === 'object') {
    const clean: Record<string, any> = {};
    for (const [key, val] of Object.entries(data)) {
      if (SENSITIVE_KEY_REGEX.test(key)) {
        clean[key] = '[REDACTED]';
      } else {
        clean[key] = sanitizeLogData(val, depth + 1, maxDepth);
      }
    }
    return clean;
  }

  return String(data);
}

export interface StructuredLogPayload {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  requestId: string;
  traceId: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  storeId?: string | null;
  cfRay?: string | null;
  clientIp?: string | null;
  userAgent?: string | null;
  message: string;
  details?: any;
}

export function writeStructuredLog(payload: StructuredLogPayload): void {
  const line = JSON.stringify(payload);
  if (payload.level === 'error') {
    console.error(line);
  } else if (payload.level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

/**
 * 結構化邊緣日誌中介層
 */
export const loggerMiddleware = () =>
  createMiddleware<AppContext>(async (c, next) => {
    const method = c.req.method;
    const path = c.req.path;
    const startTime = c.get('startTime') || performance.now();
    const requestId = c.get('requestId') || c.get('traceId') || crypto.randomUUID();
    const cfRay = c.req.header('cf-ray') || null;
    const clientIp = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || null;
    const userAgent = c.req.header('user-agent') || null;

    try {
      await next();
    } finally {
      const durationMs = Math.round((performance.now() - startTime) * 100) / 100;
      const status = c.res.status;
      const storeId = c.get('storeId') || c.req.header('x-store-id') || null;

      let level: 'info' | 'warn' | 'error' = 'info';
      if (status >= 500) {
        level = 'error';
      } else if (status >= 400) {
        level = 'warn';
      }

      writeStructuredLog({
        timestamp: new Date().toISOString(),
        level,
        requestId,
        traceId: requestId,
        method,
        path,
        status,
        durationMs,
        storeId,
        cfRay,
        clientIp,
        userAgent,
        message: `HTTP ${method} ${path} ${status} - ${durationMs}ms`,
      });
    }
  });
