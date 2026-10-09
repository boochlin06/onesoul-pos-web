import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Package, 
  Gift, 
  BarChart3, 
  CircleDollarSign, 
  ClipboardList, 
  Calendar, 
  Settings, 
  ShieldCheck,
  Store,
  Sparkles
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  selectedStore: string;
  onSelectStore: (store: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  selectedStore,
  onSelectStore,
}) => {
  const navItems = [
    { id: 'overview', label: '營運總覽儀表板', icon: LayoutDashboard },
    { id: 'members', label: '會員主檔與點數', icon: Users },
    { id: 'inventory', label: '雙門市水平庫存', icon: Package },
    { id: 'lottery', label: '一番賞試算開套', icon: Gift },
    { id: 'reports', label: '銷售流水與報表', icon: BarChart3 },
    { id: 'sessions', label: '開關帳與日結報表', icon: CircleDollarSign },
    { id: 'stocktake', label: '庫存盤點工作台', icon: ClipboardList },
    { id: 'schedule', label: '班表排班與考勤', icon: Calendar },
    { id: 'settings', label: '外部整合與公告', icon: Settings },
    { id: 'audit', label: '防竄改雜湊審計', icon: ShieldCheck },
  ];

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between shrink-0 select-none">
      <div>
        {/* Brand Logo */}
        <div className="p-5 border-b border-slate-800 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center font-extrabold text-white text-base shadow-lg shadow-indigo-500/20">
            OS
          </div>
          <div>
            <div className="font-extrabold text-white text-sm tracking-tight flex items-center gap-1.5">
              <span>OneSoul ERP</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded font-mono">
                v3.1
              </span>
            </div>
            <div className="text-[11px] text-slate-400">旗艦營運管理後台</div>
          </div>
        </div>

        {/* 門市切換器 */}
        <div className="p-3 border-b border-slate-800">
          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 px-2">
            當前營運門市
          </label>
          <div className="relative">
            <select
              value={selectedStore}
              onChange={(e) => onSelectStore(e.target.value)}
              className="w-full pl-8 pr-3 py-2 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-xl text-xs font-medium text-white focus:outline-none focus:border-indigo-500 cursor-pointer transition appearance-none"
            >
              <option value="">雙門市跨店全覽 (All)</option>
              <option value="chupei">竹北旗艦門市 (Chupei)</option>
              <option value="jinshan">金山概念門市 (Jinshan)</option>
            </select>
            <Store className="w-3.5 h-3.5 text-indigo-400 absolute left-2.5 top-2.5 pointer-events-none" />
          </div>
        </div>

        {/* 導覽項目 */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-600/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* 底部狀態列 */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/40">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-[11px] font-medium text-slate-300">Fastify Core 在線中</span>
        </div>
        <div className="text-[10px] text-slate-500 leading-tight">
          零 OOM 串流 CSV • 樂觀鎖版本防禦 • Transactional Outbox
        </div>
      </div>
    </aside>
  );
};
