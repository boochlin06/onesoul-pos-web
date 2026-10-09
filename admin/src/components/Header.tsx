import React from 'react';
import { 
  Bell, 
  ExternalLink, 
  RefreshCw, 
  User, 
  ShieldCheck,
  Radio
} from 'lucide-react';

interface HeaderProps {
  currentTab: string;
  onRefresh?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ currentTab, onRefresh }) => {
  const titles: Record<string, string> = {
    overview: '營運總覽控制台',
    members: '會員主檔與點數審計',
    inventory: '雙門市水平庫存與主檔',
    lottery: '一番賞利潤試算與開套工作台',
    reports: '財務營收與多維銷售流水',
    sessions: '門市開關帳與日結報表',
    stocktake: '門市庫存盤點工作台',
    schedule: '班表排班與考勤打卡',
    settings: '外部整合設定與即時公告',
    audit: '防竄改雜湊鏈審計日誌',
  };

  return (
    <header className="h-16 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-6 flex items-center justify-between shrink-0">
      {/* 麵包屑導覽 */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500 font-medium">OneSoul ERP</span>
        <span className="text-slate-600">/</span>
        <span className="text-xs font-bold text-white tracking-wide">
          {titles[currentTab] || '控制台'}
        </span>
      </div>

      {/* 右側操作與狀態 */}
      <div className="flex items-center gap-4">
        {/* SSE 長連線狀態 */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-[11px] text-slate-300">
          <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          <span>SSE 即時同步</span>
        </div>

        {/* POS 收銀前台一鍵前往 */}
        <a
          href="http://localhost:5173"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-xl text-xs font-medium text-slate-300 hover:text-white transition"
          title="開啟 POS 收銀前台終端機"
        >
          <span>開啟 POS 收銀台</span>
          <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
        </a>

        {/* 管理員帳號 */}
        <div className="flex items-center gap-2.5 pl-2 border-l border-slate-800">
          <div className="w-8 h-8 rounded-full bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-300 font-bold text-xs">
            A
          </div>
          <div className="hidden md:block text-left">
            <div className="text-xs font-bold text-white leading-tight">總管理員</div>
            <div className="text-[10px] text-slate-400 font-mono">admin@onesoul.com</div>
          </div>
        </div>
      </div>
    </header>
  );
};
