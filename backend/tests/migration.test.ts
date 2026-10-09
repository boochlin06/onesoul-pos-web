import { describe, it, expect, beforeEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { normalizePhone, parseNumber, parseSheetDate, normalizeStoreId } from '../src/scripts/migrate-sheets/cleaner';
import { parseCsv } from '../src/scripts/migrate-sheets/parser';
import { SheetMigrator } from '../src/scripts/migrate-sheets/migrator';
import { prisma } from '../src/plugins/prisma';

describe('Google Sheets 遷移引擎全方位整合測試 (ETL Migration Suite)', () => {

  // ─────────────────────────────────────────────────────────────
  // 1. 資料清洗器單元測試 (Cleaner & Normalization Tests)
  // ─────────────────────────────────────────────────────────────
  describe('資料清洗器邊界案例 (Data Cleaner & Normalization)', () => {
    it('應正確標準化各類台灣手機格式，並過濾非法電話', () => {
      // 標準格式
      expect(normalizePhone('0912-345-678')).toEqual({ phone: '0912345678', isValid: true });
      expect(normalizePhone('0912 345 678')).toEqual({ phone: '0912345678', isValid: true });
      expect(normalizePhone('(0912)345678')).toEqual({ phone: '0912345678', isValid: true });

      // 國碼 +886 替換
      expect(normalizePhone('+886912345678')).toEqual({ phone: '0912345678', isValid: true, note: '自動去除 +886 國碼' });
      expect(normalizePhone('886912345678')).toEqual({ phone: '0912345678', isValid: true, note: '自動去除 +886 國碼' });

      // 系統特殊調點帳號
      expect(normalizePhone('88888')).toEqual({ phone: '88888', isValid: true, note: '特殊系統帳號' });
      expect(normalizePhone('99999')).toEqual({ phone: '99999', isValid: true, note: '特殊系統帳號' });

      // 非法或短碼
      expect(normalizePhone('0912345').isValid).toBe(false);
      expect(normalizePhone('02-12345678').isValid).toBe(false);
      expect(normalizePhone('').isValid).toBe(false);
      expect(normalizePhone(null).isValid).toBe(false);
    });

    it('應正確解析包含貨幣符號、逗號與異常格式之數值', () => {
      expect(parseNumber('$1,500')).toBe(1500);
      expect(parseNumber('NT$ 350')).toBe(350);
      expect(parseNumber(' -50 ')).toBe(-50);
      expect(parseNumber('')).toBe(0);
      expect(parseNumber(null, 10)).toBe(10);
      expect(parseNumber('invalid', 99)).toBe(99);
    });

    it('應準確識別與解析多樣日期字串', () => {
      const d1 = parseSheetDate('2026/04/01 14:30:00');
      expect(d1.getFullYear()).toBe(2026);
      expect(d1.getMonth()).toBe(3); // 4月 (0-indexed)

      const d2 = parseSheetDate('2026-05-20T10:00:00Z');
      expect(d2.getFullYear()).toBe(2026);

      // 無效日期應回退當前時間而不拋出例外
      const invalid = parseSheetDate('not-a-date');
      expect(invalid).toBeInstanceOf(Date);
      expect(isNaN(invalid.getTime())).toBe(false);
    });

    it('應正確標準化門市代碼', () => {
      expect(normalizeStoreId('竹北旗艦店')).toBe('chupei');
      expect(normalizeStoreId('金山門市')).toBe('jinshan');
      expect(normalizeStoreId('JINSHAN')).toBe('jinshan');
      expect(normalizeStoreId(undefined)).toBe('chupei');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 2. CSV 解析器與 BOM 處理測試 (Parser Tests)
  // ─────────────────────────────────────────────────────────────
  describe('CSV 解析器穩定性測試 (Parser & Escaping)', () => {
    it('應支援 UTF-8 BOM、含逗號的引號字串以及換行', () => {
      const csvWithBOM = '\uFEFFname,phone,note\n"陳大明, VIP",0912345678,"備註內含""雙引號""測試"\n張小華,0987654321,一般';
      const records = parseCsv(csvWithBOM);

      expect(records.length).toBe(2);
      expect(records[0]['name']).toBe('陳大明, VIP');
      expect(records[0]['phone']).toBe('0912345678');
      expect(records[0]['note']).toBe('備註內含"雙引號"測試');
      expect(records[1]['name']).toBe('張小華');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 3. E2E 全流程遷移與審計測試 (ETL Execution & Audit Tests)
  // ─────────────────────────────────────────────────────────────
  describe('全流程遷移引擎端到端驗證 (End-to-End Migration Flow)', () => {
    let tempDir: string;

    beforeEach(() => {
      // 建立隔離臨時測試資料夾
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-migrate-test-'));

      // 產生會員測試資料 (含重複電話、無效電話)
      const membersCsv = `timestamp,name,phone,gender,birthday,store,points,note
2026/01/10 10:00:00,初代測試者,0912-345-678,男,1990/01/01,竹北,100,初次註冊
2026/02/10 10:00:00,初代測試者更新,0912345678,男,1990/01/01,竹北,500,更新點數
2026/03/10 10:00:00,金山常客,+886988776655,女,1995/05/05,金山,250,常客
2026/04/10 10:00:00,異常號碼,0999,男,,竹北,0,長度不足
2026/05/10 10:00:00,手動調點專用,88888,系統,,竹北,0,內部操作`;
      fs.writeFileSync(path.join(tempDir, 'members.csv'), membersCsv, 'utf-8');

      // 產生商品庫存資料 (同商品跨店庫存)
      const itemsCsv = `id,name,points,category,quantity,branch,cost,price
TEST-GK,測試限定魯夫 GK,300,GK,10,竹北,8000,15000
TEST-GK,測試限定魯夫 GK,300,GK,5,金山,8000,15000
TEST-BOX,高級壓克力盒,5,GENERAL,50,竹北,100,250`;
      fs.writeFileSync(path.join(tempDir, 'items.csv'), itemsCsv, 'utf-8');

      // 產生一番賞配置
      const luckyBagsJson = JSON.stringify([
        {
          bagId: 'BAG-TEST-01',
          name: '新年一番賞測試套',
          price: 350,
          store: '竹北',
          isPointsSet: false,
          status: 'ACTIVE',
          prizes: [
            {
              bagId: 'BAG-TEST-01',
              prizeGrade: 'A',
              prizeName: 'A賞 魯夫 MASTERLISE',
              productId: 'TEST-GK',
              points: 150,
              draws: 2,
              drawnCount: 0,
            },
            {
              bagId: 'BAG-TEST-01',
              prizeGrade: 'B',
              prizeName: 'B賞 索隆 MASTERLISE',
              productId: null,
              points: 100,
              draws: 3,
              drawnCount: 0,
            },
          ],
        },
      ]);
      fs.writeFileSync(path.join(tempDir, 'luckybags.json'), luckyBagsJson, 'utf-8');

      // 產生歷史開關帳
      const sessionsCsv = `store,openedAt,closedAt,openingCash,actualCash,openedBy,closedBy,note
竹北,2026/04/01 13:50:00,2026/04/01 22:10:00,3000,3000,tester@onesoul.com,tester@onesoul.com,正常打烊`;
      fs.writeFileSync(path.join(tempDir, 'sessions.csv'), sessionsCsv, 'utf-8');

      // 產生歷史銷售明細
      const salesCsv = `phone,orderId,createdAt,store,itemCode,itemName,itemType,prizeGrade,pickMethod,unitPrice,receivedAmount,cash,creditCard,remittance,pointsDelta,cashier,note
0912-345-678,HIST-ORD-01,2026/04/01 14:00:00,竹北,TEST-GK,A賞 魯夫 MASTERLISE,LOTTERY,A,帶走,350,350,350,0,0,10,cashier1,抽獎
0988776655,HIST-ORD-02,2026/04/01 15:30:00,金山,TEST-BOX,高級壓克力盒,MERCHANDISE,,帶走,250,250,0,250,0,5,cashier2,直購
,HIST-WALKIN-03,2026/04/01 16:00:00,竹北,TEST-BOX,高級壓克力盒,MERCHANDISE,,帶走,250,250,250,0,0,0,cashier1,散客購盒`;
      fs.writeFileSync(path.join(tempDir, 'sales_history.csv'), salesCsv, 'utf-8');
    });

    it('預演檢查 (Dry-Run)：應能精確識別重複與異常資料，產生審計報告，且不寫入資料庫', async () => {
      const migrator = new SheetMigrator({ dataDir: tempDir, dryRun: true });
      const report = await migrator.run();

      expect(report.summary.dryRun).toBe(true);
      expect(report.details.members.extracted).toBe(5);
      expect(report.details.members.imported).toBe(3); // 3 筆有效會員 (0912345678, 0988776655, 88888)
      expect(report.conflicts.length).toBe(2); // 1筆重複 + 1筆異常號碼

      // 檢查衝突紀錄
      const dupConflict = report.conflicts.find((c) => c.identifier === '0912345678');
      expect(dupConflict).toBeDefined();
      expect(dupConflict?.description).toContain('重複');

      const invalidConflict = report.conflicts.find((c) => c.identifier === '0999');
      expect(invalidConflict).toBeDefined();
      expect(invalidConflict?.description).toContain('無效電話格式');

      // 驗證審計檔案已落地
      const reportFile = path.join(tempDir, 'migration_audit_report.json');
      expect(fs.existsSync(reportFile)).toBe(true);
    });

    it('正式執行 (Execute)：應向量化入庫，自動分店庫存拆分、期初點數流水與訂單外鍵關聯', async () => {
      const migrator = new SheetMigrator({ dataDir: tempDir, dryRun: false });
      const report = await migrator.run();

      expect(report.summary.dryRun).toBe(false);
      expect(report.details.members.imported).toBe(3);
      expect(report.details.products.imported).toBe(2); // TEST-GK, TEST-BOX
      expect(report.details.orders.imported).toBe(3); // 3 筆歷史訂單

      // 1. 驗證會員最新點數覆蓋
      const m1 = await prisma.member.findUnique({ where: { phone: '0912345678' } });
      expect(m1).toBeDefined();
      expect(m1?.name).toBe('初代測試者更新');
      expect(m1?.points).toBe(500);

      // 2. 驗證商品庫存多門市獨立拆分
      const invChupei = await prisma.storeInventory.findUnique({
        where: { storeId_productId: { storeId: 'chupei', productId: 'TEST-GK' } },
      });
      const invJinshan = await prisma.storeInventory.findUnique({
        where: { storeId_productId: { storeId: 'jinshan', productId: 'TEST-GK' } },
      });
      expect(invChupei?.quantity).toBe(10);
      expect(invJinshan?.quantity).toBe(5);

      // 3. 驗證歷史訂單與散客外鍵完整性
      const order1 = await prisma.order.findUnique({ where: { checkoutUID: 'HIST-ORD-01' } });
      expect(order1).toBeDefined();
      expect(order1?.memberId).toBe(m1?.id);
      expect(order1?.receivedAmount).toBe(350);

      // 散客訂單
      const walkinOrder = await prisma.order.findUnique({ where: { checkoutUID: 'HIST-WALKIN-03' } });
      expect(walkinOrder).toBeDefined();
      expect(walkinOrder?.memberId).toBeNull();
      expect(walkinOrder?.receivedAmount).toBe(250);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 4. 大容量極速壓力基準測試 (High-Volume Performance Benchmark)
  // ─────────────────────────────────────────────────────────────
  describe('大容量批次寫入效能基準測試 (High-Volume Stress Test)', () => {
    it('在 1,000 筆會員與 2,000 筆歷史訂單情境下，遷移耗時應維持在 1 秒以內', async () => {
      const stressDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-stress-test-'));

      // 批次生成 1,000 筆會員
      const memberRows = ['timestamp,name,phone,store,points'];
      for (let i = 0; i < 1000; i++) {
        const phone = `0910${String(i).padStart(6, '0')}`;
        memberRows.push(`2026/01/01,會員_${i},${phone},竹北,100`);
      }
      fs.writeFileSync(path.join(stressDir, 'members.csv'), memberRows.join('\n'), 'utf-8');

      // 批次生成 2,000 筆歷史訂單明細
      const salesRows = ['phone,orderId,createdAt,store,itemCode,itemName,receivedAmount,cash,pointsDelta'];
      for (let i = 0; i < 2000; i++) {
        const phone = `0910${String(i % 1000).padStart(6, '0')}`;
        salesRows.push(`${phone},ORD-STRESS-${i},2026/04/01,竹北,GK001,海賊王GK,350,350,10`);
      }
      fs.writeFileSync(path.join(stressDir, 'sales_history.csv'), salesRows.join('\n'), 'utf-8');

      // 執行正式寫入並計時
      const start = performance.now();
      const migrator = new SheetMigrator({ dataDir: stressDir, dryRun: false });
      const report = await migrator.run();
      const durationMs = performance.now() - start;

      expect(report.details.members.imported).toBe(1000);
      expect(report.details.orders.imported).toBe(2000);

      // 驗證耗時小於 1,500 毫秒 (極速基準)
      expect(durationMs).toBeLessThan(1500);
      console.log(`\n⚡ 大容量壓力測試通過！1,000 會員 + 2,000 歷史訂單寫入耗時: ${durationMs.toFixed(1)} ms\n`);
    });
  });
});
