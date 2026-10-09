import React, { useEffect, useState } from 'react';
import { reportsApi, inventoryApi, lotteryApi, scheduleApi } from '../api/client';
import { 
  TrendingUp, 
  Users, 
  Package, 
  Gift, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowUpRight,
  Store,
  Clock,
  Download
} from 'lucide-react';

interface OverviewViewProps {
  onNavigate: (tab: string) => void;
  selectedStore: string;
}

export const OverviewView: React.FC<OverviewViewProps> = ({ onNavigate, selectedStore }) => {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<any>(null);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [activeBags, setActiveBags] = useState<any[]>([]);
  const [attendanceToday, setAttendanceToday] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, [selectedStore]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [analyticsRes, invRes, lotteryRes, attRes] = await Promise.all([
        reportsApi.analytics(selectedStore || undefined, '7'),
        inventoryApi.summary({ lowStockOnly: true }),
        lotteryApi.overview(selectedStore || undefined),
        scheduleApi.listAttendance(selectedStore || undefined),
      ]);

      if (analyticsRes.success) setAnalytics(analyticsRes.data);
      if (invRes.success) setLowStockCount(invRes.data.length);
      if (lotteryRes.success) setActiveBags(lotteryRes.data);
      if (attRes.success) setAttendanceToday(attRes.data);
    } catch (err) {
      console.error('Failed to load overview data', err);
    } finally {
      setLoading(false);
    }
  };

  const rawKpi = analytics?.kpi || {};
  const kpi = {
    totalRevenue: Number(rawKpi.totalRevenue || 0),
    totalOrders: Number(rawKpi.totalOrders ?? rawKpi.orderCount ?? 0),
    avgTicket: Number(rawKpi.orderCount > 0 ? rawKpi.totalRevenue / rawKpi.orderCount : rawKpi.avgTicket || 0),
    cashAmount: Number(rawKpi.cashRevenue ?? rawKpi.cashAmount ?? 0),
    cardAmount: Number(rawKpi.cardRevenue ?? rawKpi.cardAmount ?? 0),
    remitAmount: Number(rawKpi.remitRevenue ?? rawKpi.remitAmount ?? 0),
    voidCount: Number(rawKpi.voidCount || 0),
  };

  return (
    <div className="space-y-6">
      {/* 頂部歡迎與快速匯出 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-800/60 p-6 rounded-2xl border border-slate-700/60 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">系統即時在線</span>
            <span className="text-xs text-slate-400">| 門市：{selectedStore === 'chupei' ? '竹北旗艦店' : selectedStore === 'jinshan' ? '金山概念店' : '雙門市跨店全覽'}</span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">OneSoul 營運總覽控制台</h1>
          <p className="text-sm text-slate-400">完全取代舊版 Google Sheets，具備原子防鎖、雙軌一番賞試算與 Transactional Outbox。</p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href={reportsApi.getExportUrl('sales')}
            download
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium rounded-xl border border-slate-600 transition"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            串流匯出銷售 CSV
          </a>
          <button
            onClick={() => onNavigate('lottery')}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-sm font-semibold rounded-xl shadow-lg shadow-amber-500/20 transition"
          >
            <Gift className="w-4 h-4" />
            快速開套試算
          </button>
        </div>
      </div>

      {/* KPI 卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 本日總營收 */}
        <div className="bg-slate-800/70 border border-slate-700/80 rounded-2xl p-5 hover:border-slate-600 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">累計實收營業額 (7日)</span>
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-white tracking-tight">
              ${kpi.totalRevenue.toLocaleString()}
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
              <span className="text-emerald-400 font-medium">客單價: ${Math.round(kpi.avgTicket)}</span>
              <span>•</span>
              <span>訂單: {kpi.totalOrders} 筆</span>
            </div>
          </div>
        </div>

        {/* 支付管道拆解 */}
        <div className="bg-slate-800/70 border border-slate-700/80 rounded-2xl p-5 hover:border-slate-600 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">金流支付分佈</span>
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">💵 現金實收:</span>
              <span className="font-semibold text-slate-200">${kpi.cashAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">💳 刷卡金流:</span>
              <span className="font-semibold text-slate-200">${kpi.cardAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">🏦 銀行匯款:</span>
              <span className="font-semibold text-slate-200">${kpi.remitAmount.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* 庫存預警 */}
        <div 
          onClick={() => onNavigate('inventory')}
          className="bg-slate-800/70 border border-slate-700/80 rounded-2xl p-5 hover:border-amber-500/50 cursor-pointer transition group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">雙門市低庫存預警</span>
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl group-hover:scale-110 transition">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-amber-400 tracking-tight">
              {lowStockCount} <span className="text-sm font-normal text-slate-400">項低於安全量</span>
            </div>
            <div className="flex items-center gap-1 mt-2 text-xs text-amber-400/80">
              <span>點擊進入水平對照表補貨</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>

        {/* 一番賞進行中 */}
        <div 
          onClick={() => onNavigate('lottery')}
          className="bg-slate-800/70 border border-slate-700/80 rounded-2xl p-5 hover:border-purple-500/50 cursor-pointer transition group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">在線一番賞套組</span>
            <div className="p-2 bg-purple-500/10 text-purple-400 rounded-xl group-hover:scale-110 transition">
              <Gift className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-purple-300 tracking-tight">
              {activeBags.length} <span className="text-sm font-normal text-slate-400">套銷售中</span>
            </div>
            <div className="flex items-center gap-1 mt-2 text-xs text-purple-400/80">
              <span>即時賞況監控與中途廢套</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
      </div>

      {/* 中段：即時一番賞進度 + 雙門市考勤概況 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 一番賞各套進度條 */}
        <div className="lg:col-span-2 bg-slate-800/60 border border-slate-700/70 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg font-bold text-white">熱門在線一番賞套組進度</h2>
            </div>
            <button 
              onClick={() => onNavigate('lottery')}
              className="text-xs text-amber-400 hover:text-amber-300 font-medium"
            >
              檢視完整套況 →
            </button>
          </div>

          {activeBags.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-sm">目前無上架之一番賞套組</div>
          ) : (
            <div className="space-y-4">
              {activeBags.slice(0, 4).map((bag) => (
                <div key={bag.id} className="bg-slate-900/60 border border-slate-700/60 p-4 rounded-xl">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white text-sm">{bag.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
                        {bag.storeId === 'chupei' ? '竹北店' : '金山店'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400">
                      單抽 <span className="text-amber-400 font-bold">${bag.unitPrice}</span> • 剩餘{' '}
                      <span className="text-emerald-400 font-bold">{bag.remainingDraws}</span> / {bag.totalDraws} 抽
                    </div>
                  </div>

                  {/* 進度條 */}
                  <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden border border-slate-700">
                    <div
                      className="bg-gradient-to-r from-amber-500 to-emerald-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${bag.progressPercent}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between items-center mt-1 text-[11px] text-slate-400">
                    <span>已抽 {bag.drawnCount} 抽</span>
                    <span className="font-medium text-amber-400">{bag.progressPercent}% 完售進度</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 門市今日考勤與排班 */}
        <div className="bg-slate-800/60 border border-slate-700/70 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-400" />
                <h2 className="text-lg font-bold text-white">今日值班與考勤</h2>
              </div>
              <button 
                onClick={() => onNavigate('schedule')}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
              >
                班表管理 →
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3 bg-slate-900/60 border border-slate-700/50 rounded-xl">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-1">
                  <span className="flex items-center gap-1">
                    <Store className="w-3.5 h-3.5 text-blue-400" /> 竹北門市 (營業 14:00)
                  </span>
                  <span className="text-emerald-400">正常營運</span>
                </div>
                <div className="text-xs text-slate-400">
                  早班值班人員：<span className="text-slate-200 font-medium">王小明 (已打卡 13:50)</span>
                </div>
              </div>

              <div className="p-3 bg-slate-900/60 border border-slate-700/50 rounded-xl">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-1">
                  <span className="flex items-center gap-1">
                    <Store className="w-3.5 h-3.5 text-amber-400" /> 金山門市 (營業 16:00)
                  </span>
                  <span className="text-emerald-400">正常營運</span>
                </div>
                <div className="text-xs text-slate-400">
                  晚班值班人員：<span className="text-slate-200 font-medium">李小華 (預計 15:45 到班)</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-700/60">
            <button
              onClick={() => onNavigate('settings')}
              className="w-full py-2.5 px-4 bg-slate-700/80 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl border border-slate-600 transition text-center"
            >
              發佈全門市 POS 緊急公告
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
