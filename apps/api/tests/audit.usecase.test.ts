import { describe, it, expect, beforeEach } from 'vitest';
import {
  AuditUseCase,
  InMemoryAuditRepository,
  AuditLog,
  InventoryUseCase,
  MemberUseCase,
  SessionUseCase,
  PreOrderUseCase,
  InMemoryInventoryRepository,
  InMemoryTransferRepository,
  InMemoryStocktakeRepository,
  InMemoryMemberRepository,
  InMemoryOrderRepository,
  InMemorySessionRepository,
  InMemoryPreOrderRepository,
  InMemoryTransactionManager,
  Product,
  StoreInventory,
  Member,
  CashRegisterSession,
  PreOrder,
} from '../src';
import { isOk } from '@onesoul/shared';

describe('AuditUseCase & Cryptographic Hash Chain Verification', () => {
  let auditUseCase: AuditUseCase;
  let auditRepo: InMemoryAuditRepository;
  const secretKey = 'onesoul-test-secret-2026';

  beforeEach(() => {
    auditRepo = new InMemoryAuditRepository(secretKey);
    auditUseCase = new AuditUseCase(auditRepo, secretKey);
  });

  describe('1. HMAC-SHA256 Hash Chain Generation', () => {
    it('creates chained audit logs with prevHash links', async () => {
      // 1. First log links to GENESIS_HASH
      const res1 = await auditUseCase.recordLog({
        operatorId: 'manager@onesoul.tw',
        action: 'MANUAL_POINTS_ADJUST',
        targetType: 'MEMBER',
        targetId: 'mem-001',
        delta: 50,
        reason: '系統補償贈點',
      });

      expect(isOk(res1)).toBe(true);
      if (!isOk(res1)) return;
      expect(res1.data.prevHash).toBe(AuditLog.GENESIS_HASH);
      expect(res1.data.currentHash).toHaveLength(64); // SHA-256 hex length

      // 2. Second log links to first log currentHash
      const res2 = await auditUseCase.recordLog({
        operatorId: 'manager@onesoul.tw',
        action: 'MANUAL_STOCK_ADJUST',
        targetType: 'STORE_INVENTORY',
        targetId: 'chupei:GK-4100',
        delta: 2,
        reason: '進貨盤盈入庫',
      });

      expect(isOk(res2)).toBe(true);
      if (!isOk(res2)) return;
      expect(res2.data.prevHash).toBe(res1.data.currentHash);
      expect(res2.data.currentHash).toHaveLength(64);

      // 3. Third log links to second log currentHash
      const res3 = await auditUseCase.recordLog({
        operatorId: 'manager@onesoul.tw',
        action: 'SESSION_CLOSE_Z_REPORT',
        targetType: 'CASH_REGISTER_SESSION',
        targetId: 'sess-001',
        reason: '晚班22:00日結關帳',
      });

      expect(isOk(res3)).toBe(true);
      if (!isOk(res3)) return;
      expect(res3.data.prevHash).toBe(res2.data.currentHash);
    });
  });

  describe('2. Chain Verification & Anti-Tampering Detection', () => {
    it('successfully verifies an untampered audit chain', async () => {
      await auditUseCase.recordLog({
        operatorId: 'op-1',
        action: 'ACTION_A',
        targetType: 'TYPE_A',
        targetId: 'id-1',
        reason: '正常操作 1',
      });
      await auditUseCase.recordLog({
        operatorId: 'op-2',
        action: 'ACTION_B',
        targetType: 'TYPE_B',
        targetId: 'id-2',
        reason: '正常操作 2',
      });
      await auditUseCase.recordLog({
        operatorId: 'op-3',
        action: 'ACTION_C',
        targetType: 'TYPE_C',
        targetId: 'id-3',
        reason: '正常操作 3',
      });

      const verifyRes = await auditUseCase.verifyChain();
      expect(isOk(verifyRes)).toBe(true);
      if (!isOk(verifyRes)) return;
      expect(verifyRes.data.valid).toBe(true);
      expect(verifyRes.data.totalCount).toBe(3);
    });

    it('detects tampering when an audit log payload or hash is altered', async () => {
      const log1Res = await auditUseCase.recordLog({
        operatorId: 'op-1',
        action: 'ACTION_A',
        targetType: 'TYPE_A',
        targetId: 'id-1',
        delta: 100,
        reason: '原始合法理由',
      });
      await auditUseCase.recordLog({
        operatorId: 'op-2',
        action: 'ACTION_B',
        targetType: 'TYPE_B',
        targetId: 'id-2',
        delta: 50,
        reason: '原始合法理由 2',
      });

      expect(isOk(log1Res)).toBe(true);
      if (!isOk(log1Res)) return;

      // Maliciously tamper with log1 reason
      (log1Res.data as any).reason = '惡意篡改之偽造理由';

      const verifyTampered = await auditUseCase.verifyChain();
      expect(isOk(verifyTampered)).toBe(true);
      if (!isOk(verifyTampered)) return;
      expect(verifyTampered.data.valid).toBe(false);
      expect(verifyTampered.data.brokenAt).toBe(log1Res.data.id);

      // Restore reason but maliciously change currentHash
      (log1Res.data as any).reason = '原始合法理由';
      (log1Res.data as any).currentHash = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

      const verifyHashTampered = await auditUseCase.verifyChain();
      expect(isOk(verifyHashTampered)).toBe(true);
      if (!isOk(verifyHashTampered)) return;
      expect(verifyHashTampered.data.valid).toBe(false);
      expect(verifyHashTampered.data.brokenAt).toBe(log1Res.data.id);
    });
  });

  describe('3. Cross-UseCase Real Business Operations Chain Integrity', () => {
    it('verifies untampered linear hash chain across inventory, member, session, and preorder operations', async () => {
      // Use default audit key matching production usecases
      const sharedAuditRepo = new InMemoryAuditRepository();
      const sharedTxManager = new InMemoryTransactionManager();
      const sharedAuditUseCase = new AuditUseCase(sharedAuditRepo);

      const invRepo = new InMemoryInventoryRepository();
      const transferRepo = new InMemoryTransferRepository();
      const stocktakeRepo = new InMemoryStocktakeRepository();
      const memberRepo = new InMemoryMemberRepository();
      const orderRepo = new InMemoryOrderRepository();
      const sessionRepo = new InMemorySessionRepository();
      const preOrderRepo = new InMemoryPreOrderRepository();

      sharedTxManager.register(sharedAuditRepo);
      sharedTxManager.register(invRepo);
      sharedTxManager.register(memberRepo);
      sharedTxManager.register(sessionRepo);
      sharedTxManager.register(preOrderRepo);

      const inventoryUseCase = new InventoryUseCase(
        invRepo,
        transferRepo,
        stocktakeRepo,
        sharedAuditRepo,
        sharedTxManager
      );
      const memberUseCase = new MemberUseCase(
        memberRepo,
        orderRepo,
        sharedAuditRepo,
        sharedTxManager
      );
      const sessionUseCase = new SessionUseCase(
        sessionRepo,
        orderRepo,
        sharedAuditRepo,
        sharedTxManager
      );
      const preOrderUseCase = new PreOrderUseCase(
        preOrderRepo,
        invRepo,
        sharedAuditRepo,
        sharedTxManager
      );

      // Seed initial data
      await invRepo.saveProduct(
        new Product({ id: 'GK-4100', name: '大賞 GK 雕像 魯夫', costPrice: 2000, sellingPrice: 3500 })
      );
      await invRepo.save(
        new StoreInventory({ id: 'inv-1', storeId: 'chupei', productId: 'GK-4100', quantity: 5 })
      );

      await memberRepo.save(
        new Member({ id: 'mem-001', phone: '0912345678', name: '陳大文', points: 50 })
      );

      const openSession = new CashRegisterSession({
        id: 'sess-001',
        storeId: 'chupei',
        openedBy: 'cashier@onesoul.tw',
        openingCash: 5000,
      });
      await sessionRepo.save(openSession);

      const preOrder = new PreOrder({
        id: 'po-001',
        targetStoreId: 'chupei',
        supplier: '萬代官方',
        name: 'GK 雕像 虎杖悠仁',
        quantity: 10,
        totalCost: 20000,
        deposit: 5000,
      });
      await preOrderRepo.save(preOrder);

      // 1. Inventory UseCase: Manual stock adjust
      const invRes = await inventoryUseCase.adjustStock({
        storeId: 'chupei',
        productId: 'GK-4100',
        delta: 2,
        reason: '進貨盤盈入庫',
        operator: 'manager@onesoul.tw',
      });
      expect(isOk(invRes)).toBe(true);

      // 2. Member UseCase: Manual points adjust
      const memRes = await memberUseCase.adjustPoints({
        memberId: 'mem-001',
        delta: 30,
        reason: '行銷活動補償贈點',
        operator: 'manager@onesoul.tw',
      });
      expect(isOk(memRes)).toBe(true);

      // 3. Session UseCase: Close session (Z-Report)
      const sessRes = await sessionUseCase.closeSession({
        sessionId: 'sess-001',
        closedBy: 'cashier@onesoul.tw',
        actualCash: 5000,
        note: '收銀班次日結關帳',
      });
      expect(isOk(sessRes)).toBe(true);

      // 4. PreOrder UseCase: Receive preorder
      const poRes = await preOrderUseCase.receivePreOrder('po-001', {
        targetStoreId: 'chupei',
        productId: 'GK-4200',
        sellingPrice: 3500,
        operator: 'warehouse@onesoul.tw',
      });
      expect(isOk(poRes)).toBe(true);

      // 5. Cryptographic Chain Verification across all 4 usecases
      const verifyRes = await sharedAuditUseCase.verifyChain();
      expect(isOk(verifyRes)).toBe(true);
      if (!isOk(verifyRes)) return;
      expect(verifyRes.data.valid).toBe(true);
      expect(verifyRes.data.totalCount).toBe(4);

      // Verify underlying repo verifyChain
      const repoVerify = await sharedAuditRepo.verifyChain();
      expect(repoVerify.valid).toBe(true);
      expect(repoVerify.totalCount).toBe(4);
    });
  });
});
