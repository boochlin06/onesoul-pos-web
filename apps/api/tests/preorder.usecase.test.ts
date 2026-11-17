import { describe, it, expect, beforeEach } from 'vitest';
import {
  PreOrderUseCase,
  InMemoryPreOrderRepository,
  InMemoryInventoryRepository,
  InMemoryAuditRepository,
  InMemoryTransactionManager,
  Product,
} from '../src';
import { isOk, isErr } from '@onesoul/shared';

describe('PreOrderUseCase', () => {
  let preOrderUseCase: PreOrderUseCase;
  let preOrderRepo: InMemoryPreOrderRepository;
  let invRepo: InMemoryInventoryRepository;
  let auditRepo: InMemoryAuditRepository;
  let txManager: InMemoryTransactionManager;

  beforeEach(async () => {
    preOrderRepo = new InMemoryPreOrderRepository();
    invRepo = new InMemoryInventoryRepository();
    auditRepo = new InMemoryAuditRepository();
    txManager = new InMemoryTransactionManager();

    txManager.register(preOrderRepo);
    txManager.register(invRepo);
    txManager.register(auditRepo);

    preOrderUseCase = new PreOrderUseCase(
      preOrderRepo,
      invRepo,
      auditRepo,
      txManager
    );

    // Seed existing products with GK IDs
    await invRepo.saveProduct(
      new Product({ id: '4105', name: 'GK 鬼滅之刃 炭治郎', costPrice: 1500, sellingPrice: 2800 })
    );
    await invRepo.saveProduct(
      new Product({ id: '4108', name: 'GK 咒術迴戰 五條悟', costPrice: 2500, sellingPrice: 4500 })
    );
    // Virtual / high numeric IDs that should be ignored by GK suggestion
    await invRepo.saveProduct(
      new Product({ id: '88888', name: '點數卡 +1', isSpecial: true })
    );
    await invRepo.saveProduct(
      new Product({ id: '100050', name: '盲盒商品條目', category: 'BLIND_BOX' })
    );
  });

  describe('1. Suggest Next GK ID', () => {
    it('finds maximum GK id and suggests next number without collision', async () => {
      const res = await preOrderUseCase.suggestNextGkId();
      expect(isOk(res)).toBe(true);
      if (!isOk(res)) return;

      // Highest GK ID is 4108, so suggestion should be 4109
      expect(res.data).toBe('4109');
    });
  });

  describe('2. Create PreOrder', () => {
    it('creates a pending preorder with deposit', async () => {
      const res = await preOrderUseCase.createPreOrder({
        name: 'GK 七龍珠 貝吉塔 大爆炸',
        quantity: 5,
        deposit: 3000,
        supplier: '萬代日本原廠',
        targetStoreId: 'chupei',
        note: '第一批到貨',
      });

      expect(isOk(res)).toBe(true);
      if (!isOk(res)) return;
      expect(res.data.status).toBe('PENDING');
      expect(res.data.name).toBe('GK 七龍珠 貝吉塔 大爆炸');
      expect(res.data.deposit).toBe(3000);
    });

    it('validates quantity > 0 and deposit >= 0', async () => {
      const res1 = await preOrderUseCase.createPreOrder({
        name: '錯誤預購',
        quantity: 0,
        deposit: 1000,
      });
      expect(isErr(res1)).toBe(true);

      const res2 = await preOrderUseCase.createPreOrder({
        name: '錯誤預購2',
        quantity: 5,
        deposit: -100,
      });
      expect(isErr(res2)).toBe(true);
    });
  });

  describe('3. Receive PreOrder with Collision Protection', () => {
    it('blocks receiving when productId collides with an existing different product', async () => {
      const createRes = await preOrderUseCase.createPreOrder({
        name: 'GK 雕像 虎杖悠仁',
        quantity: 10,
        deposit: 5000,
        targetStoreId: 'chupei',
      });
      const preOrderId = createRes.data!.id;

      // 4108 is already taken by 'GK 咒術迴戰 五條悟'
      const receiveRes = await preOrderUseCase.receivePreOrder(preOrderId, {
        productId: '4108',
        targetStoreId: 'chupei',
        sellingPrice: 4000,
        operator: 'manager@onesoul.tw',
      });

      expect(isErr(receiveRes)).toBe(true);
      expect(receiveRes.error?.code).toBe('CONFLICT');
    });

    it('atomically calculates unit cost, creates Product and StoreInventory, and completes preorder', async () => {
      const createRes = await preOrderUseCase.createPreOrder({
        name: 'GK 艾連 巨人化',
        quantity: 10,
        deposit: 5000,
        targetStoreId: 'chupei',
      });
      const preOrderId = createRes.data!.id;

      // Total cost = 5000 (deposit) + 15000 (final) + 800 (shipping) = 20800
      // Unit cost = ceil(20800 / 10) = 2080
      const receiveRes = await preOrderUseCase.receivePreOrder(preOrderId, {
        productId: '4109',
        targetStoreId: 'chupei',
        finalPayment: 15000,
        shippingFee: 800,
        sellingPrice: 3800,
        operator: 'manager@onesoul.tw',
      });

      expect(isOk(receiveRes)).toBe(true);
      if (!isOk(receiveRes)) return;

      const product = receiveRes.data;
      expect(product.id).toBe('4109');
      expect(product.name).toBe('GK 艾連 巨人化');
      expect(product.costPrice).toBe(2080);
      expect(product.sellingPrice).toBe(3800);

      // Verify StoreInventory created with quantity = 10
      const inv = await invRepo.findByStoreAndProduct('chupei', '4109');
      expect(inv).not.toBeNull();
      expect(inv?.quantity).toBe(10);

      // Verify preorder status updated to COMPLETED
      const po = await preOrderRepo.findById(preOrderId);
      expect(po?.status).toBe('COMPLETED');
      expect(po?.productId).toBe('4109');

      // Verify AuditLog recorded
      const auditLogs = await auditRepo.list();
      expect(auditLogs.length).toBe(1);
      expect(auditLogs[0].action).toBe('PREORDER_RECEIVE');
    });
  });
});
