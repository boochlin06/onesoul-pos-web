import { describe, it, expect, beforeEach } from 'vitest';
import { createTestApp, type TestAppInstance } from './helpers/test-app';

describe('Adversarial Stress Test: Milestone 4 OpenAPI Routes & Invariants', () => {
  let harness: TestAppInstance;

  beforeEach(() => {
    harness = createTestApp();
  });

  describe('1. Invariant #1: Walk-In Point Rejection Matrix', () => {
    const walkInIdentifiers = [
      { phone: '111111', desc: '111111 standard walk-in' },
      { phone: '222222', desc: '222222 walk-in code' },
      { phone: '333333', desc: '333333 walk-in code' },
      { phone: '88888', desc: '88888 walk-in code' },
      { phone: '99999', desc: '99999 walk-in code' },
      { phone: 'WALKIN', desc: 'WALKIN uppercase string' },
      { phone: 'walk-in', desc: 'walk-in hyphenated string' },
      { phone: '現場散客', desc: '現場散客 Chinese label' },
      { phone: '散客顧客', desc: '散客顧客 Chinese label' },
      { phone: '', desc: 'Empty phone string' },
    ];

    for (const { phone, desc } of walkInIdentifiers) {
      it(`[WalkIn Point Deduction] ${desc} (phone: "${phone}") attempting pointsUsed > 0 is strictly rejected with HTTP 400`, async () => {
        const res = await harness.request('/api/v1/orders/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            branch: 'chupei',
            storeId: 'chupei',
            customer: { phone, name: '散客測試' },
            merchandises: [
              {
                id: 'P-TEST',
                name: '測試GK雕像',
                quantity: 1,
                paymentType: '現金',
                unitAmount: 500,
                actualAmount: 500,
                totalPoints: 0,
              },
            ],
            payment: {
              cash: 450,
              creditCard: 0,
              linePay: 0,
              remittance: 0,
              pointsUsed: 50,
            },
            cashierEmail: 'cashier@onesoul.com',
            checkoutUID: `uid-walkin-pts-${Math.random().toString(36).substring(2, 8)}`,
          }),
        });

        expect(res.status).toBe(400);
        const body = (await res.json()) as any;
        expect(body.success).toBe(false);
        expect(body.error.code).toBe('INVARIANT_VIOLATION');
        expect(body.error.message).toContain('散客');
      });

      it(`[WalkIn Merchandise Points] ${desc} (phone: "${phone}") attempting paymentType '點數' is strictly rejected with HTTP 400`, async () => {
        const res = await harness.request('/api/v1/orders/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            branch: 'chupei',
            storeId: 'chupei',
            customer: { phone, name: '散客測試' },
            merchandises: [
              {
                id: 'P-TEST-MERCH-PTS',
                name: '點數兌換模型',
                quantity: 1,
                paymentType: '點數',
                unitAmount: 0,
                actualAmount: 0,
                totalPoints: 20,
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
            checkoutUID: `uid-walkin-merch-${Math.random().toString(36).substring(2, 8)}`,
          }),
        });

        expect(res.status).toBe(400);
        const body = (await res.json()) as any;
        expect(body.success).toBe(false);
        expect(body.error.code).toBe('INVARIANT_VIOLATION');
      });
    }

    it('Walk-In attempting to draw from a PointsSet (限定點數套) is rejected with HTTP 400', async () => {
      // 1. Setup a PointsSet LuckyBag
      harness.databases.chupei.rawDb.exec(`
        INSERT INTO lucky_bags (id, store_id, name, unit_price, is_points_set, status)
        VALUES ('LB-PTS-SET-1', 'chupei', '限定點數套一番賞', 300, 1, 'ACTIVE');

        INSERT INTO lucky_bag_prizes (id, bag_id, prize_grade, prize_name, draws, drawn_count, points)
        VALUES ('PZ-PTS-1', 'LB-PTS-SET-1', 'A', '大賞雕像', 5, 0, 0);
      `);

      const res = await harness.request('/api/v1/orders/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch: 'chupei',
          storeId: 'chupei',
          customer: { phone: '111111' },
          lotteries: [
            {
              id: 'LB-PTS-SET-1',
              prize: 'A',
              draws: 1,
              type: '帶走',
              unitPrice: 300,
              amount: 0,
              pointsCost: 15,
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
          checkoutUID: `uid-walkin-pts-set-${Date.now()}`,
        }),
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INVARIANT_VIOLATION');
      expect(body.error.message).toContain('散客');
    });

    it('Walk-In attempting lottery with type: 點數 is rejected with HTTP 400', async () => {
      harness.databases.chupei.rawDb.exec(`
        INSERT INTO lucky_bags (id, store_id, name, unit_price, is_points_set, status)
        VALUES ('LB-NORMAL-1', 'chupei', '標準一番賞', 300, 0, 'ACTIVE');

        INSERT INTO lucky_bag_prizes (id, bag_id, prize_grade, prize_name, draws, drawn_count, points)
        VALUES ('PZ-NORMAL-1', 'LB-NORMAL-1', 'Z', '小賞保底', 10, 0, 1);
      `);

      const res = await harness.request('/api/v1/orders/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch: 'chupei',
          storeId: 'chupei',
          customer: { phone: '222222' },
          lotteries: [
            {
              id: 'LB-NORMAL-1',
              prize: 'Z',
              draws: 1,
              type: '點數',
              unitPrice: 300,
              amount: 300,
              pointsCost: 0,
            },
          ],
          payment: {
            cash: 300,
            creditCard: 0,
            linePay: 0,
            remittance: 0,
            pointsUsed: 0,
          },
          cashierEmail: 'cashier@onesoul.com',
          checkoutUID: `uid-walkin-lot-pts-${Date.now()}`,
        }),
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INVARIANT_VIOLATION');
    });

    it('Walk-In with retail items + 100% cash payment succeeds with HTTP 200/201 and deducts inventory', async () => {
      harness.databases.chupei.rawDb.exec(`
        INSERT INTO products (id, name, category, cost_price, selling_price, suggested_points, version)
        VALUES ('P-WALKIN-RETAIL', '零售海賊王模型', 'GK', 1000, 1500, 50, 1);

        INSERT INTO store_inventories (id, store_id, product_id, quantity, safety_stock, version)
        VALUES ('si-walkin-retail', 'chupei', 'P-WALKIN-RETAIL', 5, 1, 1);
      `);

      const res = await harness.request('/api/v1/orders/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch: 'chupei',
          storeId: 'chupei',
          customer: { phone: '111111', name: '現場散客' },
          merchandises: [
            {
              id: 'P-WALKIN-RETAIL',
              name: '零售海賊王模型',
              quantity: 2,
              paymentType: '現金',
              unitAmount: 1500,
              actualAmount: 3000,
              totalPoints: 0,
            },
          ],
          payment: {
            cash: 3000,
            creditCard: 0,
            linePay: 0,
            remittance: 0,
            pointsUsed: 0,
          },
          cashierEmail: 'cashier@onesoul.com',
          checkoutUID: `uid-walkin-cash-retail-${Date.now()}`,
        }),
      });

      expect([200, 201]).toContain(res.status);
      const body = (await res.json()) as any;
      expect(body.success).toBe(true);

      // Verify stock was deducted: 5 - 2 = 3
      const stock = harness.databases.chupei.rawDb
        .prepare('SELECT quantity FROM store_inventories WHERE store_id = ? AND product_id = ?')
        .get('chupei', 'P-WALKIN-RETAIL') as { quantity: number };
      expect(stock.quantity).toBe(3);
    });
  });

  describe('2. Invariant #2: Allocation Plan Publish & Physical Stock Timing', () => {
    it('Publishing allocation plan leaves physical StoreInventory completely untouched, radar dynamically reflects occupied stock', async () => {
      // 1. Seed product and initial stock = 8
      harness.databases.chupei.rawDb.exec(`
        INSERT INTO products (id, name, category, cost_price, selling_price, suggested_points, version)
        VALUES ('GK-OP-LUFFY', '魯夫五檔 GK 雕像', 'GK', 3000, 5000, 250, 1);

        INSERT INTO store_inventories (id, store_id, product_id, quantity, safety_stock, version)
        VALUES ('si-luffy', 'chupei', 'GK-OP-LUFFY', 8, 2, 1);
      `);

      // 2. Publish allocation plan with 3 draws of GK-OP-LUFFY
      const publishRes = await harness.request('/api/admin/allocation/plans/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '海賊王一番賞 魯夫特賞彈',
          unitPrice: 350,
          totalDraws: 10,
          batchCount: 1,
          blindBoxPoints: 10,
          smallPrizePoints: 1,
          items: [
            {
              grade: 'A',
              name: '魯夫大賞',
              draws: 3,
              productId: 'GK-OP-LUFFY',
              points: 0,
              cost: 3000,
            },
            {
              grade: 'Z',
              name: '保底小賞',
              draws: 7,
              productId: null,
              points: 1,
              cost: 50,
            },
          ],
        }),
      });

      expect(publishRes.status).toBe(200);
      const pubBody = (await publishRes.json()) as any;
      expect(pubBody.success).toBe(true);
      const bagId = pubBody.data.bagIds[0];

      // 3. PHYSICAL INVENTORY CHECK: must STILL BE 8 (NEVER pre-deducted)
      const stockRow = harness.databases.chupei.rawDb
        .prepare('SELECT quantity FROM store_inventories WHERE store_id = ? AND product_id = ?')
        .get('chupei', 'GK-OP-LUFFY') as { quantity: number };
      expect(stockRow.quantity).toBe(8);

      // 4. RADAR CHECK: currentQty = 8, allocatedCount = 3, availableStock = 5
      const radarRes = await harness.request('/api/admin/allocation/live-stock');
      expect(radarRes.status).toBe(200);
      const radarBody = (await radarRes.json()) as any;
      const luffyRadar = radarBody.data.find((item: any) => item.id === 'GK-OP-LUFFY');
      expect(luffyRadar).toBeDefined();
      expect(luffyRadar.stock).toBe(8);
      expect(luffyRadar.allocatedCount).toBe(3);
      expect(luffyRadar.availableStock).toBe(5);
      expect(luffyRadar.isOverAllocated).toBe(false);

      // 5. Checkout with TAKE_AWAY: physical stock MUST be deducted by 1 (8 -> 7)
      const checkoutRes = await harness.request('/api/v1/orders/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch: 'chupei',
          storeId: 'chupei',
          customer: { phone: '0912345678', name: '王小明' },
          lotteries: [
            {
              id: bagId,
              prize: 'A',
              draws: 1,
              type: '帶走', // TAKE_AWAY
              unitPrice: 350,
              amount: 350,
              pointsCost: 0,
            },
          ],
          payment: {
            cash: 350,
            creditCard: 0,
            linePay: 0,
            remittance: 0,
            pointsUsed: 0,
          },
          cashierEmail: 'cashier@onesoul.com',
          checkoutUID: `uid-takeaway-${Date.now()}`,
        }),
      });

      expect(checkoutRes.status).toBe(200);

      // Verify physical stock became 7
      const stockAfterTakeAway = harness.databases.chupei.rawDb
        .prepare('SELECT quantity FROM store_inventories WHERE store_id = ? AND product_id = ?')
        .get('chupei', 'GK-OP-LUFFY') as { quantity: number };
      expect(stockAfterTakeAway.quantity).toBe(7);

      // 6. Checkout with POINTS (non-take-away Z賞): physical stock untouched, member earns points
      const pointsCheckoutRes = await harness.request('/api/v1/orders/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch: 'chupei',
          storeId: 'chupei',
          customer: { phone: '0912345678', name: '王小明' },
          lotteries: [
            {
              id: bagId,
              prize: 'Z',
              draws: 2,
              type: '點數', // convert to points (2 draws * 1 point = 2 points)
              unitPrice: 350,
              amount: 700,
              pointsCost: 0,
            },
          ],
          payment: {
            cash: 700,
            creditCard: 0,
            linePay: 0,
            remittance: 0,
            pointsUsed: 0,
          },
          cashierEmail: 'cashier@onesoul.com',
          checkoutUID: `uid-points-draw-${Date.now()}`,
        }),
      });

      const pointsBody = (await pointsCheckoutRes.json()) as any;
      console.log('pointsCheckoutRes:', pointsCheckoutRes.status, pointsBody);
      expect(pointsCheckoutRes.status).toBe(200);
      expect(pointsBody.data.netPointsDelta).toBe(2);

      // Physical stock still 7
      const stockAfterPoints = harness.databases.chupei.rawDb
        .prepare('SELECT quantity FROM store_inventories WHERE store_id = ? AND product_id = ?')
        .get('chupei', 'GK-OP-LUFFY') as { quantity: number };
      expect(stockAfterPoints.quantity).toBe(7);
    });
  });

  describe('3. Invariant #3: Lock Ordering with localeCompare in Multi-Product Operations', () => {
    it('Multi-product checkout applies deductions in strict localeCompare order', async () => {
      // Seed products in reverse/arbitrary alphabetical order
      harness.databases.chupei.rawDb.exec(`
        INSERT INTO products (id, name, category, cost_price, selling_price, suggested_points, version)
        VALUES 
          ('PROD-ZETA', 'Zeta Model', 'FIGURE', 100, 200, 10, 1),
          ('PROD-ALPHA', 'Alpha Model', 'FIGURE', 100, 200, 10, 1),
          ('PROD-MU', 'Mu Model', 'FIGURE', 100, 200, 10, 1),
          ('PROD-BETA', 'Beta Model', 'FIGURE', 100, 200, 10, 1);

        INSERT INTO store_inventories (id, store_id, product_id, quantity, safety_stock, version)
        VALUES
          ('si-zeta', 'chupei', 'PROD-ZETA', 10, 1, 1),
          ('si-alpha', 'chupei', 'PROD-ALPHA', 10, 1, 1),
          ('si-mu', 'chupei', 'PROD-MU', 10, 1, 1),
          ('si-beta', 'chupei', 'PROD-BETA', 10, 1, 1);
      `);

      // Send unsorted checkout: ZETA, ALPHA, MU, BETA
      const res = await harness.request('/api/v1/orders/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch: 'chupei',
          storeId: 'chupei',
          customer: { phone: '0912345678', name: '王小明' },
          merchandises: [
            { id: 'PROD-ZETA', name: 'Zeta Model', quantity: 2, paymentType: '現金', unitAmount: 200, actualAmount: 400, totalPoints: 0 },
            { id: 'PROD-ALPHA', name: 'Alpha Model', quantity: 3, paymentType: '現金', unitAmount: 200, actualAmount: 600, totalPoints: 0 },
            { id: 'PROD-MU', name: 'Mu Model', quantity: 1, paymentType: '現金', unitAmount: 200, actualAmount: 200, totalPoints: 0 },
            { id: 'PROD-BETA', name: 'Beta Model', quantity: 4, paymentType: '現金', unitAmount: 200, actualAmount: 800, totalPoints: 0 },
          ],
          payment: {
            cash: 2000,
            creditCard: 0,
            linePay: 0,
            remittance: 0,
            pointsUsed: 0,
          },
          cashierEmail: 'cashier@onesoul.com',
          checkoutUID: `uid-multi-lock-${Date.now()}`,
        }),
      });

      expect(res.status).toBe(200);

      // Verify all stock deducted properly
      const getStock = (pid: string) => (harness.databases.chupei.rawDb.prepare('SELECT quantity FROM store_inventories WHERE product_id = ?').get(pid) as any).quantity;
      expect(getStock('PROD-ALPHA')).toBe(7); // 10 - 3
      expect(getStock('PROD-BETA')).toBe(6);  // 10 - 4
      expect(getStock('PROD-MU')).toBe(9);    // 10 - 1
      expect(getStock('PROD-ZETA')).toBe(8);  // 10 - 2
    });

    it('Transfer dispatch applies multi-item lock ordering with localeCompare', async () => {
      harness.databases.chupei.rawDb.exec(`
        INSERT INTO products (id, name, category, cost_price, selling_price, suggested_points, version)
        VALUES 
          ('TR-PROD-C', 'Product C', 'GK', 500, 1000, 50, 1),
          ('TR-PROD-A', 'Product A', 'GK', 500, 1000, 50, 1),
          ('TR-PROD-B', 'Product B', 'GK', 500, 1000, 50, 1);

        INSERT INTO store_inventories (id, store_id, product_id, quantity, safety_stock, version)
        VALUES
          ('si-tr-c', 'chupei', 'TR-PROD-C', 10, 1, 1),
          ('si-tr-a', 'chupei', 'TR-PROD-A', 10, 1, 1),
          ('si-tr-b', 'chupei', 'TR-PROD-B', 10, 1, 1);
      `);

      // Create transfer with items out of order: C, A, B
      const createRes = await harness.request('/api/admin/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceStoreId: 'chupei',
          targetStoreId: 'jinshan',
          items: [
            { productId: 'TR-PROD-C', requestedQty: 2 },
            { productId: 'TR-PROD-A', requestedQty: 3 },
            { productId: 'TR-PROD-B', requestedQty: 1 },
          ],
          dispatchedBy: 'admin@onesoul.com',
          note: '多商品有序調撥',
        }),
      });

      expect(createRes.status).toBe(201);
      const transferId = ((await createRes.json()) as any).data.id;

      // Dispatch transfer
      const dispatchRes = await harness.request(`/api/admin/transfers/${transferId}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operator: 'admin@onesoul.com' }),
      });

      expect(dispatchRes.status).toBe(200);

      // Verify stock in source store chupei
      const getStock = (pid: string) => (harness.databases.chupei.rawDb.prepare('SELECT quantity FROM store_inventories WHERE store_id = ? AND product_id = ?').get('chupei', pid) as any).quantity;
      expect(getStock('TR-PROD-A')).toBe(7);
      expect(getStock('TR-PROD-B')).toBe(9);
      expect(getStock('TR-PROD-C')).toBe(8);
    });
  });

  describe('4. Idempotency on POST /api/v1/orders/checkout', () => {
    it('Duplicate checkoutUID returns HTTP 200 with idempotent response without double-deducting stock or points', async () => {
      harness.databases.chupei.rawDb.exec(`
        INSERT INTO products (id, name, category, cost_price, selling_price, suggested_points, version)
        VALUES ('GK-IDEM', 'Idempotent Model', 'GK', 1000, 2000, 100, 1);

        INSERT INTO store_inventories (id, store_id, product_id, quantity, safety_stock, version)
        VALUES ('si-idem', 'chupei', 'GK-IDEM', 10, 1, 1);
      `);

      const checkoutPayload = {
        branch: 'chupei',
        storeId: 'chupei',
        customer: { phone: '0912345678', name: '王小明' },
        merchandises: [
          {
            id: 'GK-IDEM',
            name: 'Idempotent Model',
            quantity: 2,
            paymentType: '現金',
            unitAmount: 2000,
            actualAmount: 4000,
            totalPoints: 0,
          },
        ],
        payment: {
          cash: 4000,
          creditCard: 0,
          linePay: 0,
          remittance: 0,
          pointsUsed: 0,
        },
        cashierEmail: 'cashier@onesoul.com',
        checkoutUID: `UID-IDEMPOTENT-FIXED-KEY-${Date.now()}`,
      };

      // First Request
      const res1 = await harness.request('/api/v1/orders/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checkoutPayload),
      });

      expect(res1.status).toBe(200);
      const body1 = (await res1.json()) as any;
      expect(body1.success).toBe(true);

      // Verify stock was deducted from 10 to 8
      const stock1 = (harness.databases.chupei.rawDb.prepare('SELECT quantity FROM store_inventories WHERE product_id = ?').get('GK-IDEM') as any).quantity;
      expect(stock1).toBe(8);

      // Second Request with EXACT same checkoutUID
      const res2 = await harness.request('/api/v1/orders/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checkoutPayload),
      });

      expect(res2.status).toBe(200);
      const body2 = (await res2.json()) as any;
      expect(body2.success).toBe(true);
      expect(body2.data.message).toContain('冪等響應');
      expect(body2.data.checkoutUID).toBe(checkoutPayload.checkoutUID);

      // CRITICAL CHECK: Stock must STILL BE 8, NOT 6!
      const stock2 = (harness.databases.chupei.rawDb.prepare('SELECT quantity FROM store_inventories WHERE product_id = ?').get('GK-IDEM') as any).quantity;
      expect(stock2).toBe(8);

      // Only 1 order record in database
      const orderCount = (harness.databases.chupei.rawDb.prepare('SELECT count(*) as count FROM orders WHERE checkout_uid = ?').get(checkoutPayload.checkoutUID) as any).count;
      expect(orderCount).toBe(1);
    });
  });

  describe('5. Negative Stock Deduction & Constraint Violation Error Mapping', () => {
    it('Over-deducting stock beyond available inventory returns standardized Result Pattern error format', async () => {
      harness.databases.chupei.rawDb.exec(`
        INSERT INTO products (id, name, category, cost_price, selling_price, suggested_points, version)
        VALUES ('GK-LOW-STOCK', 'Limited Model', 'GK', 1000, 2000, 100, 1);

        INSERT INTO store_inventories (id, store_id, product_id, quantity, safety_stock, version)
        VALUES ('si-low', 'chupei', 'GK-LOW-STOCK', 1, 1, 1);
      `);

      // Attempt to checkout 5 items when only 1 is in stock
      const res = await harness.request('/api/v1/orders/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch: 'chupei',
          storeId: 'chupei',
          customer: { phone: '0912345678', name: '王小明' },
          merchandises: [
            {
              id: 'GK-LOW-STOCK',
              name: 'Limited Model',
              quantity: 5, // Exceeds stock (1)
              paymentType: '現金',
              unitAmount: 2000,
              actualAmount: 10000,
              totalPoints: 0,
            },
          ],
          payment: {
            cash: 10000,
            creditCard: 0,
            linePay: 0,
            remittance: 0,
            pointsUsed: 0,
          },
          cashierEmail: 'cashier@onesoul.com',
          checkoutUID: `uid-overdraw-stock-${Date.now()}`,
        }),
      });

      const body = (await res.json()) as any;
      console.log('Negative stock deduction response:', res.status, body);

      expect(body.success).toBe(false);
      expect(body.error).toBeDefined();
      expect(body.error.code).toBeDefined();
      expect(body.error.message).toBeDefined();
      expect(body.traceId).toBeDefined();

      // Check status code: is it 422 or 400?
      // Let's observe the exact status code returned!
    });
  });
});
