import { describe, it, expect, beforeEach } from 'vitest';
import { createTestApp, type TestAppInstance } from './helpers/test-app';
import { createOneSoulClient } from '../src/client';

describe('Empirical Verification: OpenAPI 3.1, Client RPC, and Foreign Key Integrity', () => {
  let harness: TestAppInstance;

  beforeEach(() => {
    harness = createTestApp();
  });

  it('OpenAPI /api/doc endpoint enumeration and tag analysis', async () => {
    const res = await harness.request('/api/doc', { method: 'GET' }, '');
    expect(res.status).toBe(200);

    const doc = (await res.json()) as any;
    expect(doc.openapi).toBe('3.1.0');
    expect(doc.info.title).toBe('OneSoul Cloudflare Edge API Gateway');

    const paths = Object.keys(doc.paths || {});
    let totalOperations = 0;
    const tagSet = new Set<string>();
    const operationsList: string[] = [];

    for (const [pathStr, item] of Object.entries(doc.paths)) {
      for (const [method, op] of Object.entries(item as Record<string, any>)) {
        if (['get', 'post', 'put', 'patch', 'delete'].includes(method.toLowerCase())) {
          totalOperations++;
          operationsList.push(`${method.toUpperCase()} ${pathStr}`);
          if (op.tags && Array.isArray(op.tags)) {
            op.tags.forEach((t: string) => tagSet.add(t));
          }
        }
      }
    }

    console.log(`[OpenAPI Audit] Total Unique Paths: ${paths.length}`);
    console.log(`[OpenAPI Audit] Total HTTP Operations: ${totalOperations}`);
    console.log(`[OpenAPI Audit] Registered Tags:`, Array.from(tagSet));

    // Verify comprehensive coverage
    expect(paths.length).toBeGreaterThanOrEqual(40);
    expect(totalOperations).toBeGreaterThanOrEqual(50);
  });

  it('Swagger UI /api/docs returns 200 and loads OpenAPI specification', async () => {
    const res = await harness.request('/api/docs', { method: 'GET' }, '');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');

    const html = await res.text();
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('swagger-ui');
    expect(html).toContain('/api/doc');
  });

  it('Client RPC: Verify exposed routes and type coverage', async () => {
    const client = createOneSoulClient('http://localhost', {
      fetch: async (input, init) => {
        const urlStr = typeof input === 'string' ? input : 'url' in input ? input.url : input.toString();
        const urlObj = new URL(urlStr);
        return harness.app.request(urlObj.pathname + urlObj.search, init, harness.env);
      },
      getStoreId: () => 'chupei',
    });

    // Health check works
    const healthRes = await client.health.$get();
    expect(healthRes.status).toBe(200);

    // Products works
    const prodRes = await client.api.v1.products.$get({ query: {} });
    expect(prodRes.status).toBe(200);

    // Luckybags works
    const bagsRes = await client.api.v1.luckybags.$get();
    expect(bagsRes.status).toBe(200);

    // NOTE: client.api.v1.orders and client.api.admin are missing from AppType
    // because routers in admin/ and v1/ were defined as unchained statements!
    const clientKeys = Object.keys((client as any).api?.v1 || {});
    console.log('[RPC Analysis] v1 keys present in client:', clientKeys);
  });

  it('Empirical Bug Reproduction: PointLog Foreign Key Constraint Failure on Non-TakeAway Lottery Draw', async () => {
    // 1. Seed LuckyBag and Prizes
    harness.databases.chupei.rawDb.exec(`
      INSERT INTO lucky_bags (id, store_id, name, unit_price, is_points_set, status)
      VALUES ('LB-FK-BUG', 'chupei', '測試套組', 300, 0, 'ACTIVE');

      INSERT INTO lucky_bag_prizes (id, bag_id, prize_grade, prize_name, draws, drawn_count, points)
      VALUES ('PZ-FK-Z', 'LB-FK-BUG', 'Z', '保底獎項', 10, 0, 1);
    `);

    // 2. Customer draws Z prize with pickType '點數' (earns 1 point)
    const res = await harness.request('/api/v1/orders/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        branch: 'chupei',
        storeId: 'chupei',
        customer: { phone: '0988776655', name: '測試會員' },
        lotteries: [
          {
            id: 'LB-FK-BUG',
            prize: 'Z',
            draws: 1,
            type: '點數', // Triggers netPointsDelta = 1 > 0
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
        checkoutUID: `uid-fk-bug-${Date.now()}`,
      }),
    });

    const body = (await res.json()) as any;
    console.log('[Bug Reproduction] Checkout with points reward response:', res.status, body);

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.netPointsDelta).toBe(1);
  });
});
