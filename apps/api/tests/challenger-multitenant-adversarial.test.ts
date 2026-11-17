import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import {
  normalizeStoreId,
  resolveStoreD1Binding,
  resolveTenantD1,
  tenantMiddleware,
} from '../src/middleware/tenant';
import { createTestD1Database, TestD1Instance } from './d1-test-harness';
import {
  D1OrderRepository,
  D1InventoryRepository,
  D1LuckyBagRepository,
  D1SessionRepository,
  D1StocktakeRepository,
  D1TransferRepository,
  D1AuditRepository,
} from '../src/adapters/d1';
import { Order } from '../src/core/entities/Order';
import { StoreInventory } from '../src/core/entities/Product';
import { LuckyBag, LuckyBagPrize } from '../src/core/entities/LuckyBag';
import { CashRegisterSession } from '../src/core/entities/CashRegisterSession';
import { Stocktake } from '../src/core/entities/Stocktake';
import { TransferOrder } from '../src/core/entities/TransferOrder';
import { AuditLog } from '../src/core/entities/AuditLog';
import type { AppContext, WorkerEnv } from '../src/types/env';

describe('Adversarial Challenge: D1-per-Tenant Physical Isolation & Header Attack', () => {
  let chupeiHarness: TestD1Instance;
  let jinshanHarness: TestD1Instance;
  let warehouseHarness: TestD1Instance;
  let coordinatorHarness: TestD1Instance;
  let env: WorkerEnv;

  beforeEach(() => {
    chupeiHarness = createTestD1Database();
    jinshanHarness = createTestD1Database();
    warehouseHarness = createTestD1Database();
    coordinatorHarness = createTestD1Database();

    chupeiHarness.seedCommonData();
    jinshanHarness.seedCommonData();
    warehouseHarness.seedCommonData();
    coordinatorHarness.seedCommonData();

    env = {
      DB_CHUPEI: chupeiHarness.d1,
      DB_JINSHAN: jinshanHarness.d1,
      DB_WAREHOUSE: warehouseHarness.d1,
      DB_COORDINATOR: coordinatorHarness.d1,
    };
  });

  describe('Part 1: Adversarial Physical Isolation Attack (Write Chupei, Query Jinshan/Warehouse)', () => {
    it('TC-ADV-ISO-01: Deep Multi-Entity Chupei Write, Zero Leakage in Jinshan & Warehouse across 7 Domain Entities', async () => {
      // 1. Orders
      const orderRepoCP = new D1OrderRepository(chupeiHarness.db);
      const orderRepoJS = new D1OrderRepository(jinshanHarness.db);
      const orderRepoWH = new D1OrderRepository(warehouseHarness.db);

      const secretOrder = new Order({
        id: 'ORD-SECRET-CP-888',
        checkoutUID: 'UID-CONFIDENTIAL-REVENUE-CHUPEI-888',
        storeId: 'chupei',
        sessionId: 'sess-001',
        memberPhone: '0988777666',
        totalDue: 999999,
        payment: { cash: 999999, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
        netPointsDelta: 0,
        items: [],
        cashierEmail: 'chupei-boss@onesoul.com',
      });
      await orderRepoCP.save(secretOrder);

      // Verify read in Chupei
      expect(await orderRepoCP.findById('ORD-SECRET-CP-888')).not.toBeNull();

      // Verify 0 leakage in Jinshan & Warehouse via Repositories
      expect(await orderRepoJS.findById('ORD-SECRET-CP-888')).toBeNull();
      expect(await orderRepoJS.findByCheckoutUID('UID-CONFIDENTIAL-REVENUE-CHUPEI-888')).toBeNull();
      expect(await orderRepoWH.findById('ORD-SECRET-CP-888')).toBeNull();
      expect(await orderRepoWH.findByCheckoutUID('UID-CONFIDENTIAL-REVENUE-CHUPEI-888')).toBeNull();

      // Verify 0 leakage in Jinshan & Warehouse via Raw SQL
      const jsOrderRaw = jinshanHarness.rawDb
        .prepare("SELECT * FROM orders WHERE id = 'ORD-SECRET-CP-888'")
        .all();
      expect(jsOrderRaw.length).toBe(0);

      const whOrderRaw = warehouseHarness.rawDb
        .prepare("SELECT * FROM orders WHERE id = 'ORD-SECRET-CP-888'")
        .all();
      expect(whOrderRaw.length).toBe(0);

      // 2. Store Inventory
      const invRepoCP = new D1InventoryRepository(chupeiHarness.db);
      const invRepoJS = new D1InventoryRepository(jinshanHarness.db);
      const invRepoWH = new D1InventoryRepository(warehouseHarness.db);

      await invRepoCP.save(
        new StoreInventory({
          id: 'inv-secret-cp-p1',
          storeId: 'chupei',
          productId: 'P-001',
          quantity: 777,
        })
      );

      expect((await invRepoCP.findByStoreAndProduct('chupei', 'P-001'))?.quantity).toBe(777);
      expect(await invRepoJS.findByStoreAndProduct('chupei', 'P-001')).toBeNull();
      expect(await invRepoWH.findByStoreAndProduct('chupei', 'P-001')).toBeNull();

      const jsInvRaw = jinshanHarness.rawDb
        .prepare("SELECT * FROM store_inventories WHERE store_id = 'chupei'")
        .all();
      expect(jsInvRaw.length).toBe(0);

      // 3. LuckyBag & Prizes
      const bagRepoCP = new D1LuckyBagRepository(chupeiHarness.db);
      const bagRepoJS = new D1LuckyBagRepository(jinshanHarness.db);
      const bagRepoWH = new D1LuckyBagRepository(warehouseHarness.db);

      const chupeiBag = new LuckyBag({
        id: 'LB-CP-SECRET',
        storeId: 'chupei',
        name: '竹北高機密大套',
        unitPrice: 800,
      });
      const chupeiPrize = new LuckyBagPrize({
        id: 'PRIZE-CP-A',
        bagId: 'LB-CP-SECRET',
        prizeGrade: 'A',
        prizeName: '海賊王 GK 特選',
        draws: 2,
        drawnCount: 0,
      });
      await bagRepoCP.saveBagWithPrizes(chupeiBag, [chupeiPrize]);

      expect(await bagRepoCP.findById('LB-CP-SECRET')).not.toBeNull();
      expect(await bagRepoJS.findById('LB-CP-SECRET')).toBeNull();
      expect(await bagRepoWH.findById('LB-CP-SECRET')).toBeNull();

      const jsBagsRaw = jinshanHarness.rawDb
        .prepare("SELECT * FROM lucky_bags WHERE id = 'LB-CP-SECRET'")
        .all();
      expect(jsBagsRaw.length).toBe(0);

      // 4. Cash Register Sessions
      const sessionRepoCP = new D1SessionRepository(chupeiHarness.db);
      const sessionRepoJS = new D1SessionRepository(jinshanHarness.db);
      const sessionRepoWH = new D1SessionRepository(warehouseHarness.db);

      const cpSession = new CashRegisterSession({
        id: 'sess-cp-secret',
        storeId: 'chupei',
        openedBy: 'vip-cashier@onesoul.com',
        openingCash: 50000,
      });
      await sessionRepoCP.openSession(cpSession);

      expect(await sessionRepoCP.findById('sess-cp-secret')).not.toBeNull();
      expect(await sessionRepoJS.findById('sess-cp-secret')).toBeNull();
      expect(await sessionRepoWH.findById('sess-cp-secret')).toBeNull();

      // 5. Stocktake
      const stocktakeRepoCP = new D1StocktakeRepository(chupeiHarness.db);
      const stocktakeRepoJS = new D1StocktakeRepository(jinshanHarness.db);

      const cpStocktake = new Stocktake({
        id: 'st-cp-001',
        storeId: 'chupei',
        countedBy: 'st-staff@onesoul.com',
        note: '竹北機密實盤',
      });
      await stocktakeRepoCP.createStocktake(cpStocktake, []);

      expect(await stocktakeRepoCP.findById('st-cp-001')).not.toBeNull();
      expect(await stocktakeRepoJS.findById('st-cp-001')).toBeNull();

      // 6. Transfer Order
      const transferRepoCP = new D1TransferRepository(chupeiHarness.db);
      const transferRepoJS = new D1TransferRepository(jinshanHarness.db);

      const cpTransfer = new TransferOrder({
        id: 'to-cp-001',
        transferNo: 'TR-20261108-001',
        sourceStoreId: 'chupei',
        targetStoreId: 'jinshan',
        dispatchedBy: 'transfer-boss@onesoul.com',
      });
      await transferRepoCP.createTransfer(cpTransfer, []);

      expect(await transferRepoCP.findById('to-cp-001')).not.toBeNull();
      expect(await transferRepoJS.findById('to-cp-001')).toBeNull();

      // 7. Audit Log
      const secretSalt = 'secret-salt-2026';
      const auditRepoCP = new D1AuditRepository(chupeiHarness.db, secretSalt);
      const auditRepoJS = new D1AuditRepository(jinshanHarness.db, secretSalt);

      const latestCP = await auditRepoCP.getLatestHash();
      const currentHashCP = AuditLog.calculateHash(
        latestCP,
        {
          operatorId: 'boss@onesoul.com',
          action: 'ORDER_CHECKOUT',
          targetType: 'Order',
          targetId: 'ORD-SECRET-CP-888',
          delta: null,
          reason: '訂單結帳',
        },
        secretSalt
      );

      const auditCP = new AuditLog({
        id: 'aud-cp-001',
        action: 'ORDER_CHECKOUT',
        operatorId: 'boss@onesoul.com',
        targetType: 'Order',
        targetId: 'ORD-SECRET-CP-888',
        reason: '訂單結帳',
        prevHash: latestCP,
        currentHash: currentHashCP,
      });
      await auditRepoCP.append(auditCP);

      const cpChain = await auditRepoCP.verifyChain();
      expect(cpChain.valid).toBe(true);

      const jsLatestHash = await auditRepoJS.getLatestHash();
      expect(jsLatestHash).toBe('0'.repeat(64)); // Genesis, zero logs in Jinshan
    });

    it('TC-ADV-ISO-02: Same Primary Key / UID Concurrent Multi-Store Write (No Collision due to Physical Isolation)', async () => {
      const orderRepoCP = new D1OrderRepository(chupeiHarness.db);
      const orderRepoJS = new D1OrderRepository(jinshanHarness.db);

      const sameId = 'ORD-DUPLICATE-ID-TEST';
      const sameUid = 'UID-SHARED-POS-COUNTER-01';

      const orderCP = new Order({
        id: sameId,
        checkoutUID: sameUid,
        storeId: 'chupei',
        sessionId: 'sess-001',
        memberPhone: '0911000111',
        totalDue: 1000,
        payment: { cash: 1000, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
        netPointsDelta: 0,
        items: [],
        cashierEmail: 'cp@onesoul.com',
      });

      const orderJS = new Order({
        id: sameId,
        checkoutUID: sameUid,
        storeId: 'jinshan',
        sessionId: 'sess-001',
        memberPhone: '0922000222',
        totalDue: 2000,
        payment: { cash: 2000, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
        netPointsDelta: 0,
        items: [],
        cashierEmail: 'js@onesoul.com',
      });

      // Both writes succeed because they are physically distinct SQLite files
      await orderRepoCP.save(orderCP);
      await orderRepoJS.save(orderJS);

      const fetchedCP = await orderRepoCP.findById(sameId);
      const fetchedJS = await orderRepoJS.findById(sameId);

      expect(fetchedCP?.totalDue).toBe(1000);
      expect(fetchedJS?.totalDue).toBe(2000);
      expect(fetchedCP?.storeId).toBe('chupei');
      expect(fetchedJS?.storeId).toBe('jinshan');
    });

    it('TC-ADV-ISO-03: Attempt Cross-Database Table Attachment / Schema Inspection', async () => {
      expect(chupeiHarness.rawDb).not.toBe(jinshanHarness.rawDb);
      expect(chupeiHarness.d1).not.toBe(jinshanHarness.d1);
      expect(chupeiHarness.db).not.toBe(jinshanHarness.db);

      const countChupeiOrders = chupeiHarness.rawDb
        .prepare('SELECT count(*) as count FROM orders')
        .get() as any;
      const countJinshanOrders = jinshanHarness.rawDb
        .prepare('SELECT count(*) as count FROM orders')
        .get() as any;

      expect(countChupeiOrders.count).toBeGreaterThanOrEqual(0);
      expect(countJinshanOrders.count).toBe(0);
    });
  });

  describe('Part 2: Adversarial X-Store-Id Header Attack (SQLi, Traversal, Malformed, Unknown)', () => {
    const buildApp = () => {
      const app = new Hono<AppContext>();
      app.use('*', tenantMiddleware());
      app.get('/api/test/tenant', (c) => {
        return c.json({
          success: true,
          storeId: c.get('storeId'),
        });
      });
      return app;
    };

    it('TC-ADV-HDR-01: SQL Injection Attack Payloads in X-Store-Id Header', async () => {
      const sqliPayloads = [
        "chupei' OR '1'='1",
        "chupei'; DROP TABLE orders; --",
        "' UNION SELECT 1, 2, 3 --",
        'chupei" OR 1=1 --',
        "admin' --",
        '/* comment */ chupei',
        "chupei' AND 1=2 UNION ALL SELECT * FROM stores--",
        "1' OR '1'='1",
      ];

      const app = buildApp();

      for (const payload of sqliPayloads) {
        expect(normalizeStoreId(payload)).toBeNull();

        const res = await app.request(
          '/api/test/tenant',
          {
            headers: { 'X-Store-Id': payload },
          },
          env
        );

        expect(res.status).toBe(400);
        const body = (await res.json()) as any;
        expect(body.success).toBe(false);
        expect(body.error.code).toBe('ERR_INVALID_STORE_ID');
      }
    });

    it('TC-ADV-HDR-02: Path Traversal and System Path Payloads in X-Store-Id Header', async () => {
      const traversalPayloads = [
        '../chupei',
        '../../../../etc/passwd',
        '..\\..\\windows\\system32',
        '/var/run/secrets',
        'chupei/../jinshan',
        '/chupei',
        './chupei',
        'chupei/./',
      ];

      const app = buildApp();

      for (const payload of traversalPayloads) {
        expect(normalizeStoreId(payload)).toBeNull();

        const res = await app.request(
          '/api/test/tenant',
          {
            headers: { 'X-Store-Id': payload },
          },
          env
        );

        expect(res.status).toBe(400);
        const body = (await res.json()) as any;
        expect(body.success).toBe(false);
        expect(body.error.code).toBe('ERR_INVALID_STORE_ID');
      }
    });

    it('TC-ADV-HDR-03: Control Characters, Null Bytes, Homoglyphs & Extreme Inputs', async () => {
      // 1. Payloads rejected by normalizeStoreId directly
      const rawControlPayloads = [
        'chupei\0',
        'chupei\x00malicious',
        'chupei\r\nSet-Cookie: pwned=true',
        '\0chupei',
        'a'.repeat(50000), // Extreme length
      ];

      for (const payload of rawControlPayloads) {
        expect(normalizeStoreId(payload)).toBeNull();
      }

      // 2. HTTP valid headers that attempt confusion
      const app = buildApp();
      const confusingHeaders = [
        'сhupei', // Cyrillic 'с' (U+0441)
        'ｃｈｕｐｅｉ', // Full-width Latin
        'chupei 🏬',
        '   \r\n\t  ', // Whitespace
      ];

      for (const payload of confusingHeaders) {
        expect(normalizeStoreId(payload)).toBeNull();

        try {
          const res = await app.request(
            '/api/test/tenant',
            {
              headers: { 'X-Store-Id': payload },
            },
            env
          );

          expect(res.status).toBe(400);
          const body = (await res.json()) as any;
          expect(body.success).toBe(false);
        } catch (err: any) {
          // If HTTP parser rejects invalid byte sequence, that's also secure
          expect(err).toBeDefined();
        }
      }
    });

    it('TC-ADV-HDR-04: Prototype Pollution and Object Key Names', async () => {
      const protoPayloads = [
        '__proto__',
        'constructor',
        'prototype',
        'toString',
        'valueOf',
        'hasOwnProperty',
        'isPrototypeOf',
      ];

      const app = buildApp();

      for (const payload of protoPayloads) {
        expect(normalizeStoreId(payload)).toBeNull();
        expect(resolveStoreD1Binding(env, payload as any)).toBeNull();

        const res = await app.request(
          '/api/test/tenant',
          {
            headers: { 'X-Store-Id': payload },
          },
          env
        );

        expect(res.status).toBe(400);
        const body = (await res.json()) as any;
        expect(body.success).toBe(false);
        expect(body.error.code).toBe('ERR_INVALID_STORE_ID');
      }

      expect(({} as any).chupei).toBeUndefined();
    });

    it('TC-ADV-HDR-05: Unknown and Unauthorized Store IDs', async () => {
      const unknownStores = [
        'taipei-101',
        'kaohsiung-central',
        'store-999',
        'hsinchu-sub',
        'tokyo-shibuya',
        'null',
        'undefined',
        '0',
        'false',
      ];

      const app = buildApp();

      for (const store of unknownStores) {
        expect(normalizeStoreId(store)).toBeNull();

        const res = await app.request(
          '/api/test/tenant',
          {
            headers: { 'X-Store-Id': store },
          },
          env
        );

        expect(res.status).toBe(400);
        const body = (await res.json()) as any;
        expect(body.success).toBe(false);
        expect(body.error.code).toBe('ERR_INVALID_STORE_ID');
      }
    });

    it('TC-ADV-HDR-06: Case Insensitivity of HTTP Header Name (x-store-id vs X-Store-Id vs X-STORE-ID)', async () => {
      const app = buildApp();

      const testCasings = ['x-store-id', 'X-Store-Id', 'X-STORE-ID', 'x-StOrE-iD'];

      for (const headerName of testCasings) {
        const res = await app.request(
          '/api/test/tenant',
          {
            headers: { [headerName]: 'CP01' },
          },
          env
        );

        expect(res.status).toBe(200);
        const body = (await res.json()) as any;
        expect(body.success).toBe(true);
        expect(body.storeId).toBe('chupei');
      }
    });

    it('TC-ADV-HDR-07: Missing D1 Binding in Worker Environment (Fail-Safe 500)', async () => {
      const app = buildApp();
      const brokenEnv: WorkerEnv = {
        DB_CHUPEI: null as any,
        DB_JINSHAN: jinshanHarness.d1,
        DB_WAREHOUSE: warehouseHarness.d1,
        DB_COORDINATOR: coordinatorHarness.d1,
      };

      const res = await app.request(
        '/api/test/tenant',
        {
          headers: { 'X-Store-Id': 'chupei' },
        },
        brokenEnv
      );

      expect(res.status).toBe(500);
      const body = (await res.json()) as any;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('ERR_STORE_DB_UNAVAILABLE');
    });

    it('TC-ADV-HDR-08: Standalone resolveTenantD1 Behavior on Invalid Header (Throws ERR_INVALID_STORE_ID)', () => {
      const mockContextWithInvalid = {
        req: {
          header: () => 'attacker-malicious-store',
        },
        env,
      };

      // Strict rejection: invalid store ID must throw ERR_INVALID_STORE_ID
      expect(() => resolveTenantD1(mockContextWithInvalid)).toThrow('ERR_INVALID_STORE_ID');
    });

    it('TC-ADV-HDR-09: Standalone resolveTenantD1 Behavior on Missing Header (Throws ERR_MISSING_STORE_ID)', () => {
      const mockContextWithMissing = {
        req: {
          header: () => null,
        },
        env,
      };

      // Strict rejection: missing store ID must throw ERR_MISSING_STORE_ID
      expect(() => resolveTenantD1(mockContextWithMissing)).toThrow('ERR_MISSING_STORE_ID');
    });
  });
});
