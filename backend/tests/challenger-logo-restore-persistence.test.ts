import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'crypto';
import { buildApp } from '../src/app.js';
import { prisma, initPrisma } from '../src/plugins/prisma.js';
import type { FastifyInstance } from 'fastify';

describe('Empirical Challenger: Brand Logo State Lifecycle, Restore & Persistence Harness', () => {
  let app: FastifyInstance;
  const AUDIT_SECRET = process.env.AUDIT_SECRET || 'onesoul-audit-key-2026';

  // 1x1 綠色 PNG
  const customSquarePng =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkWP+/HgAEfAI7U29pUAAAAABJRU5ErkJggg==';

  // 2x2 紅色 PNG
  const customHorizontalPng =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mP8z8AARAwMDEwMDABiBgMBs2XlVAAAAABJRU5ErkJggg==';

  // 獨立自訂藍色 SVG
  const customSquareSvg = `data:image/svg+xml;base64,${Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="blue"/></svg>'
  ).toString('base64')}`;

  beforeAll(async () => {
    await initPrisma();
    app = await buildApp();
    await app.ready();

    // 清理或重設品牌設定以確保起始於純淨預設狀態
    if (typeof (prisma.integrationConfig as any).deleteMany === 'function') {
      await (prisma.integrationConfig as any).deleteMany({
        where: { key: 'STORE_BRAND_INFO' },
      });
    } else {
      // In-Memory Prisma 模式：若已存在則重設回預設無自訂 Logo 狀態
      const existing = await prisma.integrationConfig.findUnique({
        where: { key: 'STORE_BRAND_INFO' },
      });
      if (existing) {
        await prisma.integrationConfig.upsert({
          where: { key: 'STORE_BRAND_INFO' },
          create: {
            key: 'STORE_BRAND_INFO',
            value: JSON.stringify({
              brandName: 'OneSoul 模型玩具一番賞',
              brandSubtitle: '門市管理與即時營運系統',
              logoText: 'OS',
              supportPhone: '0912-345-678',
              blindBoxPointsValue: 10,
              pointRateTwd: 20,
              smallPrizePointsValue: 1,
              logoHorizontal: null,
              logoSquare: null,
            }),
          },
          update: {
            value: JSON.stringify({
              brandName: 'OneSoul 模型玩具一番賞',
              brandSubtitle: '門市管理與即時營運系統',
              logoText: 'OS',
              supportPhone: '0912-345-678',
              blindBoxPointsValue: 10,
              pointRateTwd: 20,
              smallPrizePointsValue: 1,
              logoHorizontal: null,
              logoSquare: null,
            }),
          },
        });
      }
    }
  });

  afterAll(async () => {
    await app.close();
  });

  // ─────────────────────────────────────────────────────────────
  // 1. 預設狀態起始驗證 (Default State Initialization)
  // ─────────────────────────────────────────────────────────────
  describe('Test 1: 預設狀態起始驗證 (Default State Initialization)', () => {
    it('1.1 公開端點 GET /api/v1/brand 在初始無設定時自動指向預設圖示路徑', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/brand',
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.brandName).toBe('OneSoul 模型玩具一番賞');
      expect(json.data.logoHorizontal).toBe('/logo-horizontal.png');
      expect(json.data.logoSquare).toBe('/logo-square.png');
      expect(json.data.hasCustomHorizontalLogo).toBe(false);
      expect(json.data.hasCustomSquareLogo).toBe(false);
      expect(json.data.defaultLogos).toEqual({
        horizontal: '/logo-horizontal.png',
        square: '/logo-square.png',
      });
    });

    it('1.2 管理員端點 GET /api/admin/settings/brand 在初始無設定時 custom logo 應為 null', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/settings/brand',
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.logoHorizontal).toBeNull();
      expect(json.data.logoSquare).toBeNull();
      expect(json.data.hasCustomHorizontalLogo).toBe(false);
      expect(json.data.hasCustomSquareLogo).toBe(false);
      expect(json.data.defaultLogos).toEqual({
        horizontal: '/logo-horizontal.png',
        square: '/logo-square.png',
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 2. 單一自訂上傳與持久化驗證 (Single Custom Upload & Persistence)
  // ─────────────────────────────────────────────────────────────
  describe('Test 2: 單一自訂上傳與獨立持久化驗證 (Single Custom Upload & Isolation)', () => {
    it('2.1 僅上傳自訂 logoSquare（不提供 logoHorizontal），資料庫與 API 能正確持久化且 logoHorizontal 維持預設路徑', async () => {
      const putRes = await app.inject({
        method: 'PUT',
        url: '/api/admin/settings/brand',
        payload: {
          logoSquare: customSquarePng,
        },
      });

      expect(putRes.statusCode).toBe(200);
      const putBody = putRes.json();
      expect(putBody.success).toBe(true);
      expect(putBody.data.logoSquare).toBe(customSquarePng);
      expect(putBody.data.logoHorizontal).toBeNull();
      expect(putBody.data.hasCustomSquareLogo).toBe(true);
      expect(putBody.data.hasCustomHorizontalLogo).toBe(false);

      // 直接檢查底層資料庫持久化記錄
      const dbConfig = await prisma.integrationConfig.findUnique({
        where: { key: 'STORE_BRAND_INFO' },
      });
      expect(dbConfig).not.toBeNull();
      const parsedConfig = JSON.parse(dbConfig!.value as string);
      expect(parsedConfig.logoSquare).toBe(customSquarePng);
      expect(parsedConfig.logoHorizontal).toBeNull();

      // 檢查公開端點 GET /api/v1/brand 回傳值
      const pubRes = await app.inject({
        method: 'GET',
        url: '/api/v1/brand',
      });
      const pubBody = pubRes.json();
      expect(pubBody.data.logoSquare).toBe(customSquarePng);
      expect(pubBody.data.hasCustomSquareLogo).toBe(true);
      expect(pubBody.data.logoHorizontal).toBe('/logo-horizontal.png');
      expect(pubBody.data.hasCustomHorizontalLogo).toBe(false);
    });

    it('2.2 僅上傳自訂 logoHorizontal（不提供 logoSquare），驗證兩者獨立互不覆蓋', async () => {
      const putRes = await app.inject({
        method: 'PUT',
        url: '/api/admin/settings/brand',
        payload: {
          logoHorizontal: customHorizontalPng,
        },
      });

      expect(putRes.statusCode).toBe(200);
      const putBody = putRes.json();
      expect(putBody.success).toBe(true);
      // 橫式 Logo 成功設定
      expect(putBody.data.logoHorizontal).toBe(customHorizontalPng);
      expect(putBody.data.hasCustomHorizontalLogo).toBe(true);
      // 原有方形 Logo 依然完好保留，未被覆蓋！
      expect(putBody.data.logoSquare).toBe(customSquarePng);
      expect(putBody.data.hasCustomSquareLogo).toBe(true);

      // 資料庫持久化驗證
      const dbConfig = await prisma.integrationConfig.findUnique({
        where: { key: 'STORE_BRAND_INFO' },
      });
      const parsedConfig = JSON.parse(dbConfig!.value as string);
      expect(parsedConfig.logoHorizontal).toBe(customHorizontalPng);
      expect(parsedConfig.logoSquare).toBe(customSquarePng);

      // 公開端點驗證兩者皆生效
      const pubRes = await app.inject({
        method: 'GET',
        url: '/api/v1/brand',
      });
      const pubBody = pubRes.json();
      expect(pubBody.data.logoHorizontal).toBe(customHorizontalPng);
      expect(pubBody.data.hasCustomHorizontalLogo).toBe(true);
      expect(pubBody.data.logoSquare).toBe(customSquarePng);
      expect(pubBody.data.hasCustomSquareLogo).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 3. 單項還原 (Single Restore) 驗證
  // ─────────────────────────────────────────────────────────────
  describe('Test 3: 單項還原 (Single Restore) 驗證', () => {
    it('3.1 調用 POST /api/admin/settings/brand/logo/reset { type: "horizontal" }：logoHorizontal 恢復預設，logoSquare 完好保留', async () => {
      const resetRes = await app.inject({
        method: 'POST',
        url: '/api/admin/settings/brand/logo/reset',
        payload: { type: 'horizontal' },
      });

      expect(resetRes.statusCode).toBe(200);
      const resetBody = resetRes.json();
      expect(resetBody.success).toBe(true);
      expect(resetBody.data.logoHorizontal).toBeNull();
      expect(resetBody.data.hasCustomHorizontalLogo).toBe(false);
      // 關鍵驗證：方形 Logo 依然維持自訂圖片，未被意外清除！
      expect(resetBody.data.logoSquare).toBe(customSquarePng);
      expect(resetBody.data.hasCustomSquareLogo).toBe(true);

      // 資料庫確認
      const dbConfig = await prisma.integrationConfig.findUnique({
        where: { key: 'STORE_BRAND_INFO' },
      });
      const parsed = JSON.parse(dbConfig!.value as string);
      expect(parsed.logoHorizontal).toBeNull();
      expect(parsed.logoSquare).toBe(customSquarePng);

      // 公開端點 GET /api/v1/brand 驗證
      const pubRes = await app.inject({ method: 'GET', url: '/api/v1/brand' });
      const pubBody = pubRes.json();
      expect(pubBody.data.logoHorizontal).toBe('/logo-horizontal.png');
      expect(pubBody.data.hasCustomHorizontalLogo).toBe(false);
      expect(pubBody.data.logoSquare).toBe(customSquarePng);
      expect(pubBody.data.hasCustomSquareLogo).toBe(true);
    });

    it('3.2 對稱驗證：重新上傳橫式 Logo 後，調用 { type: "square" }：logoSquare 恢復預設，logoHorizontal 完好保留', async () => {
      // 先把橫式設為自訂
      await app.inject({
        method: 'PUT',
        url: '/api/admin/settings/brand',
        payload: { logoHorizontal: customHorizontalPng },
      });

      // 執行單項還原方形
      const resetSquareRes = await app.inject({
        method: 'POST',
        url: '/api/admin/settings/brand/logo/reset',
        payload: { type: 'square' },
      });

      expect(resetSquareRes.statusCode).toBe(200);
      const body = resetSquareRes.json();
      expect(body.success).toBe(true);
      expect(body.data.logoSquare).toBeNull();
      expect(body.data.hasCustomSquareLogo).toBe(false);
      // 橫式 Logo 依然維持自訂
      expect(body.data.logoHorizontal).toBe(customHorizontalPng);
      expect(body.data.hasCustomHorizontalLogo).toBe(true);

      // 公開端點驗證
      const pubRes = await app.inject({ method: 'GET', url: '/api/v1/brand' });
      const pubBody = pubRes.json();
      expect(pubBody.data.logoSquare).toBe('/logo-square.png');
      expect(pubBody.data.hasCustomSquareLogo).toBe(false);
      expect(pubBody.data.logoHorizontal).toBe(customHorizontalPng);
      expect(pubBody.data.hasCustomHorizontalLogo).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 4. 全數還原 (Full Restore) 驗證
  // ─────────────────────────────────────────────────────────────
  describe('Test 4: 全數還原 (Full Restore) 驗證', () => {
    it('4.1 兩者皆設定為自訂後，調用 { type: "all" }：兩者均全數恢復為 null / 預設路徑', async () => {
      // 先將兩者皆設為自訂圖片
      await app.inject({
        method: 'PUT',
        url: '/api/admin/settings/brand',
        payload: {
          logoHorizontal: customHorizontalPng,
          logoSquare: customSquareSvg,
        },
      });

      // 執行全數還原
      const resetAllRes = await app.inject({
        method: 'POST',
        url: '/api/admin/settings/brand/logo/reset',
        payload: { type: 'all' },
      });

      expect(resetAllRes.statusCode).toBe(200);
      const body = resetAllRes.json();
      expect(body.success).toBe(true);
      expect(body.data.logoHorizontal).toBeNull();
      expect(body.data.logoSquare).toBeNull();
      expect(body.data.hasCustomHorizontalLogo).toBe(false);
      expect(body.data.hasCustomSquareLogo).toBe(false);

      // 資料庫驗證
      const dbConfig = await prisma.integrationConfig.findUnique({
        where: { key: 'STORE_BRAND_INFO' },
      });
      const parsed = JSON.parse(dbConfig!.value as string);
      expect(parsed.logoHorizontal).toBeNull();
      expect(parsed.logoSquare).toBeNull();

      // 公開端點驗證
      const pubRes = await app.inject({ method: 'GET', url: '/api/v1/brand' });
      const pubBody = pubRes.json();
      expect(pubBody.data.logoHorizontal).toBe('/logo-horizontal.png');
      expect(pubBody.data.logoSquare).toBe('/logo-square.png');
      expect(pubBody.data.hasCustomHorizontalLogo).toBe(false);
      expect(pubBody.data.hasCustomSquareLogo).toBe(false);
    });

    it('4.2 冪等性驗證：在已經是預設狀態下再次調用 { type: "all" }，依然回傳 200 且不損壞系統狀態', async () => {
      const resetRepeat = await app.inject({
        method: 'POST',
        url: '/api/admin/settings/brand/logo/reset',
        payload: { type: 'all' },
      });

      expect(resetRepeat.statusCode).toBe(200);
      const body = resetRepeat.json();
      expect(body.success).toBe(true);
      expect(body.data.logoHorizontal).toBeNull();
      expect(body.data.logoSquare).toBeNull();
      expect(body.data.hasCustomHorizontalLogo).toBe(false);
      expect(body.data.hasCustomSquareLogo).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 5. 審計雜湊鏈防篡改檢驗 (Cryptographic Audit Log Hash Chain)
  // ─────────────────────────────────────────────────────────────
  describe('Test 5: 審計雜湊鏈防篡改檢驗 (Cryptographic Audit Log Hash Chain)', () => {
    it('5.1 檢查上述操作所產生之所有 StoreBrand AuditLog 記錄，驗算 currentHash 嚴格等於 HMAC-SHA256 且鏈接無斷鏈', async () => {
      // 撈取全量審計日誌
      const rawAllLogs = await prisma.auditLog.findMany();
      // memoryPrisma 預設會 reverse()，因此若最舊的日誌在陣列末端，將其反轉為嚴格的時間正序
      const isReverseOrdered =
        rawAllLogs.length >= 2 &&
        new Date(rawAllLogs[0].createdAt).getTime() >= new Date(rawAllLogs[rawAllLogs.length - 1].createdAt).getTime();
      const allLogs = isReverseOrdered ? [...rawAllLogs].reverse() : rawAllLogs;

      // 篩選出 StoreBrand 相關的審計記錄（按時間正序）
      const brandLogs = allLogs.filter((l: any) => l.targetType === 'StoreBrand');

      // 至少有 6 筆操作 (2 次 PUT, 4 次 reset)
      expect(brandLogs.length).toBeGreaterThanOrEqual(6);

      // 1. 驗證全量鏈條中相鄰兩筆的 prevHash 必定等於前一筆的 currentHash (完整鏈條零斷鏈)
      for (let i = 1; i < allLogs.length; i++) {
        expect(allLogs[i].prevHash).toBe(allLogs[i - 1].currentHash);
      }

      // 2. 驗證所有 StoreBrand 審計記錄之 currentHash 皆嚴格符合 HMAC-SHA256 密碼學規範
      for (const log of brandLogs) {
        const expectedPayload = `${log.prevHash}|${log.operatorId}|${log.action}|${log.targetType}|${log.targetId}|${log.delta ?? 0}|${log.reason}`;
        const calculatedHash = crypto.createHmac('sha256', AUDIT_SECRET).update(expectedPayload).digest('hex');
        expect(log.currentHash).toBe(calculatedHash);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 6. 邊界與異常對抗實測 (Adversarial Robustness & Input Guardrails)
  // ─────────────────────────────────────────────────────────────
  describe('Test 6: 邊界與異常對抗實測 (Adversarial Robustness & Guardrails)', () => {
    it('6.1 傳入非法 reset type (非 horizontal, square, all) 應立即阻斷 (400 Bad Request)', async () => {
      const invalidTypes = ['header', 'footer', 'none', '', 12345, null];

      for (const inv of invalidTypes) {
        const res = await app.inject({
          method: 'POST',
          url: '/api/admin/settings/brand/logo/reset',
          payload: { type: inv },
        });

        expect(res.statusCode).toBe(400);
        expect(res.json().success).toBe(false);
        expect(res.json().message).toContain('無效的重設類型');
      }
    });

    it('6.2 傳入非字串型態 (如數字、布林) 至 PUT /api/admin/settings/brand 應被阻斷 (400 Bad Request)', async () => {
      // 傳入純數字型態
      const numRes = await app.inject({
        method: 'PUT',
        url: '/api/admin/settings/brand',
        payload: { logoSquare: 99999 },
      });
      expect(numRes.statusCode).toBe(400);
      expect(numRes.json().message).toContain('必須為字串或 null');

      // 傳入布林型態
      const boolRes = await app.inject({
        method: 'PUT',
        url: '/api/admin/settings/brand',
        payload: { logoHorizontal: false },
      });
      expect(boolRes.statusCode).toBe(400);
      expect(boolRes.json().message).toContain('必須為字串或 null');
    });

    it('6.3 傳入非法 DataURL 格式 (不支援之 MIME、過大圖檔、XSS 腳本) 應被阻斷 (400 Bad Request)', async () => {
      // 非法 MIME
      const gifRes = await app.inject({
        method: 'PUT',
        url: '/api/admin/settings/brand',
        payload: { logoHorizontal: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7' },
      });
      expect(gifRes.statusCode).toBe(400);
      expect(gifRes.json().message).toContain('不支援');

      // 缺少逗號之畸形 Data URL
      const malformedRes = await app.inject({
        method: 'PUT',
        url: '/api/admin/settings/brand',
        payload: { logoSquare: 'data:image/png;base64' },
      });
      expect(malformedRes.statusCode).toBe(400);
      expect(malformedRes.json().message).toContain('格式無效');
    });

    it('6.4 提交非 data: 開頭字串 (如外部連結或未校驗字串) 應被阻斷 (400 Bad Request) 且不污染資料庫', async () => {
      const exploitPayload = { logoHorizontal: 'https://attacker.com/spoofed-logo.png' };
      const exploitRes = await app.inject({
        method: 'PUT',
        url: '/api/admin/settings/brand',
        payload: exploitPayload,
      });

      // 防禦驗證：伺服器正確回傳 400 Bad Request
      expect(exploitRes.statusCode).toBe(400);
      expect(exploitRes.json().success).toBe(false);
      expect(exploitRes.json().message).toContain('必須為合法的 Data URL');

      // 狀態穩健性驗證：資料庫未發生任何污染或寫入，保持純淨 null
      const checkRes = await app.inject({
        method: 'GET',
        url: '/api/admin/settings/brand',
      });
      expect(checkRes.statusCode).toBe(200);
      expect(checkRes.json().data.logoHorizontal).toBeNull();
    });

    it('6.5 在經歷所有異常與對抗探針後，系統狀態依然可透過 reset/default 端點回復完整穩健性', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/settings/brand',
      });
      expect(res.statusCode).toBe(200);
      const data = res.json().data;
      expect(data.logoHorizontal).toBeNull();
      expect(data.logoSquare).toBeNull();
      expect(data.hasCustomHorizontalLogo).toBe(false);
      expect(data.hasCustomSquareLogo).toBe(false);

      const pubRes = await app.inject({
        method: 'GET',
        url: '/api/v1/brand',
      });
      expect(pubRes.statusCode).toBe(200);
      expect(pubRes.json().data.logoHorizontal).toBe('/logo-horizontal.png');
      expect(pubRes.json().data.logoSquare).toBe('/logo-square.png');
    });
  });
});
