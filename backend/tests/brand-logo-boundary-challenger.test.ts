import { describe, it, expect, beforeAll } from 'vitest';
import { buildApp } from '../src/app';
import type { FastifyInstance } from 'fastify';

describe('【對抗性邊界壓力測試】Brand Logo Upload Validation & Security Challenger', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  describe('1. 檔案大小邊界壓力測試 (File Size Boundary Stress Tests)', () => {
    it('剛好 2.0 MB (2 * 1024 * 1024 = 2,097,152 bytes) 的 Base64 Data URL 應成功通過 (200 OK)', async () => {
      // 構造剛好 2,097,152 bytes 的二進位緩衝區
      const exact2MbBytes = 2 * 1024 * 1024;
      const buffer = Buffer.alloc(exact2MbBytes, 0x42);
      const exactDataUrl = `data:image/png;base64,${buffer.toString('base64')}`;

      const res = await app.inject({
        method: 'PUT',
        url: '/api/admin/settings/brand',
        payload: {
          logoHorizontal: exactDataUrl,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.logoHorizontal).toBe(exactDataUrl);
      expect(body.data.hasCustomHorizontalLogo).toBe(true);
    });

    it('2.0001 MB (2 * 1024 * 1024 + 100 = 2,097,252 bytes) 超限圖檔應被後端以 HTTP 400 阻擋', async () => {
      const over2MbBytes = 2 * 1024 * 1024 + 100;
      const buffer = Buffer.alloc(over2MbBytes, 0x42);
      const overDataUrl = `data:image/png;base64,${buffer.toString('base64')}`;

      const res = await app.inject({
        method: 'PUT',
        url: '/api/admin/settings/brand',
        payload: {
          logoSquare: overDataUrl,
        },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.message).toContain('超過上限');
      expect(body.message).toContain('2.00 MB');
    });

    it('極限 1 byte 超標 (2,097,153 bytes) 應被精確阻擋 (HTTP 400)', async () => {
      const overBy1Byte = 2 * 1024 * 1024 + 1;
      const buffer = Buffer.alloc(overBy1Byte, 0x42);
      const overDataUrl = `data:image/png;base64,${buffer.toString('base64')}`;

      const res = await app.inject({
        method: 'PUT',
        url: '/api/admin/settings/brand',
        payload: {
          logoHorizontal: overDataUrl,
        },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.message).toContain('超過上限');
    });
  });

  describe('2. 危險與非圖檔類型攻擊測試 (Dangerous & Non-Image Type Attacks)', () => {
    it('上傳 .exe 執行檔 (data:application/x-msdownload) 應被後端 400 拒絕', async () => {
      const exeDataUrl = 'data:application/x-msdownload;base64,TVqQAAMAAAAEAAAA//8AALgAAAAAAAAAQAA=';
      const res = await app.inject({
        method: 'PUT',
        url: '/api/admin/settings/brand',
        payload: { logoHorizontal: exeDataUrl },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.message).toContain('格式不支援');
      expect(body.message).toContain('application/x-msdownload');
    });

    it('上傳 .txt 文字檔 (data:text/plain) 應被後端 400 拒絕', async () => {
      const txtDataUrl = 'data:text/plain;base64,SGVsbG8gV29ybGQ=';
      const res = await app.inject({
        method: 'PUT',
        url: '/api/admin/settings/brand',
        payload: { logoSquare: txtDataUrl },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.message).toContain('格式不支援');
      expect(body.message).toContain('text/plain');
    });

    it('上傳 .pdf 文件 (data:application/pdf) 應被後端 400 拒絕', async () => {
      const pdfDataUrl = 'data:application/pdf;base64,JVBERi0xLjQKJeLjz9MKMSAwIG9iajw8L1R5cGUvQ2F0YWxvZw==';
      const res = await app.inject({
        method: 'PUT',
        url: '/api/admin/settings/brand',
        payload: { logoHorizontal: pdfDataUrl },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.message).toContain('格式不支援');
      expect(body.message).toContain('application/pdf');
    });

    it('上傳非白名單格式 image/gif 應被後端 400 拒絕', async () => {
      const gifDataUrl = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
      const res = await app.inject({
        method: 'PUT',
        url: '/api/admin/settings/brand',
        payload: { logoHorizontal: gifDataUrl },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.message).toContain('格式不支援');
      expect(body.message).toContain('image/gif');
    });

    it('上傳非白名單格式 image/bmp 應被後端 400 拒絕', async () => {
      const bmpDataUrl = 'data:image/bmp;base64,Qk06AAAAAAAAADYAAAAoAAAAAQAAAAEAAAABABgAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAA';
      const res = await app.inject({
        method: 'PUT',
        url: '/api/admin/settings/brand',
        payload: { logoSquare: bmpDataUrl },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.message).toContain('格式不支援');
      expect(body.message).toContain('image/bmp');
    });
  });

  describe('3. 副檔名與協定偽裝攻擊測試 (MIME & Protocol Spoofing Attacks)', () => {
    it('上傳 application/octet-stream 二進位流偽裝應被後端 400 阻擋', async () => {
      const octetStreamDataUrl = 'data:application/octet-stream;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
      const res = await app.inject({
        method: 'PUT',
        url: '/api/admin/settings/brand',
        payload: { logoSquare: octetStreamDataUrl },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.message).toContain('格式不支援');
      expect(body.message).toContain('application/octet-stream');
    });

    it('提交遠端 URL (非 data: 開頭) 應被阻擋 (HTTP 400)', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/admin/settings/brand',
        payload: { logoHorizontal: 'https://evil.com/shell.png' },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.message).toContain('必須為合法的 Data URL');
    });

    it('提交 javascript: 偽協議字串應被阻擋 (HTTP 400)', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/admin/settings/brand',
        payload: { logoHorizontal: 'javascript:alert(document.domain)' },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.success).toBe(false);
    });

    it('使用大寫 DATA: 協議繞過驗證檢查之惡意 SVG 載荷應被阻擋 (HTTP 400)', async () => {
      const xssSvg = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>';
      const dataUrl = `DATA:image/svg+xml;base64,${Buffer.from(xssSvg).toString('base64')}`;

      const res = await app.inject({
        method: 'PUT',
        url: '/api/admin/settings/brand',
        payload: { logoSquare: dataUrl },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.success).toBe(false);
    });

    it('缺少逗號分隔符號之畸形 Data URL 應被阻擋 (HTTP 400)', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/admin/settings/brand',
        payload: { logoSquare: 'data:image/png;base64' },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.message).toContain('缺少逗號分隔符號');
    });

    it('非字串型態 (如傳入物件或數字) 應被阻擋 (HTTP 400)', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/admin/settings/brand',
        payload: { logoHorizontal: 12345 },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.message).toContain('必須為字串或 null');
    });
  });

  describe('4. SVG 惡意腳本 (XSS) 注入測試 (SVG Sanitization & Anti-XSS Vectors)', () => {
    it('Vector A: 包含 <script>alert(1)</script> 之 SVG Data URL 應被以 400 攔截', async () => {
      const xssSvg = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><circle r="10"/></svg>';
      const dataUrl = `data:image/svg+xml;base64,${Buffer.from(xssSvg).toString('base64')}`;

      const res = await app.inject({
        method: 'PUT',
        url: '/api/admin/settings/brand',
        payload: { logoSquare: dataUrl },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.message).toContain('潛在危險代碼或腳本');
    });

    it('Vector B: 包含 onload="fetch(\'/steal\')" 之 SVG Data URL 應被以 400 攔截', async () => {
      const xssSvg = '<svg xmlns="http://www.w3.org/2000/svg" onload="fetch(\'/steal\')"><rect width="10" height="10"/></svg>';
      const dataUrl = `data:image/svg+xml;base64,${Buffer.from(xssSvg).toString('base64')}`;

      const res = await app.inject({
        method: 'PUT',
        url: '/api/admin/settings/brand',
        payload: { logoHorizontal: dataUrl },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.message).toContain('潛在危險代碼或腳本');
    });

    it('Vector C: 包含 javascript:void(0) 偽協議之 SVG 應被以 400 攔截', async () => {
      const xssSvg = '<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:void(0)"><text>Click</text></a></svg>';
      const dataUrl = `data:image/svg+xml;base64,${Buffer.from(xssSvg).toString('base64')}`;

      const res = await app.inject({
        method: 'PUT',
        url: '/api/admin/settings/brand',
        payload: { logoSquare: dataUrl },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.message).toContain('潛在危險代碼或腳本');
    });

    it('Vector D: 混雜大小寫與空白之 ONLOAD = 變體應被攔截', async () => {
      const xssSvg = '<svg xmlns="http://www.w3.org/2000/svg"   ONLOAD   =  "fetch(\'/steal\')"><path d="M0 0"/></svg>';
      const dataUrl = `data:image/svg+xml;base64,${Buffer.from(xssSvg).toString('base64')}`;

      const res = await app.inject({
        method: 'PUT',
        url: '/api/admin/settings/brand',
        payload: { logoSquare: dataUrl },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.message).toContain('潛在危險代碼或腳本');
    });

    it('Vector E: 包含 <foreignObject> 與 <iframe> 之複合 XSS 載荷應被攔截', async () => {
      const foreignObjectSvg = '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject width="100" height="100"><iframe src="javascript:alert(1)"></iframe></foreignObject></svg>';
      const dataUrl = `data:image/svg+xml;base64,${Buffer.from(foreignObjectSvg).toString('base64')}`;

      const res = await app.inject({
        method: 'PUT',
        url: '/api/admin/settings/brand',
        payload: { logoHorizontal: dataUrl },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.message).toContain('潛在危險代碼或腳本');
    });

    it('Vector F: 非 Base64 (URL-encoded) 之 SVG XSS 亦應被解碼並以 400 攔截', async () => {
      const rawUrlEncoded = 'data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20onload%3D%22alert(1)%22%3E%3C%2Fsvg%3E';

      const res = await app.inject({
        method: 'PUT',
        url: '/api/admin/settings/brand',
        payload: { logoSquare: rawUrlEncoded },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.message).toContain('潛在危險代碼或腳本');
    });

    it('Vector G: 合法無惡意標籤的純淨 SVG 向量圖形應順利通過 (200 OK)', async () => {
      const cleanSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="#4F46E5"/><path d="M30 50 L45 65 L70 35" stroke="#FFFFFF" stroke-width="6" fill="none"/></svg>';
      const dataUrl = `data:image/svg+xml;base64,${Buffer.from(cleanSvg).toString('base64')}`;

      const res = await app.inject({
        method: 'PUT',
        url: '/api/admin/settings/brand',
        payload: { logoSquare: dataUrl },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.logoSquare).toBe(dataUrl);
    });
  });
});
