import { describe, it, expect, beforeAll } from 'vitest';
import crypto from 'crypto';
import { buildApp } from '../src/app';
import { prisma } from '../src/plugins/prisma';
import type { FastifyInstance } from 'fastify';

describe('店家品牌與 Logo 設定 API (Brand Settings & Security)', () => {
  let app: FastifyInstance;

  // 1x1 像素有效透明 PNG Base64 Data URL (約 68 bytes)
  const validPngDataUrl =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

  // 有效且安全的 SVG Base64 Data URL
  const validSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="50" cy="50" r="40" fill="red" /></svg>';
  const validSvgDataUrl = `data:image/svg+xml;base64,${Buffer.from(validSvg).toString('base64')}`;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  it('1. 公開端點: GET /api/v1/brand 應回傳系統預設品牌名稱與預設 Logo 路徑', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/brand',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.brandName).toBeDefined();
    expect(body.data.logoHorizontal).toBe('/logo-horizontal.png');
    expect(body.data.logoSquare).toBe('/logo-square.png');
    expect(body.data.hasCustomHorizontalLogo).toBe(false);
    expect(body.data.hasCustomSquareLogo).toBe(false);
    expect(body.data.defaultLogos).toEqual({
      horizontal: '/logo-horizontal.png',
      square: '/logo-square.png',
    });
  });

  it('2. 管理員讀取端點: GET /api/admin/settings/brand 未客製時 custom logo 應為 null', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/settings/brand',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.logoHorizontal).toBeNull();
    expect(body.data.logoSquare).toBeNull();
    expect(body.data.hasCustomHorizontalLogo).toBe(false);
    expect(body.data.hasCustomSquareLogo).toBe(false);
    expect(body.data.defaultLogos).toEqual({
      horizontal: '/logo-horizontal.png',
      square: '/logo-square.png',
    });
  });

  it('3. 管理員更新 Logo: PUT /api/admin/settings/brand 成功更新橫式與方形 Logo', async () => {
    const payload = {
      brandName: 'OneSoul 旗艦模型總店',
      brandSubtitle: '全台最大一番賞連鎖體系',
      logoHorizontal: validPngDataUrl,
      logoSquare: validSvgDataUrl,
    };

    const resPut = await app.inject({
      method: 'PUT',
      url: '/api/admin/settings/brand',
      payload,
    });

    expect(resPut.statusCode).toBe(200);
    const body = resPut.json();
    expect(body.success).toBe(true);
    expect(body.data.brandName).toBe('OneSoul 旗艦模型總店');
    expect(body.data.logoHorizontal).toBe(validPngDataUrl);
    expect(body.data.logoSquare).toBe(validSvgDataUrl);
    expect(body.data.hasCustomHorizontalLogo).toBe(true);
    expect(body.data.hasCustomSquareLogo).toBe(true);

    // 驗證公開端點 GET /api/v1/brand 同步呈現最新自訂 Logo
    const resPublic = await app.inject({
      method: 'GET',
      url: '/api/v1/brand',
    });
    expect(resPublic.statusCode).toBe(200);
    const publicBody = resPublic.json();
    expect(publicBody.data.brandName).toBe('OneSoul 旗艦模型總店');
    expect(publicBody.data.logoHorizontal).toBe(validPngDataUrl);
    expect(publicBody.data.logoSquare).toBe(validSvgDataUrl);
    expect(publicBody.data.hasCustomHorizontalLogo).toBe(true);
    expect(publicBody.data.hasCustomSquareLogo).toBe(true);
  });

  it('4. 安全防護: 阻擋不支援的 MIME 格式 (如 GIF 或 PDF)', async () => {
    // 嘗試上傳 GIF 格式
    const gifPayload = {
      logoHorizontal: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    };

    const resGif = await app.inject({
      method: 'PUT',
      url: '/api/admin/settings/brand',
      payload: gifPayload,
    });

    expect(resGif.statusCode).toBe(400);
    expect(resGif.json().success).toBe(false);
    expect(resGif.json().message).toContain('不支援');

    // 嘗試上傳 application/pdf 格式
    const pdfPayload = {
      logoSquare: 'data:application/pdf;base64,JVBERi0xLjQKJeLjz9MKMSAwIG9iajw8L1R5cGUvQ2F0YWxvZw==',
    };

    const resPdf = await app.inject({
      method: 'PUT',
      url: '/api/admin/settings/brand',
      payload: pdfPayload,
    });

    expect(resPdf.statusCode).toBe(400);
    expect(resPdf.json().success).toBe(false);
    expect(resPdf.json().message).toContain('不支援');
  });

  it('5. 安全防護: 阻擋超過 2MB 的超大圖檔', async () => {
    // 建立 2.2MB 的模擬二進位 Base64 字串
    const largeBuffer = Buffer.alloc(Math.floor(2.2 * 1024 * 1024), 0xaa);
    const largeDataUrl = `data:image/png;base64,${largeBuffer.toString('base64')}`;

    const resLarge = await app.inject({
      method: 'PUT',
      url: '/api/admin/settings/brand',
      payload: {
        logoHorizontal: largeDataUrl,
      },
    });

    expect(resLarge.statusCode).toBe(400);
    const body = resLarge.json();
    expect(body.success).toBe(false);
    expect(body.message).toContain('超過上限');
    expect(body.message).toContain('2.00 MB');
  });

  it('6. 安全防護 (MASVS): 阻擋包含 <script> 的惡意 SVG 向量圖', async () => {
    const maliciousScriptSvg = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert("XSS")</script></svg>';
    const maliciousScriptDataUrl = `data:image/svg+xml;base64,${Buffer.from(maliciousScriptSvg).toString('base64')}`;

    const resScript = await app.inject({
      method: 'PUT',
      url: '/api/admin/settings/brand',
      payload: {
        logoSquare: maliciousScriptDataUrl,
      },
    });

    expect(resScript.statusCode).toBe(400);
    const body = resScript.json();
    expect(body.success).toBe(false);
    expect(body.message).toContain('危險代碼或腳本');
  });

  it('7. 安全防護 (MASVS): 阻擋包含 onload 屬性或 javascript: 協議的惡意 SVG', async () => {
    // 1. onload 事件
    const maliciousOnloadSvg = '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>';
    const maliciousOnloadDataUrl = `data:image/svg+xml;base64,${Buffer.from(maliciousOnloadSvg).toString('base64')}`;

    const resOnload = await app.inject({
      method: 'PUT',
      url: '/api/admin/settings/brand',
      payload: { logoSquare: maliciousOnloadDataUrl },
    });
    expect(resOnload.statusCode).toBe(400);
    expect(resOnload.json().message).toContain('危險代碼或腳本');

    // 2. javascript: 偽協議
    const maliciousJsSvg = '<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)"><circle r="10" /></a></svg>';
    const maliciousJsDataUrl = `data:image/svg+xml;base64,${Buffer.from(maliciousJsSvg).toString('base64')}`;

    const resJs = await app.inject({
      method: 'PUT',
      url: '/api/admin/settings/brand',
      payload: { logoHorizontal: maliciousJsDataUrl },
    });
    expect(resJs.statusCode).toBe(400);
    expect(resJs.json().message).toContain('危險代碼或腳本');
  });

  it('8. 還原預設值: POST /api/admin/settings/brand/logo/reset 支援個別還原 (horizontal)', async () => {
    const resResetHorizontal = await app.inject({
      method: 'POST',
      url: '/api/admin/settings/brand/logo/reset',
      payload: { type: 'horizontal' },
    });

    expect(resResetHorizontal.statusCode).toBe(200);
    const body = resResetHorizontal.json();
    expect(body.success).toBe(true);
    expect(body.data.logoHorizontal).toBeNull();
    expect(body.data.hasCustomHorizontalLogo).toBe(false);
    // 方形 logo 仍保持自訂
    expect(body.data.logoSquare).toBe(validSvgDataUrl);
    expect(body.data.hasCustomSquareLogo).toBe(true);

    // 公開端點驗證
    const resPublic = await app.inject({ method: 'GET', url: '/api/v1/brand' });
    expect(resPublic.json().data.logoHorizontal).toBe('/logo-horizontal.png');
    expect(resPublic.json().data.hasCustomHorizontalLogo).toBe(false);
    expect(resPublic.json().data.logoSquare).toBe(validSvgDataUrl);
    expect(resPublic.json().data.hasCustomSquareLogo).toBe(true);
  });

  it('9. 還原預設值: POST /api/admin/settings/brand/logo/reset 支援全數還原 (all)', async () => {
    const resResetAll = await app.inject({
      method: 'POST',
      url: '/api/admin/settings/brand/logo/reset',
      payload: { type: 'all' },
    });

    expect(resResetAll.statusCode).toBe(200);
    const body = resResetAll.json();
    expect(body.success).toBe(true);
    expect(body.data.logoHorizontal).toBeNull();
    expect(body.data.logoSquare).toBeNull();
    expect(body.data.hasCustomHorizontalLogo).toBe(false);
    expect(body.data.hasCustomSquareLogo).toBe(false);

    // 公開端點驗證完全回退至預設靜態資源
    const resPublic = await app.inject({ method: 'GET', url: '/api/v1/brand' });
    expect(resPublic.json().data.logoHorizontal).toBe('/logo-horizontal.png');
    expect(resPublic.json().data.logoSquare).toBe('/logo-square.png');
    expect(resPublic.json().data.hasCustomHorizontalLogo).toBe(false);
    expect(resPublic.json().data.hasCustomSquareLogo).toBe(false);
  });

  it('10. 還原預設值防呆: 無效的 reset type 應被阻擋 (400 Bad Request)', async () => {
    const resInvalid = await app.inject({
      method: 'POST',
      url: '/api/admin/settings/brand/logo/reset',
      payload: { type: 'invalid_type' },
    });

    expect(resInvalid.statusCode).toBe(400);
    expect(resInvalid.json().success).toBe(false);
    expect(resInvalid.json().message).toContain('無效的重設類型');
  });

  it('11. 密碼學審計鏈 (AuditLog): 驗證品牌變更與重設均正確記錄且雜湊無斷鏈', async () => {
    const logs = await prisma.auditLog.findMany({
      where: { targetType: 'StoreBrand' },
    });

    expect(logs.length).toBeGreaterThanOrEqual(3); // UPDATE_BRAND_INFO, RESET_BRAND_LOGO (horizontal), RESET_BRAND_LOGO (all)

    const updateLog = logs.find((l: any) => l.action === 'UPDATE_BRAND_INFO');
    expect(updateLog).toBeDefined();
    expect(updateLog.currentHash).toHaveLength(64);
    expect(updateLog.prevHash).toHaveLength(64);

    const resetHorizontalLog = logs.find(
      (l: any) => l.action === 'RESET_BRAND_LOGO' && l.targetId === 'horizontal'
    );
    expect(resetHorizontalLog).toBeDefined();
    expect(resetHorizontalLog.currentHash).toHaveLength(64);

    const resetAllLog = logs.find(
      (l: any) => l.action === 'RESET_BRAND_LOGO' && l.targetId === 'all'
    );
    expect(resetAllLog).toBeDefined();
    expect(resetAllLog.currentHash).toHaveLength(64);

    // 驗證密碼學雜湊計算公式之正確性
    const AUDIT_SECRET = process.env.AUDIT_SECRET || 'onesoul-audit-key-2026';
    const expectedPayload = `${resetAllLog.prevHash}|${resetAllLog.operatorId}|${resetAllLog.action}|${resetAllLog.targetType}|${resetAllLog.targetId}|${resetAllLog.delta ?? 0}|${resetAllLog.reason}`;
    const calculatedHash = crypto.createHmac('sha256', AUDIT_SECRET).update(expectedPayload).digest('hex');
    expect(resetAllLog.currentHash).toBe(calculatedHash);
  });
});
