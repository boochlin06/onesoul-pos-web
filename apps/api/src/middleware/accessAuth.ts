import { createMiddleware } from 'hono/factory';
import type { AppContext, WorkerEnv } from '../types/env';
import type { webcrypto } from 'node:crypto';

type CryptoKey = webcrypto.CryptoKey;

export interface JWKKey {
  kty: string;
  kid?: string;
  use?: string;
  alg?: string;
  n?: string;
  e?: string;
  [key: string]: any;
}

export interface JWKSResponse {
  keys: JWKKey[];
}

// 模組層級公鑰快取 (TTL: 1 小時)
const keyCache = new Map<string, { key: CryptoKey; cachedAt: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000;

export function clearAccessKeyCache(): void {
  keyCache.clear();
}

/**
 * 將 Base64URL 字串轉換為 Uint8Array 位元組陣列
 */
export function base64UrlToBytes(str: string): Uint8Array {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * 具備完整 UTF-8 支援之 Base64URL 解碼器
 */
export function decodeBase64Url(str: string): string {
  if (typeof Buffer !== 'undefined') {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) base64 += '=';
    return Buffer.from(base64, 'base64').toString('utf-8');
  }
  return new TextDecoder('utf-8').decode(base64UrlToBytes(str));
}

/**
 * 取得並快取對應 kid 之 RSA 公鑰 (CryptoKey)
 */
async function getVerificationKey(kid: string, env: WorkerEnv): Promise<CryptoKey> {
  const cached = keyCache.get(kid);
  const now = Date.now();
  if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
    return cached.key;
  }

  let jwksData: JWKSResponse | null = null;

  // 1. 優先使用測試/模擬環境注入之 JWKS
  if (env.CF_ACCESS_JWKS) {
    try {
      jwksData =
        typeof env.CF_ACCESS_JWKS === 'string'
          ? JSON.parse(env.CF_ACCESS_JWKS)
          : (env.CF_ACCESS_JWKS as any);
    } catch {
      throw new Error('Malformed CF_ACCESS_JWKS environment variable');
    }
  } else {
    // 2. 生產環境：連線 Cloudflare Access Certs 端點
    const teamName = env.CF_ACCESS_TEAM_NAME;
    const certsUrl =
      env.CF_ACCESS_CERTS_URL ||
      (teamName ? `https://${teamName}.cloudflareaccess.com/cdn-cgi/access/certs` : null);

    if (!certsUrl) {
      throw new Error('缺少 Cloudflare Access JWKS 配置 (需設置 CF_ACCESS_TEAM_NAME 或 CF_ACCESS_JWKS)');
    }

    const res = await fetch(certsUrl);
    if (!res.ok) {
      throw new Error(`無法取得 Cloudflare Access JWKS (HTTP ${res.status})`);
    }
    jwksData = (await res.json()) as JWKSResponse;
  }

  if (!jwksData || !Array.isArray(jwksData.keys)) {
    throw new Error('JWKS 回應格式錯誤：缺少 keys 陣列');
  }

  const matchingKey = jwksData.keys.find((k) => k.kid === kid);
  if (!matchingKey) {
    throw new Error(`JWKS 中未找到符合之 Key ID (kid: ${kid})`);
  }

  if (matchingKey.kty !== 'RSA') {
    throw new Error(`不支援的金鑰型態 (kty: ${matchingKey.kty}, 預期 RSA)`);
  }

  const cryptoKey = await crypto.subtle.importKey(
    'jwk',
    {
      kty: 'RSA',
      n: matchingKey.n,
      e: matchingKey.e,
      alg: 'RS256',
      ext: true,
    },
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: { name: 'SHA-256' },
    },
    false,
    ['verify']
  );

  keyCache.set(kid, { key: cryptoKey, cachedAt: now });
  return cryptoKey;
}

/**
 * Cloudflare Access JWT (Zero Trust) 驗章中介層 (OWASP A01: Broken Access Control 防禦)
 * 攔截 /api/admin/* 端點，驗證 Cf-Access-Jwt-Assertion 標頭與 RS256 密碼學簽章
 */
