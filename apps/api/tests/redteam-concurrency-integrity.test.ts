import { describe, it, expect, beforeEach } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { createTestD1Database, type TestD1Instance } from './d1-test-harness';
import { createTestApp } from './helpers/test-app';
import {
  D1TransactionManager,
  D1OrderRepository,
  D1InventoryRepository,
  D1LuckyBagRepository,
  D1MemberRepository,
  D1SessionRepository,
  D1TransferRepository,
  D1AuditRepository,
  D1StocktakeRepository,
} from '../src/adapters/d1';
import {
  CheckoutUseCase,
  InventoryUseCase,
} from '../src/core/usecases';
import { Product, StoreInventory } from '../src/core/entities/Product';
import { Member } from '../src/core/entities/Member';
import { PhoneNumber } from '../src/core/entities/PhoneNumber';
import { InsufficientStockError, InvariantViolationError, isOk, isErr } from '@onesoul/shared';
import {
  sortProductIdsForLock,
  validateWalkInBlock,
} from '../src/core/invariants/invariants';

/**
 * 確保資料庫 Schema 套用最新遷移或補齊 SQLite CHECK 約束與硬化欄位
 */
function ensureSchemaHardening(rawDb: any) {
  const migrationsDir = path.resolve(__dirname, '../../../packages/db/drizzle/migrations');
  if (fs.existsSync(migrationsDir)) {
    const files = fs.readdirSync(migrationsDir).sort();
    for (const file of files) {
      if (file.endsWith('.sql') && file !== '0000_smart_ink.sql') {
        const sqlContent = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        for (const stmt of sqlContent.split('--> statement-breakpoint')) {
          const trimmed = stmt.trim();
          if (trimmed) {
            try {
              rawDb.exec(trimmed);
            } catch {
              // 忽略已存在或重複之 DDL
            }
          }
        }
      }
    }
  }

  // 檢查 orders 是否已具備 is_walkin 欄位與 CHECK 約束
  const columns = rawDb.prepare("PRAGMA table_info('orders')").all() as Array<{ name: string }>;
  const hasIsWalkin = columns.some((c) => c.name === 'is_walkin');
  if (!hasIsWalkin) {
    try {
      rawDb.exec(
        'ALTER TABLE orders ADD COLUMN is_walkin INTEGER NOT NULL DEFAULT 0 CHECK (is_walkin = 0 OR points_used = 0);'
      );
    } catch {
      // 忽略已存在之約束
    }
  }
}

