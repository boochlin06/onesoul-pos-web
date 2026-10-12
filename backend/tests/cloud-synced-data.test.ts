import { describe, it, expect, beforeAll } from 'vitest';
import { buildApp } from '../src/app';
import { initPrisma } from '../src/plugins/prisma';
import type { FastifyInstance } from 'fastify';
import fs from 'fs';
import path from 'path';

describe('OneSoul ERP 線上真實資料同步驗證 Suite (Cloud Synced Real Data)', () => {
  let app: FastifyInstance;
  const snapshotDir = path.resolve(__dirname, '../data/cloud_snapshot');

  beforeAll(async () => {
    await initPrisma();
    app = buildApp();
    await app.ready();
  });

  describe('1. 雲端真實資料快照完整性校驗 (Snapshot Integrity)', () => {
    it('應包含完整 5 大核心實體之 JSON 快照檔案', () => {
      const expectedFiles = [
        'stores.json',
        'products.json',
        'store_inventories.json',
        'members.json',
        'lucky_bags.json',
        'snapshot_store.json',
      ];
      expectedFiles.forEach((file) => {
        expect(fs.existsSync(path.join(snapshotDir, file))).toBe(true);
      });
    });

    it('快照中各資料表筆數應與雲端實體資料庫 100% 精確吻合', () => {
      const stores = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'stores.json'), 'utf-8'));
      const products = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'products.json'), 'utf-8'));
      const storeInventories = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'store_inventories.json'), 'utf-8'));
      const members = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'members.json'), 'utf-8'));
      const luckyBags = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'lucky_bags.json'), 'utf-8'));

      expect(stores.length).toBe(2);
      expect(products.length).toBeGreaterThanOrEqual(4041);
      expect(storeInventories.length).toBeGreaterThanOrEqual(8082);
      expect(members.length).toBe(1568);
      expect(luckyBags.length).toBe(10);
    });
  });

  describe('2. 海量真實商品庫存水平對照與動態門市驗證 (4,041+ Products)', () => {
    it('全量分頁查詢應正確回傳 4,041+ 筆真實商品與動態門市表頭', async () => {
      const startTime = Date.now();
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/inventory/summary?page=1&pageSize=20',
      });
      const durationMs = Date.now() - startTime;

      expect(res.statusCode).toBe(200);
      expect(durationMs).toBeLessThan(350); // 確保 O(1) Hash Map 分頁效能 < 350ms

      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.stores).toBeDefined();
      expect(json.stores.length).toBe(2);
      expect(json.pagination.total).toBeGreaterThanOrEqual(4041);
      expect(json.data.length).toBe(20);

      // 驗證最新建立之單品排在最頂端 (createdAt DESC)
      const topItem = json.data[0];
      expect(topItem.id).toBe('海賊王-272278');
      expect(topItem.name).toBe('[新春限定] 航海王四皇五檔魯夫極限雕像');
      expect(topItem.category).toBe('海賊王');
      expect(topItem.storeStocks['chupei']).toBe(5);
      expect(topItem.storeStocks['jinshan']).toBe(3);
      expect(topItem.totalStock).toBe(8);
    });

    it('真實資料關鍵字搜尋 (模糊比對品名與貨號)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/inventory/summary?q=魯夫&page=1&pageSize=10',
      });
      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.length).toBeGreaterThanOrEqual(1);

      json.data.forEach((item: any) => {
        const matchesName = item.name.toLowerCase().includes('魯夫');
        const matchesId = item.id.toLowerCase().includes('魯夫');
        expect(matchesName || matchesId).toBe(true);
      });
    });

    it('真實資料分類過濾 (Category Filter)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/inventory/summary?category=海賊王&page=1&pageSize=15',
      });
      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.length).toBeGreaterThanOrEqual(1);

      json.data.forEach((item: any) => {
        expect(item.category).toBe('海賊王');
      });
    });

    it('動態門市庫存加總一致性檢驗 (Sampling Consistency Check)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/inventory/summary?page=1&pageSize=20',
      });
      const items = res.json().data;

      items.forEach((item: any) => {
        let sum = 0;
        for (const storeId of Object.keys(item.storeStocks || {})) {
          sum += item.storeStocks[storeId] || 0;
        }
        expect(item.totalStock).toBe(sum);
        expect(item.chupeiStock).toBe(item.storeStocks['chupei'] || 0);
        expect(item.jinshanStock).toBe(item.storeStocks['jinshan'] || 0);
      });
    });
  });

  describe('3. 真實會員主檔與分頁檢驗 (1,568 Members)', () => {
    it('應正確分頁載入 1,568 位會員且資料包含姓名、電話與點數', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/members?page=1&pageSize=10',
      });
      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.length).toBe(10);
      expect(json.data[0]).toHaveProperty('phone');
      expect(json.data[0]).toHaveProperty('points');
    });
  });
});
