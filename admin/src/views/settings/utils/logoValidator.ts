// admin/src/views/settings/utils/logoValidator.ts
import { LogoType, LogoValidationResult } from '../types';

export const LOGO_CONSTRAINTS = {
  MAX_FILE_SIZE_BYTES: 2 * 1024 * 1024, // 2MB
  ALLOWED_MIME_TYPES: ['image/png', 'image/webp', 'image/svg+xml'],
  ALLOWED_EXTENSIONS: ['.png', '.webp', '.svg'],
  HORIZONTAL: {
    recommendedAspectRatio: '3:1 ~ 4:1 (橫幅) 或 16:9',
    recommendedResolution: '1200 x 300 ~ 1200 x 400 px (或 1024 x 576 px)',
    minWidth: 300,
  },
  SQUARE: {
    recommendedAspectRatio: '1:1 (正方形)',
    recommendedResolution: '512 x 512 或 1024 x 1024 px',
    minWidth: 128,
  },
};

export function validateLogoFile(file: File, _type?: LogoType): LogoValidationResult {
  // 1. 檔案大小檢查 (嚴格上限 2MB)
  if (file.size > LOGO_CONSTRAINTS.MAX_FILE_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      errorMessage: `⚠️ 檔案大小超過限制：選取檔案為 ${sizeMb} MB，不可超過 2.0 MB！`,
    };
  }

  // 2. MIME Type 檢查
  if (!LOGO_CONSTRAINTS.ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      errorMessage: `⚠️ 檔案格式不支援：檢測到「${file.type || '未知格式'}」，僅支援 PNG、WebP、SVG 圖檔！`,
    };
  }

  // 3. 副檔名雙重防禦 (防禦副檔名偽裝)
  const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
  if (!LOGO_CONSTRAINTS.ALLOWED_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      errorMessage: `⚠️ 副檔名不符合規範：僅支援 .png, .webp, .svg 格式，禁止上傳 ${ext} 檔案！`,
    };
  }

  return { valid: true };
}

// 非同步解析圖片解析度與寬高比提示
export function inspectImageDimensions(
  file: File,
  type: LogoType
): Promise<{ width: number; height: number; warning?: string }> {
  return new Promise((resolve) => {
    if (file.type === 'image/svg+xml') {
      // SVG 向量圖無固定像素維度限制
      resolve({ width: 0, height: 0 });
      return;
    }

    if (typeof Image === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) {
      resolve({ width: 0, height: 0 });
      return;
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      let warning: string | undefined;

      if (type === 'square') {
        const ratio = width / (height || 1);
        if (Math.abs(ratio - 1) > 0.15) {
          warning = `💡 溫馨提示：此圖片解析度為 ${width}×${height} (比例 ${ratio.toFixed(2)}:1)，建議使用 1:1 正方形圖檔以防圓角或頭像變形。`;
        }
      } else if (type === 'horizontal') {
        if (height >= width) {
          warning = `💡 溫馨提示：橫式 Logo 解析度為 ${width}×${height}，建議寬大於高 (寬高比 ≥ 2:1) 以達到最佳橫幅呈現。`;
        }
      }
      resolve({ width, height, warning });
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ width: 0, height: 0 });
    };
    img.src = objectUrl;
  });
}
