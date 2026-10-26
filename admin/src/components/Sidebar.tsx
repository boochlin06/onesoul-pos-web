import React, { useEffect, useState } from 'react';
import { storesApi, settingsApi } from '../api/client';
import { useTheme } from '../context/ThemeContext';
import { 
  LayoutDashboard, 
  Users, 
  Package, 
  Boxes,
  Gift, 
  BarChart3, 
  CircleDollarSign, 
  ClipboardList, 
  Calendar, 
  Settings, 
  ShieldCheck,
  Store,
  Sparkles,
  ChevronDown,
  FileSpreadsheet,
  Truck
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
  const { theme } = useTheme();
  const [stores, setStores] = useState<any[]>([]);
  const [brand, setBrand] = useState<any>({
    brandName: 'OneSoul 模型一番賞',
    brandSubtitle: '門市管理與營運系統',
    logoText: 'OS',
  });

  useEffect(() => {
    loadStoresAndBrand();
  }, []);

  const loadStoresAndBrand = async () => {
    try {
      const [resStores, resBrand] = await Promise.all([
        storesApi.list(),
        settingsApi.getBrand(),
      ]);
      if (resStores.success) {
        setStores(resStores.data || []);
      }
      if (resBrand.success && resBrand.data) {
        setBrand(resBrand.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const navItems = [
    { id: 'overview', label: '營運總覽儀表板', icon: LayoutDashboard },
    { id: 'members', label: '會員主檔與點數', icon: Users },
    { id: 'inventory', label: '商品主檔與庫存', icon: Package },
    { id: 'preorders', label: '廠商預購與跟蹤', icon: Truck },
    { id: 'blindboxes', label: '盲盒商品資料庫', icon: Boxes },
    { id: 'allocation', label: '一番賞配賞工作台', icon: Sparkles },
    { id: 'lottery', label: '在場一番賞戰情', icon: Gift },
    { id: 'reports', label: '銷售流水與報表', icon: BarChart3 },
    { id: 'sessions', label: '開櫃即時流水與日結', icon: CircleDollarSign },
    { id: 'stocktake', label: '庫存盤點工作台', icon: ClipboardList },
    { id: 'schedule', label: '班表排班與考勤', icon: Calendar },
    { id: 'exports', label: '資料匯出中心', icon: FileSpreadsheet },
    { id: 'settings', label: '店家品牌與門市管理', icon: Settings },
    { id: 'audit', label: '防竄改雜湊審計', icon: ShieldCheck },
  ];

  const isMultiStore = stores.length > 1;

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between shrink-0 select-none">
      <div>
        {/* Brand Logo & Name (支援其他店家自訂品牌) */}
        <div className="p-5 border-b border-slate-800 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center font-extrabold text-white text-base shadow-lg shadow-indigo-500/20">
            {brand.logoText || 'POS'}
          </div>
          <div className="truncate">
            <div className="font-extrabold text-white text-sm tracking-tight flex items-center gap-1.5 truncate">
              <span className="truncate">{brand.brandName || '智慧門市系統'}</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded font-mono shrink-0">
                v3.2
              </span>
            </div>
            <div className="text-[11px] text-slate-400 truncate">
              {brand.brandSubtitle || '輕量低消耗架構'}
            </div>
          </div>
        </div>

        {/* 門市自適應區域: 單門市時簡約展示，多門市(2~5間)時自動解鎖切換器 */}
        <div className="p-3 border-b border-slate-800">
          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 px-2">
            {isMultiStore ? `營運門市 (${stores.length}/5 間分店)` : '當前營運門市'}
          </label>

          {isMultiStore ? (
            <div className="relative">
              <select
                value={selectedStore}
                onChange={(e) => onSelectStore(e.target.value)}
                className="w-full pl-8 pr-7 py-2 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-xl text-xs font-medium text-white focus:outline-none focus:border-indigo-500 cursor-pointer transition appearance-none"
              >
                <option value="">全門市跨店全覽 (All)</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code || s.id})
                  </option>
                ))}
              </select>
              <Store className="w-3.5 h-3.5 text-indigo-400 absolute left-2.5 top-2.5 pointer-events-none" />
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/40 border border-slate-800 rounded-xl text-xs text-slate-300 font-medium">
              <Store className="w-3.5 h-3.5 text-emerald-400" />
              <span>{stores[0]?.name || '本店 (單店模式)'}</span>
              <span className="text-[10px] text-slate-500 font-mono ml-auto">標準單店</span>
            </div>
          )}
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

      {/* 底部狀態列 (輕量低消耗模式 + 主題狀態) */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/40 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span className="text-[11px] font-medium text-slate-300">按需輕量連線</span>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400">
            {theme === 'dark' ? '🌙 夜晚' : '☀️ 明亮'}
          </span>
        </div>
        <div className="text-[10px] text-slate-500 leading-tight">
          低記憶體佔用 · 支援1至5店 · 雙色系自適應
        </div>
      </div>
    </aside>
  );
};