export const accessAuthMiddleware = () =>
  createMiddleware<AppContext>(async (c, next) => {
    const jwt = c.req.header('Cf-Access-Jwt-Assertion') || c.req.header('cf-access-jwt-assertion');

    // 1. 測試環境向下相容：僅當明確配置 ENVIRONMENT === 'test' 且完全未攜帶 JWT assertion 時才允許測試放行
    if (c.env?.ENVIRONMENT === 'test' && !jwt) {
      const callerEmail = c.req.header('x-caller-email') || 'test-admin@onesoul.tw';
      c.set('callerEmail', callerEmail);
      c.set('isAdmin', true);
      return await next();
    }

    // 2. 缺少 JWT 憑證時回傳 401 Unauthorized
    if (!jwt) {
      return c.json(
        {
          success: false as const,
          error: {
            code: 'ERR_UNAUTHORIZED',
            message: '未授權存取：缺少 Cloudflare Access JWT 憑證 (Missing Cf-Access-Jwt-Assertion)',
          },
          traceId: c.get('traceId'),
        },
        401
      );
    }

    // 3. 結構與密碼學簽名校驗
    try {
      const parts = jwt.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format (expected 3 parts)');
      }

      // 3.1 驗證 Header
      let header: any;
      try {
        header = JSON.parse(decodeBase64Url(parts[0]));
      } catch {
        throw new Error('Malformed JWT header (invalid JSON)');
      }

      if (header.alg !== 'RS256') {
        throw new Error(`Unsupported JWT algorithm: ${header.alg} (expected RS256)`);
      }

      if (!header.kid || typeof header.kid !== 'string') {
        throw new Error('Missing or invalid kid in JWT header');
      }

      // 3.2 密碼學簽名驗證 (RS256)
      const dataBytes = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
      const sigBytes = base64UrlToBytes(parts[2]);
      const publicKey = await getVerificationKey(header.kid, c.env || {});

      const isSignatureValid = await crypto.subtle.verify(
        'RSASSA-PKCS1-v1_5',
        publicKey,
        sigBytes,
        dataBytes
      );

      if (!isSignatureValid) {
        return c.json(
          {
            success: false as const,
            error: {
              code: 'ERR_INVALID_ACCESS_TOKEN',
              message: 'Cloudflare Access JWT 簽章驗證失敗 (Signature verification failed)',
            },
            traceId: c.get('traceId'),
          },
          403
        );
      }

      // 3.3 驗證 Payload
      let payload: any;
      try {
        payload = JSON.parse(decodeBase64Url(parts[1]));
      } catch {
        throw new Error('Malformed JWT payload (invalid JSON)');
      }

      // 3.4 驗證過期時間 (exp) — 嚴格阻斷 exp 缺失、非數值或 exp <= now
      if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) {
        return c.json(
          {
            success: false as const,
            error: {
              code: 'ERR_INVALID_ACCESS_TOKEN',
              message: 'JWT 缺少有效的 exp 數值宣告',
            },
            traceId: c.get('traceId'),
          },
          403
        );
      }

      const now = Math.floor(Date.now() / 1000);
      if (payload.exp < now) {
        return c.json(
          {
            success: false as const,
            error: { code: 'ERR_JWT_EXPIRED', message: 'Cloudflare Access 憑證已過期' },
            traceId: c.get('traceId'),
          },
          403
        );
      }

      // 3.5 驗證 AUD 標籤 (若環境變數配置 CF_ACCESS_AUD)
      if (c.env?.CF_ACCESS_AUD) {
        const expectedAud = c.env.CF_ACCESS_AUD;
        const actualAud = payload.aud;
        const matches = Array.isArray(actualAud)
          ? actualAud.includes(expectedAud)
          : actualAud === expectedAud;

        if (!matches) {
          return c.json(
            {
              success: false as const,
              error: { code: 'ERR_AUDIENCE_MISMATCH', message: 'Cloudflare Access AUD 驗證失敗' },
              traceId: c.get('traceId'),
            },
            403
          );
        }
      }

      // 3.6 提取操作者信箱 (嚴格自已驗簽之 JWT 宣告讀取，禁止 Header 偽造提權)
      const email = payload.email || payload.identity?.email || payload.sub;
      if (!email || typeof email !== 'string') {
        throw new Error('Missing email claim in Access token');
      }

      c.set('callerEmail', email);
      c.set('isAdmin', true);
      return await next();
    } catch (err: any) {
      return c.json(
        {
          success: false as const,
          error: {
            code: 'ERR_INVALID_ACCESS_TOKEN',
            message: `無效的 Cloudflare Access 憑證: ${err.message}`,
          },
          traceId: c.get('traceId'),
        },
        403
      );
    }
  });
