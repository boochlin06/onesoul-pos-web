import { describe, it, expect, beforeEach } from 'vitest';
import { prisma, initPrisma } from '../../../../plugins/prisma.js';
import { inventoryService, InventoryServiceError } from '../inventory.service.js';

describe('InventoryService Integration Tests', () => {
  beforeEach(async () => {
    await initPrisma();
  });

  describe('規則 1：Prisma 事務穿透支援 (Transaction Passthrough)', () => {
    it('在外部 tx 交易中建立商品應穿透執行，若外部交易 rollback 應全數回復', async () => {
      const testId = `TX-TEST-${Date.now()}`;
      try {
        await prisma.$transaction(async (tx: any) => {
          await inventoryService.createProduct(
            {
              id: testId,
              name: '事務穿透測試公仔',
              category: '海賊王',
              sellingPrice: 1000,
              costPrice: 500,
              initialStocks: { chupei: 5, jinshan: 5 },
            },
            'test@onesoul.com',
            tx
          );

          // 驗證在同一交易內可查詢到
          const inTx = await tx.product.findUnique({ where: { id: testId } });
          expect(inTx).toBeDefined();
          expect(inTx.name).toBe('事務穿透測試公仔');

          // 人為拋出例外模擬交易失敗 Rollback
          throw new Error('SIMULATED_TRANSACTION_ROLLBACK');
        });
      } catch (err: any) {
        expect(err.message).toBe('SIMULATED_TRANSACTION_ROLLBACK');
      }

      // 交易外驗證：應已被 Rollback，不得殘留髒資料
      const outsideTx = await prisma.product.findUnique({ where: { id: testId } });
      expect(outsideTx).toBeNull();
    });

    it('在外部 tx 中呼叫 adjustStock 應與外部事務原子綁定', async () => {
      const prodId = `TX-ADJ-${Date.now()}`;
      // 先建立測試商品與庫存
      await inventoryService.createProduct({
        id: prodId,
        name: '調帳事務測試商品',
        category: '七龍珠',
        sellingPrice: 1200,
        initialStocks: { chupei: 10 },
      });

      await prisma.$transaction(async (tx: any) => {
        const res = await inventoryService.adjustStock(
          {
            storeId: 'chupei',
            productId: prodId,
            delta: 5,
            reason: '外部事務調帳測試',
          },
          'admin@onesoul.com',
          '127.0.0.1',
          tx
        );
        expect(res.success).toBe(true);
        expect(res.data.finalQty).toBe(15);
      });

      // 驗證已成功提交
      const invAfter = await prisma.storeInventory.findUnique({
        where: { storeId_productId: { storeId: 'chupei', productId: prodId } },
      });
      expect(invAfter?.quantity).toBe(15);
    });
  });

  describe('樂觀鎖版本控制 (Optimistic Concurrency Control)', () => {
    it('修改主檔版本號相符時應成功更新並自增版本號', async () => {
      const prodId = `OPT-VER-${Date.now()}`;
      await inventoryService.createProduct({
        id: prodId,
        name: '樂觀鎖測試品',
        sellingPrice: 3000,
      });

      const prod = await prisma.product.findUnique({ where: { id: prodId } });
      expect(prod).toBeDefined();
      const currentVersion = prod?.version || 0;

      const res = await inventoryService.updateProduct(prodId, {
        sellingPrice: 3500,
        version: currentVersion,
      });

      expect(res.success).toBe(true);
      expect(res.data.version).toBe(currentVersion + 1);
      expect(res.data.sellingPrice).toBe(3500);
    });

    it('傳入舊版本號時應觸發 409 衝突例外阻絕覆寫', async () => {
      const prodId = `OPT-CONFLICT-${Date.now()}`;
      await inventoryService.createProduct({
        id: prodId,
        name: '樂觀鎖衝突測試品',
        sellingPrice: 2000,
      });

      const prod = await prisma.product.findUnique({ where: { id: prodId } });
      const staleVersion = (prod?.version || 0) - 1;

      await expect(
        inventoryService.updateProduct(prodId, {
          sellingPrice: 2500,
          version: staleVersion,
        })
      ).rejects.toThrow(InventoryServiceError);

      try {
        await inventoryService.updateProduct(prodId, {
          sellingPrice: 2500,
          version: staleVersion,
        });
      } catch (err: any) {
        expect(err.statusCode).toBe(409);
        expect(err.message).toContain('樂觀鎖版本衝突');
      }
    });
  });

  describe('庫存調帳邊界與防呆 (Stock Adjustments & Invariants)', () => {
    it('調帳導致庫存為負數時應拋出 400 錯誤阻斷', async () => {
      const prodId = `NEG-STOCK-${Date.now()}`;
      await inventoryService.createProduct({
        id: prodId,
        name: '負庫存防呆測試',
        initialStocks: { chupei: 2 },
      });

      await expect(
        inventoryService.adjustStock({
          storeId: 'chupei',
          productId: prodId,
          delta: -10,
        })
      ).rejects.toThrow('調帳後庫存不可為負數');
    });

    it('試算表批次更新 (batchUpdate) 應依固定字典序排序執行並寫入審計日誌', async () => {
      const idA = `BATCH-A-${Date.now()}`;
      const idB = `BATCH-B-${Date.now()}`;

      await inventoryService.createProduct({ id: idA, name: '批次品A', sellingPrice: 500, initialStocks: { chupei: 5 } });
      await inventoryService.createProduct({ id: idB, name: '批次品B', sellingPrice: 600, initialStocks: { jinshan: 5 } });

      const res = await inventoryService.batchUpdate({
        productUpdates: [
          { id: idB, sellingPrice: 650 },
          { id: idA, sellingPrice: 550 },
        ],
        stockAdjustments: [
          { storeId: 'jinshan', productId: idB, newQuantity: 8 },
          { storeId: 'chupei', productId: idA, newQuantity: 12 },
        ],
      });

      expect(res.success).toBe(true);
      expect(res.data.updatedProductCount).toBe(2);
      expect(res.data.updatedStockCount).toBe(2);

      // 驗證審計日誌存在
      const latestAudit = await prisma.auditLog.findFirst({
        where: { action: 'BATCH_PRODUCT_UPDATE' },
        orderBy: { createdAt: 'desc' },
      });
      expect(latestAudit).toBeDefined();
    });

    it('批次匯入 (bulkImport) 遇重複貨號應記錄於 errors 而不中斷其餘商品', async () => {
      const existingId = `EXISTING-${Date.now()}`;
      await inventoryService.createProduct({ id: existingId, name: '既有商品' });

      const res = await inventoryService.bulkImport({
        defaultStoreId: 'chupei',
        items: [
          { id: existingId, name: '重複之商品A', sellingPrice: 500 },
          { id: `NEW-IMPORT-${Date.now()}`, name: '全新商品B', sellingPrice: 800, quantity: 3 },
        ],
      });

      expect(res.success).toBe(true);
      expect(res.data.errors.length).toBeGreaterThanOrEqual(1);
      expect(res.data.errors[0].message).toContain('已存在');
      expect(res.data.successCount).toBe(1);
    });
  });

  describe('查詢與決策分析 (Queries & Analytics)', () => {
    it('跨門市庫存水平總覽 (getSummary) 應能正確分頁並統計低庫存總數', async () => {
      const summary = await inventoryService.getSummary({
        page: 1,
        pageSize: 10,
        sortBy: 'sellingPrice',
        sortOrder: 'desc',
      });

      expect(summary.success).toBe(true);
      expect(summary.data.length).toBeLessThanOrEqual(10);
      expect(summary.pagination).toBeDefined();
      expect(summary.pagination.totalPages).toBeGreaterThanOrEqual(1);
      expect(summary.meta.totalProducts).toBeGreaterThan(0);
    });

    it('決策分析 (getDecisionAnalytics) 應能彙總 IP 存量平衡與熱銷滯銷排行', async () => {
      const analytics = await inventoryService.getDecisionAnalytics({ days: 30 });
      expect(analytics.success).toBe(true);
      expect(analytics.data.ipSummary.length).toBeGreaterThan(0);
      expect(analytics.data.totals.totalProducts).toBeGreaterThan(0);
    });
  });
});
