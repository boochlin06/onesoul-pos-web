import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { createApp } from '../src/app';
import { createTestD1Database } from './d1-test-harness';
import type { WorkerEnv } from '../src/types/env';
import { isAllowedOrigin } from '../src/middleware/security';
import { OrderSchema, CheckoutPaymentSchema, CheckoutPayloadSchema } from '@onesoul/shared';
import type { webcrypto } from 'node:crypto';

type CryptoKeyPair = webcrypto.CryptoKeyPair;

let testKeyPair: CryptoKeyPair;
let testJwk: any;

beforeAll(async () => {
  // 生成真實 2048-bit RSA 金鑰對
  testKeyPair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify']
  );
  testJwk = await crypto.subtle.exportKey('jwk', testKeyPair.publicKey);
  testJwk.kid = 'cf-access-key-1';
});

// Helper to forge mock JWT tokens with real cryptographic signatures for Cloudflare Access testing
async function createMockJwt(
  payload: Record<string, any>,
  headerOverrides?: Record<string, any>,
  rawSignatureOverride?: string
): Promise<string> {
  const header = { alg: 'RS256', typ: 'JWT', kid: 'cf-access-key-1', ...headerOverrides };
  const b64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  const b64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const data = new TextEncoder().encode(`${b64Header}.${b64Payload}`);

  if (rawSignatureOverride !== undefined) {
    const b64Sig = Buffer.from(rawSignatureOverride).toString('base64url');
    return `${b64Header}.${b64Payload}.${b64Sig}`;
  }

  const sigBuffer = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', testKeyPair.privateKey, data);
  const b64Sig = Buffer.from(sigBuffer).toString('base64url');
  return `${b64Header}.${b64Payload}.${b64Sig}`;
}

