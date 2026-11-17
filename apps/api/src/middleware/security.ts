import { createMiddleware } from 'hono/factory';
import type { AppContext } from '../types/env';

/**
 * 來源白名單比對 (支援 Localhost, Cloudflare Pages *.pages.dev 及自訂網域)
 */
export function isAllowedOrigin(origin: string | undefined, allowedEnvString?: string): boolean {
  if (!origin) return true; // 非瀏覽器請求 (curl, Postman, server-to-server) 允許

  const clean = origin.trim();

  // 1. 本機開發環境
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:[0-9]+)?$/.test(clean)) {
    return true;
  }

  // 2. Cloudflare Pages 預覽與正式網域 (*.pages.dev)
  if (/^https:\/\/[a-zA-Z0-9_\-]+\.pages\.dev$/.test(clean)) {
    return true;
  }

  // 3. 環境變數額外配置之白名單清單 (逗號分隔)
  if (allowedEnvString) {
    const list = allowedEnvString.split(',').map((s) => s.trim().toLowerCase());
    if (list.includes(clean.toLowerCase())) {
      return true;
    }
  }

  return false;
}

/**
 * CORS 與安全防護標頭中介層 (MASVS-NETWORK Compliant)
 */
export const securityMiddleware = () =>
  createMiddleware<AppContext>(async (c, next) => {
    const origin = c.req.header('origin') || c.req.header('Origin');
    const allowed = isAllowedOrigin(origin, c.env?.ALLOWED_ORIGINS);

    // 處理 OPTIONS 預檢請求
    if (c.req.method === 'OPTIONS') {
      if (!allowed && origin) {
        return c.text('Forbidden CORS Origin', 403);
      }

      const headers: Record<string, string> = {
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers':
          'Content-Type, Authorization, X-Store-Id, x-store-id, X-Request-Id, x-request-id, X-Trace-Id, x-trace-id, X-Caller-Email, x-caller-email',
        'Access-Control-Expose-Headers': 'X-Request-Id, X-Trace-Id, CF-Ray',
        'Access-Control-Max-Age': '86400',
      };

      if (origin && allowed) {
        headers['Access-Control-Allow-Origin'] = origin;
        headers['Access-Control-Allow-Credentials'] = 'true';
      }

      return new Response(null, { status: 204, headers });
    }

    await next();

    // 注入 CORS 回應標頭
    if (origin && allowed) {
      c.res.headers.set('Access-Control-Allow-Origin', origin);
      c.res.headers.set('Access-Control-Allow-Credentials', 'true');
      c.res.headers.set('Access-Control-Expose-Headers', 'X-Request-Id, X-Trace-Id, CF-Ray');
    }

    // 注入 MASVS-NETWORK 核心安全標頭 (排除 Swagger UI HTML 端點)
    if (!c.req.path.startsWith('/api/docs')) {
      c.res.headers.set('X-Content-Type-Options', 'nosniff');
      c.res.headers.set('X-Frame-Options', 'DENY');
      c.res.headers.set('X-XSS-Protection', '0');
      c.res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
      c.res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
      if (c.req.url.startsWith('https://')) {
        c.res.headers.set(
          'Strict-Transport-Security',
          'max-age=31536000; includeSubDomains; preload'
        );
      }
    }
    return;
  });
