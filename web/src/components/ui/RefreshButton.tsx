import { RefreshCw, Loader2 } from 'lucide-react';

interface RefreshButtonProps {
  onClick: () => void;
  isLoading?: boolean;
  label?: string;
  /** 'standard' = 標題旁小膠囊；'toolbar' = 工具列內較大按鈕 */
  variant?: 'standard' | 'toolbar';
}

/**
 * 統一的刷新資料按鈕 — 全分頁共用
 * 漸層背景 + 發光陰影 + loading 脈衝動畫
 */
export function RefreshButton({ onClick, isLoading = false, label = '刷新資料', variant = 'standard' }: RefreshButtonProps) {
  if (variant === 'toolbar') {
    return (
      <button
        onClick={onClick}
        disabled={isLoading}
        className={`group flex shrink-0 items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 disabled:cursor-not-allowed ${
          isLoading
            ? 'bg-gradient-to-r from-violet-400 to-fuchsia-400 text-white/90 shadow-lg shadow-violet-400/30 animate-pulse'
            : 'bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40'
        }`}
        title={label}
      >
        {isLoading
          ? <Loader2 className="w-4 h-4 animate-spin" />
          : <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
        }
        <span className="hidden sm:inline">{isLoading ? '讀取中…' : label}</span>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className={`group inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-full transition-all active:scale-95 disabled:cursor-not-allowed ${
        isLoading
          ? 'bg-gradient-to-r from-violet-400 to-fuchsia-400 text-white/90 shadow-md shadow-violet-400/25 animate-pulse'
          : 'bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white shadow-md shadow-indigo-500/20 hover:shadow-indigo-500/40'
      }`}
      title={label}
    >
      {isLoading
        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
        : <RefreshCw className="w-3.5 h-3.5 group-hover:rotate-180 transition-transform duration-500" />
      }
      {isLoading ? '讀取中…' : label}
    </button>
  );
}
