import { describe, it, expect, beforeAll } from 'vitest';
import path from 'path';
import fs from 'fs';
import { buildApp } from '../src/app';
import { initPrisma, prisma } from '../src/plugins/prisma';
import type { FastifyInstance } from 'fastify';
import { normalizePhone, parseNumber, parseSheetDate, normalizeStoreId, normalizeTaiwanBirthday } from '../src/scripts/migrate-sheets/cleaner';
import { SheetMigrator } from '../src/scripts/migrate-sheets/migrator';

describe('OneSoul 資料清洗與試算表遷移 User Stories 全面驗收測試 Suite', () => {
  let app: FastifyInstance;
  const realStorePath = path.resolve(__dirname, '../data/real_migrated_store.json');
  let realStoreData: any = null;

  beforeAll(async () => {
    await initPrisma();
    app = buildApp();
    await app.ready();

    if (fs.existsSync(realStorePath)) {
      realStoreData = JSON.parse(fs.readFileSync(realStorePath, 'utf-8'));
    }
  });

  // ─────────────────────────────────────────────────────────────
  // US-65: 會員手機號碼強固型清洗、去重與系統帳號保護
  // ─────────────────────────────────────────────────────────────
  describe('US-65: 歷史會員手機號碼正規化與去重驗收', () => {
    it('應正確處理帶有符號、多餘空格、括號或 Excel 匯出浮點小數尾綴 (.0) 之台灣手機', () => {
      expect(normalizePhone('0912-345-678')).toEqual({ phone: '0912345678', isValid: true });
      expect(normalizePhone('0912 345 678')).toEqual({ phone: '0912345678', isValid: true });
      expect(normalizePhone('(0912)345678')).toEqual({ phone: '0912345678', isValid: true });
      expect(normalizePhone('0912.345.678')).toEqual({ phone: '0912345678', isValid: true });
      expect(normalizePhone('0912345678.0')).toEqual({ phone: '0912345678', isValid: true });
      expect(normalizePhone('912345678.0')).toEqual({ phone: '0912345678', isValid: true, note: '自動補回前導 0' });
    });

    it('應自動補回省略首碼 0 的 9 碼電話', () => {
      const res = normalizePhone('912345678');
      expect(res.phone).toBe('0912345678');
      expect(res.isValid).toBe(true);
      expect(res.note).toContain('自動補回前導 0');
    });

    it('應自動去除 +886 與 886 國碼並還原為標準 09 開頭', () => {
      const withPlus = normalizePhone('+886912345678');
      expect(withPlus.phone).toBe('0912345678');
      expect(withPlus.isValid).toBe(true);

      const withoutPlus = normalizePhone('886912345678');
      expect(withoutPlus.phone).toBe('0912345678');
      expect(withoutPlus.isValid).toBe(true);
    });

    it('應保留 88888 (手動加點) 與 99999 (手動扣點) 特殊系統帳號', () => {
      expect(normalizePhone('88888')).toEqual({ phone: '88888', isValid: true, note: '特殊系統帳號' });
      expect(normalizePhone('99999')).toEqual({ phone: '99999', isValid: true, note: '特殊系統帳號' });
    });

    it('應嚴格拒絕長度不足、過長或非法字元之電話號碼', () => {
      expect(normalizePhone('0912345').isValid).toBe(false);
      expect(normalizePhone('02-12345678').isValid).toBe(false); // 室話非手機
      expect(normalizePhone('abc09123456').isValid).toBe(false);
      expect(normalizePhone('').isValid).toBe(false);
      expect(normalizePhone(null).isValid).toBe(false);
    });

    it('驗證真實資料庫中所有會員電話 100% 合法且無重複', () => {
      expect(realStoreData).toBeTruthy();
      const members = realStoreData.members || [];
      expect(members.length).toBeGreaterThan(1500);

      const phoneSet = new Set<string>();
      members.forEach((m: any) => {
        const phone = String(m.phone || '').trim();
        expect(phone).toBeTruthy();
        expect(phoneSet.has(phone)).toBe(false); // 絕無重複
        phoneSet.add(phone);

        if (phone !== '88888' && phone !== '99999') {
          expect(phone).toMatch(/^09\d{8}$/);
        }
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // US-66: 會員生日多樣化格式、民國年與異常年份校驗
  // ─────────────────────────────────────────────────────────────
  describe('US-66: 會員生日多格式與民國年/Excel 浮點數自動解析校正', () => {
    it('應正確解析民國年 (如 86/6/15 ➜ 1997/06/15)', () => {
      expect(normalizeTaiwanBirthday('86/6/15')).toBe('1997/06/15');
      expect(normalizeTaiwanBirthday('75/12/30')).toBe('1986/12/30');
    });

    it('應正確解析倒置民國年 (如 5/4/0090 ➜ 2001/05/04)', () => {
      expect(normalizeTaiwanBirthday('5/4/0090')).toBe('2001/05/04');
    });

    it('應精準過濾超自然年份、建檔日誤植與非真實曆法日 (如 1785 年、2026 年或 2/30 溢位日)', () => {
      expect(normalizeTaiwanBirthday('1785/01/01')).toBeNull();
      expect(normalizeTaiwanBirthday('2026/04/01')).toBeNull();
      expect(normalizeTaiwanBirthday('1995/02/30')).toBeNull(); // 非法日防範 Rollover
      expect(normalizeTaiwanBirthday('0')).toBeNull();
      expect(normalizeTaiwanBirthday('invalid')).toBeNull();
    });

    it('真實資料庫中會員生日若存在，年份必須座落於 1930 ~ 2020 年合理區間', () => {
      expect(realStoreData).toBeTruthy();
      const members = realStoreData.members || [];
      members.forEach((m: any) => {
        if (m.birthday) {
          const match = m.birthday.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
          if (match) {
            const year = parseInt(match[1], 10);
            expect(year).toBeGreaterThanOrEqual(1930);
            expect(year).toBeLessThanOrEqual(2020);
          }
        }
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // US-67: 商品主檔真實品名交叉回補與純數字代號消除
  // ─────────────────────────────────────────────────────────────
  describe('US-67: 商品主檔真實品名交叉回補與代號消除驗收', () => {
    it('真實資料庫中 3,500+ 款商品品名絕無「商品-ID」或純數字代號 (88888/99999 除外)', () => {
      expect(realStoreData).toBeTruthy();
      const products = realStoreData.products || [];
      expect(products.length).toBeGreaterThanOrEqual(3500);

      products.forEach((p: any) => {
        const id = String(p.id);
        const name = String(p.name || '').trim();

        expect(name).toBeTruthy();
        expect(name).not.toMatch(/^商品-\d+$/);
        expect(name).not.toMatch(/^商品規格-/);

        if (id !== '88888' && id !== '99999') {
          // 品名不可為純數字 (避免 100037 等代號未解析)
          expect(name).not.toMatch(/^\d+$/);
        }
      });
    });

    it('透過 API 分頁查詢商品庫存主檔，品名均為真實語義且包含完整資訊', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/inventory/summary?page=1&pageSize=50',
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);

      json.data.forEach((item: any) => {
        expect(item.name.length).toBeGreaterThan(0);
        if (item.id !== '88888' && item.id !== '99999') {
          expect(item.name).not.toMatch(/^\d+$/);
        }
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // US-68: 商品二級分類體系 (GK vs 盲盒 & 16 大真實動漫 IP，消除 GENERAL)
  // ─────────────────────────────────────────────────────────────
  describe('US-68: 商品二級分類體系 (GK vs BLIND_BOX & 16 IP)', () => {
    const VALID_16_IPS = [
      '海賊王', '火影', '寶可夢', '七龍珠', '遊戲王', '獵人',
      '灌籃高手', '鏈鋸咒術', '宮崎駿', '數碼寶貝', '小新', '安妮雅',
      '潮玩', '國漫', '阿拉雷', '綜合'
    ];

    it('真實資料庫中商品分類絕無無意義之 GENERAL 模糊類別', () => {
      expect(realStoreData).toBeTruthy();
      const products = realStoreData.products || [];

      products.forEach((p: any) => {
        const id = String(p.id);
        if (id !== '88888' && id !== '99999' && !id.startsWith('SKU-SYS-')) {
          expect(p.category).not.toBe('GENERAL');
          // 必須符合二級分類之大項或 16 大 IP 分類之一
          const isValid =
            p.category === 'GK' ||
            p.category === 'BLIND_BOX' ||
            p.category === '盲盒' ||
            VALID_16_IPS.includes(p.category);
          expect(isValid).toBe(true);
        }
      });
    });

    it('API 二級過濾：能單獨篩選出 GK 雕像或盒玩盲盒', async () => {
      // 1. 篩選盒玩盲盒
      const resBlind = await app.inject({
        method: 'GET',
        url: '/api/admin/inventory/summary?mainCategory=BLIND_BOX&page=1&pageSize=20',
      });
      expect(resBlind.statusCode).toBe(200);
      const jsonBlind = resBlind.json();
      expect(jsonBlind.pagination.total).toBeGreaterThan(0);
      jsonBlind.data.forEach((item: any) => {
        expect(item.category).toMatch(/盲盒|BLIND_BOX/);
      });

      // 2. 篩選 GK 雕像
      const resGK = await app.inject({
        method: 'GET',
        url: '/api/admin/inventory/summary?mainCategory=GK&page=1&pageSize=20',
      });
      expect(resGK.statusCode).toBe(200);
      const jsonGK = resGK.json();
      expect(jsonGK.pagination.total).toBeGreaterThan(3000);
    });

    it('API 二級過濾：支援 GK 雕像結合「海賊王」真實 IP 分類查詢', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/inventory/summary?mainCategory=GK&category=海賊王&page=1&pageSize=20',
      });
      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.pagination.total).toBeGreaterThan(0);
      json.data.forEach((item: any) => {
        expect(item.category).toBe('海賊王');
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // US-69: 盲盒公式預留空行 (如 103999) 徹底過濾
  // ─────────────────────────────────────────────────────────────
  describe('US-69: 盲盒資料庫公式預留空行 (如 103999) 徹底濾除驗收', () => {
    it('商品主檔與盲盒庫中絕不存在 103999 等無品名、零成本、零售價之空行幽靈商品', () => {
      expect(realStoreData).toBeTruthy();
      const products = realStoreData.products || [];
      const blindBoxes = realStoreData.blindBoxes || [];

      const p103999 = products.find((p: any) => String(p.id) === '103999' || String(p.barcode) === '471103999');
      expect(p103999).toBeUndefined();

      const b103999 = blindBoxes.find((b: any) => String(b.id) === '103999' || String(b.barcode) === '471103999');
      expect(b103999).toBeUndefined();
    });

    it('API 搜尋 103999 不應回傳任何無效之幽靈盲盒', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/blindboxes?q=103999',
      });
      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.data.length).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // US-70: 雙門市庫存拆分、非負數邊界約束與無孤兒庫存
  // ─────────────────────────────────────────────────────────────
  describe('US-70: 雙門市庫存拆分、非負約束 (quantity >= 0) 與孤兒防禦', () => {
    it('真實資料庫中所有門市庫存 quantity >= 0 且 storeId 必為 chupei 或 jinshan', () => {
      expect(realStoreData).toBeTruthy();
      const inventories = realStoreData.inventories || [];
      const products = realStoreData.products || [];
      const prodIdSet = new Set(products.map((p: any) => String(p.id)));

      expect(inventories.length).toBeGreaterThanOrEqual(7000);

      inventories.forEach((inv: any) => {
        expect(['chupei', 'jinshan']).toContain(inv.storeId);
        expect(inv.quantity).toBeGreaterThanOrEqual(0); // 嚴禁負數
        // 嚴防孤兒商品庫存
        expect(prodIdSet.has(String(inv.productId))).toBe(true);
      });
    });

    it('庫存調帳若引發負數庫存，API 必須強制阻擋並回傳 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/inventory/adjust-stock',
        headers: { 'x-caller-email': 'admin@onesoul.com' },
        payload: {
          storeId: 'chupei',
          productId: '88888',
          delta: -99999, // 惡意或錯誤的大量超扣
          reason: '測試超扣阻斷',
        },
      });

      expect(res.statusCode).toBe(400);
      const json = res.json();
      expect(json.success).toBe(false);
      expect(json.message).toMatch(/負數|不足|無效/);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // US-71: 18,000+ 筆歷史銷售明細平帳校驗與系統虛擬 SKU 對照
  // ─────────────────────────────────────────────────────────────
  describe('US-71: 歷史銷售交易平帳校驗與虛擬品項完整性', () => {
    it('真實資料庫中所有歷史訂單之實收金額與支付管道加總 100% 平帳', () => {
      expect(realStoreData).toBeTruthy();
      const orders = realStoreData.orders || [];
      expect(orders.length).toBeGreaterThan(6000);

      orders.forEach((o: any) => {
        const recv = Math.round(Number(o.receivedAmount || 0));
        const cash = Number(o.cash || 0);
        const card = Number(o.creditCard || 0);
        const remit = Number(o.remittance || 0);
        const sumPayment = Math.round(cash + card + remit);

        expect(recv).toBe(sumPayment);
        expect(recv).toBeGreaterThanOrEqual(0);
        expect(cash).toBeGreaterThanOrEqual(0);
        expect(card).toBeGreaterThanOrEqual(0);
        expect(remit).toBeGreaterThanOrEqual(0);
      });
    });

    it('所有訂單明細之品項 ID 均合法存在於主檔中 (涵蓋 SKU-SYS-Z-NON-GK 與 SKU-SYS-X-BOX 等虛擬品項)', () => {
      expect(realStoreData).toBeTruthy();
      const orders = realStoreData.orders || [];
      const products = realStoreData.products || [];
      const prodIdSet = new Set(products.map((p: any) => String(p.id)));

      let totalItems = 0;
      orders.forEach((o: any) => {
        const items = o.items || [];
        totalItems += items.length;
        items.forEach((it: any) => {
          const pid = it.productId ? String(it.productId) : null;
          if (pid) {
            expect(prodIdSet.has(pid)).toBe(true); // 絕無孤兒外鍵
          }
        });
      });
      expect(totalItems).toBeGreaterThan(18000);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // US-72: 試算表遷移乾跑 (dryRun) 與審計報告輸出驗收
  // ─────────────────────────────────────────────────────────────
  describe('US-72: 試算表遷移 dryRun 預演與審計報告完整性', () => {
    it('POST /api/admin/migration/run 支援 dryRun=true 模式，不破壞線上資料庫', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/migration/run',
        headers: { 'x-caller-email': 'admin@onesoul.com' },
        payload: {
          dryRun: true,
          source: 'auto',
        },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.jobId).toBeTruthy();
    });

    it('GET /api/admin/migration/status 回傳當前健康狀態與各資料表統計', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/migration/status',
        headers: { 'x-caller-email': 'admin@onesoul.com' },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.status).toBeDefined();
    });
  });
});
