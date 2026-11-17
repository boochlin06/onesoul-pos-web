import React from 'react';
import { 
  RefreshCw, 
  ExternalLink, 
  CheckCircle2, 
  Sun, 
  Moon,
  Menu
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface HeaderProps {
  currentTab: string;
  onRefresh?: () => void;
  onToggleDrawer?: () => void;
  isDrawerOpen?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onRefresh,
  onToggleDrawer,
  isDrawerOpen = false,
}) => {
  const { theme, toggleTheme } = useTheme();

  // 補齊預購與盲盒路由標題
  const titles: Record<string, string> = {
    overview: '營運總覽控制台',
    members: '會員主檔與點數審計',
    inventory: '商品主檔與水平庫存',
    preorders: '廠商預購與跟蹤',
    blindboxes: '盲盒商品資料庫',
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
    <header className="h-16 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-3 sm:px-6 flex items-center justify-between shrink-0 select-none z-20">
      {/* 左側：漢堡切換按鈕 + 麵包屑導覽 */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* 行動端抽屜漢堡開關 */}
        <button
          type="button"
          onClick={onToggleDrawer}
          className="p-2 -ml-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition md:hidden cursor-pointer shrink-0"
          aria-label="切換功能選單"
          aria-expanded={isDrawerOpen}
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* 品牌標章錨點 */}
        <img
          src="/logo-square.png"
          alt="OneSoul"
          className="w-7 h-7 object-contain rounded-lg shrink-0 hidden xs:block"
        />

        {/* 麵包屑路徑 */}
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 text-xs">
          <span className="text-slate-500 font-medium hidden xs:inline sm:inline shrink-0">門市管理系統</span>
          <span className="text-slate-600 hidden xs:inline sm:inline shrink-0">/</span>
          <span className="font-bold text-white tracking-wide truncate max-w-[130px] sm:max-w-xs md:max-w-none">
            {titles[currentTab] || '控制台'}
          </span>
        </div>
      </div>

      {/* 右側：操作與狀態 */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* 輕量連線標記 (窄螢幕隱藏) */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-[11px] text-slate-300">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>按需輕量連線</span>
        </div>

        {/* 手動刷新按鈕 */}
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition cursor-pointer"
            title="手動刷新資料"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        )}

        {/* 色系主題切換按鈕 (明亮 / 夜晚) */}
        <button
          type="button"
          onClick={toggleTheme}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-xs text-slate-200 transition shadow-sm cursor-pointer"
          title={theme === 'dark' ? '切換為白天明亮模式' : '切換為夜晚深色模式'}
        >
          {theme === 'dark' ? (
            <>
              <Sun className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="hidden md:inline font-medium text-[11px]">明亮模式</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-indigo-500 shrink-0" />
              <span className="hidden md:inline font-medium text-[11px]">夜晚模式</span>
            </>
          )}
        </button>

        {/* POS 前台入口 */}
        <a
          href={import.meta.env.VITE_POS_URL || "http://localhost:5173"}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-medium text-slate-200 transition shrink-0"
          title="開啟門市收銀前台"
        >
          <span>收銀台 POS</span>
          <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
        </a>
      </div>
    </header>
  );
};
