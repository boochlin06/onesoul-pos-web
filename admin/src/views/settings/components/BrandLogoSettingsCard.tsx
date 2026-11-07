import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  RotateCcw, 
  CheckCircle2, 
  AlertTriangle, 
  Info, 
  Sparkles, 
  Eye, 
  Check, 
  Sun, 
  Moon,
  FileCheck
} from 'lucide-react';
import { LogoType, LogoMeta, BrandLogoSettingsCardProps } from '../types';
import { validateLogoFile, inspectImageDimensions } from '../utils/logoValidator';

// 系統內建預設 Logo 路徑
const DEFAULT_LOGOS = {
  horizontal: '/logo-horizontal.png',
  square: '/logo-square.png',
};

export const BrandLogoSettingsCard: React.FC<BrandLogoSettingsCardProps> = ({
  currentHorizontalLogo,
  currentSquareLogo,
  onSaveLogos,
  isSaving = false,
}) => {
  // 橫式 Logo 狀態
  const [horizontal, setHorizontal] = useState<LogoMeta>({
    url: currentHorizontalLogo,
    defaultUrl: DEFAULT_LOGOS.horizontal,
    previewUrl: currentHorizontalLogo || DEFAULT_LOGOS.horizontal,
    fileName: null,
    fileSize: null,
    isModified: false,
    isDefault: !currentHorizontalLogo,
  });

  // 方形 Logo 狀態
  const [square, setSquare] = useState<LogoMeta>({
    url: currentSquareLogo,
    defaultUrl: DEFAULT_LOGOS.square,
    previewUrl: currentSquareLogo || DEFAULT_LOGOS.square,
    fileName: null,
    fileSize: null,
    isModified: false,
    isDefault: !currentSquareLogo,
  });

  // 預覽容器模式：深色、淺色或雙色並排
  const [previewTheme, setPreviewTheme] = useState<'both' | 'dark' | 'light'>('both');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);

  const horizontalInputRef = useRef<HTMLInputElement>(null);
  const squareInputRef = useRef<HTMLInputElement>(null);

  // 當外部 props 更新且本地無尚未儲存的變更時，同步狀態
  useEffect(() => {
    if (!horizontal.isModified) {
      setHorizontal((prev) => ({
        ...prev,
        url: currentHorizontalLogo,
        previewUrl: currentHorizontalLogo || DEFAULT_LOGOS.horizontal,
        isDefault: !currentHorizontalLogo,
      }));
    }
  }, [currentHorizontalLogo, horizontal.isModified]);

  useEffect(() => {
    if (!square.isModified) {
      setSquare((prev) => ({
        ...prev,
        url: currentSquareLogo,
        previewUrl: currentSquareLogo || DEFAULT_LOGOS.square,
        isDefault: !currentSquareLogo,
      }));
    }
  }, [currentSquareLogo, square.isModified]);

  // 自動清除通知
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  // 處理單一 Logo 上傳
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, type: LogoType) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 1. 同步首毫秒防呆校驗
    const validation = validateLogoFile(file, type);
    if (!validation.valid) {
      setFeedback({ type: 'error', message: validation.errorMessage! });
      e.target.value = ''; // 清空選擇器
      return;
    }

    // 2. 異步檢查尺寸警告 (非阻塞)
    const { width, height, warning } = await inspectImageDimensions(file, type);
    if (warning) {
      setFeedback({ type: 'warning', message: warning });
    }

    // 3. 轉為 Base64 Data URL 進行即時預覽與儲存準備
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (type === 'horizontal') {
        setHorizontal((prev) => ({
          ...prev,
          previewUrl: dataUrl,
          fileName: file.name,
          fileSize: file.size,
          dimensions: { width, height },
          isModified: true,
          isDefault: false,
        }));
      } else {
        setSquare((prev) => ({
          ...prev,
          previewUrl: dataUrl,
          fileName: file.name,
          fileSize: file.size,
          dimensions: { width, height },
          isModified: true,
          isDefault: false,
        }));
      }
      setFeedback({
        type: 'success',
        message: `✅ 已載入 ${type === 'horizontal' ? '橫式橫幅' : '方形吉祥物'} Logo (${(file.size / 1024).toFixed(1)} KB)，請點擊「儲存品牌標誌」以生效。`,
      });
    };
    reader.readAsDataURL(file);
  };

  // 還原單項為預設值
  const handleRestoreSingle = (type: LogoType) => {
    if (type === 'horizontal') {
      setHorizontal((prev) => ({
        ...prev,
        previewUrl: prev.defaultUrl,
        fileName: null,
        fileSize: null,
        isModified: true,
        isDefault: true,
      }));
      if (horizontalInputRef.current) horizontalInputRef.current.value = '';
    } else {
      setSquare((prev) => ({
        ...prev,
        previewUrl: prev.defaultUrl,
        fileName: null,
        fileSize: null,
        isModified: true,
        isDefault: true,
      }));
      if (squareInputRef.current) squareInputRef.current.value = '';
    }
    setFeedback({
      type: 'success',
      message: `🔄 已將 ${type === 'horizontal' ? '橫式橫幅' : '方形吉祥物'} Logo 還原為系統預設值，請記得點擊儲存！`,
    });
  };

  // 一鍵全數還原預設值
  const handleRestoreAll = () => {
    if (!window.confirm('確定要將橫式與方形 Logo 全部還原為系統官方預設標誌嗎？')) {
      return;
    }
    handleRestoreSingle('horizontal');
    handleRestoreSingle('square');
  };

  // 提交儲存變更
  const handleSave = async () => {
    const horizontalVal = horizontal.isDefault ? null : horizontal.previewUrl;
    const squareVal = square.isDefault ? null : square.previewUrl;
    const ok = await onSaveLogos(horizontalVal, squareVal);
    if (ok) {
      setHorizontal((prev) => ({ ...prev, url: horizontalVal, isModified: false }));
      setSquare((prev) => ({ ...prev, url: squareVal, isModified: false }));
      setFeedback({ type: 'success', message: '🎉 店家品牌 Logo 已成功儲存並同步全站！' });
    } else {
      setFeedback({ type: 'error', message: '❌ 儲存 Logo 失敗，請檢查網路連線或系統日誌。' });
    }
  };

  const hasChanges = horizontal.isModified || square.isModified;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow space-y-6">
      {/* 頂部標題與操作列 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              店家品牌 Logo 與多情境識別管理
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                雙尺寸獨立 · 即時雙色預覽
              </span>
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            配置 Admin ERP 與 POS 收銀前台之品牌形象。支援橫式橫幅與方形吉祥物標章獨立替換，並隨時支援一鍵還原預設。
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRestoreAll}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white text-xs font-semibold rounded-xl border border-slate-700 transition cursor-pointer"
            title="將所有自訂 Logo 還原為系統官方預設標誌"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            全數還原預設值
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl shadow transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            {isSaving ? '儲存中...' : hasChanges ? '儲存品牌標誌 *' : '標誌已同步'}
          </button>
        </div>
      </div>

      {/* 浮動提示 Banner */}
      {feedback && (
        <div className={`p-3 rounded-xl border text-xs flex items-center justify-between transition-all ${
          feedback.type === 'success' ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' :
          feedback.type === 'error' ? 'bg-rose-500/15 border-rose-500/40 text-rose-300' :
          'bg-amber-500/15 border-amber-500/40 text-amber-300'
        }`}>
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white text-xs cursor-pointer">✕</button>
        </div>
      )}

      {/* ── 規範與說明引導面板 ── */}
      <div className="bg-slate-850/60 border border-slate-700/70 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2 text-xs font-bold text-white">
          <Info className="w-4 h-4 text-indigo-400" />
          品牌標誌上傳規範與設計引導
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] text-slate-300">
          <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 space-y-1">
            <span className="font-bold text-amber-400 block">📐 建議解析度與寬高比</span>
            <p>• <b>橫式橫幅</b>：比例建議 3:1 或 4:1 (如 1200×300 ~ 1200×400 px 或 16:9 / 1024×576 px)，寬度 ≥ 300px。</p>
            <p>• <b>方形標章</b>：比例嚴格 1:1 (如 512×512 或 1024×1024 px)，用於圓形頭像與小尺寸縮圖。</p>
          </div>
          <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 space-y-1">
            <span className="font-bold text-emerald-400 block">📦 檔案限制與防呆上限</span>
            <p>• <b>格式支援</b>：僅限 <b>PNG、WebP、SVG</b> (嚴禁 .exe, .txt 等非圖檔)。</p>
            <p>• <b>大小上限</b>：單張檔案最大不得超過 <b>2.0 MB</b> (前端即時攔截超出者)。</p>
          </div>
          <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 space-y-1">
            <span className="font-bold text-indigo-400 block">🎨 去背與雙色系對比建議</span>
            <p>• <b>去背透明底</b>：強烈建議使用 RGBA 透明去背背景，完美適應白天/夜晚主題。</p>
            <p>• <b>安全留白邊距</b>：標章周圍建議保留 8%~10% 安全留白，防止被外框或圓角裁切。</p>
          </div>
        </div>
      </div>

      {/* 雙色系預覽模式切換鈕 */}
      <div className="flex items-center justify-between pt-1">
        <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
          <Eye className="w-3.5 h-3.5 text-slate-400" />
          即時預覽環境模式 (Live Environment Preview)
        </span>
        <div className="flex bg-slate-800 p-0.5 rounded-lg border border-slate-700 text-[11px]">
          <button
            type="button"
            onClick={() => setPreviewTheme('both')}
            className={`px-2.5 py-1 rounded-md transition cursor-pointer ${previewTheme === 'both' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
          >
            雙色並排
          </button>
          <button
            type="button"
            onClick={() => setPreviewTheme('dark')}
            className={`px-2.5 py-1 rounded-md flex items-center gap-1 transition cursor-pointer ${previewTheme === 'dark' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
          >
            <Moon className="w-3 h-3" /> 深色夜間
          </button>
          <button
            type="button"
            onClick={() => setPreviewTheme('light')}
            className={`px-2.5 py-1 rounded-md flex items-center gap-1 transition cursor-pointer ${previewTheme === 'light' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
          >
            <Sun className="w-3 h-3" /> 淺色明亮
          </button>
        </div>
      </div>

      {/* ── 兩組獨立上傳與預覽面板 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* 1. 橫式橫幅 Logo 面板 (Horizontal Banner Logo) */}
        <div className="bg-slate-850/60 border border-slate-700/80 rounded-xl p-4 space-y-3.5">
          <div className="flex items-center justify-between border-b border-slate-700/60 pb-2.5">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white">橫式橫幅標誌 (Horizontal Banner)</span>
                {horizontal.isDefault ? (
                  <span className="text-[10px] px-1.5 py-0.2 bg-slate-800 text-slate-400 border border-slate-700 rounded font-mono">系統預設</span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded font-mono">自訂圖檔</span>
                )}
                {horizontal.isModified && (
                  <span className="text-[10px] px-1.5 py-0.2 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded font-bold">待儲存</span>
                )}
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">用於 Admin ERP 展開側邊欄 Header、頂部導覽列及 POS 登入迎賓畫面。</p>
            </div>

            <button
              type="button"
              onClick={() => handleRestoreSingle('horizontal')}
              disabled={horizontal.isDefault && !horizontal.isModified}
              className="text-xs text-slate-400 hover:text-amber-400 flex items-center gap-1 transition disabled:opacity-30 disabled:hover:text-slate-400 cursor-pointer"
              title="僅將此橫式 Logo 恢復為系統預設值"
            >
              <RotateCcw className="w-3 h-3" />
              還原預設
            </button>
          </div>

          {/* 橫幅即時預覽 */}
          <div className="space-y-2">
            <span className="text-[10px] text-slate-400 block font-medium">即時效果預覽：</span>
            <div className={`grid gap-2 ${previewTheme === 'both' ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {(previewTheme === 'both' || previewTheme === 'dark') && (
                <div className="bg-[#0b0f19] border border-slate-800 rounded-xl p-3 flex flex-col items-center justify-center min-h-[90px] relative overflow-hidden group">
                  <span className="absolute top-1 left-2 text-[9px] font-mono text-slate-500">🌙 深色背景 (#0b0f19)</span>
                  <img
                    src={horizontal.previewUrl || horizontal.defaultUrl}
                    alt="橫式 Logo 深色預覽"
                    className="max-h-14 max-w-full object-contain filter drop-shadow-[0_0_2px_rgba(255,255,255,0.3)] transition-transform group-hover:scale-105"
                  />
                </div>
              )}
              {(previewTheme === 'both' || previewTheme === 'light') && (
                <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col items-center justify-center min-h-[90px] relative overflow-hidden group">
                  <span className="absolute top-1 left-2 text-[9px] font-mono text-slate-400">☀️ 淺色背景 (#FFFFFF)</span>
                  <img
                    src={horizontal.previewUrl || horizontal.defaultUrl}
                    alt="橫式 Logo 淺色預覽"
                    className="max-h-14 max-w-full object-contain filter drop-shadow-[0_1px_2px_rgba(0,0,0,0.15)] transition-transform group-hover:scale-105"
                  />
                </div>
              )}
            </div>
          </div>

          {/* 上傳操作區與隱藏 input */}
          <div className="flex items-center gap-2 pt-1">
            <input
              ref={horizontalInputRef}
              type="file"
              accept=".png,.webp,.svg,image/png,image/webp,image/svg+xml"
              onChange={(e) => handleFileSelect(e, 'horizontal')}
              className="hidden"
              id="horizontal-logo-upload"
            />
            <label
              htmlFor="horizontal-logo-upload"
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-indigo-500 rounded-xl text-xs font-semibold text-slate-200 transition cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-indigo-400" />
              選擇新橫幅圖檔 (≤ 2MB)
            </label>
          </div>
          {horizontal.fileName && (
            <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1.5">
              <FileCheck className="w-3 h-3 text-emerald-400" />
              <span>{horizontal.fileName} ({(horizontal.fileSize! / 1024).toFixed(1)} KB)</span>
            </div>
          )}
        </div>

        {/* 2. 方形吉祥物 Logo 面板 (Square Mascot / Icon Logo) */}
        <div className="bg-slate-850/60 border border-slate-700/80 rounded-xl p-4 space-y-3.5">
          <div className="flex items-center justify-between border-b border-slate-700/60 pb-2.5">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white">方形吉祥物標章 (Square Mascot / Icon)</span>
                {square.isDefault ? (
                  <span className="text-[10px] px-1.5 py-0.2 bg-slate-800 text-slate-400 border border-slate-700 rounded font-mono">系統預設</span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded font-mono">自訂圖檔</span>
                )}
                {square.isModified && (
                  <span className="text-[10px] px-1.5 py-0.2 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded font-bold">待儲存</span>
                )}
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">用於 Admin 側邊欄收合 Icon、Favicon 標籤及 POS 頂部門市吉祥物。</p>
            </div>

            <button
              type="button"
              onClick={() => handleRestoreSingle('square')}
              disabled={square.isDefault && !square.isModified}
              className="text-xs text-slate-400 hover:text-amber-400 flex items-center gap-1 transition disabled:opacity-30 disabled:hover:text-slate-400 cursor-pointer"
              title="僅將此方形 Logo 恢復為系統預設值"
            >
              <RotateCcw className="w-3 h-3" />
              還原預設
            </button>
          </div>

          {/* 方形標章即時預覽 (正方形 + 圓形雙容器) */}
          <div className="space-y-2">
            <span className="text-[10px] text-slate-400 block font-medium">即時效果預覽：</span>
            <div className={`grid gap-2 ${previewTheme === 'both' ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {(previewTheme === 'both' || previewTheme === 'dark') && (
                <div className="bg-[#0b0f19] border border-slate-800 rounded-xl p-3 flex items-center justify-center gap-4 min-h-[90px] relative overflow-hidden">
                  <span className="absolute top-1 left-2 text-[9px] font-mono text-slate-500">🌙 深色 (#0b0f19)</span>
                  {/* 正方形顯示 */}
                  <img
                    src={square.previewUrl || square.defaultUrl}
                    alt="方形 Logo 深色預覽"
                    className="w-12 h-12 rounded-xl object-contain bg-slate-900 border border-slate-800 p-1 shadow filter drop-shadow-[0_0_2px_rgba(255,255,255,0.25)]"
                  />
                  {/* 圓形頭像容器顯示 */}
                  <img
                    src={square.previewUrl || square.defaultUrl}
                    alt="圓形頭像預覽"
                    className="w-10 h-10 rounded-full object-contain bg-slate-900 border border-slate-800 p-0.5 shadow-md filter drop-shadow-[0_0_2px_rgba(255,255,255,0.25)]"
                  />
                </div>
              )}
              {(previewTheme === 'both' || previewTheme === 'light') && (
                <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-center gap-4 min-h-[90px] relative overflow-hidden">
                  <span className="absolute top-1 left-2 text-[9px] font-mono text-slate-400">☀️ 淺色 (#FFFFFF)</span>
                  {/* 正方形顯示 */}
                  <img
                    src={square.previewUrl || square.defaultUrl}
                    alt="方形 Logo 淺色預覽"
                    className="w-12 h-12 rounded-xl object-contain bg-slate-50 border border-slate-200 p-1 shadow-sm filter drop-shadow-[0_1px_2px_rgba(0,0,0,0.15)]"
                  />
                  {/* 圓形頭像容器顯示 */}
                  <img
                    src={square.previewUrl || square.defaultUrl}
                    alt="圓形頭像淺色預覽"
                    className="w-10 h-10 rounded-full object-contain bg-slate-50 border border-slate-200 p-0.5 shadow-sm filter drop-shadow-[0_1px_2px_rgba(0,0,0,0.15)]"
                  />
                </div>
              )}
            </div>
          </div>

          {/* 上傳操作區與隱藏 input */}
          <div className="flex items-center gap-2 pt-1">
            <input
              ref={squareInputRef}
              type="file"
              accept=".png,.webp,.svg,image/png,image/webp,image/svg+xml"
              onChange={(e) => handleFileSelect(e, 'square')}
              className="hidden"
              id="square-logo-upload"
            />
            <label
              htmlFor="square-logo-upload"
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-emerald-500 rounded-xl text-xs font-semibold text-slate-200 transition cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-400" />
              選擇新標章圖檔 (1:1 / ≤ 2MB)
            </label>
          </div>
          {square.fileName && (
            <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1.5">
              <FileCheck className="w-3 h-3 text-emerald-400" />
              <span>{square.fileName} ({(square.fileSize! / 1024).toFixed(1)} KB)</span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
