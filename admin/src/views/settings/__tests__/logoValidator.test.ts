import { describe, it, expect } from 'vitest';
import { validateLogoFile, LOGO_CONSTRAINTS } from '../utils/logoValidator';

// Helper to create mock File objects
function createMockFile(name: string, sizeBytes: number, mimeType: string): File {
  const blob = new Blob(['x'.repeat(Math.min(sizeBytes, 1024))], { type: mimeType });
  const file = new File([blob], name, { type: mimeType });
  Object.defineProperty(file, 'size', { value: sizeBytes });
  return file;
}

describe('logoValidator', () => {
  describe('檔案大小檢查 (File Size Constraints)', () => {
    it('允許小於或等於 2MB 的合法檔案', () => {
      const file = createMockFile('logo.png', 1.5 * 1024 * 1024, 'image/png');
      const result = validateLogoFile(file, 'horizontal');
      expect(result.valid).toBe(true);
      expect(result.errorMessage).toBeUndefined();
    });

    it('剛好 2MB (2 * 1024 * 1024 bytes) 的檔案應通過', () => {
      const file = createMockFile('logo.png', LOGO_CONSTRAINTS.MAX_FILE_SIZE_BYTES, 'image/png');
      const result = validateLogoFile(file, 'square');
      expect(result.valid).toBe(true);
    });

    it('阻擋大於 2MB 的圖檔並回傳明確錯誤提示', () => {
      const file = createMockFile('huge-logo.png', 2.5 * 1024 * 1024, 'image/png');
      const result = validateLogoFile(file, 'horizontal');
      expect(result.valid).toBe(false);
      expect(result.errorMessage).toContain('檔案大小超過限制');
      expect(result.errorMessage).toContain('2.50 MB');
      expect(result.errorMessage).toContain('2.0 MB');
    });
  });

  describe('MIME 格式與副檔名白名單驗證 (MIME & Extension Security)', () => {
    it('允許標準 PNG 圖檔', () => {
      const file = createMockFile('mascot.png', 500 * 1024, 'image/png');
      const result = validateLogoFile(file, 'square');
      expect(result.valid).toBe(true);
    });

    it('允許標準 WebP 圖檔', () => {
      const file = createMockFile('banner.webp', 300 * 1024, 'image/webp');
      const result = validateLogoFile(file, 'horizontal');
      expect(result.valid).toBe(true);
    });

    it('允許標準 SVG 向量圖檔', () => {
      const file = createMockFile('vector.svg', 50 * 1024, 'image/svg+xml');
      const result = validateLogoFile(file, 'horizontal');
      expect(result.valid).toBe(true);
    });

    it('阻擋可執行檔 .exe (即使偽裝或無偽裝)', () => {
      const file = createMockFile('malware.exe', 100 * 1024, 'application/x-msdownload');
      const result = validateLogoFile(file, 'square');
      expect(result.valid).toBe(false);
      expect(result.errorMessage).toContain('檔案格式不支援');
    });

    it('阻擋純文字檔 .txt', () => {
      const file = createMockFile('notes.txt', 10 * 1024, 'text/plain');
      const result = validateLogoFile(file, 'horizontal');
      expect(result.valid).toBe(false);
      expect(result.errorMessage).toContain('檔案格式不支援');
    });

    it('阻擋未在白名單的圖片格式如 GIF 或 JPEG', () => {
      const fileGif = createMockFile('anim.gif', 200 * 1024, 'image/gif');
      const resultGif = validateLogoFile(fileGif, 'horizontal');
      expect(resultGif.valid).toBe(false);
      expect(resultGif.errorMessage).toContain('僅支援 PNG、WebP、SVG');

      const fileJpg = createMockFile('photo.jpg', 200 * 1024, 'image/jpeg');
      const resultJpg = validateLogoFile(fileJpg, 'square');
      expect(resultJpg.valid).toBe(false);
    });

    it('阻擋副檔名偽裝 (例如 MIME 是 image/png 但副檔名為 .exe)', () => {
      const file = createMockFile('sneaky.exe', 100 * 1024, 'image/png');
      const result = validateLogoFile(file, 'horizontal');
      expect(result.valid).toBe(false);
      expect(result.errorMessage).toContain('副檔名不符合規範');
      expect(result.errorMessage).toContain('.exe');
    });

    it('阻擋 MIME 為非圖檔但副檔名偽裝為 .png 的檔案', () => {
      const file = createMockFile('trojan.png', 100 * 1024, 'application/octet-stream');
      const result = validateLogoFile(file, 'square');
      expect(result.valid).toBe(false);
      expect(result.errorMessage).toContain('檔案格式不支援');
    });
  });
});
