import { describe, it, expect, beforeEach } from 'vitest';
import { createOneSoulClient } from '../src/client';
import { createTestApp, type TestAppInstance } from './helpers/test-app';

describe('Challenger M4 Adversarial Contract & Client RPC Test Suite', () => {
  let harness: TestAppInstance;

  beforeEach(() => {
    harness = createTestApp();
  });

  // Helper to create an RPC client directly wired to the test app instance
  function createDirectClient(options?: {
    storeId?: string | null;
    token?: string | null;
    customHeaders?: Record<string, string> | (() => Record<string, string>);
  }) {
    return createOneSoulClient('http://localhost', {
      fetch: async (input, init) => {
        const urlStr = typeof input === 'string' ? input : 'url' in input ? input.url : input.toString();
        const urlObj = new URL(urlStr);
        const pathWithQuery = urlObj.pathname + urlObj.search;
        return harness.app.request(pathWithQuery, init, harness.env);
      },
      getStoreId: () => options?.storeId !== undefined ? options.storeId : 'chupei',
      getToken: () => options?.token !== undefined ? options.token : 'test-jwt-token-12345',
      headers: options?.customHeaders,
    });
  }

  // =========================================================================
  // Section 1: Type-Safe Client RPC Header Injection & Construction
  // =========================================================================
  describe('1. Client RPC Header Injection & Construction', () => {
    it('動態注入 X-Store-Id 與 Bearer Token', async () => {
      let recordedHeaders: Headers | null = null;
      const client = createOneSoulClient('http://localhost', {
        fetch: async (input, init) => {
          const headers = new Headers(init?.headers);
          recordedHeaders = headers;
          const urlStr = typeof input === 'string' ? input : 'url' in input ? input.url : input.toString();
          const urlObj = new URL(urlStr);
          return harness.app.request(urlObj.pathname + urlObj.search, init, harness.env);
        },
        getStoreId: () => 'jinshan',
        getToken: () => 'secure-auth-token-xyz',
      });

      const res = await client.health.$get();
      expect(res.status).toBe(200);
      expect(recordedHeaders).not.toBeNull();
      expect(recordedHeaders!.get('X-Store-Id')).toBe('jinshan');
      expect(recordedHeaders!.get('Authorization')).toBe('Bearer secure-auth-token-xyz');
    });

    it('支援自訂靜態 Headers 物件傳遞', async () => {
      let recordedHeaders: Headers | null = null;
      const client = createOneSoulClient('http://localhost', {
        fetch: async (input, init) => {
          recordedHeaders = new Headers(init?.headers);
          const urlStr = typeof input === 'string' ? input : 'url' in input ? input.url : input.toString();
          return harness.app.request(new URL(urlStr).pathname, init, harness.env);
        },
        getStoreId: () => 'chupei',
        headers: {
          'X-Client-Version': '1.0.0-rc1',
          'X-Correlation-Id': 'corr-abc-999',
        },
      });

      await client.health.$get();
      expect(recordedHeaders!.get('X-Client-Version')).toBe('1.0.0-rc1');
      expect(recordedHeaders!.get('X-Correlation-Id')).toBe('corr-abc-999');
      expect(recordedHeaders!.get('X-Store-Id')).toBe('chupei');
    });

    it('支援自訂動態 Headers 函數求值', async () => {
      let counter = 0;
      let recordedHeaders: Headers | null = null;
      const client = createOneSoulClient('http://localhost', {
        fetch: async (input, init) => {
          recordedHeaders = new Headers(init?.headers);
          const urlStr = typeof input === 'string' ? input : 'url' in input ? input.url : input.toString();
          return harness.app.request(new URL(urlStr).pathname, init, harness.env);
        },
        headers: () => ({
          'X-Request-Sequence': String(++counter),
        }),
      });

      await client.health.$get();
      expect(recordedHeaders!.get('X-Request-Sequence')).toBe('1');
      await client.health.$get();
      expect(recordedHeaders!.get('X-Request-Sequence')).toBe('2');
    });

    it('當無 storeId 與 token 時，不發送對應標頭', async () => {
      let recordedHeaders: Headers | null = null;
      const client = createOneSoulClient('http://localhost', {
        fetch: async (input, init) => {
          recordedHeaders = new Headers(init?.headers);
          const urlStr = typeof input === 'string' ? input : 'url' in input ? input.url : input.toString();
          return harness.app.request(new URL(urlStr).pathname, init, harness.env);
        },
        getStoreId: () => null,
        getToken: () => undefined,
      });

      await client.health.$get();
      expect(recordedHeaders!.has('X-Store-Id')).toBe(false);
      expect(recordedHeaders!.has('Authorization')).toBe(false);
    });
  });

  // =========================================================================
  // Section 2: RPC Query, Path, Body & Response Type Safety
  // =========================================================================
  describe('2. RPC Query, Path, Body & Response Type Safety', () => {
    it('Query Parameters 序列化與型別推導驗證', async () => {
      const client = createDirectClient({ storeId: 'chupei' });

      // 測試商品關鍵字與分類查詢
      const res = await client.api.v1.products.$get({
        query: {
          search: 'GK',
          category: 'GK雕像',
        },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      if (json.success) {
        expect(Array.isArray(json.data)).toBe(true);
      }

      // 測試會員關鍵字查詢
      const memberRes = await client.api.v1.members.$get({
        query: {
          search: '0912',
        },
      });
      expect(memberRes.status).toBe(200);
      const memberJson = await memberRes.json();
      expect(memberJson.success).toBe(true);
    });

    it('Path Parameters 序列化與動態路徑推導驗證', async () => {
      const client = createDirectClient({ storeId: 'chupei' });

      // 查詢不存在的商品主檔 -> 404 Not Found
      const res = await client.api.v1.products[':id'].$get({
        param: {
          id: 'non-existent-product-id',
        },
      });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.success).toBe(false);
      if (!json.success) {
        expect(json.error.code).toBe('NOT_FOUND');
      }

      // 查詢特定一番賞套組籤位列表
      const prizeRes = await client.api.v1.luckybags.prizes.$get({
        query: {
          bagId: 'lucky-bag-chupei-001',
        },
      });
      expect(prizeRes.status).toBe(200);
      const prizeJson = await prizeRes.json();
      expect(prizeJson.success).toBe(true);

      // 查詢會員主檔
      const phoneRes = await client.api.v1.members[':phone'].$get({
        param: {
          phone: '0912345678',
        },
      });
      // 0912345678 在種子資料中或未建立 (200 或 404)
      expect([200, 404]).toContain(phoneRes.status);
    });

    it('Request Body (JSON) 序列化與結帳 API 調用', async () => {
      // 預先為竹北門市注入 P-001 實體庫存 10 件
      harness.databases.chupei.rawDb.exec(`
        INSERT OR REPLACE INTO store_inventories (id, store_id, product_id, quantity)
        VALUES ('inv-cp-p001', 'chupei', 'P-001', 10);
      `);

      const client = createDirectClient({ storeId: 'chupei' });

      const checkoutPayload = {
        branch: 'chupei',
        storeId: 'chupei',
        customer: { phone: '0912345678', name: '王小明' },
        lotteries: [],
        merchandises: [
          {
            id: 'P-001',
            name: '海賊王 GK 潮流雕像',
            quantity: 1,
            paymentType: '現金' as const,
            unitAmount: 3500,
            actualAmount: 3500,
            totalPoints: 0,
          },
        ],
        payment: {
          cash: 3500,
          creditCard: 0,
          linePay: 0,
          remittance: 0,
          pointsUsed: 0,
        },
        cashierEmail: 'cashier@onesoul.com',
        checkoutUID: `rpc-test-checkout-${Date.now()}`,
      };

      const res = await client.api.v1.orders.checkout.$post({
        json: checkoutPayload,
      });
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      if (json.success) {
        expect(json.data.checkoutUID).toBe(checkoutPayload.checkoutUID);
        expect(json.data.orderId).toBeDefined();
      }
    });

    it('Admin 配賞看板即時雷達端點 RPC 呼叫', async () => {
      const client = createDirectClient({ storeId: 'chupei' });

      const res = await client.api.admin.allocation['live-stock'].$get({ query: {} });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.success).toBe(true);
      if (json.success) {
        expect(Array.isArray(json.data)).toBe(true);
      }
    });

    it('Admin 審計雜湊鏈完整性驗證端點 RPC 呼叫', async () => {
      const client = createDirectClient({ storeId: 'chupei' });

      const res = await client.api.admin.audit.verify.$get();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      if (json.success) {
        expect(json.data.valid).toBe(true);
      }
    });
  });

  // =========================================================================
  // Section 3: OpenAPI 3.1 Specification JSON (/api/doc) Deep Verification
  // =========================================================================
  describe('3. OpenAPI 3.1 Specification Deep Verification (/api/doc)', () => {
    let doc: any;

    beforeEach(async () => {
      const res = await harness.request('/api/doc', { method: 'GET' }, '');
      expect(res.status).toBe(200);
      doc = await res.json();
    });

    it('OpenAPI 規範格式完整且版本為 3.1.0', () => {
      expect(doc.openapi).toBe('3.1.0');
      expect(doc.info).toBeDefined();
      expect(doc.info.title).toBe('OneSoul Cloudflare Edge API Gateway');
      expect(doc.info.version).toBe('1.0.0');
      expect(doc.servers).toBeDefined();
      expect(Array.isArray(doc.servers)).toBe(true);
      expect(doc.servers[0].url).toBe('/');
      expect(doc.paths).toBeDefined();
      expect(typeof doc.paths).toBe('object');
    });

    it('覆蓋所有 v1 收銀端點', () => {
      const expectedV1Paths = [
        '/api/v1/orders/checkout',
        '/api/v1/orders',
        '/api/v1/orders/:id',
        '/api/v1/orders/:id/void',
        '/api/v1/luckybags',
        '/api/v1/luckybags/:id',
        '/api/v1/luckybags/prizes',
        '/api/v1/luckybags/draw-counts',
        '/api/v1/products',
        '/api/v1/products/:id',
        '/api/v1/products/categories',
        '/api/v1/products/blindboxes',
        '/api/v1/products/stocks',
        '/api/v1/members',
        '/api/v1/members/:phone',
        '/api/v1/members/:phone/history',
        '/api/v1/sessions',
        '/api/v1/sessions/active',
        '/api/v1/sessions/current',
        '/api/v1/sessions/open',
        '/api/v1/sessions/close',
        '/api/v1/stocktakes',
        '/api/v1/stocktakes/:id',
        '/api/v1/stocktakes/:id/post',
        '/api/v1/stocktakes/checklist',
        '/api/v1/brand',
        '/api/v1/notifications',
      ];

      for (const p of expectedV1Paths) {
        expect(doc.paths[p], `OpenAPI spec 必須包含 v1 路徑: ${p}`).toBeDefined();
      }
    });

    it('覆蓋所有 admin 管理端點', () => {
      const expectedAdminPaths = [
        '/api/admin/allocation/live-stock',
        '/api/admin/allocation/plans',
        '/api/admin/allocation/plans/:id',
        '/api/admin/allocation/plans/publish',
        '/api/admin/inventory/summary',
        '/api/admin/inventory/suggest',
        '/api/admin/inventory/categories',
        '/api/admin/inventory/products',
        '/api/admin/inventory/products/:id',
        '/api/admin/inventory/adjust-stock',
        '/api/admin/inventory/batch-update',
        '/api/admin/transfers',
        '/api/admin/transfers/:id',
        '/api/admin/transfers/:id/dispatch',
        '/api/admin/transfers/:id/receive',
        '/api/admin/transfers/:id/cancel',
        '/api/admin/preorders',
        '/api/admin/preorders/suggest-next-id',
        '/api/admin/preorders/:id/receive',
        '/api/admin/preorders/:id/cancel',
        '/api/admin/audit',
        '/api/admin/audit/verify',
        '/api/admin/settings/brand',
        '/api/admin/settings/integrations',
        '/api/admin/settings/emergency-notices',
        '/api/admin/settings/emergency-notices/:id',
        '/api/admin/members/:id/adjust-points',
        '/api/admin/sessions/live-shift',
      ];

      for (const p of expectedAdminPaths) {
        expect(doc.paths[p], `OpenAPI spec 必須包含 admin 路徑: ${p}`).toBeDefined();
      }
    });

    it('每個路由操作均包含合規的 HTTP Method、摘要、標籤與 200/201 回應定義', () => {
      for (const [pathStr, pathItem] of Object.entries(doc.paths)) {
        for (const [method, op] of Object.entries(pathItem as Record<string, any>)) {
          if (['get', 'post', 'put', 'patch', 'delete'].includes(method)) {
            expect(op.responses, `${pathStr} [${method}] 必須定義 responses`).toBeDefined();
            const successCode = Object.keys(op.responses).find((code) =>
              code.startsWith('2')
            );
            expect(
              successCode,
              `${pathStr} [${method}] 必須具備 2xx 成功回應碼`
            ).toBeDefined();
            expect(
              op.responses[successCode!].description,
              `${pathStr} [${method}] 成功回應必須有說明文字`
            ).toBeDefined();
          }
        }
      }
    });

    it('OpenAPI JSON 不包含字串化的 [object Object] 損毀項目', () => {
      const rawJson = JSON.stringify(doc);
      expect(rawJson).not.toContain('[object Object]');
      expect(rawJson).not.toContain('undefined');
    });
  });

  // =========================================================================
  // Section 4: Swagger UI HTML & Assets Rendering (/api/docs)
  // =========================================================================
  describe('4. Swagger UI HTML & CDN Assets Rendering (/api/docs)', () => {
    it('GET /api/docs 回傳合規 HTML5、Swagger UI 容器與 CDN 資源引用', async () => {
      const res = await harness.request('/api/docs', { method: 'GET' }, '');
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/html');

      const html = await res.text();
      // 驗證 HTML5 結構
      expect(html.toLowerCase()).toContain('<!doctype html>');
      expect(html).toContain('<html');
      expect(html).toContain('</html>');

      // 驗證 Swagger UI 核心容器 id
      expect(html).toContain('id="swagger-ui"');

      // 驗證 Swagger UI 載入 /api/doc 規格來源
      expect(html).toContain('/api/doc');

      // 驗證 Swagger UI CDN CSS 與 Bundle JS
      expect(html).toContain('swagger-ui.css');
      expect(html).toContain('swagger-ui-bundle.js');
    });
  });

  // =========================================================================
  // Section 5: Edge Case & Adversarial Fault Injection via RPC
  // =========================================================================
  describe('5. Edge Case & Adversarial Fault Injection via Client RPC', () => {
    it('未提供 X-Store-Id 標頭存取業務路由立即觸發 400 ERR_MISSING_STORE_ID', async () => {
      const client = createDirectClient({ storeId: null });

      const res = await client.api.v1.products.$get({ query: {} });
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.success).toBe(false);
      if (!json.success) {
        expect(json.error.code).toBe('ERR_MISSING_STORE_ID');
      }
    });

    it('🚨 Invariant #1: 散客（WALKIN）使用點數結帳立即被邊緣閘道阻斷', async () => {
      const client = createDirectClient({ storeId: 'chupei' });

      const res = await client.api.v1.orders.checkout.$post({
        json: {
          branch: 'chupei',
          storeId: 'chupei',
          customer: { phone: 'WALKIN' },
          lotteries: [],
          merchandises: [
            {
              id: 'PROD-CHUPEI-001',
              name: '航海王 魯夫 GK 雕像',
              quantity: 1,
              paymentType: '現金',
              unitAmount: 1000,
              actualAmount: 1000,
              totalPoints: 0,
            },
          ],
          payment: {
            cash: 900,
            creditCard: 0,
            linePay: 0,
            remittance: 0,
            pointsUsed: 100, // 散客企圖扣點
          },
          cashierEmail: 'cashier@onesoul.com',
          checkoutUID: `walkin-exploit-${Date.now()}`,
        },
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      if (!json.success) {
        expect(json.error.code).toBe('INVARIANT_VIOLATION');
      }
    });

    it('請求不存在的路由回傳標準 Result Pattern 404 ROUTE_NOT_FOUND', async () => {
      const res = await harness.request('/api/v1/non-existent-endpoint', { method: 'GET' }, 'chupei');
      expect(res.status).toBe(404);

      const json = await res.json() as any;
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('ROUTE_NOT_FOUND');
      expect(json.traceId).toBeDefined();
    });

    it('傳入格式錯誤的 JSON Body 回傳 400 VALIDATION_ERROR 與欄位細節', async () => {
      // 故意傳送缺少必填欄位 customer 與 payment 的錯誤 payload
      const res = await harness.request(
        '/api/v1/orders/checkout',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ checkoutUID: 'only-uid' }),
        },
        'chupei'
      );

      expect(res.status).toBe(400);
      const json = await res.json() as any;
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('VALIDATION_ERROR');
      expect(json.error.details).toBeDefined();
    });
  });
});
