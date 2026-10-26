import React from 'react';
import { 
  RefreshCw, 
  ExternalLink, 
  Store,
  CheckCircle2,
  Sun,
  Moon
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface HeaderProps {
  currentTab: string;
  onRefresh?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ currentTab, onRefresh }) => {
  const { theme, toggleTheme } = useTheme();
  const titles: Record<string, string> = {
    overview: '營運總覽控制台',
    members: '會員主檔與點數審計',
    inventory: '商品主檔與水平庫存',
    allocation: '一番賞配賞工作台',
    lottery: '在場一番賞戰情與即時抽況',
    reports: '財務營收與多維銷售流水',
    sessions: '門市開關帳與日結報表',
    stocktake: '門市庫存盤點工作台',
    schedule: '班表排班與考勤打卡',
    exports: '資料匯出與報表歸檔中心',
    settings: '店家品牌與門市管理',
    audit: '防竄改雜湊鏈審計日誌',
  };

  return (
    <header className="h-16 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-6 flex items-center justify-between shrink-0 select-none">
      {/* 麵包屑導覽 */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500 font-medium">門市管理系統</span>
        <span className="text-slate-600">/</span>
        <span className="text-xs font-bold text-white tracking-wide">
          {titles[currentTab] || '控制台'}
        </span>
      </div>

      {/* 右側操作與狀態 (按需連線 · 零額外背景資源消耗) */}
      <div className="flex items-center gap-3">
        {/* 輕量連線標記 */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-[11px] text-slate-300">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>按需輕量連線</span>
        </div>

        {/* 手動刷新按鈕 */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition"
            title="手動刷新資料"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        )}

        {/* 色系主題切換按鈕 (明亮 / 夜晚) */}
        <button
          onClick={toggleTheme}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-xs text-slate-200 transition shadow-sm cursor-pointer"
          title={theme === 'dark' ? '切換為白天明亮模式' : '切換為夜晚深色模式'}
        >
          {theme === 'dark' ? (
            <>
              <Sun className="w-4 h-4 text-amber-400" />
              <span className="hidden md:inline font-medium text-[11px]">明亮模式</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-indigo-500" />
              <span className="hidden md:inline font-medium text-[11px]">夜晚模式</span>
            </>
          )}
        </button>

        {/* POS 前台入口 */}
        <a
          href="http://localhost:5173"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-medium text-slate-200 transition"
          title="開啟門市收銀前台"
        >
          <span>收銀台 POS</span>
          <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
        </a>
      </div>
    </header>
  );
};
