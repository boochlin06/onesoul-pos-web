import { describe, it, expect, beforeEach } from 'vitest';
import {
  InventoryUseCase,
  InMemoryInventoryRepository,
  InMemoryTransferRepository,
  InMemoryStocktakeRepository,
  InMemoryAuditRepository,
  InMemoryTransactionManager,
  Product,
  StoreInventory,
} from '../src';
import { isOk, isErr } from '@onesoul/shared';

describe('InventoryUseCase', () => {
  let inventoryUseCase: InventoryUseCase;
  let invRepo: InMemoryInventoryRepository;
  let transferRepo: InMemoryTransferRepository;
  let stocktakeRepo: InMemoryStocktakeRepository;
  let auditRepo: InMemoryAuditRepository;
  let txManager: InMemoryTransactionManager;

  beforeEach(async () => {
    invRepo = new InMemoryInventoryRepository();
    transferRepo = new InMemoryTransferRepository();
    stocktakeRepo = new InMemoryStocktakeRepository();
    auditRepo = new InMemoryAuditRepository();
    txManager = new InMemoryTransactionManager();

    txManager.register(invRepo);
    txManager.register(transferRepo);
    txManager.register(stocktakeRepo);
    txManager.register(auditRepo);

    inventoryUseCase = new InventoryUseCase(
      invRepo,
      transferRepo,
      stocktakeRepo,
      auditRepo,
      txManager
    );

    // Seed products
    await invRepo.saveProduct(
      new Product({ id: 'GK-4100', name: 'GK 索隆', costPrice: 2000, sellingPrice: 3500 })
    );
    await invRepo.saveProduct(
      new Product({ id: 'GK-4101', name: 'GK 魯夫', costPrice: 2200, sellingPrice: 3800 })
    );

    // Seed inventories (Chupei: 5, Jinshan: 0, Warehouse: 10)
    await invRepo.save(
      new StoreInventory({ id: 'inv-cp-1', storeId: 'chupei', productId: 'GK-4100', quantity: 5 })
    );
    await invRepo.save(
      new StoreInventory({ id: 'inv-wh-1', storeId: 'warehouse-main', productId: 'GK-4100', quantity: 10 })
    );
    await invRepo.save(
      new StoreInventory({ id: 'inv-wh-2', storeId: 'warehouse-main', productId: 'GK-4101', quantity: 8 })
    );
  });

  describe('1. Manual Stock Adjustment', () => {
    it('manually adds stock and records inventory & audit logs', async () => {
      const res = await inventoryUseCase.adjustStock({
        storeId: 'chupei',
        productId: 'GK-4100',
        delta: 3,
        reason: '門市進貨補貨',
        operator: 'manager@onesoul.tw',
      });

      expect(isOk(res)).toBe(true);
      if (!isOk(res)) return;
      expect(res.data.quantity).toBe(8); // 5 + 3 = 8

      // Check inventory log
      const logs = await invRepo.findLogsByStore('chupei');
      expect(logs.length).toBe(1);
      expect(logs[0].changeType).toBe('MANUAL_ADJUST');
      expect(logs[0].delta).toBe(3);

      // Check audit log
      const auditLogs = await auditRepo.list();
      expect(auditLogs.length).toBe(1);
      expect(auditLogs[0].action).toBe('MANUAL_STOCK_ADJUST');
    });

    it('manually deducts stock and prevents negative inventory', async () => {
      const resOk = await inventoryUseCase.adjustStock({
        storeId: 'chupei',
        productId: 'GK-4100',
        delta: -3,
        reason: '商品包裝受損報廢',
        operator: 'manager@onesoul.tw',
      });
      expect(isOk(resOk)).toBe(true);
      expect(resOk.data?.quantity).toBe(2); // 5 - 3 = 2

      // Fails when deducting beyond current stock (2 - 5 = -3 < 0)
      const resFail = await inventoryUseCase.adjustStock({
        storeId: 'chupei',
        productId: 'GK-4100',
        delta: -5,
        reason: '過度扣減報廢',
        operator: 'manager@onesoul.tw',
      });
      expect(isErr(resFail)).toBe(true);
      expect(resFail.error?.code).toBe('INSUFFICIENT_STOCK');

      // Verify stock stays at 2
      const inv = await invRepo.findByStoreAndProduct('chupei', 'GK-4100');
      expect(inv?.quantity).toBe(2);
    });
  });

  describe('2. TransferOrder Full Lifecycle', () => {
    it('handles DRAFT -> DISPATCHED -> RECEIVED cross-store flow', async () => {
      // 1. Create Transfer Order: Warehouse to Jinshan
      const createRes = await inventoryUseCase.createTransfer({
        sourceStoreId: 'warehouse-main',
        targetStoreId: 'jinshan',
        operator: 'logistics@onesoul.tw',
        note: '金山門市週五補貨',
        items: [
          { productId: 'GK-4100', requestedQty: 4 },
          { productId: 'GK-4101', requestedQty: 3 },
        ],
      });

      expect(isOk(createRes)).toBe(true);
      if (!isOk(createRes)) return;
      const transferId = createRes.data.id;
      expect(createRes.data.status).toBe('DRAFT');

      // Stock has not changed yet during DRAFT
      expect((await invRepo.findByStoreAndProduct('warehouse-main', 'GK-4100'))?.quantity).toBe(10);
      expect((await invRepo.findByStoreAndProduct('jinshan', 'GK-4100'))?.quantity ?? 0).toBe(0);

      // 2. Dispatch Transfer (DRAFT -> DISPATCHED)
      const dispatchRes = await inventoryUseCase.dispatchTransfer(transferId, 'warehouse_staff@onesoul.tw');
      expect(isOk(dispatchRes)).toBe(true);
      expect(dispatchRes.data?.status).toBe('DISPATCHED');

      // Warehouse stock deducted
      expect((await invRepo.findByStoreAndProduct('warehouse-main', 'GK-4100'))?.quantity).toBe(6); // 10 - 4
      expect((await invRepo.findByStoreAndProduct('warehouse-main', 'GK-4101'))?.quantity).toBe(5); // 8 - 3
      // Jinshan stock not added yet (in transit)
      expect((await invRepo.findByStoreAndProduct('jinshan', 'GK-4100'))?.quantity ?? 0).toBe(0);

      // 3. Receive Transfer (DISPATCHED -> RECEIVED)
      const receiveRes = await inventoryUseCase.receiveTransfer(transferId, 'jinshan_staff@onesoul.tw');
      expect(isOk(receiveRes)).toBe(true);
      expect(receiveRes.data?.status).toBe('RECEIVED');

      // Jinshan stock received
      expect((await invRepo.findByStoreAndProduct('jinshan', 'GK-4100'))?.quantity).toBe(4);
      expect((await invRepo.findByStoreAndProduct('jinshan', 'GK-4101'))?.quantity).toBe(3);
    });

    it('rolls back dispatched stock back to source store when transfer is cancelled', async () => {
      // 1. Create & dispatch transfer
      const createRes = await inventoryUseCase.createTransfer({
        sourceStoreId: 'warehouse-main',
        targetStoreId: 'chupei',
        operator: 'logistics@onesoul.tw',
        items: [{ productId: 'GK-4100', requestedQty: 3 }],
      });
      const transferId = createRes.data!.id;

      await inventoryUseCase.dispatchTransfer(transferId, 'warehouse_staff');
      expect((await invRepo.findByStoreAndProduct('warehouse-main', 'GK-4100'))?.quantity).toBe(7); // 10 - 3

      // 2. Cancel transfer
      const cancelRes = await inventoryUseCase.cancelTransfer(
        transferId,
        'manager@onesoul.tw',
        '司機車禍取消運送'
      );
      expect(isOk(cancelRes)).toBe(true);
      expect(cancelRes.data?.status).toBe('CANCELLED');

      // Warehouse stock restored back to 10
      expect((await invRepo.findByStoreAndProduct('warehouse-main', 'GK-4100'))?.quantity).toBe(10);
    });
  });

  describe('3. Stocktake Draft & Posting (門市盲盤與審核過帳)', () => {
    it('creates blind count draft, calculates variance, and applies variance upon posting', async () => {
      // Current Chupei stock: GK-4100 = 5
      // 1. Auditor counts actualQty = 7 (surplus +2)
      const draftRes = await inventoryUseCase.createStocktakeDraft({
        storeId: 'chupei',
        countedBy: 'auditor@onesoul.tw',
        items: [{ productId: 'GK-4100', actualQty: 7, remark: '前排盤點多出2隻' }],
      });

      expect(isOk(draftRes)).toBe(true);
      if (!isOk(draftRes)) return;
      const stocktakeId = draftRes.data.id;
      expect(draftRes.data.status).toBe('DRAFT');
      expect(draftRes.data.items[0].variance).toBe(2);

      // Stock unchanged while in DRAFT
      expect((await invRepo.findByStoreAndProduct('chupei', 'GK-4100'))?.quantity).toBe(5);

      // 2. Manager posts stocktake (DRAFT -> POSTED)
      const postRes = await inventoryUseCase.postStocktake(stocktakeId, 'manager@onesoul.tw');
      expect(isOk(postRes)).toBe(true);
      expect(postRes.data?.status).toBe('POSTED');

      // Stock updated to actual count 7
      expect((await invRepo.findByStoreAndProduct('chupei', 'GK-4100'))?.quantity).toBe(7);

      // Inventory log recorded
      const logs = await invRepo.findLogsByStore('chupei');
      const stLog = logs.find((l) => l.changeType === 'STOCKTAKE_ADJUST');
      expect(stLog).toBeDefined();
      expect(stLog?.delta).toBe(2);
      expect(stLog?.balance).toBe(7);
    });
  });
});
