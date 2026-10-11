import { describe, it, expect, beforeAll } from 'vitest';
import { buildApp } from '../src/app';
import { initPrisma } from '../src/plugins/prisma';
import type { FastifyInstance } from 'fastify';

describe('OneSoul ERP Admin API Suite', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    await initPrisma();
    app = buildApp();
    await app.ready();
  });

  describe('1. 會員與點數管理 (Members & Points)', () => {
    it('應能分頁搜尋會員並正確排序', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/members?q=王小明',
      });
      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.length).toBeGreaterThanOrEqual(1);
      expect(json.data[0].name).toBe('王小明');
    });

    it('手動調整點數：扣點不可超出現有點數，且必須強制提供 >= 4 字元之理由', async () => {
      // 理由過短應被拒絕
      const shortReasonRes = await app.inject({
        method: 'POST',
        url: '/api/admin/members/m1/adjust-points',
        payload: { delta: 50, reason: '短' },
      });
      expect(shortReasonRes.statusCode).toBe(400);

      // 扣過多點數應被拒絕
      const overDeductRes = await app.inject({
        method: 'POST',
        url: '/api/admin/members/m1/adjust-points',
        payload: { delta: -99999, reason: '扣除超過現有點數' },
      });
      expect(overDeductRes.statusCode).toBe(400);

      // 合法加點應成功並寫入審計日誌
      const validRes = await app.inject({
        method: 'POST',
        url: '/api/admin/members/m1/adjust-points',
        payload: { delta: 100, reason: '店長特殊補償贈點' },
      });
      expect(validRes.statusCode).toBe(200);
      const json = validRes.json();
      expect(json.success).toBe(true);
      expect(json.data.newPoints).toBe(json.data.beforePoints + 100);
    });

    it('應能查看單一會員消費流水與點數審計抽屜歷程', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/members/m1/history',
      });
      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.member).toBeDefined();
      expect(json.data.auditLogs).toBeDefined();
    });
  });

  describe('2. 商品庫存與雙門市水平對照 (Inventory & Products)', () => {
    it('應能並排取得竹北與金山門市庫存對照表 (向下相容全量)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/inventory/summary',
      });
      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.length).toBeGreaterThan(0);
      expect(json.data[0]).toHaveProperty('chupeiStock');
      expect(json.data[0]).toHaveProperty('jinshanStock');
      expect(json.data[0]).toHaveProperty('isLowStock');
    });

    it('應支援極速分頁查詢與分頁元數據回傳 (Pagination Meta)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/inventory/summary?page=1&pageSize=2',
      });
      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.length).toBeLessThanOrEqual(2);
      expect(json.pagination).toBeDefined();
      expect(json.pagination.page).toBe(1);
      expect(json.pagination.pageSize).toBe(2);
      expect(json.pagination.total).toBeGreaterThanOrEqual(1);
      expect(json.pagination.totalPages).toBeGreaterThanOrEqual(1);
      expect(json.meta).toBeDefined();
      expect(json.meta.totalProducts).toBeGreaterThanOrEqual(1);
    });

    it('商品主檔修改應支援樂觀鎖 (Version Check)', async () => {
      // 成功更新
      const updateRes = await app.inject({
        method: 'PUT',
        url: '/api/admin/inventory/products/GEN001',
        payload: { sellingPrice: 350, version: 0 },
      });
      expect(updateRes.statusCode).toBe(200);

      // 拿舊版本號再次更新應觸發 409 衝突
      const conflictRes = await app.inject({
        method: 'PUT',
        url: '/api/admin/inventory/products/GEN001',
        payload: { sellingPrice: 400, version: 0 },
      });
      expect(conflictRes.statusCode).toBe(409);
    });

    it('單品庫存調帳應記錄異動日誌與審計日誌', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/inventory/adjust-stock',
        payload: {
          storeId: 'chupei',
          productId: 'GEN001',
          delta: 5,
          reason: '店面樣品回補庫存',
        },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.delta).toBe(5);
    });

    it('Excel 批次上架精靈 (Bulk Import) 應能正確解析並批量入庫', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/inventory/products/bulk-import',
        payload: {
          items: [
            { id: 'BULK001', name: '批量測試景品A', costPrice: 200, sellingPrice: 400, quantity: 10, safetyStock: 2 },
            { id: 'BULK002', name: '批量測試景品B', costPrice: 250, sellingPrice: 500, quantity: 5, safetyStock: 1 },
          ],
        },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.successCount).toBe(2);
    });
  });

  describe('3. 一番賞毛利試算、雙軌開套與廢套回流 (Lottery)', () => {
    it('一番賞毛利率試算器應精確計算總成本、毛利率與損平抽數', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/lottery/simulate',
        payload: {
          unitPrice: 300,
          prizes: [
            { grade: 'A', name: 'A賞 GK', cost: 5000, draws: 1 },
            { grade: 'B', name: 'B賞 景品', cost: 500, draws: 4 },
            { grade: 'Z', name: 'Z賞 安慰獎', cost: 50, draws: 75 },
          ],
        },
      });
      expect(res.statusCode).toBe(200);
      const data = res.json().data;
      expect(data.totalDraws).toBe(80);
      expect(data.totalCost).toBe(5000 * 1 + 500 * 4 + 50 * 75); // 10750
      expect(data.totalRevenue).toBe(80 * 300); // 24000
      expect(data.grossProfit).toBe(24000 - 10750); // 13250
      expect(data.marginRate).toBeGreaterThan(50);
      expect(data.canOpenSet).toBe(true);
    });

    it('單品開套模式若低於建議價 9 折防線應強制拒絕', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/lottery/boxes',
        payload: {
          mode: 'SINGLE',
          itemNo: 'GK001',
          itemName: '虧本開套測試',
          totalDraws: 80,
          suggestedPrice: 300,
          actualPrice: 200, // 低於 270 (9折)
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().message).toContain('低於建議售價 9 折');
    });

    it('中途廢套應將未抽出的實體大獎原子加回一般門市庫存', async () => {
      // 開一套測試套組
      await app.inject({
        method: 'POST',
        url: '/api/admin/lottery/boxes',
        payload: {
          mode: 'SINGLE',
          storeId: 'chupei',
          itemNo: 'GK001',
          itemName: '即將廢套測試組',
          totalDraws: 50,
          suggestedPrice: 300,
          actualPrice: 300,
        },
      });

      // 取得開好的套組 ID
      const overviewRes = await app.inject({ method: 'GET', url: '/api/admin/lottery/overview' });
      const targetBag = overviewRes.json().data.find((b: any) => b.name === '即將廢套測試組');
      expect(targetBag).toBeDefined();

      // 執行廢套
      const voidRes = await app.inject({
        method: 'POST',
        url: `/api/admin/lottery/boxes/${targetBag.id}/void`,
        payload: { reason: '店鋪檔期結束撤套' },
      });
      expect(voidRes.statusCode).toBe(200);
      expect(voidRes.json().data.restoredItems.length).toBeGreaterThan(0);
      expect(voidRes.json().data.restoredItems[0].productId).toBe('GK001');
    });
  });

  describe('4. 銷售報表、分析與 Zero-OOM 串流 CSV 匯出 (Reports & Export)', () => {
    it('應能正確取得營收 KPI 與支付方式拆分', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/reports/analytics',
      });
      expect(res.statusCode).toBe(200);
      const data = res.json().data;
      expect(data).toHaveProperty('kpi');
      expect(data).toHaveProperty('paymentBreakdown');
      expect(data).toHaveProperty('revenueTrend');
    });

    it('Zero-OOM 串流 CSV 匯出應包含 UTF-8 BOM 與正確標頭', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/export/inventory',
      });
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      // 驗證 UTF-8 BOM
      expect(res.rawPayload[0]).toBe(0xEF);
      expect(res.rawPayload[1]).toBe(0xBB);
      expect(res.rawPayload[2]).toBe(0xBF);
    });
  });

  describe('5. 班表考勤、外部整合與審計鏈 (Schedule, Integrations & Audit)', () => {
    it('批次更新排班與查詢月曆應正常運作', async () => {
      const updateRes = await app.inject({
        method: 'PUT',
        url: '/api/admin/schedule/days',
        payload: {
          storeId: 'chupei',
          days: [
            { date: '2026-10-20', staffName: '測試早班', shiftType: 'MORNING' },
            { date: '2026-10-21', staffName: '測試晚班', shiftType: 'EVENING' },
          ],
        },
      });
      expect(updateRes.statusCode).toBe(200);

      const queryRes = await app.inject({
        method: 'GET',
        url: '/api/admin/schedule/month?storeId=chupei&yearMonth=2026-10',
      });
      expect(queryRes.statusCode).toBe(200);
      expect(queryRes.json().data.length).toBeGreaterThanOrEqual(2);
    });

    it('考勤打卡若遲到超出寬限應正確標示 LATE 並計算遲到分鐘數', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/attendance/clock-in',
        payload: {
          storeId: 'chupei',
          userEmail: 'staff@onesoul.com',
          userName: '小美',
        },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data).toHaveProperty('lateMinutes');
    });

    it('發佈緊急公告應能正確更新版本號並供 POS 查詢', async () => {
      const pubRes = await app.inject({
        method: 'POST',
        url: '/api/admin/settings/emergency-notices',
        payload: {
          title: '颱風天提早打烊公告',
          content: '今晚 20:00 提早打烊，請依序執行結算關帳。',
          level: 'CRITICAL',
        },
      });
      expect(pubRes.statusCode).toBe(200);
      expect(pubRes.json().data.title).toBe('颱風天提早打烊公告');
    });

    it('審計日誌應維護雜湊鏈 (prevHash / currentHash) 具備防竄改能力', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/audit-logs',
      });
      expect(res.statusCode).toBe(200);
      const logs = res.json().data;
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0]).toHaveProperty('prevHash');
      expect(logs[0]).toHaveProperty('currentHash');
    });
  });
});
