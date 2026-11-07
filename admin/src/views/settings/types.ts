// admin/src/views/settings/types.ts

export type LogoType = 'horizontal' | 'square';

export interface LogoMeta {
  url: string | null;            // 當前自訂 Logo (Data URL 或 URL)，null 代表使用系統預設
  defaultUrl: string;           // 系統預設原始 Logo 路徑
  previewUrl: string | null;     // 本地選擇檔案後的即時預覽 URL (尚未保存至後端)
  fileName: string | null;       // 檔案名稱
  fileSize: number | null;       // 檔案大小 (bytes)
  dimensions?: { width: number; height: number }; // 圖片實際解析度
  isModified: boolean;           // 本地是否有尚未儲存的變更
  isDefault: boolean;            // 當前是否處於預設狀態
}

export interface StoreBrandConfig {
  brandName: string;
  brandSubtitle?: string;
  logoText?: string;
  supportPhone?: string;
  primaryColor?: string;
  blindBoxPointsValue?: number;
  pointRateTwd?: number;
  smallPrizePointsValue?: number;
  // Logo 專用欄位
  logoHorizontal?: string | null; // 橫式橫幅 Logo (Data URL 或路徑，null 表示預設)
  logoSquare?: string | null;     // 方形吉祥物 Logo (Data URL 或路徑，null 表示預設)
}

export interface LogoValidationResult {
  valid: boolean;
  errorMessage?: string;
  warningMessage?: string;
}

export interface BrandLogoSettingsCardProps {
  currentHorizontalLogo: string | null;
  currentSquareLogo: string | null;
  onSaveLogos: (horizontal: string | null, square: string | null) => Promise<boolean>;
  isSaving?: boolean;
}
