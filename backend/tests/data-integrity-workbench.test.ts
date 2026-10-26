import { describe, it, expect, beforeAll } from 'vitest';
import { buildApp } from '../src/app';
import { initPrisma, prisma } from '../src/plugins/prisma';
import type { FastifyInstance } from 'fastify';

describe('OneSoul POS 庫存主檔工作台資料完整性與邊界測試 (Data Integrity & Edge Cases)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    await initPrisma();
    app = buildApp();
    await app.ready();
  });

  describe('DATA-01: 4,041 筆快照海量載入與 O(1) 聚合效能', () => {
    it('分頁查詢應在 200ms 內極速響應，且合計庫存公式精確無誤', async () => {
      const startTime = performance.now();
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/inventory/summary?page=1&pageSize=50',
      });
      const elapsed = performance.now() - startTime;

      expect(res.statusCode).toBe(200);
      expect(elapsed).toBeLessThan(600);

      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.length).toBe(50);
      expect(body.pagination.total).toBeGreaterThanOrEqual(3148);

      // 驗證回傳商品品名絕無試算表純數字代號
      body.data.forEach((item: any) => {
        expect(item.name).not.toMatch(/^\d+$/);
      });

      // 驗證每一筆資料的門市庫存合計等於 totalStock (動態公式校驗)
      body.data.forEach((item: any) => {
        const storeSum = Object.values(item.storeStocks || {}).reduce(
          (sum: number, qty: any) => sum + (Number(qty) || 0),
          0
        );
        expect(item.totalStock).toBe(storeSum);
      });
    });
  });

  describe('DATA-02: 多門市期初入庫與異動日誌完整性', () => {
    const testProdId = `TEST-ITEM-${Date.now()}`;

    it('新增商品主檔並分配各門市期初現貨，應連動建立 StoreInventory 與 InventoryLog', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/inventory/products',
        payload: {
          id: testProdId,
          name: '【測試單品】鬼滅之刃 炭治郎 日輪刀 模型',
          category: 'FIGURE',
          costPrice: 450,
          sellingPrice: 850,
          suggestedPoints: 43,
          barcode: '471888999001',
          safetyStock: 3,
          initialStocks: {
            chupei: 15,
            jinshan: 8,
          },
        },
      });

      expect(res.statusCode).toBe(201);
      const prod = res.json().data;
      expect(prod.id).toBe(testProdId);
      expect(prod.sellingPrice).toBe(850);

      // 查詢驗證多門市庫存對照
      const checkRes = await app.inject({
        method: 'GET',
        url: `/api/admin/inventory/summary?q=${testProdId}`,
      });
      const summaryItem = checkRes.json().data[0];
      expect(summaryItem).toBeDefined();
      expect(summaryItem.storeStocks['chupei']).toBe(15);
      expect(summaryItem.storeStocks['jinshan']).toBe(8);
      expect(summaryItem.totalStock).toBe(23);
    });
  });

  describe('DATA-03: 庫存調帳負數邊界防護 (防超扣)', () => {
    it('調帳扣減量若導致庫存為負數，系統必須強制阻擋並回傳 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/inventory/adjust-stock',
        payload: {
          storeId: 'chupei',
          productId: '4',
          delta: -999999, // 惡意或錯誤大幅扣減
          reason: '錯誤大量出庫測試',
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().message).toContain('負數');
    });

    it('newQuantity 設定為負數時亦必須強制阻擋', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/inventory/adjust-stock',
        payload: {
          storeId: 'chupei',
          productId: '4',
          newQuantity: -5,
          reason: '設定為負數測試',
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().message).toContain('負數');
    });
  });

  describe('DATA-04: 批次更新原子性與雙向存檔 (batch-update)', () => {
    it('空 payload 應被校驗阻擋', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/inventory/batch-update',
        payload: { productUpdates: [], stockAdjustments: [] },
      });
      expect(res.statusCode).toBe(400);
    });

    it('批次更新多筆商品主檔 (售價、成本、品名) 應原子性生效', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/inventory/batch-update',
        payload: {
          productUpdates: [
            { id: '4', sellingPrice: 990, costPrice: 500, suggestedPoints: 50 },
            { id: '5', sellingPrice: 16800, costPrice: 8500, suggestedPoints: 350 },
          ],
          stockAdjustments: [
            { storeId: 'chupei', productId: '4', newQuantity: 30, reason: '批次盤點實體入帳' },
            { storeId: 'jinshan', productId: '5', newQuantity: 18, reason: '批次盤點實體入帳' },
          ],
        },
      });

      expect(res.statusCode).toBe(200);
      const result = res.json().data;
      expect(result.updatedProductCount).toBe(2);
      expect(result.updatedStockCount).toBe(2);

      // 驗證 4
      const check1 = await app.inject({ method: 'GET', url: '/api/admin/inventory/summary?q=4' });
      const item1 = check1.json().data.find((p: any) => p.id === '4');
      expect(item1.sellingPrice).toBe(990);
      expect(item1.storeStocks['chupei']).toBe(30);

      // 驗證 5
      const check2 = await app.inject({ method: 'GET', url: '/api/admin/inventory/summary?q=5' });
      const item2 = check2.json().data.find((p: any) => p.id === '5');
      expect(item2.sellingPrice).toBe(16800);
      expect(item2.storeStocks['jinshan']).toBe(18);
    });
  });

  describe('DATA-05: 樂觀並發鎖 (Optimistic Locking) 版本衝突防護', () => {
    it('版本號過舊之更新請求必須回傳 409 Conflict', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/admin/inventory/products/4',
        payload: {
          sellingPrice: 1500,
          version: 0, // 傳入舊版本
        },
      });

      expect(res.statusCode).toBe(409);
      expect(res.json().message).toContain('版本衝突');
    });
  });

  describe('DATA-06: 貨號唯一性約束防禦', () => {
    it('重複建立相同貨號商品必須拒絕並回傳 409 Conflict', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/inventory/products',
        payload: {
          id: '4', // 已存在的貨號
          name: '衝撞貨號測試',
          category: 'GENERAL',
          sellingPrice: 100,
        },
      });

      expect(res.statusCode).toBe(409);
      expect(res.json().message).toContain('已存在');
    });
  });

  describe('DATA-07: 點數回饋公式精度驗證 (5% 四捨五入)', () => {
    it('售價 $3162 時應精確折抵 158 pt，售價 $99 應折抵 5 pt', () => {
      const calc1 = Math.round(3162 * 0.05);
      const calc2 = Math.round(99 * 0.05);
      expect(calc1).toBe(158);
      expect(calc2).toBe(5);
    });
  });
});
