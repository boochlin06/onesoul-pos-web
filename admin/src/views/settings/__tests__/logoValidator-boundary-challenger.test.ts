import { describe, it, expect } from 'vitest';
import { validateLogoFile } from '../utils/logoValidator';

// Helper to create mock File objects with controllable size and type
function createMockFile(name: string, sizeBytes: number, mimeType: string): File {
  const blob = new Blob(['x'.repeat(Math.min(sizeBytes, 1024))], { type: mimeType });
  const file = new File([blob], name, { type: mimeType });
  Object.defineProperty(file, 'size', { value: sizeBytes });
  return file;
}

describe('【對抗性邊界壓力測試】logoValidator Boundary & Security Challenger', () => {
  describe('1. 檔案大小邊界壓力測試 (File Size Boundary Stress Tests)', () => {
    it('剛好 2.0 MB (2 * 1024 * 1024 = 2,097,152 bytes) 邊界檢驗應通過', () => {
      const exact2Mb = 2 * 1024 * 1024;
      const file = createMockFile('exact-2mb.png', exact2Mb, 'image/png');
      const result = validateLogoFile(file, 'horizontal');
      expect(result.valid).toBe(true);
      expect(result.errorMessage).toBeUndefined();
    });

    it('2.0001 MB (2 * 1024 * 1024 + 100 = 2,097,252 bytes) 超限圖檔應嚴格阻擋', () => {
      const over2Mb = 2 * 1024 * 1024 + 100;
      const file = createMockFile('over-2mb.png', over2Mb, 'image/png');
      const result = validateLogoFile(file, 'square');
      expect(result.valid).toBe(false);
      expect(result.errorMessage).toContain('檔案大小超過限制');
      expect(result.errorMessage).toContain('2.00 MB');
      expect(result.errorMessage).toContain('不可超過 2.0 MB');
    });

    it('極限 1 byte 超標 (2,097,153 bytes) 邊界檢驗應精確阻擋', () => {
      const overByOneByte = 2 * 1024 * 1024 + 1;
      const file = createMockFile('edge-plus-one.webp', overByOneByte, 'image/webp');
      const result = validateLogoFile(file, 'horizontal');
      expect(result.valid).toBe(false);
      expect(result.errorMessage).toContain('檔案大小超過限制');
    });

    it('極限 1 byte 內 (2,097,151 bytes) 邊界檢驗應精確通過', () => {
      const underByOneByte = 2 * 1024 * 1024 - 1;
      const file = createMockFile('edge-minus-one.svg', underByOneByte, 'image/svg+xml');
      const result = validateLogoFile(file, 'square');
      expect(result.valid).toBe(true);
      expect(result.errorMessage).toBeUndefined();
    });
  });

  describe('2. 危險與非圖檔類型攻擊測試 (Dangerous & Non-Image Type Attacks)', () => {
    it('上傳 .exe 執行檔 (application/x-msdownload) 應被阻絕', () => {
      const file = createMockFile('payload.exe', 50 * 1024, 'application/x-msdownload');
      const result = validateLogoFile(file, 'horizontal');
      expect(result.valid).toBe(false);
      expect(result.errorMessage).toContain('檔案格式不支援');
    });

    it('上傳 .txt 純文字檔 (text/plain) 應被阻絕', () => {
      const file = createMockFile('notes.txt', 2 * 1024, 'text/plain');
      const result = validateLogoFile(file, 'square');
      expect(result.valid).toBe(false);
      expect(result.errorMessage).toContain('檔案格式不支援');
    });

    it('上傳 .pdf 文件 (application/pdf) 應被阻絕', () => {
      const file = createMockFile('document.pdf', 150 * 1024, 'application/pdf');
      const result = validateLogoFile(file, 'horizontal');
      expect(result.valid).toBe(false);
      expect(result.errorMessage).toContain('檔案格式不支援');
    });

    it('上傳非白名單格式 image/gif 應被阻絕', () => {
      const file = createMockFile('animation.gif', 300 * 1024, 'image/gif');
      const result = validateLogoFile(file, 'horizontal');
      expect(result.valid).toBe(false);
      expect(result.errorMessage).toContain('僅支援 PNG、WebP、SVG');
    });

    it('上傳非白名單格式 image/bmp 應被阻絕', () => {
      const file = createMockFile('bitmap.bmp', 400 * 1024, 'image/bmp');
      const result = validateLogoFile(file, 'square');
      expect(result.valid).toBe(false);
      expect(result.errorMessage).toContain('僅支援 PNG、WebP、SVG');
    });
  });

  describe('3. 副檔名偽裝攻擊測試 (Extension Spoofing & Evasion)', () => {
    it('將 .exe 重新命名為 malicious.png (MIME 為 application/octet-stream) 應被 MIME 檢驗立即阻擋', () => {
      const file = createMockFile('malicious.png', 100 * 1024, 'application/octet-stream');
      const result = validateLogoFile(file, 'horizontal');
      expect(result.valid).toBe(false);
      expect(result.errorMessage).toContain('檔案格式不支援');
      expect(result.errorMessage).toContain('application/octet-stream');
    });

    it('將惡意腳本命名為 script.png (MIME 為 application/x-sh) 應被阻擋', () => {
      const file = createMockFile('script.png', 10 * 1024, 'application/x-sh');
      const result = validateLogoFile(file, 'square');
      expect(result.valid).toBe(false);
      expect(result.errorMessage).toContain('檔案格式不支援');
    });

    it('偽裝副檔名為 .exe 但宣稱 MIME 為 image/png 應被副檔名檢查阻擋', () => {
      const file = createMockFile('trojan.exe', 80 * 1024, 'image/png');
      const result = validateLogoFile(file, 'horizontal');
      expect(result.valid).toBe(false);
      expect(result.errorMessage).toContain('副檔名不符合規範');
      expect(result.errorMessage).toContain('.exe');
    });

    it('多重副檔名攻擊 exploit.png.exe (MIME: image/png) 應被最後副檔名阻擋', () => {
      const file = createMockFile('exploit.png.exe', 90 * 1024, 'image/png');
      const result = validateLogoFile(file, 'horizontal');
      expect(result.valid).toBe(false);
      expect(result.errorMessage).toContain('副檔名不符合規範');
      expect(result.errorMessage).toContain('.exe');
    });

    it('大寫副檔名 (TEST.PNG / TEST.WEBP / TEST.SVG) 應不分大小寫正常通過', () => {
      const filePng = createMockFile('COMPANY_LOGO.PNG', 100 * 1024, 'image/png');
      expect(validateLogoFile(filePng, 'horizontal').valid).toBe(true);

      const fileWebp = createMockFile('BANNER.WEBP', 100 * 1024, 'image/webp');
      expect(validateLogoFile(fileWebp, 'horizontal').valid).toBe(true);

      const fileSvg = createMockFile('MASCOT.SVG', 100 * 1024, 'image/svg+xml');
      expect(validateLogoFile(fileSvg, 'square').valid).toBe(true);
    });

    it('無副檔名檔案 (malicious_file) 應被阻擋', () => {
      const file = createMockFile('malicious_file', 50 * 1024, 'image/png');
      const result = validateLogoFile(file, 'square');
      expect(result.valid).toBe(false);
      expect(result.errorMessage).toContain('副檔名不符合規範');
    });
  });
});
