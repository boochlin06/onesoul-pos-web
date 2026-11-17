import { createMiddleware } from 'hono/factory';
import type { AppContext } from '../types/env';

/**
 * 鏈路追蹤與請求識別碼中介層 (Trace / Request ID Middleware)
 * 1. 優先繼承外層之 X-Request-Id, X-Trace-Id, CF-Ray
 * 2. 若皆無則透過 Web Crypto API 生成標準 UUID
 * 3. 注入 Context Variables 與 Response Headers
 */
export const traceMiddleware = () =>
  createMiddleware<AppContext>(async (c, next) => {
    const cfRay = c.req.header('cf-ray') || c.req.header('CF-Ray');
    const incomingRequestId =
      c.req.header('x-request-id') ||
      c.req.header('X-Request-Id') ||
      c.req.header('x-trace-id') ||
      c.req.header('X-Trace-Id');

    const requestId = incomingRequestId?.trim() || cfRay?.trim() || crypto.randomUUID();
    const startTime = performance.now();

    c.set('requestId', requestId);
    c.set('traceId', requestId);
    c.set('startTime', startTime);

    await next();

    c.res.headers.set('X-Request-Id', requestId);
    c.res.headers.set('X-Trace-Id', requestId);
    if (cfRay) {
      c.res.headers.set('CF-Ray', cfRay);
    }
  });
