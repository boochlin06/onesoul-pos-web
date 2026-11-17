import { describe, it, expect, beforeEach } from 'vitest';
import { createTestD1Database, TestD1Instance } from './d1-test-harness';
import {
  D1OrderRepository,
  D1InventoryRepository,
  D1LuckyBagRepository,
  D1SessionRepository,
} from '../src/adapters/d1';
import { Order } from '../src/core/entities/Order';
import { StoreInventory } from '../src/core/entities/Product';
import { LuckyBag } from '../src/core/entities/LuckyBag';
import { CashRegisterSession } from '../src/core/entities/CashRegisterSession';

describe('D1-per-Tenant Physical SQLite Isolation Test Suite', () => {
  let chupeiHarness: TestD1Instance;
  let jinshanHarness: TestD1Instance;
  let warehouseHarness: TestD1Instance;

  let chupeiOrderRepo: D1OrderRepository;
  let jinshanOrderRepo: D1OrderRepository;

  let chupeiInvRepo: D1InventoryRepository;
  let jinshanInvRepo: D1InventoryRepository;

  let chupeiBagRepo: D1LuckyBagRepository;
  let jinshanBagRepo: D1LuckyBagRepository;

  let chupeiSessionRepo: D1SessionRepository;
  let jinshanSessionRepo: D1SessionRepository;

  beforeEach(() => {
    // 建立 3 座完全獨立的實體 SQLite 記憶體檔案
    chupeiHarness = createTestD1Database();
    jinshanHarness = createTestD1Database();
    warehouseHarness = createTestD1Database();

    chupeiHarness.seedCommonData();
    jinshanHarness.seedCommonData();
    warehouseHarness.seedCommonData();

    chupeiOrderRepo = new D1OrderRepository(chupeiHarness.db);
    jinshanOrderRepo = new D1OrderRepository(jinshanHarness.db);

    chupeiInvRepo = new D1InventoryRepository(chupeiHarness.db);
    jinshanInvRepo = new D1InventoryRepository(jinshanHarness.db);

    chupeiBagRepo = new D1LuckyBagRepository(chupeiHarness.db);
    jinshanBagRepo = new D1LuckyBagRepository(jinshanHarness.db);

    chupeiSessionRepo = new D1SessionRepository(chupeiHarness.db);
    jinshanSessionRepo = new D1SessionRepository(jinshanHarness.db);
  });

  it('TC-ISO-01: 銷售訂單在竹北與金山門市實體 SQLite 資料庫之間具備絕對物理隔離', async () => {
    // 1. 向竹北門市寫入銷售訂單
    const order = new Order({
      id: 'ORD-CP-999',
      checkoutUID: 'UID-CP-SECRET-REVENUE-01',
      storeId: 'chupei',
      sessionId: 'sess-001',
      memberPhone: '0912000001',
      totalDue: 68000,
      payment: { cash: 68000, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
      netPointsDelta: 0,
      items: [],
      cashierEmail: 'chupei@onesoul.com',
    });
    await chupeiOrderRepo.save(order);

    // 2. 驗證竹北能成功讀取
    const chupeiOrder = await chupeiOrderRepo.findById('ORD-CP-999');
    expect(chupeiOrder).not.toBeNull();
    expect(chupeiOrder?.totalDue).toBe(68000);

    // 3. 驗證金山店實體 SQLite 內絕對查無該訂單 (物理絕緣)
    const jinshanOrder = await jinshanOrderRepo.findById('ORD-CP-999');
    expect(jinshanOrder).toBeNull();

    const jinshanByUid = await jinshanOrderRepo.findByCheckoutUID('UID-CP-SECRET-REVENUE-01');
    expect(jinshanByUid).toBeNull();

    // 4. 金山店訂單清單仍為空
    const jinshanOrders = await jinshanOrderRepo.listByStore('jinshan');
    expect(jinshanOrders.length).toBe(0);
  });

  it('TC-ISO-02: 門市現貨在庫數量在不同資料庫實體間獨立計算且互不影響', async () => {
    // 竹北現貨 50 件
    await chupeiInvRepo.save(
      new StoreInventory({
        id: 'inv-cp-01',
        storeId: 'chupei',
        productId: 'P-001',
        quantity: 50,
      })
    );

    // 金山現貨 2 件
    await jinshanInvRepo.save(
      new StoreInventory({
        id: 'inv-js-01',
        storeId: 'jinshan',
        productId: 'P-001',
        quantity: 2,
      })
    );

    // 竹北扣減 20 件
    await chupeiInvRepo.deductQuantities('chupei', [{ productId: 'P-001', quantity: 20 }]);

    const chupeiStock = await chupeiInvRepo.findByStoreAndProduct('chupei', 'P-001');
    const jinshanStock = await jinshanInvRepo.findByStoreAndProduct('jinshan', 'P-001');

    expect(chupeiStock?.quantity).toBe(30);
    expect(jinshanStock?.quantity).toBe(2); // 金山庫存絲毫不受影響
  });

  it('TC-ISO-03: 一番賞套組開套狀態在各門市實體分立', async () => {
    const bagChupei = new LuckyBag({
      id: 'LB-CHUPEI-EXCLUSIVE',
      storeId: 'chupei',
      name: '竹北旗艦限定一番賞',
      unitPrice: 500,
    });
    await chupeiBagRepo.saveBagWithPrizes(bagChupei, []);

    const foundInChupei = await chupeiBagRepo.findById('LB-CHUPEI-EXCLUSIVE');
    expect(foundInChupei).not.toBeNull();

    const foundInJinshan = await jinshanBagRepo.findById('LB-CHUPEI-EXCLUSIVE');
    expect(foundInJinshan).toBeNull();
  });

  it('TC-ISO-04: 收銀班次開關帳記錄在門市實體檔案中完全隔離', async () => {
    const chupeiSession = new CashRegisterSession({
      id: 'sess-cp-morning',
      storeId: 'chupei',
      openedBy: 'staff-cp@onesoul.com',
      openingCash: 10000,
    });
    await chupeiSessionRepo.openSession(chupeiSession);

    const sessionInChupei = await chupeiSessionRepo.findById('sess-cp-morning');
    expect(sessionInChupei?.id).toBe('sess-cp-morning');
    expect(sessionInChupei?.openedBy).toBe('staff-cp@onesoul.com');

    const sessionInJinshan = await jinshanSessionRepo.findById('sess-cp-morning');
    expect(sessionInJinshan).toBeNull();

  });
});