describe('Red Team Concurrency & Integrity Scenarios (Cloudflare Edge D1 Hardening)', () => {
  let harness: TestD1Instance;
  let txManager: D1TransactionManager;
  let orderRepo: D1OrderRepository;
  let inventoryRepo: D1InventoryRepository;
  let luckyBagRepo: D1LuckyBagRepository;
  let memberRepo: D1MemberRepository;
  let sessionRepo: D1SessionRepository;
  let transferRepo: D1TransferRepository;
  let auditRepo: D1AuditRepository;
  let stocktakeRepo: D1StocktakeRepository;

  let checkoutUseCase: CheckoutUseCase;
  let inventoryUseCase: InventoryUseCase;

  beforeEach(() => {
    harness = createTestD1Database();
    ensureSchemaHardening(harness.rawDb);
    harness.seedCommonData();

    txManager = new D1TransactionManager(harness.db);
    orderRepo = new D1OrderRepository(harness.db);
    inventoryRepo = new D1InventoryRepository(harness.db);
    luckyBagRepo = new D1LuckyBagRepository(harness.db);
    memberRepo = new D1MemberRepository(harness.db);
    sessionRepo = new D1SessionRepository(harness.db);
    transferRepo = new D1TransferRepository(harness.db);
    auditRepo = new D1AuditRepository(harness.db);
    stocktakeRepo = new D1StocktakeRepository(harness.db);

    checkoutUseCase = new CheckoutUseCase(
      orderRepo,
      inventoryRepo,
      luckyBagRepo,
      memberRepo,
      sessionRepo,
      txManager
    );

    inventoryUseCase = new InventoryUseCase(
      inventoryRepo,
      transferRepo,
      stocktakeRepo,
      auditRepo,
      txManager
    );


  });

  // ═════════════════════════════════════════════════════════════════════════
  // Scenario 1: Member points CAS concurrency conflict rejection
  // ═════════════════════════════════════════════════════════════════════════
  describe('Scenario 1: Member Points CAS Concurrency Conflict Rejection', () => {
    it('rejects stale version update when two concurrent CAS operations target the same member', () => {
      // 1. 初始化具有 100 點、version = 1 之會員
      harness.rawDb.exec(`
        INSERT INTO members (id, phone, name, tier, points, version, total_spent, order_count, is_active)
        VALUES ('mem-cas-001', '0912000001', 'CAS測試員', 'NORMAL', 100, 1, 0, 0, 1);
      `);

      // 2. 模擬機台 A 讀取 snapshot: version = 1, points = 100
      // 模擬機台 B 讀取 snapshot: version = 1, points = 100
      const expectedVersionA = 1;
      const expectedVersionB = 1;

      // 3. 機台 A 執行 CAS 扣點 40 點
      const stmtA = harness.rawDb.prepare(`
        UPDATE members
        SET points = points - 40, version = version + 1
        WHERE id = 'mem-cas-001' AND version = ?;
      `);
      const infoA = stmtA.run(expectedVersionA);
      expect(infoA.changes).toBe(1);

      // 驗證機台 A 成功後，版本升至 2，點數降為 60
      const midCheck = harness.rawDb
        .prepare("SELECT points, version FROM members WHERE id = 'mem-cas-001'")
        .get() as { points: number; version: number };
      expect(midCheck.points).toBe(60);
      expect(midCheck.version).toBe(2);

      // 4. 機台 B 同步嘗試以舊 version = 1 扣點 50 點 (競態雙花攻擊)
      const stmtB = harness.rawDb.prepare(`
        UPDATE members
        SET points = points - 50, version = version + 1
        WHERE id = 'mem-cas-001' AND version = ?;
      `);
      const infoB = stmtB.run(expectedVersionB);

      // 🚨 CAS 核心斷言：因為版本已非 1，WHERE 條件匹配 0 筆，changes 必為 0！
      expect(infoB.changes).toBe(0);

      // 5. 驗證資料庫最終狀態：點數依然為 60，未發生雙花 (Double-Spending)
      const finalCheck = harness.rawDb
        .prepare("SELECT points, version FROM members WHERE id = 'mem-cas-001'")
        .get() as { points: number; version: number };
      expect(finalCheck.points).toBe(60);
      expect(finalCheck.version).toBe(2);
    });

    it('prevents overdraft when concurrent transactions race to exhaust balance with CAS guards', () => {
      // 會員僅持有 50 點，version = 1
      harness.rawDb.exec(`
        INSERT INTO members (id, phone, name, tier, points, version, total_spent, order_count, is_active)
        VALUES ('mem-cas-race', '0912000002', '並發競態會員', 'NORMAL', 50, 1, 0, 0, 1);
      `);

      // 兩筆同時發起欲扣除 40 點之請求（若無 CAS 則 50 - 40 - 40 = -30 破產）
      const attemptDeduction = (deductPts: number, baseVersion: number) => {
        const stmt = harness.rawDb.prepare(`
          UPDATE members
          SET points = points - ?, version = version + 1
          WHERE id = 'mem-cas-race' AND version = ? AND (points - ?) >= 0;
        `);
        const info = stmt.run(deductPts, baseVersion, deductPts);
        if (info.changes === 0) {
          throw new Error('CAS_CONCURRENCY_CONFLICT: 會員點數已被其他連線異動或餘額不足');
        }
        return info;
      };

      // 第一筆以 version = 1 成功扣除
      expect(() => attemptDeduction(40, 1)).not.toThrow();

      // 第二筆以相同 version = 1 嘗試扣除，被 CAS 守衛徹底拒絕
      expect(() => attemptDeduction(40, 1)).toThrow(/CAS_CONCURRENCY_CONFLICT/);

      // 即便第二筆重新獲取 version = 2，點數只剩 10，扣 40 會觸發 (points - 40 >= 0) 阻斷
      expect(() => attemptDeduction(40, 2)).toThrow(/CAS_CONCURRENCY_CONFLICT/);

      const check = harness.rawDb
        .prepare("SELECT points, version FROM members WHERE id = 'mem-cas-race'")
        .get() as { points: number; version: number };
      expect(check.points).toBe(10);
      expect(check.version).toBe(2);
    });

    it('Member entity increments version on point adjustments', () => {
      const member = new Member({
        id: 'mem-entity-cas',
        phone: '0912000003',
        name: '實體版本測試',
        points: 200,
        version: 1,
      });

      expect(member.version).toBe(1);
      member.adjustPoints(-50);
      expect(member.version).toBe(2);
      expect(member.points).toBe(150);

      member.adjustPoints(30);
      expect(member.version).toBe(3);
      expect(member.points).toBe(180);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // Scenario 2: Cross-store inventory transfer deadlock resistance & atomicity
  // ═════════════════════════════════════════════════════════════════════════
  describe('Scenario 2: Cross-Store Inventory Transfer Deadlock Resistance & Transaction Atomicity', () => {
    it('sortProductIdsForLock guarantees deterministic alphabetical sequence regardless of input order or duplicates', () => {
      // 逆序與混亂排列
      const inputA = ['P-ZULU', 'P-BRAVO', 'P-ALPHA', 'P-MIKE'];
      const inputB = ['P-ALPHA', 'P-MIKE', 'P-ZULU', 'P-BRAVO'];
      const inputC = ['P-MIKE', 'P-ALPHA', 'P-BRAVO', 'P-ZULU', 'P-ALPHA', 'P-MIKE'];

      const sortedA = sortProductIdsForLock(inputA);
      const sortedB = sortProductIdsForLock(inputB);
      const sortedC = sortProductIdsForLock(inputC);

      const expected = ['P-ALPHA', 'P-BRAVO', 'P-MIKE', 'P-ZULU'];
      expect(sortedA).toEqual(expected);
      expect(sortedB).toEqual(expected);
      expect(sortedC).toEqual(expected);

      // 中文公仔名稱之 localeCompare 排序確定性
      const chineseNames = ['GK-魯夫-四檔', 'GK-索隆-阿修羅', 'GK-艾斯-大炎戒'];
      const sortedChinese1 = sortProductIdsForLock(chineseNames);
      const sortedChinese2 = sortProductIdsForLock(['GK-索隆-阿修羅', 'GK-艾斯-大炎戒', 'GK-魯夫-四檔']);
      expect(sortedChinese1).toEqual(sortedChinese2);
    });

    it('simulates cross-store bidirectional transfer without deadlock by enforcing localeCompare lock ordering', async () => {
      // 準備品項 P-001 與 P-002
      await inventoryRepo.saveProduct(
        new Product({ id: 'P-CROSS-1', name: '雙向品項1', costPrice: 100, sellingPrice: 200 })
      );
      await inventoryRepo.saveProduct(
        new Product({ id: 'P-CROSS-2', name: '雙向品項2', costPrice: 150, sellingPrice: 300 })
      );

      // 竹北 (chupei) 與 金山 (jinshan) 皆預存庫存
      await inventoryRepo.save(
        new StoreInventory({ id: 'inv-cp-c1', storeId: 'chupei', productId: 'P-CROSS-1', quantity: 20 })
      );
      await inventoryRepo.save(
        new StoreInventory({ id: 'inv-cp-c2', storeId: 'chupei', productId: 'P-CROSS-2', quantity: 20 })
      );
      await inventoryRepo.save(
        new StoreInventory({ id: 'inv-js-c1', storeId: 'jinshan', productId: 'P-CROSS-1', quantity: 15 })
      );
      await inventoryRepo.save(
        new StoreInventory({ id: 'inv-js-c2', storeId: 'jinshan', productId: 'P-CROSS-2', quantity: 15 })
      );

      // 調撥 1: 竹北 -> 金山，傳入逆序品項 ['P-CROSS-2', 'P-CROSS-1']
      const trRes1 = await inventoryUseCase.createTransfer({
        transferNo: 'TR-DEADLOCK-1',
        sourceStoreId: 'chupei',
        targetStoreId: 'jinshan',
        operator: 'dispatcher@onesoul.com',
        items: [
          { productId: 'P-CROSS-2', requestedQty: 5 },
          { productId: 'P-CROSS-1', requestedQty: 3 },
        ],
      });
      expect(isOk(trRes1)).toBe(true);
      if (!isOk(trRes1)) return;

      // 調撥 2: 金山 -> 竹北，傳入順序品項 ['P-CROSS-1', 'P-CROSS-2']
      const trRes2 = await inventoryUseCase.createTransfer({
        transferNo: 'TR-DEADLOCK-2',
        sourceStoreId: 'jinshan',
        targetStoreId: 'chupei',
        operator: 'dispatcher@onesoul.com',
        items: [
          { productId: 'P-CROSS-1', requestedQty: 4 },
          { productId: 'P-CROSS-2', requestedQty: 2 },
        ],
      });
      expect(isOk(trRes2)).toBe(true);
      if (!isOk(trRes2)) return;

      // 執行發貨：底層一律經由 sortProductIdsForLock 獲取鎖，依序更新 P-CROSS-1 再 P-CROSS-2
      const dispatch1 = await inventoryUseCase.dispatchTransfer(trRes1.data.id, 'dispatcher@onesoul.com');
      const dispatch2 = await inventoryUseCase.dispatchTransfer(trRes2.data.id, 'dispatcher@onesoul.com');

      expect(isOk(dispatch1)).toBe(true);
      expect(isOk(dispatch2)).toBe(true);

      // 檢查竹北發貨後庫存: P-CROSS-1 (20 - 3 = 17), P-CROSS-2 (20 - 5 = 15)
      const cp1 = await inventoryRepo.findByStoreAndProduct('chupei', 'P-CROSS-1');
      const cp2 = await inventoryRepo.findByStoreAndProduct('chupei', 'P-CROSS-2');
      expect(cp1?.quantity).toBe(17);
      expect(cp2?.quantity).toBe(15);

      // 檢查金山發貨後庫存: P-CROSS-1 (15 - 4 = 11), P-CROSS-2 (15 - 2 = 13)
      const js1 = await inventoryRepo.findByStoreAndProduct('jinshan', 'P-CROSS-1');
      const js2 = await inventoryRepo.findByStoreAndProduct('jinshan', 'P-CROSS-2');
      expect(js1?.quantity).toBe(11);
      expect(js2?.quantity).toBe(13);
    });

    it('enforces complete atomic rollback when partial item in a cross-store transfer has insufficient stock', async () => {
      // 設置品項：P-001 (充足), P-002 (不足)
      await inventoryRepo.save(
        new StoreInventory({ id: 'inv-atom-1', storeId: 'chupei', productId: 'P-001', quantity: 10 })
      );
      await inventoryRepo.save(
        new StoreInventory({ id: 'inv-atom-2', storeId: 'chupei', productId: 'P-002', quantity: 1 })
      );

      // 建立調撥單欲調撥：P-001: 5 (可滿足), P-002: 8 (超額扣減，將引發 InsufficientStockError)
      const createRes = await inventoryUseCase.createTransfer({
        transferNo: 'TR-ATOMIC-FAIL',
        sourceStoreId: 'chupei',
        targetStoreId: 'jinshan',
        operator: 'manager@onesoul.com',
        items: [
          { productId: 'P-001', requestedQty: 5 },
          { productId: 'P-002', requestedQty: 8 },
        ],
      });
      expect(isOk(createRes)).toBe(true);
      if (!isOk(createRes)) return;
      const transferId = createRes.data.id;

      // 執行發貨，預期整批回滾
      const dispatchRes = await inventoryUseCase.dispatchTransfer(transferId, 'manager@onesoul.com');
      expect(isErr(dispatchRes)).toBe(true);
      expect(dispatchRes.error).toBeInstanceOf(InsufficientStockError);

      // 🚨 原子性驗證：P-001 不可被扣減為 5，必須完整回滾為 10！
      const p1 = await inventoryRepo.findByStoreAndProduct('chupei', 'P-001');
      const p2 = await inventoryRepo.findByStoreAndProduct('chupei', 'P-002');
      expect(p1?.quantity).toBe(10);
      expect(p2?.quantity).toBe(1);

      // 目標門市不可收到任何品項
      const targetP1 = await inventoryRepo.findByStoreAndProduct('jinshan', 'P-001');
      expect(targetP1?.quantity ?? 0).toBe(0);

      // 調撥單狀態必須依然維持 DRAFT
      const orderCheck = await transferRepo.findById(transferId);
      expect(orderCheck?.status).toBe('DRAFT');

      // 庫存異動流水不可殘留此筆調撥之日誌
      const logs = harness.rawDb
        .prepare("SELECT * FROM inventory_logs WHERE reason LIKE '%TR-ATOMIC-FAIL%'")
        .all();
      expect(logs.length).toBe(0);
    });

    it('atomically restores in-transit stock back to source store upon transfer cancellation', async () => {
      // 初始化庫存 10 件
      await inventoryRepo.save(
        new StoreInventory({ id: 'inv-cancel-1', storeId: 'chupei', productId: 'P-001', quantity: 10 })
      );

      // 建立並發貨 4 件 (DISPATCHED, 在途)
      const createRes = await inventoryUseCase.createTransfer({
        transferNo: 'TR-CANCEL-001',
        sourceStoreId: 'chupei',
        targetStoreId: 'jinshan',
        operator: 'dispatcher@onesoul.com',
        items: [{ productId: 'P-001', requestedQty: 4 }],
      });
      expect(isOk(createRes)).toBe(true);
      if (!isOk(createRes)) return;
      const transferId = createRes.data.id;
      await inventoryUseCase.dispatchTransfer(transferId, 'dispatcher@onesoul.com');

      // 發貨後竹北庫存應為 6
      const mid = await inventoryRepo.findByStoreAndProduct('chupei', 'P-001');
      expect(mid?.quantity).toBe(6);

      // 取消調撥單
      const cancelRes = await inventoryUseCase.cancelTransfer(transferId, 'admin@onesoul.com', '門市急需原物料');
      expect(isOk(cancelRes)).toBe(true);

      // 竹北庫存應原子回補為 10
      const restored = await inventoryRepo.findByStoreAndProduct('chupei', 'P-001');
      expect(restored?.quantity).toBe(10);

      // 調撥單狀態為 CANCELLED
      const order = await transferRepo.findById(transferId);
      expect(order?.status).toBe('CANCELLED');
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // Scenario 3: Walk-in customer pointsUsed > 0 hitting SQLite CHECK constraint
  // ═════════════════════════════════════════════════════════════════════════
  describe('Scenario 3: Walk-In Customer Attempting pointsUsed > 0 Directly Hitting SQLite CHECK Constraint', () => {
    it('direct raw SQLite INSERT with is_walkin = 1 and points_used > 0 triggers SQLite CHECK constraint failure', () => {
      // 🚨 核心防禦：底層 SQLite 引擎約束 CHECK (is_walkin = 0 OR points_used = 0)
      expect(() => {
        harness.rawDb.exec(`
          INSERT INTO orders (
            id, checkout_uid, store_id, session_id,
            points_used, is_walkin, cashier_email, status
          ) VALUES (
            'ord-raw-walkin-exploit',
            'uid-raw-walkin-exploit',
            'chupei',
            'sess-001',
            50, -- 🚨 企圖使用 50 點！
            1,  -- 🚨 散客標記 is_walkin = 1！
            'cashier@onesoul.com',
            'COMPLETED'
          );
        `);
      }).toThrow(/CHECK constraint failed/);

      // 驗證惡意訂單未入庫
      const check = harness.rawDb
        .prepare("SELECT * FROM orders WHERE id = 'ord-raw-walkin-exploit'")
        .get();
      expect(check).toBeUndefined();
    });

    it('direct raw SQLite UPDATE setting points_used > 0 on an existing walk-in order triggers CHECK constraint failure', () => {
      // 先建立合法的散客訂單 (is_walkin = 1, points_used = 0)
      harness.rawDb.exec(`
        INSERT INTO orders (
          id, checkout_uid, store_id, session_id,
          points_used, is_walkin, cashier_email, status
        ) VALUES (
          'ord-walkin-legit',
          'uid-walkin-legit',
          'chupei',
          'sess-001',
          0,
          1,
          'cashier@onesoul.com',
          'COMPLETED'
        );
      `);

      // 企圖後門篡改 points_used
      expect(() => {
        harness.rawDb.exec(`
          UPDATE orders SET points_used = 20 WHERE id = 'ord-walkin-legit';
        `);
      }).toThrow(/CHECK constraint failed/);

      const check = harness.rawDb
        .prepare("SELECT points_used FROM orders WHERE id = 'ord-walkin-legit'")
        .get() as { points_used: number };
      expect(check.points_used).toBe(0);
    });

    it('permits valid combinations under SQLite CHECK constraint', () => {
      // 1. 一般會員使用點數：is_walkin = 0, points_used = 100 (合法)
      expect(() => {
        harness.rawDb.exec(`
          INSERT INTO orders (id, checkout_uid, store_id, session_id, points_used, is_walkin, cashier_email)
          VALUES ('ord-ok-member-pts', 'uid-ok-member-pts', 'chupei', 'sess-001', 100, 0, 'cashier@onesoul.com');
        `);
      }).not.toThrow();

      // 2. 散客不使用點數：is_walkin = 1, points_used = 0 (合法)
      expect(() => {
        harness.rawDb.exec(`
          INSERT INTO orders (id, checkout_uid, store_id, session_id, points_used, is_walkin, cashier_email)
          VALUES ('ord-ok-walkin-no-pts', 'uid-ok-walkin-no-pts', 'chupei', 'sess-001', 0, 1, 'cashier@onesoul.com');
        `);
      }).not.toThrow();

      // 3. 一般會員不使用點數：is_walkin = 0, points_used = 0 (合法)
      expect(() => {
        harness.rawDb.exec(`
          INSERT INTO orders (id, checkout_uid, store_id, session_id, points_used, is_walkin, cashier_email)
          VALUES ('ord-ok-member-zero-pts', 'uid-ok-member-zero-pts', 'chupei', 'sess-001', 0, 0, 'cashier@onesoul.com');
        `);
      }).not.toThrow();
    });

    it('validates defense-in-depth across domain pure function, CheckoutUseCase and HTTP gateway', async () => {
      const walkInIdentifiers = ['WALKIN', '111111', '222222', '333333', '88888', '99999', '散客', '現場散客', ''];

      for (const phoneStr of walkInIdentifiers) {
        const phone = new PhoneNumber(phoneStr);
        expect(phone.isWalkIn).toBe(true);

        // 1. Layer 1: Domain Invariant 純函數防禦
        expect(() => {
          validateWalkInBlock(
            phone,
            { cash: 100, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 10 }
          );
        }).toThrow(InvariantViolationError);

        // 2. Layer 2: CheckoutUseCase 防禦
        const result = await checkoutUseCase.execute({
          storeId: 'chupei',
          cashierEmail: 'cashier@onesoul.com',
          customer: { phone: phoneStr, name: '散客測試' },
          payment: { cash: 100, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 10 },
          merchandises: [
            {
              productId: 'P-001',
              quantity: 1,
              unitPrice: 110,
              amount: 100,
              paymentType: '現金',
            },
          ],
          checkoutUID: `uid-walkin-block-${Math.random().toString(36).substring(2, 8)}`,
        });

        expect(isErr(result)).toBe(true);
        expect(result.error).toBeInstanceOf(InvariantViolationError);
        expect(result.error?.message).toContain('散客');
      }

      // 3. Layer 3: API Gateway HTTP 路由防禦
      const testApp = createTestApp();
      for (const rawDb of Object.values(testApp.databases).map((d) => d.rawDb)) {
        ensureSchemaHardening(rawDb);
      }

      const res = await testApp.request('/api/v1/orders/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId: 'chupei',
          customer: { phone: 'WALKIN' },
          payment: { cash: 400, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 50 },
          merchandises: [
            {
              id: 'P-001',
              name: '海賊王 GK 潮流雕像',
              quantity: 1,
              unitAmount: 450,
              actualAmount: 400,
              paymentType: '現金',
            },
          ],
          cashierEmail: 'cashier@onesoul.com',
          checkoutUID: `uid-redteam-api-walkin-${Date.now()}`,
        }),
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INVARIANT_VIOLATION');
      expect(body.error.message).toContain('散客');
    });
  });
});
