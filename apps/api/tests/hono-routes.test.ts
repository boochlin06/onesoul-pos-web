import { describe, it, expect, beforeEach } from 'vitest';
import { createTestApp, type TestAppInstance } from './helpers/test-app';

describe('Hono OpenAPI 邊緣閘道業務路由整合測試 (Business Route Integration)', () => {
  let harness: TestAppInstance;

  beforeEach(() => {
    harness = createTestApp();
  });

  // 1. Invariant #1: 散客點數穿透零容忍阻斷
  describe('🚨 Invariant #1: 散客點數穿透阻斷', () => {
    it('散客（WALKIN）使用點數扣抵時，立即回傳 HTTP 400 阻斷', async () => {
      const res = await harness.request('/api/v1/orders/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch: 'chupei',
          storeId: 'chupei',
          customer: { phone: 'WALKIN' },
          lotteries: [],
          merchandises: [
            {
              id: 'P-TEST',
              name: 'GK雕像模型',
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
          checkoutUID: `uid-walkin-test-${Date.now()}`,
        }),
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INVARIANT_VIOLATION');
      expect(body.error.message).toContain('散客無會員帳號');
    });

    it('散客代碼（111111）使用點數換購商品時，立即回傳 HTTP 400 阻斷', async () => {
      const res = await harness.request('/api/v1/orders/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch: 'chupei',
          storeId: 'chupei',
          customer: { phone: '111111' },
          lotteries: [],
          merchandises: [
            {
              id: 'P-TEST-2',
              name: '盒玩盲盒',
              quantity: 1,
              paymentType: '點數', // 散客點數換購
              unitAmount: 0,
              actualAmount: 0,
              totalPoints: 10,
            },
          ],
          payment: {
            cash: 0,
            creditCard: 0,
            linePay: 0,
            remittance: 0,
            pointsUsed: 0,
          },
          cashierEmail: 'cashier@onesoul.com',
          checkoutUID: `uid-walkin-points-${Date.now()}`,
        }),
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INVARIANT_VIOLATION');
    });
  });

  // 2. Invariant #2: 一番賞發布開套與配賞現貨看板
  describe('🚨 Invariant #2: 一番賞開套不預扣門市現貨', () => {
    it('發布開套建立 LuckyBag 與獎項籤位，且嚴禁預扣 StoreInventory 門市現貨', async () => {
      // 1. 先新增商品主檔與初始門市現貨 5 件
      harness.databases.chupei.rawDb.exec(`
        INSERT INTO products (id, name, category, cost_price, selling_price, suggested_points, version)
        VALUES ('GK-001', '艾斯潮流雕像', 'GK', 2000, 3500, 175, 1);
        INSERT INTO store_inventories (id, store_id, product_id, quantity, safety_stock, version)
        VALUES ('si-001', 'chupei', 'GK-001', 5, 1, 1);
      `);

      // 2. 發布開套 (包含 A賞 2 抽，使用 GK-001)
      const res = await harness.request('/api/admin/allocation/plans/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '海賊王一番賞套組 第一彈',
          unitPrice: 300,
          totalDraws: 10,
          batchCount: 1,
          blindBoxPoints: 10,
          items: [
            {
              grade: 'A',
              name: '艾斯大賞',
              draws: 2,
              productId: 'GK-001',
              points: 0,
              cost: 2000,
            },
            {
              grade: 'Z',
              name: '保底小賞',
              draws: 8,
              productId: null,
              points: 1,
              cost: 50,
            },
          ],
        }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.success).toBe(true);
      expect(body.data.bagIds.length).toBe(1);

      // 3. 驗證門市現貨依舊為 5 件（不變量：開套絕不預扣現貨）
      const checkStock = harness.databases.chupei.rawDb
        .prepare('SELECT quantity FROM store_inventories WHERE store_id = ? AND product_id = ?')
        .get('chupei', 'GK-001') as any;
      expect(checkStock.quantity).toBe(5);

      // 4. 驗證配賞現貨雷達動態計算：allocatedCount = 2, availableStock = 3
      const radarRes = await harness.request('/api/admin/allocation/live-stock');
      expect(radarRes.status).toBe(200);
      const radarBody = (await radarRes.json()) as any;
      const aceItem = radarBody.data.find((it: any) => it.id === 'GK-001');
      expect(aceItem).toBeDefined();
      expect(aceItem.stock).toBe(5);
      expect(aceItem.allocatedCount).toBe(2);
      expect(aceItem.availableStock).toBe(3);
    });
  });

  // 3. 收銀班次生命週期 (開班、查詢、交班關帳日結)
  describe('收銀班次生命週期管理', () => {
    it('開啟收銀班次 -> 查詢當前收銀班次 -> 交班關帳日結', async () => {
      // 清空預先 seed 的開啟中收銀班次，確保獨立測試開班
      harness.databases.chupei.rawDb.exec("DELETE FROM cash_register_sessions WHERE store_id = 'chupei';");

      // 1. 開啟收銀班次
      const openRes = await harness.request('/api/v1/sessions/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId: 'chupei',
          openedBy: 'cashier@onesoul.com',
          openingCash: 8000,
        }),
      });

      expect(openRes.status).toBe(201);
      const openBody = (await openRes.json()) as any;
      expect(openBody.success).toBe(true);
      expect(openBody.data.status).toBe('OPEN');
      const sessionId = openBody.data.id;

      // 2. 查詢當前開啟中之收銀班次
      const currentRes = await harness.request('/api/v1/sessions/current');
      expect(currentRes.status).toBe(200);
      const currentBody = (await currentRes.json()) as any;
      expect(currentBody.success).toBe(true);
      expect(currentBody.data.id).toBe(sessionId);

      // 3. 結束收銀班次與交班關帳日結 (輸入實盤現金 8000)
      const closeRes = await harness.request('/api/v1/sessions/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actualCash: 8000,
          closedBy: 'cashier@onesoul.com',
          note: '正常收班',
        }),
      });

      expect(closeRes.status).toBe(200);
      const closeBody = (await closeRes.json()) as any;
      expect(closeBody.success).toBe(true);
      expect(closeBody.data.sessionId).toBe(sessionId);
      expect(closeBody.data.expectedCash).toBe(8000);
      expect(closeBody.data.discrepancy).toBe(0);
    });
  });

  // 4. 會員建立與點數手動調整
  describe('會員管理與點數複式記帳', () => {
    it('新增會員 -> 依電話查詢 -> 管理員手動調整點數', async () => {
      // 1. 新增會員
      const createRes = await harness.request('/api/v1/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: '0912345678',
          name: '王小明',
          email: 'wang@example.com',
        }),
      });

      expect(createRes.status).toBe(201);
      const createBody = (await createRes.json()) as any;
      expect(createBody.success).toBe(true);
      expect(createBody.data.phone).toBe('0912345678');
      const memberId = createBody.data.id;

      // 2. 依電話查詢會員
      const getRes = await harness.request('/api/v1/members/0912345678');
      expect(getRes.status).toBe(200);
      const getBody = (await getRes.json()) as any;
      expect(getBody.data.name).toBe('王小明');
      expect(getBody.data.points).toBe(0);

      // 3. 後台管理員加點 50 點
      const adjustRes = await harness.request(`/api/admin/members/${memberId}/adjust-points`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId,
          delta: 50,
          reason: '開幕活動贈送點數',
          operator: 'manager@onesoul.com',
        }),
      });

      expect(adjustRes.status).toBe(200);
      const adjustBody = (await adjustRes.json()) as any;
      expect(adjustBody.success).toBe(true);
      expect(adjustBody.data.points).toBe(50);
    });
  });

  // 5. 跨店調撥流程 (草稿 -> 出庫發貨 -> 驗收入庫)
  describe('跨店調撥單生命週期', () => {
    it('建立調撥單 -> 出庫發貨 (扣來源庫存) -> 驗收入庫 (增目標庫存)', async () => {
      // 準備竹北門市現貨 10 件
      harness.databases.chupei.rawDb.exec(`
        INSERT INTO products (id, name, category, cost_price, selling_price, suggested_points, version)
        VALUES ('GK-TR-1', '索隆潮流雕像', 'GK', 1500, 2500, 125, 1);
        INSERT INTO store_inventories (id, store_id, product_id, quantity, safety_stock, version)
        VALUES ('si-tr-1', 'chupei', 'GK-TR-1', 10, 2, 1);
      `);

      // 1. 建立調撥單 (竹北 -> 金山，調撥 3 件)
      const createRes = await harness.request('/api/admin/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceStoreId: 'chupei',
          targetStoreId: 'jinshan',
          items: [{ productId: 'GK-TR-1', requestedQty: 3 }],
          dispatchedBy: 'admin@onesoul.com',
          note: '支援金山門市週年慶',
        }),
      });

      expect(createRes.status).toBe(201);
      const createBody = (await createRes.json()) as any;
      expect(createBody.success).toBe(true);
      const transferId = createBody.data.id;

      // 2. 出庫發貨 (竹北扣除 3 件門市現貨，餘額 7 件)
      const dispatchRes = await harness.request(`/api/admin/transfers/${transferId}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operator: 'admin@onesoul.com',
        }),
      });

      expect(dispatchRes.status).toBe(200);
      const sourceStock = harness.databases.chupei.rawDb
        .prepare('SELECT quantity FROM store_inventories WHERE store_id = ? AND product_id = ?')
        .get('chupei', 'GK-TR-1') as any;
      expect(sourceStock.quantity).toBe(7);

      // 3. 驗收入庫 (金山門市入庫)
      const receiveRes = await harness.request(`/api/admin/transfers/${transferId}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operator: 'jinshan_cashier@onesoul.com',
        }),
      });

      expect(receiveRes.status).toBe(200);
      const targetStock = harness.databases.chupei.rawDb
        .prepare('SELECT quantity FROM store_inventories WHERE store_id = ? AND product_id = ?')
        .get('jinshan', 'GK-TR-1') as any;
      expect(targetStock.quantity).toBe(3);
    });
  });

  // 6. 廠商預購單與入庫驗收
  describe('廠商預購單業務流程', () => {
    it('推薦接續 GK 貨號 -> 建立預購單 -> 補款驗收入庫', async () => {
      // 1. 取得推薦接續 GK 貨號
      const suggestRes = await harness.request('/api/admin/preorders/suggest-next-id');
      expect(suggestRes.status).toBe(200);
      const suggestBody = (await suggestRes.json()) as any;
      expect(suggestBody.data.suggestedId).toBeDefined();
      const gkId = suggestBody.data.suggestedId;

      // 2. 建立預購單 (訂金 500)
      const createRes = await harness.request('/api/admin/preorders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '航海王 魯夫五檔 GK 雕像',
          quantity: 2,
          deposit: 1000,
          supplier: '萬代玩具',
          targetStoreId: 'chupei',
        }),
      });

      expect(createRes.status).toBe(201);
      const createBody = (await createRes.json()) as any;
      const preOrderId = createBody.data.id;

      // 3. 補款驗收入庫 (尾款 3000、運費 200，總成本 4200，單件成本 2100)
      const receiveRes = await harness.request(`/api/admin/preorders/${preOrderId}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: gkId,
          finalPayment: 3000,
          shippingFee: 200,
          sellingPrice: 4500,
          targetStoreId: 'chupei',
          operator: 'admin@onesoul.com',
        }),
      });

      expect(receiveRes.status).toBe(200);

      // 驗證 Product 與 StoreInventory 已原子建立
      const prod = harness.databases.chupei.rawDb
        .prepare('SELECT * FROM products WHERE id = ?')
        .get(gkId) as any;
      expect(prod).toBeDefined();
      expect(prod.name).toBe('航海王 魯夫五檔 GK 雕像');
      expect(prod.cost_price).toBe(2100);

      const stock = harness.databases.chupei.rawDb
        .prepare('SELECT quantity FROM store_inventories WHERE store_id = ? AND product_id = ?')
        .get('chupei', gkId) as any;
      expect(stock.quantity).toBe(2);
    });
  });

  // 7. 密碼學審計日誌雜湊鏈完整性驗證
  describe('不可變審計日誌與密碼學驗證', () => {
    it('查詢審計日誌與密碼學驗證線性雜湊鏈完整性', async () => {
      const verifyRes = await harness.request('/api/admin/audit/verify');
      expect(verifyRes.status).toBe(200);
      const verifyBody = (await verifyRes.json()) as any;
      expect(verifyBody.success).toBe(true);
      expect(verifyBody.data.valid).toBe(true);
    });
  });

  // 8. 404 與錯誤處理
  describe('全域錯誤處理與 404 端點', () => {
    it('不存在之端點回傳符合 Result Pattern 之 404 JSON', async () => {
      const res = await harness.request('/api/v1/non-existent-endpoint');
      expect(res.status).toBe(404);
      const body = (await res.json()) as any;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('ROUTE_NOT_FOUND');
      expect(body.traceId).toBeDefined();
    });

    it('業務端點缺失 X-Store-Id 標頭回傳 400 錯誤', async () => {
      const res = await harness.request('/api/v1/sessions/current', { method: 'GET' }, '');
      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('ERR_MISSING_STORE_ID');
    });
  });
});