describe('Milestone 3 (R4): API Gateway Defense & Security Hardening', () => {
  let app: ReturnType<typeof createApp>;
  let baseEnv: WorkerEnv;

  beforeEach(() => {
    const chupei = createTestD1Database();
    chupei.seedCommonData();

    baseEnv = {
      DB_CHUPEI: chupei.d1,
      CF_ACCESS_AUD: 'onesoul-access-aud-prod',
      CF_ACCESS_TEAM_NAME: 'onesoul',
      CF_ACCESS_JWKS: JSON.stringify({ keys: [testJwk] }),
      ALLOWED_ORIGINS: 'https://staging.onesoul.tw,https://preview.onesoul.tw',
    };

    app = createApp();
  });

  // =========================================================================
  // 1. Cloudflare Access JWT Middleware (OWASP A01: Broken Access Control)
  // =========================================================================
  describe('1. Cloudflare Access JWT Middleware on /api/admin/* (OWASP A01)', () => {
    it('生產環境下未帶任何標頭存取 /api/admin/* 應優先回傳 401 Unauthorized (非 400)', async () => {
      const prodEnv: WorkerEnv = {
        ...baseEnv,
        ENVIRONMENT: 'production',
      };

      const res = await app.request(
        '/api/admin/allocation/live-stock',
        {
          method: 'GET',
          headers: {},
        },
        prodEnv
      );

      expect(res.status).toBe(401);
      const json = (await res.json()) as any;
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('ERR_UNAUTHORIZED');
      expect(json.error.message).toContain('缺少 Cloudflare Access JWT 憑證');
    });

    it('生產環境下未帶 JWT 憑證存取 /api/admin/* 應回傳 401 Unauthorized', async () => {
      const prodEnv: WorkerEnv = {
        ...baseEnv,
        ENVIRONMENT: 'production',
      };

      const res = await app.request(
        '/api/admin/allocation/live-stock',
        {
          method: 'GET',
          headers: {
            'X-Store-Id': 'chupei',
          },
        },
        prodEnv
      );

      expect(res.status).toBe(401);
      const json = (await res.json()) as any;
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('ERR_UNAUTHORIZED');
      expect(json.error.message).toContain('缺少 Cloudflare Access JWT 憑證');
    });

    it('生產環境下企圖偽造 X-Caller-Email 繞過認證應被硬阻斷為 401', async () => {
      const prodEnv: WorkerEnv = {
        ...baseEnv,
        ENVIRONMENT: 'production',
      };

      const res = await app.request(
        '/api/admin/allocation/live-stock',
        {
          method: 'GET',
          headers: {
            'X-Store-Id': 'chupei',
            'X-Caller-Email': 'attacker@malicious.com',
          },
        },
        prodEnv
      );

      expect(res.status).toBe(401);
      const json = (await res.json()) as any;
      expect(json.error.code).toBe('ERR_UNAUTHORIZED');
    });

    it('攜帶格式錯誤的 JWT 應回傳 403 Forbidden (ERR_INVALID_ACCESS_TOKEN)', async () => {
      const prodEnv: WorkerEnv = {
        ...baseEnv,
        ENVIRONMENT: 'production',
      };

      const res = await app.request(
        '/api/admin/allocation/live-stock',
        {
          method: 'GET',
          headers: {
            'X-Store-Id': 'chupei',
            'Cf-Access-Jwt-Assertion': 'malformed.jwt.token.extra.parts',
          },
        },
        prodEnv
      );

      expect(res.status).toBe(403);
      const json = (await res.json()) as any;
      expect(json.error.code).toBe('ERR_INVALID_ACCESS_TOKEN');
      expect(json.error.message).toContain('Invalid JWT format');
    });

    it('偽造或遭篡改之 RSA 簽名應被密碼學校驗拒絕 (403 ERR_INVALID_ACCESS_TOKEN)', async () => {
      const prodEnv: WorkerEnv = {
        ...baseEnv,
        ENVIRONMENT: 'production',
      };

      const futureTimestamp = Math.floor(Date.now() / 1000) + 3600;
      const forgedJwt = await createMockJwt(
        {
          email: 'admin@onesoul.tw',
          aud: 'onesoul-access-aud-prod',
          exp: futureTimestamp,
        },
        undefined,
        'forged-tampered-signature-data'
      );

      const res = await app.request(
        '/api/admin/allocation/live-stock',
        {
          method: 'GET',
          headers: {
            'X-Store-Id': 'chupei',
            'Cf-Access-Jwt-Assertion': forgedJwt,
          },
        },
        prodEnv
      );

      expect(res.status).toBe(403);
      const json = (await res.json()) as any;
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('ERR_INVALID_ACCESS_TOKEN');
      expect(json.error.message).toContain('簽章驗證失敗');
    });

    it('攜帶已過期之 Access JWT 應回傳 403 Forbidden (ERR_JWT_EXPIRED)', async () => {
      const prodEnv: WorkerEnv = {
        ...baseEnv,
        ENVIRONMENT: 'production',
      };

      const pastTimestamp = Math.floor(Date.now() / 1000) - 3600; // 1 小時前過期
      const expiredJwt = await createMockJwt({
        email: 'admin@onesoul.tw',
        aud: 'onesoul-access-aud-prod',
        exp: pastTimestamp,
      });

      const res = await app.request(
        '/api/admin/allocation/live-stock',
        {
          method: 'GET',
          headers: {
            'X-Store-Id': 'chupei',
            'Cf-Access-Jwt-Assertion': expiredJwt,
          },
        },
        prodEnv
      );

      expect(res.status).toBe(403);
      const json = (await res.json()) as any;
      expect(json.error.code).toBe('ERR_JWT_EXPIRED');
      expect(json.error.message).toContain('已過期');
    });

    it('JWT 之 exp 為 0 時 (邊界 Unix Epoch) 應嚴格判定為已過期 (403 ERR_JWT_EXPIRED)', async () => {
      const prodEnv: WorkerEnv = {
        ...baseEnv,
        ENVIRONMENT: 'production',
      };

      const jwtExpZero = await createMockJwt({
        email: 'admin@onesoul.tw',
        aud: 'onesoul-access-aud-prod',
        exp: 0,
      });

      const res = await app.request(
        '/api/admin/allocation/live-stock',
        {
          method: 'GET',
          headers: {
            'X-Store-Id': 'chupei',
            'Cf-Access-Jwt-Assertion': jwtExpZero,
          },
        },
        prodEnv
      );

      expect(res.status).toBe(403);
      const json = (await res.json()) as any;
      expect(json.error.code).toBe('ERR_JWT_EXPIRED');
    });

    it('JWT 完全未帶 exp 宣告時應判定為無效憑證 (403 ERR_INVALID_ACCESS_TOKEN)', async () => {
      const prodEnv: WorkerEnv = {
        ...baseEnv,
        ENVIRONMENT: 'production',
      };

      const jwtNoExp = await createMockJwt({
        email: 'admin@onesoul.tw',
        aud: 'onesoul-access-aud-prod',
      });

      const res = await app.request(
        '/api/admin/allocation/live-stock',
        {
          method: 'GET',
          headers: {
            'X-Store-Id': 'chupei',
            'Cf-Access-Jwt-Assertion': jwtNoExp,
          },
        },
        prodEnv
      );

      expect(res.status).toBe(403);
      const json = (await res.json()) as any;
      expect(json.error.code).toBe('ERR_INVALID_ACCESS_TOKEN');
      expect(json.error.message).toContain('exp');
    });

    it('JWT 攜帶非數值之 exp (如字串) 應判定為無效憑證 (403 ERR_INVALID_ACCESS_TOKEN)', async () => {
      const prodEnv: WorkerEnv = {
        ...baseEnv,
        ENVIRONMENT: 'production',
      };

      const jwtStringExp = await createMockJwt({
        email: 'admin@onesoul.tw',
        aud: 'onesoul-access-aud-prod',
        exp: 'never',
      });

      const res = await app.request(
        '/api/admin/allocation/live-stock',
        {
          method: 'GET',
          headers: {
            'X-Store-Id': 'chupei',
            'Cf-Access-Jwt-Assertion': jwtStringExp,
          },
        },
        prodEnv
      );

      expect(res.status).toBe(403);
      const json = (await res.json()) as any;
      expect(json.error.code).toBe('ERR_INVALID_ACCESS_TOKEN');
    });

    it('Audience 標籤不符時應回傳 403 Forbidden (ERR_AUDIENCE_MISMATCH)', async () => {
      const prodEnv: WorkerEnv = {
        ...baseEnv,
        ENVIRONMENT: 'production',
      };

      const futureTimestamp = Math.floor(Date.now() / 1000) + 3600;
      const mismatchJwt = await createMockJwt({
        email: 'admin@onesoul.tw',
        aud: 'other-unauthorized-app-aud',
        exp: futureTimestamp,
      });

      const res = await app.request(
        '/api/admin/allocation/live-stock',
        {
          method: 'GET',
          headers: {
            'X-Store-Id': 'chupei',
            'Cf-Access-Jwt-Assertion': mismatchJwt,
          },
        },
        prodEnv
      );

      expect(res.status).toBe(403);
      const json = (await res.json()) as any;
      expect(json.error.code).toBe('ERR_AUDIENCE_MISMATCH');
      expect(json.error.message).toContain('AUD 驗證失敗');
    });

    it('JWT 缺少 email 宣告時應回傳 403 Forbidden', async () => {
      const prodEnv: WorkerEnv = {
        ...baseEnv,
        ENVIRONMENT: 'production',
      };

      const futureTimestamp = Math.floor(Date.now() / 1000) + 3600;
      const noEmailJwt = await createMockJwt({
        aud: 'onesoul-access-aud-prod',
        exp: futureTimestamp,
      });

      const res = await app.request(
        '/api/admin/allocation/live-stock',
        {
          method: 'GET',
          headers: {
            'X-Store-Id': 'chupei',
            'Cf-Access-Jwt-Assertion': noEmailJwt,
          },
        },
        prodEnv
      );

      expect(res.status).toBe(403);
      const json = (await res.json()) as any;
      expect(json.error.code).toBe('ERR_INVALID_ACCESS_TOKEN');
      expect(json.error.message).toContain('Missing email claim');
    });

    it('有效 JWT 憑證應成功驗證並提取 callerEmail 放行存取', async () => {
      const prodEnv: WorkerEnv = {
        ...baseEnv,
        ENVIRONMENT: 'production',
      };

      const futureTimestamp = Math.floor(Date.now() / 1000) + 3600;
      const validJwt = await createMockJwt({
        email: 'manager@onesoul.tw',
        aud: 'onesoul-access-aud-prod',
        exp: futureTimestamp,
      });

      const res = await app.request(
        '/api/admin/allocation/live-stock',
        {
          method: 'GET',
          headers: {
            'X-Store-Id': 'chupei',
            'Cf-Access-Jwt-Assertion': validJwt,
          },
        },
        prodEnv
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.success).toBe(true);
    });

    it('有效 JWT 搭配陣列形式之 aud 宣告應成功通過', async () => {
      const prodEnv: WorkerEnv = {
        ...baseEnv,
        ENVIRONMENT: 'production',
      };

      const futureTimestamp = Math.floor(Date.now() / 1000) + 3600;
      const validArrayAudJwt = await createMockJwt({
        email: 'chief@onesoul.tw',
        aud: ['tag-1', 'onesoul-access-aud-prod', 'tag-2'],
        exp: futureTimestamp,
      });

      const res = await app.request(
        '/api/admin/allocation/live-stock',
        {
          method: 'GET',
          headers: {
            'X-Store-Id': 'chupei',
            'cf-access-jwt-assertion': validArrayAudJwt,
          },
        },
        prodEnv
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.success).toBe(true);
    });

    it('JWT Payload 包含 UTF-8 中文字元時應正常解析放行', async () => {
      const prodEnv: WorkerEnv = {
        ...baseEnv,
        ENVIRONMENT: 'production',
      };

      const futureTimestamp = Math.floor(Date.now() / 1000) + 3600;
      const utf8Jwt = await createMockJwt({
        email: '測試員@onesoul.tw',
        name: '張小明（總管理員）',
        aud: 'onesoul-access-aud-prod',
        exp: futureTimestamp,
      });

      const res = await app.request(
        '/api/admin/allocation/live-stock',
        {
          method: 'GET',
          headers: {
            'X-Store-Id': 'chupei',
            'Cf-Access-Jwt-Assertion': utf8Jwt,
          },
        },
        prodEnv
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.success).toBe(true);
    });

    it('測試環境下若傳入無效 JWT 仍嚴格拒絕 (403)，禁止偽造 X-Caller-Email 穿透', async () => {
      const testEnv: WorkerEnv = {
        ...baseEnv,
        ENVIRONMENT: 'test',
      };

      const pastTimestamp = Math.floor(Date.now() / 1000) - 3600;
      const expiredJwt = await createMockJwt({
        email: 'forged@attacker.com',
        aud: 'onesoul-access-aud-prod',
        exp: pastTimestamp,
      });

      const res = await app.request(
        '/api/admin/allocation/live-stock',
        {
          method: 'GET',
          headers: {
            'X-Store-Id': 'chupei',
            'Cf-Access-Jwt-Assertion': expiredJwt,
            'X-Caller-Email': 'bypass-attempt@onesoul.tw',
          },
        },
        testEnv
      );

      expect(res.status).toBe(403);
      const json = (await res.json()) as any;
      expect(json.error.code).toBe('ERR_JWT_EXPIRED');
    });

    it('測試環境下未帶 JWT 標頭時放行並使用預設管理員', async () => {
      const testEnv: WorkerEnv = {
        ...baseEnv,
        ENVIRONMENT: 'test',
      };

      const res = await app.request(
        '/api/admin/allocation/live-stock',
        {
          method: 'GET',
          headers: {
            'X-Store-Id': 'chupei',
          },
        },
        testEnv
      );

      expect(res.status).toBe(200);
    });
  });

  // =========================================================================
  // 2. Strict CORS Hardening (OWASP A01 / CORS Misconfiguration)
  // =========================================================================
  describe('2. Strict CORS Hardening (OWASP A01)', () => {
    it('isAllowedOrigin 應嚴格阻斷惡意 pages.dev 網域 (消除萬用正則破口)', () => {
      expect(isAllowedOrigin('https://malicious.pages.dev')).toBe(false);
      expect(isAllowedOrigin('https://attacker-fake.pages.dev')).toBe(false);
      expect(isAllowedOrigin('https://onesoul-fake.pages.dev')).toBe(false);
      expect(isAllowedOrigin('http://evil-site.com')).toBe(false);
    });

    it('isAllowedOrigin 應放行官方正式生產網域與本機開發環境', () => {
      // 官方生產網域
      expect(isAllowedOrigin('https://pos.onesoul.tw')).toBe(true);
      expect(isAllowedOrigin('https://admin.onesoul.tw')).toBe(true);

      // 本機開發環境
      expect(isAllowedOrigin('http://localhost:5173')).toBe(true);
      expect(isAllowedOrigin('http://localhost:5174')).toBe(true);
      expect(isAllowedOrigin('http://127.0.0.1:5173')).toBe(true);
      expect(isAllowedOrigin('http://127.0.0.1:18181')).toBe(true);

      // 環境變數設定之網域
      expect(isAllowedOrigin('https://staging.onesoul.tw', 'https://staging.onesoul.tw,https://preview.onesoul.tw')).toBe(true);
      expect(isAllowedOrigin('https://preview.onesoul.tw', 'https://staging.onesoul.tw,https://preview.onesoul.tw')).toBe(true);

      // 非瀏覽器請求 (origin 為 undefined)
      expect(isAllowedOrigin(undefined)).toBe(true);
    });

    it('OPTIONS 預檢請求遇到非白名單 Origin 應回傳 403 Forbidden', async () => {
      const res = await app.request(
        '/api/v1/products',
        {
          method: 'OPTIONS',
          headers: {
            Origin: 'https://malicious.pages.dev',
          },
        },
        baseEnv
      );

      expect(res.status).toBe(403);
      const text = await res.text();
      expect(text).toBe('Forbidden CORS Origin');
    });

    it('OPTIONS 預檢請求遇到合法 Origin 應回傳 204 並包含合規 CORS 標頭', async () => {
      const res = await app.request(
        '/api/v1/products',
        {
          method: 'OPTIONS',
          headers: {
            Origin: 'https://pos.onesoul.tw',
          },
        },
        baseEnv
      );

      expect(res.status).toBe(204);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://pos.onesoul.tw');
      expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
      expect(res.headers.get('Access-Control-Allow-Headers')).toContain('Cf-Access-Jwt-Assertion');
    });
  });

  // =========================================================================
  // 3. Elimination of In-Memory Map State (OWASP A07)
  // =========================================================================
  describe('3. Elimination of In-Memory Map State (OWASP A07)', () => {
    it('/api/v1/orders/drafts 端點已自路由完全移除，不再維護有狀態內存 Map', async () => {
      // 呼叫已被移除的草稿端點，應回傳 404
      const getDraftsRes = await app.request(
        '/api/v1/orders/drafts',
        {
          method: 'GET',
          headers: {
            'X-Store-Id': 'chupei',
          },
        },
        baseEnv
      );
      expect(getDraftsRes.status).toBe(404);

      const postDraftsRes = await app.request(
        '/api/v1/orders/drafts',
        {
          method: 'POST',
          headers: {
            'X-Store-Id': 'chupei',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ draftId: 'd-1', data: {} }),
        },
        baseEnv
      );
      expect(postDraftsRes.status).toBe(404);
    });
  });

  // =========================================================================
  // 4. Zod Schema .min(0) Hardening (OWASP A04: Insecure Design)
  // =========================================================================
  describe('4. Zod Schema .min(0) Hardening (OWASP A04)', () => {
    it('OrderSchema 應拒絕負數金額與點數欄位', () => {
      const baseValidOrder = {
        id: 'ord-001',
        checkoutUID: 'uid-001',
        storeId: 'chupei',
        sessionId: 'sess-001',
        status: 'COMPLETED' as const,
        totalDue: 100,
        receivedAmount: 100,
        cash: 100,
        creditCard: 0,
        linePay: 0,
        remittance: 0,
        pointsUsed: 0,
        netPointsDelta: 0,
        cashierEmail: 'cashier@onesoul.tw',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // 驗證正常合法訂單通過
      expect(() => OrderSchema.parse(baseValidOrder)).not.toThrow();

      // 負數 totalDue 拒絕
      expect(() => OrderSchema.parse({ ...baseValidOrder, totalDue: -1 })).toThrow();
      expect(() => OrderSchema.parse({ ...baseValidOrder, totalDue: -500 })).toThrow();

      // 負數 receivedAmount 拒絕
      expect(() => OrderSchema.parse({ ...baseValidOrder, receivedAmount: -100 })).toThrow();

      // 負數各支付金額拒絕
      expect(() => OrderSchema.parse({ ...baseValidOrder, cash: -50 })).toThrow();
      expect(() => OrderSchema.parse({ ...baseValidOrder, creditCard: -100 })).toThrow();
      expect(() => OrderSchema.parse({ ...baseValidOrder, linePay: -200 })).toThrow();
      expect(() => OrderSchema.parse({ ...baseValidOrder, remittance: -300 })).toThrow();

      // 負數 pointsUsed 拒絕 (杜絕無本鑄點漏洞)
      expect(() => OrderSchema.parse({ ...baseValidOrder, pointsUsed: -10 })).toThrow();
      expect(() => OrderSchema.parse({ ...baseValidOrder, pointsUsed: -1000 })).toThrow();

      // netPointsDelta 為淨變動差額：會員扣點折抵時為合法負整數，抽獎換點時為正整數
      expect(() => OrderSchema.parse({ ...baseValidOrder, netPointsDelta: -5 })).not.toThrow();
      expect(() => OrderSchema.parse({ ...baseValidOrder, netPointsDelta: -34 })).not.toThrow();
      expect(() => OrderSchema.parse({ ...baseValidOrder, netPointsDelta: 25 })).not.toThrow();

      // netPointsDelta 必須為整數，小數浮點數應被拒絕
      expect(() => OrderSchema.parse({ ...baseValidOrder, netPointsDelta: -5.5 })).toThrow();
      expect(() => OrderSchema.parse({ ...baseValidOrder, netPointsDelta: 3.14 })).toThrow();
    });

    it('CheckoutPaymentSchema 應拒絕負數現金與點數扣抵', () => {
      expect(() => CheckoutPaymentSchema.parse({ cash: -10 })).toThrow();
      expect(() => CheckoutPaymentSchema.parse({ creditCard: -20 })).toThrow();
      expect(() => CheckoutPaymentSchema.parse({ linePay: -30 })).toThrow();
      expect(() => CheckoutPaymentSchema.parse({ remittance: -40 })).toThrow();
      expect(() => CheckoutPaymentSchema.parse({ pointsUsed: -50 })).toThrow();
    });

    it('CheckoutPayloadSchema 應拒絕無效或負數支付設定', () => {
      expect(() =>
        CheckoutPayloadSchema.parse({
          storeId: 'chupei',
          customer: { phone: '0912345678' },
          payment: { cash: -100, pointsUsed: 0 },
          checkoutUID: 'uid-test-payload-neg',
          cashierEmail: 'cashier@onesoul.tw',
        })
      ).toThrow();
    });

    it('結帳 API 傳入負數 pointsUsed 應在 Zod 驗證層被 400 攔截', async () => {
      const res = await app.request(
        '/api/v1/orders/checkout',
        {
          method: 'POST',
          headers: {
            'X-Store-Id': 'chupei',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            storeId: 'chupei',
            customer: { phone: '0912345678', name: '王小明' },
            payment: {
              cash: 100,
              pointsUsed: -50, // 惡意負數點數
            },
            checkoutUID: 'uid-adversarial-neg-points',
            cashierEmail: 'cashier@onesoul.tw',
          }),
        },
        baseEnv
      );

      expect(res.status).toBe(400);
      const json = (await res.json()) as any;
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
