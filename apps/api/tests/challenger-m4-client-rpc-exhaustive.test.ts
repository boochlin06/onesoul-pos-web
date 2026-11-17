import { describe, it, expect, beforeEach } from 'vitest';
import { createOneSoulClient } from '../src/client';
import { createTestApp, type TestAppInstance } from './helpers/test-app';

describe('Challenger M4 Exhaustive Client RPC Type Inference & Route Tree Test Suite', () => {
  let harness: TestAppInstance;

  beforeEach(() => {
    harness = createTestApp();
  });

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
      getStoreId: () => (options?.storeId !== undefined ? options.storeId : 'chupei'),
      getToken: () => (options?.token !== undefined ? options.token : 'test-jwt-token-12345'),
      headers: options?.customHeaders,
    });
  }

  // =========================================================================
  // 1. Root & Health Check Type Safety
  // =========================================================================
  describe('1. 邊緣閘道系統健康檢查 (Health Check)', () => {
    it('client.health.$get 型別推導與回傳正確', async () => {
      const client = createDirectClient();
      const res = await client.health.$get();
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.status).toBe('ok');
      expect(typeof json.timestamp).toBe('string');
    });
  });

  // =========================================================================
  // 2. v1 銷售訂單模組 (Orders)
  // =========================================================================
  describe('2. v1 銷售訂單模組 (Orders RPC Chaining)', () => {
    it('client.api.v1.orders 完整鏈式端點型別安全推導與路徑衝突鑑識', async () => {
      const client = createDirectClient({ storeId: 'chupei' });

      // GET /api/v1/orders
      const listRes = await client.api.v1.orders.$get({
        query: { limit: 10 },
      });
      expect(listRes.status).toBe(200);
      const listJson = await listRes.json();
      expect(listJson.success).toBe(true);

      // POST /api/v1/orders/drafts
      const saveDraftRes = await client.api.v1.orders.drafts.$post({
        json: {
          draftId: 'draft-test-001',
          data: { cart: [] },
        },
      });
      expect(saveDraftRes.status).toBe(200);

      // GET /api/v1/orders/:id (不存在訂單 -> 404)
      const orderDetailRes = await client.api.v1.orders[':id'].$get({
        param: { id: 'non-existent-order' },
      });
      expect(orderDetailRes.status).toBe(404);

      // POST /api/v1/orders/:id/void (不存在訂單 -> 404)
      const voidRes = await client.api.v1.orders[':id'].void.$post({
        param: { id: 'non-existent-order' },
        json: {
          reason: '測試作廢銷售訂單',
          cashierEmail: 'cashier@onesoul.com',
        },
      });
      expect(voidRes.status).toBe(404);

      // 🚨 Bug 1 鑑識驗證: GET /api/v1/orders/drafts 被 GET /api/v1/orders/:id 遮蔽
      const draftsRes = await client.api.v1.orders.drafts.$get();
      const draftsJson = (await draftsRes.json()) as any;
      console.log('[Routing Forensic Bug 1] GET /api/v1/orders/drafts status & body:', draftsRes.status, draftsJson);
      // 因為 /:id 註冊在 /drafts 之前，Hono 將 drafts 視為 :id，回傳 404 找不到銷售訂單: drafts
      expect(draftsRes.status).toBe(404);
      expect(draftsJson.error?.message).toContain('找不到銷售訂單: drafts');
    });
  });

  // =========================================================================
  // 3. v1 一番賞套組模組 (LuckyBags)
  // =========================================================================
  describe('3. v1 一番賞套組模組 (LuckyBags RPC Chaining)', () => {
    it('client.api.v1.luckybags 完整鏈式端點型別安全推導', async () => {
      const client = createDirectClient({ storeId: 'chupei' });

      // GET /api/v1/luckybags
      const listRes = await client.api.v1.luckybags.$get();
      expect(listRes.status).toBe(200);
      const listJson = await listRes.json();
      expect(listJson.success).toBe(true);

      // GET /api/v1/luckybags/:id (種子資料中的套組 LB-01)
      const bagRes = await client.api.v1.luckybags[':id'].$get({
        param: { id: 'LB-01' },
      });
      expect(bagRes.status).toBe(200);

      // GET /api/v1/luckybags/prizes
      const prizesRes = await client.api.v1.luckybags.prizes.$get({
        query: { bagId: 'LB-01' },
      });
      expect(prizesRes.status).toBe(200);

      // GET /api/v1/luckybags/draw-counts
      const countsRes = await client.api.v1.luckybags['draw-counts'].$get();
      expect(countsRes.status).toBe(200);
    });
  });

  // =========================================================================
  // 4. v1 商品主檔模組 (Products)
  // =========================================================================
  describe('4. v1 商品主檔模組 (Products RPC Chaining)', () => {
    it('client.api.v1.products 完整鏈式端點型別安全推導', async () => {
      const client = createDirectClient({ storeId: 'chupei' });

      // GET /api/v1/products
      const listRes = await client.api.v1.products.$get({
        query: { search: 'GK' },
      });
      expect(listRes.status).toBe(200);

      // GET /api/v1/products/categories
      const catRes = await client.api.v1.products.categories.$get();
      expect(catRes.status).toBe(200);

      // GET /api/v1/products/blindboxes
      const blindRes = await client.api.v1.products.blindboxes.$get();
      expect(blindRes.status).toBe(200);

      // GET /api/v1/products/stocks
      const stockRes = await client.api.v1.products.stocks.$get({
        query: {},
      });
      expect(stockRes.status).toBe(200);

      // GET /api/v1/products/:id (404)
      const detailRes = await client.api.v1.products[':id'].$get({
        param: { id: 'non-existent-product' },
      });
      expect(detailRes.status).toBe(404);
    });
  });

  // =========================================================================
  // 5. v1 會員點數錢包模組 (Members)
  // =========================================================================
  describe('5. v1 會員點數錢包模組 (Members RPC Chaining)', () => {
    it('client.api.v1.members 完整鏈式端點型別安全推導與電話參數鑑識', async () => {
      const client = createDirectClient({ storeId: 'chupei' });

      // GET /api/v1/members
      const listRes = await client.api.v1.members.$get({
        query: { search: '0912' },
      });
      expect(listRes.status).toBe(200);

      // POST /api/v1/members (建立新會員)
      const uniquePhone = `09${Math.floor(10000000 + Math.random() * 90000000)}`;
      const createRes = await client.api.v1.members.$post({
        json: {
          phone: uniquePhone,
          name: '新進會員顧客',
          note: 'RPC 測試建檔',
        },
      });
      expect(createRes.status).toBe(201);

      // GET /api/v1/members/:phone
      const memberRes = await client.api.v1.members[':phone'].$get({
        param: { phone: uniquePhone },
      });
      expect(memberRes.status).toBe(200);

      // 🚨 Bug 2 鑑識驗證: GET /api/v1/members/:phone/history 將 phone 誤傳給 findById
      const historyRes = await client.api.v1.members[':phone'].history.$get({
        param: { phone: uniquePhone },
      });
      const historyJson = (await historyRes.json()) as any;
      console.log('[Routing Forensic Bug 2] GET /api/v1/members/:phone/history status & body:', historyRes.status, historyJson);
      // 因為路由 handler 將 phone 傳入 memberRepo.findById，並非資料庫主鍵 ID，導致回傳 404
      expect(historyRes.status).toBe(404);
      expect(historyJson.error?.message).toMatch(new RegExp(`(找不到會員|會員 \\[${uniquePhone}\\] not found)`));
    });
  });

  // =========================================================================
  // 6. v1 收銀班次與日結模組 (Sessions)
  // =========================================================================
  describe('6. v1 收銀班次與日結模組 (Sessions RPC Chaining)', () => {
    it('client.api.v1.sessions 完整鏈式端點型別安全推導', async () => {
      const client = createDirectClient({ storeId: 'chupei' });

      // GET /api/v1/sessions
      const listRes = await client.api.v1.sessions.$get();
      expect(listRes.status).toBe(200);

      // GET /api/v1/sessions/active
      const activeRes = await client.api.v1.sessions.active.$get();
      expect(activeRes.status).toBe(200);

      // GET /api/v1/sessions/current
      const currentRes = await client.api.v1.sessions.current.$get();
      expect(currentRes.status).toBe(200);

      // POST /api/v1/sessions/close (先關閉當前開啟中的收銀班次)
      const closeRes = await client.api.v1.sessions.close.$post({
        json: {
          actualCash: 8000,
          closedBy: 'cashier@onesoul.com',
          note: '收銀班次測試日結關帳',
        },
      });
      expect(closeRes.status).toBe(200);

      // POST /api/v1/sessions/open (重新開啟新收銀班次)
      const openRes = await client.api.v1.sessions.open.$post({
        json: {
          storeId: 'chupei',
          openingCash: 5000,
          openedBy: 'cashier@onesoul.com',
        },
      });
      expect([200, 201]).toContain(openRes.status);
    });
  });

  // =========================================================================
  // 7. v1 門市實盤盤點模組 (Stocktakes)
  // =========================================================================
  describe('7. v1 門市實盤盤點模組 (Stocktakes RPC Chaining)', () => {
    it('client.api.v1.stocktakes 完整鏈式端點型別安全推導', async () => {
      const client = createDirectClient({ storeId: 'chupei' });

      // GET /api/v1/stocktakes/checklist
      const checkRes = await client.api.v1.stocktakes.checklist.$get();
      expect(checkRes.status).toBe(200);

      // GET /api/v1/stocktakes
      const listRes = await client.api.v1.stocktakes.$get();
      expect(listRes.status).toBe(200);

      // POST /api/v1/stocktakes (建立門市實盤草稿 - 使用種子資料中的 P-001)
      const createRes = await client.api.v1.stocktakes.$post({
        json: {
          storeId: 'chupei',
          countedBy: 'clerk@onesoul.com',
          items: [
            {
              productId: 'P-001',
              actualQty: 10,
            },
          ],
          note: '例行門市實盤',
        },
      });
      expect(createRes.status).toBe(201);
      const createJson = (await createRes.json()) as any;
      const stocktakeId = createJson.data?.id;
      expect(stocktakeId).toBeDefined();

      // GET /api/v1/stocktakes/:id
      const getRes = await client.api.v1.stocktakes[':id'].$get({
        param: { id: stocktakeId },
      });
      expect(getRes.status).toBe(200);

      // POST /api/v1/stocktakes/:id/post (審核過帳)
      const postRes = await client.api.v1.stocktakes[':id'].post.$post({
        param: { id: stocktakeId },
        json: {
          postedBy: 'manager@onesoul.com',
        },
      });
      expect(postRes.status).toBe(200);
    });
  });

  // =========================================================================
  // 8. v1 品牌與公告模組 (Brand & Notifications)
  // =========================================================================
  describe('8. v1 品牌與公告模組 (Brand & Notifications RPC Chaining)', () => {
    it('client.api.v1.brand 與 notifications 完整鏈式端點型別安全推導', async () => {
      const client = createDirectClient({ storeId: 'chupei' });

      // GET /api/v1/brand
      const brandRes = await client.api.v1.brand.$get();
      expect(brandRes.status).toBe(200);

      // GET /api/v1/notifications
      const notifyRes = await client.api.v1.notifications.$get();
      expect(notifyRes.status).toBe(200);
    });
  });

  // =========================================================================
  // 9. Admin 配賞看板與開套發布 (Allocation)
  // =========================================================================
  describe('9. Admin 配賞看板與開套發布 (Allocation RPC Chaining)', () => {
    it('client.api.admin.allocation 完整鏈式端點型別安全推導', async () => {
      const client = createDirectClient({ storeId: 'chupei' });

      // GET /api/admin/allocation/live-stock
      const liveStockRes = await client.api.admin.allocation['live-stock'].$get({
        query: { category: 'GK' },
      });
      expect(liveStockRes.status).toBe(200);

      // GET /api/admin/allocation/plans
      const plansRes = await client.api.admin.allocation.plans.$get();
      expect(plansRes.status).toBe(200);

      // POST /api/admin/allocation/plans (儲存方案草稿)
      const saveDraftRes = await client.api.admin.allocation.plans.$post({
        json: {
          name: '海賊王一番賞草稿套組',
          totalDraws: 80,
          price1: 300,
          status: 'DRAFT',
          items: [
            {
              grade: 'A',
              name: '魯夫 GK 潮流雕像',
              draws: 2,
              productId: 'P-001',
              cost: 1500,
            },
            {
              grade: 'Z',
              name: '航海王小吊飾保底小賞',
              draws: 78,
              points: 1,
              cost: 30,
            },
          ],
        },
      });
      expect(saveDraftRes.status).toBe(200);

      // POST /api/admin/allocation/plans/publish (發布開套一番賞套組 - 遵守 Invariant #2)
      const publishRes = await client.api.admin.allocation.plans.publish.$post({
        json: {
          name: '火影忍者一番賞開套發布',
          unitPrice: 350,
          totalDraws: 80,
          isPointsSet: false,
          batchCount: 1,
          blindBoxPoints: 10,
          smallPrizePoints: 1,
          items: [
            {
              grade: 'A',
              name: '鳴人仙人模式 GK 潮流雕像',
              draws: 2,
              productId: 'P-002',
              cost: 1800,
            },
            {
              grade: 'X',
              name: '火影盲盒賞',
              draws: 10,
              points: 10,
              cost: 150,
            },
            {
              grade: 'Z',
              name: '火影保底小賞',
              draws: 68,
              points: 1,
              cost: 30,
            },
          ],
        },
      });
      expect(publishRes.status).toBe(200);
    });
  });

  // =========================================================================
  // 10. Admin 門市現貨與商品管理 (Inventory)
  // =========================================================================
  describe('10. Admin 門市現貨與商品管理 (Inventory RPC Chaining)', () => {
    it('client.api.admin.inventory 完整鏈式端點型別安全推導', async () => {
      const client = createDirectClient({ storeId: 'chupei' });

      // GET /api/admin/inventory/summary
      const summaryRes = await client.api.admin.inventory.summary.$get({
        query: { lowStockOnly: 'false' },
      });
      expect(summaryRes.status).toBe(200);

      // GET /api/admin/inventory/suggest
      const suggestRes = await client.api.admin.inventory.suggest.$get({
        query: { prefix: 'GK' },
      });
      expect(suggestRes.status).toBe(200);

      // GET /api/admin/inventory/categories
      const catRes = await client.api.admin.inventory.categories.$get();
      expect(catRes.status).toBe(200);

      // POST /api/admin/inventory/products (建立商品主檔)
      const uniqueProdId = `PROD-TEST-${Date.now()}`;
      const createProdRes = await client.api.admin.inventory.products.$post({
        json: {
          id: uniqueProdId,
          name: '全新七龍珠 GK 雕像商品主檔',
          category: 'GK',
          costPrice: 2000,
          sellingPrice: 4200,
          suggestedPoints: 210,
        },
      });
      expect(createProdRes.status).toBe(201);

      // PUT /api/admin/inventory/products/:id (修改商品主檔)
      const updateProdRes = await client.api.admin.inventory.products[':id'].$put({
        param: { id: uniqueProdId },
        json: {
          sellingPrice: 4500,
        },
      });
      expect(updateProdRes.status).toBe(200);

      // POST /api/admin/inventory/adjust-stock (手動調帳)
      const adjustRes = await client.api.admin.inventory['adjust-stock'].$post({
        json: {
          storeId: 'chupei',
          productId: uniqueProdId,
          delta: 5,
          reason: '進貨入庫調帳',
          operator: 'admin@onesoul.com',
        },
      });
      expect(adjustRes.status).toBe(200);
    });
  });

  // =========================================================================
  // 11. Admin 跨店調撥單管理 (Transfers)
  // =========================================================================
  describe('11. Admin 跨店調撥單管理 (Transfers RPC Chaining)', () => {
    it('client.api.admin.transfers 完整鏈式端點型別安全推導', async () => {
      // 預先為竹北門市注入 P-001 實體庫存以供調撥出庫
      harness.databases.chupei.rawDb.exec(`
        INSERT OR REPLACE INTO store_inventories (id, store_id, product_id, quantity)
        VALUES ('inv-cp-transfer-p001', 'chupei', 'P-001', 5);
      `);

      const client = createDirectClient({ storeId: 'chupei' });

      // GET /api/admin/transfers
      const listRes = await client.api.admin.transfers.$get({
        query: { storeId: 'chupei' },
      });
      expect(listRes.status).toBe(200);

      // POST /api/admin/transfers (建立跨店調撥單草稿)
      const createRes = await client.api.admin.transfers.$post({
        json: {
          sourceStoreId: 'chupei',
          targetStoreId: 'jinshan',
          items: [
            {
              productId: 'P-001',
              requestedQty: 1,
            },
          ],
          note: '門市間GK雕像展示支援',
          dispatchedBy: 'manager@onesoul.com',
        },
      });
      expect(createRes.status).toBe(201);
      const createJson = (await createRes.json()) as any;
      const transferId = createJson.data?.id;
      expect(transferId).toBeDefined();

      // GET /api/admin/transfers/:id
      const detailRes = await client.api.admin.transfers[':id'].$get({
        param: { id: transferId },
      });
      expect(detailRes.status).toBe(200);

      // POST /api/admin/transfers/:id/dispatch (出庫發貨)
      const dispatchRes = await client.api.admin.transfers[':id'].dispatch.$post({
        param: { id: transferId },
        json: {
          operator: 'manager@onesoul.com',
        },
      });
      expect(dispatchRes.status).toBe(200);

      // POST /api/admin/transfers/:id/receive (驗收入庫)
      const receiveRes = await client.api.admin.transfers[':id'].receive.$post({
        param: { id: transferId },
        json: {
          operator: 'receiver@onesoul.com',
        },
      });
      expect(receiveRes.status).toBe(200);
    });
  });

  // =========================================================================
  // 12. Admin 廠商預購單管理 (PreOrders)
  // =========================================================================
  describe('12. Admin 廠商預購單管理 (PreOrders RPC Chaining)', () => {
    it('client.api.admin.preorders 完整鏈式端點型別安全推導', async () => {
      const client = createDirectClient({ storeId: 'chupei' });

      // GET /api/admin/preorders
      const listRes = await client.api.admin.preorders.$get({
        query: { status: 'PENDING' },
      });
      expect(listRes.status).toBe(200);

      // GET /api/admin/preorders/suggest-next-id
      const suggestRes = await client.api.admin.preorders['suggest-next-id'].$get();
      expect(suggestRes.status).toBe(200);

      // POST /api/admin/preorders (建立廠商預購單)
      const createRes = await client.api.admin.preorders.$post({
        json: {
          name: '機動戰士鋼彈 GK 潮流雕像',
          supplier: '萬代日本官方進口商',
          quantity: 2,
          deposit: 2000,
        },
      });
      expect(createRes.status).toBe(201);
      const createJson = (await createRes.json()) as any;
      const preorderId = createJson.data?.id;
      expect(preorderId).toBeDefined();

      // POST /api/admin/preorders/:id/receive (驗收入庫 - 使用全新無碰撞貨號 GK-GUNDAM-001)
      const receiveRes = await client.api.admin.preorders[':id'].receive.$post({
        param: { id: preorderId },
        json: {
          targetStoreId: 'chupei',
          productId: 'GK-GUNDAM-001',
          sellingPrice: 6000,
          operator: 'warehouse-manager@onesoul.com',
        },
      });
      expect(receiveRes.status).toBe(200);
    });
  });

  // =========================================================================
  // 13. Admin 審計日誌與密碼學驗證 (Audit)
  // =========================================================================
  describe('13. Admin 審計日誌與密碼學驗證 (Audit RPC Chaining)', () => {
    it('client.api.admin.audit 完整鏈式端點型別安全推導', async () => {
      const client = createDirectClient({ storeId: 'chupei' });

      // GET /api/admin/audit
      const listRes = await client.api.admin.audit.$get({
        query: { limit: 10 },
      });
      expect(listRes.status).toBe(200);

      // GET /api/admin/audit/verify (SHA-256 密碼學雜湊鏈檢驗)
      const verifyRes = await client.api.admin.audit.verify.$get();
      expect(verifyRes.status).toBe(200);
      const verifyJson = await verifyRes.json();
      expect(verifyJson.success).toBe(true);
      if (verifyJson.success) {
        expect(verifyJson.data.valid).toBe(true);
      }
    });
  });

  // =========================================================================
  // 14. Admin 系統設定與緊急廣播 (Settings)
  // =========================================================================
  describe('14. Admin 系統設定與緊急廣播 (Settings RPC Chaining)', () => {
    it('client.api.admin.settings 完整鏈式端點型別安全推導', async () => {
      const client = createDirectClient({ storeId: 'chupei' });

      // GET /api/admin/settings/brand
      const brandRes = await client.api.admin.settings.brand.$get();
      expect(brandRes.status).toBe(200);

      // PUT /api/admin/settings/brand
      const updateBrandRes = await client.api.admin.settings.brand.$put({
        json: {
          brandName: 'OneSoul 旗艦總店',
          blindBoxPointsValue: 10,
          pointRateTwd: 20,
          smallPrizePointsValue: 1,
        },
      });
      expect(updateBrandRes.status).toBe(200);

      // GET /api/admin/settings/integrations
      const integRes = await client.api.admin.settings.integrations.$get();
      expect(integRes.status).toBe(200);

      // GET /api/admin/settings/emergency-notices
      const noticesRes = await client.api.admin.settings['emergency-notices'].$get();
      expect(noticesRes.status).toBe(200);

      // POST /api/admin/settings/emergency-notices (發布緊急廣播)
      const postNoticeRes = await client.api.admin.settings['emergency-notices'].$post({
        json: {
          title: '門市收銀防颱緊急公告',
          content: '全台門市今日 20:00 提前日結關帳。',
          level: 'HIGH',
          targetStoreIds: ['chupei', 'jinshan'],
        },
      });
      expect(postNoticeRes.status).toBe(201);
      const noticeJson = (await postNoticeRes.json()) as any;
      const noticeId = noticeJson.data?.id;
      expect(noticeId).toBeDefined();

      // DELETE /api/admin/settings/emergency-notices/:id (撤回緊急廣播)
      const deleteRes = await client.api.admin.settings['emergency-notices'][':id'].$delete({
        param: { id: noticeId },
      });
      expect(deleteRes.status).toBe(200);
    });
  });

  // =========================================================================
  // 15. Admin 會員調點與戰情監控 (Members & Sessions)
  // =========================================================================
  describe('15. Admin 會員調點與戰情監控 (Admin Members & Sessions RPC Chaining)', () => {
    it('client.api.admin.members 與 sessions 完整鏈式端點型別安全推導', async () => {
      const client = createDirectClient({ storeId: 'chupei' });

      // 先建檔一位測試會員
      const memberPhone = `09${Math.floor(10000000 + Math.random() * 90000000)}`;
      const newMemberRes = await client.api.v1.members.$post({
        json: {
          phone: memberPhone,
          name: '調點測試會員',
        },
      });
      const memberJson = (await newMemberRes.json()) as any;
      const memberId = memberJson.data?.id;
      expect(memberId).toBeDefined();

      // POST /api/admin/members/:id/adjust-points
      const adjustRes = await client.api.admin.members[':id']['adjust-points'].$post({
        param: { id: memberId },
        json: {
          delta: 50,
          reason: '店長回饋贈點',
          operator: 'store-manager@onesoul.com',
        },
      });
      expect(adjustRes.status).toBe(200);

      // GET /api/admin/sessions/live-shift
      const liveShiftRes = await client.api.admin.sessions['live-shift'].$get({
        query: {},
      });
      expect(liveShiftRes.status).toBe(200);
    });
  });
});
