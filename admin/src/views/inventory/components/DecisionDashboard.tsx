import React from 'react';
import {
  BarChart2,
  ChevronDown,
  ChevronUp,
  Scale,
  RotateCw,
  Flame,
  Snowflake,
  TrendingUp,
  Check,
  AlertTriangle,
} from 'lucide-react';
import type { DecisionAnalyticsData } from '../types.js';

interface DecisionDashboardProps {
  decisionData: DecisionAnalyticsData | null;
  dashboardView: 'expanded' | 'collapsed';
  setDashboardView: React.Dispatch<React.SetStateAction<'expanded' | 'collapsed'>>;
  selectedIpFilter: string | null;
  selectedCategory: string;
  onSelectIpCard: (ip: string) => void;
  onClearIpFilter: () => void;
  onSearchProduct: (name: string) => void;
}

export const DecisionDashboard: React.FC<DecisionDashboardProps> = React.memo(({
  decisionData,
  dashboardView,
  setDashboardView,
  selectedIpFilter,
  selectedCategory,
  onSelectIpCard,
  onClearIpFilter,
  onSearchProduct,
}) => {
  const getIpIcon = (ip: string) => {
    if (ip.includes('海賊') || ip.includes('航海王')) return '🏴‍☠️';
    if (ip.includes('火影')) return '🍥';
    if (ip.includes('寶可夢')) return '⚡';
    if (ip.includes('七龍珠')) return '🐉';
    if (ip.includes('咒術')) return '👁️';
    if (ip.includes('獵人')) return '🎣';
    if (ip.includes('鬼滅')) return '⚔️';
    if (ip.includes('灌籃')) return '🏀';
    if (ip.includes('宮崎駿')) return '🍃';
    if (ip.includes('小新')) return '🖍️';
    if (ip.includes('數碼')) return '🦖';
    if (ip.includes('遊戲王')) return '🃏';
    if (ip.includes('安妮雅') || ip.includes('間諜')) return '🥜';
    if (ip.includes('潮玩') || ip.includes('盲盒')) return '🎲';
    return '📦';
  };

  const renderStatusBadge = (status: string, suggestion: string, statusLabel?: string) => {
    if (status === 'BALANCED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold">
          <Check className="w-3.5 h-3.5" />
          雙店平衡
        </span>
      );
    }
    if (status === 'CHUPEI_DEFICIT' || status === 'JINSHAN_DEFICIT') {
      return (
        <div className="flex flex-col gap-1 w-full">
          <div className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-extrabold text-[10px] border border-amber-500/30 shrink-0">
              {statusLabel || (status === 'CHUPEI_DEFICIT' ? '竹北缺貨' : '金山缺貨')}
            </span>
            <span className="text-[11px] font-semibold text-amber-200 truncate">{suggestion}</span>
          </div>
        </div>
      );
    }
    if (status === 'LOW_STOCK') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-400 text-[11px] font-bold">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          庫存告急 · 待追單
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-700/60 border border-slate-600 text-slate-400 text-[11px] font-semibold">
        全店斷貨
      </span>
    );
  };

  return (
    <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-xl transition-all">
      {/* 看板頂部標題與折疊切換列 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-700/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-inner">
            <BarChart2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-white tracking-wide">
                跨店 IP 存貨平衡與動銷決策看板
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                老闆決策專用
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              全盤掌握各 IP 系列雙店存量失衡狀態、自動計算補平調撥量，並掌握 30 天狂銷追單與滯銷大賞出清預警。
            </p>
          </div>
        </div>

        {/* 宏觀指標快覽 */}
        <div className="flex items-center gap-3">
          {decisionData?.totals && (
            <div className="hidden lg:flex items-center gap-2 text-xs">
              <div className="px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-700/60 flex items-center gap-2">
                <span className="text-slate-400">總現貨量</span>
                <span className="font-mono font-bold text-white text-sm">
                  {decisionData.totals.totalStock.toLocaleString()} 隻
                </span>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-700/60 flex items-center gap-2">
                <span className="text-slate-400">30天動銷</span>
                <span className="font-mono font-bold text-emerald-400 text-sm">
                  {decisionData.totals.totalSales30d.toLocaleString()} 隻
                </span>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-700/60 flex items-center gap-2">
                <span className="text-slate-400">待調撥補平</span>
                <span
                  className={`font-mono font-bold text-sm ${
                    decisionData.totals.rebalanceNeededCount > 0 ? 'text-amber-400' : 'text-slate-300'
                  }`}
                >
                  {decisionData.totals.rebalanceNeededCount} 組 IP
                </span>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setDashboardView((prev) => (prev === 'expanded' ? 'collapsed' : 'expanded'))}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-700/70 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold border border-slate-600/70 transition shadow"
          >
            {dashboardView === 'expanded' ? (
              <>
                <ChevronUp className="w-4 h-4 text-amber-400" />
                收合看板
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4 text-amber-400" />
                展開看板
              </>
            )}
          </button>
        </div>
      </div>

      {/* 展開時完整看板 */}
      {dashboardView === 'expanded' && (
        <div className="mt-5 space-y-6">
          {/* 1. IP 存量直觀判斷與跨店平衡卡片網格 */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-slate-200">
                  各系列貨品類型 (IP) 雙店存量平衡指標（點擊任一 IP 卡片可即時連動篩選下方原地編輯表格）
                </span>
              </div>
              {selectedIpFilter && (
                <button
                  onClick={onClearIpFilter}
                  className="text-[11px] text-amber-400 hover:underline flex items-center gap-1 font-semibold"
                >
                  <RotateCw className="w-3 h-3" />
                  清除 IP 篩選 (目前選取: {selectedIpFilter})
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {decisionData?.ipSummary?.map((item) => {
                const isSelected = selectedIpFilter === item.ip || selectedCategory === item.ip;
                return (
                  <div
                    key={item.ip}
                    onClick={() => onSelectIpCard(item.ip)}
                    className={`cursor-pointer rounded-xl p-3.5 border transition-all duration-150 flex flex-col justify-between ${
                      isSelected
                        ? 'bg-indigo-950/40 border-indigo-500 ring-2 ring-indigo-500/30 shadow-lg scale-[1.01]'
                        : 'bg-slate-900/70 hover:bg-slate-800/80 border-slate-700/60 hover:border-slate-600'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="flex items-center gap-2 text-sm font-bold text-white">
                          <span>{getIpIcon(item.ip)}</span>
                          <span>{item.ip}</span>
                        </span>
                        <span className="font-mono text-xs font-extrabold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg">
                          {item.totalStock} 隻
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-400 mb-2 flex justify-between">
                        <span>共 {item.productCount} 款單品</span>
                        <span className="text-slate-400 font-mono">30天動銷: {item.sales30d} 隻</span>
                      </div>

                      {/* 雙店比例條 */}
                      <div className="space-y-1 mb-2">
                        <div className="flex justify-between text-[10px] font-mono text-slate-400">
                          <span className="text-indigo-300">
                            竹北: {item.chupeiStock} 隻 ({item.stockShareChupei}%)
                          </span>
                          <span className="text-emerald-300">
                            金山: {item.jinshanStock} 隻 ({item.stockShareJinshan}%)
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden flex border border-slate-700/60">
                          <div
                            style={{ width: `${item.stockShareChupei}%` }}
                            className="bg-indigo-500 h-full transition-all"
                            title={`竹北店: ${item.chupeiStock} 隻`}
                          />
                          <div
                            style={{ width: `${item.stockShareJinshan}%` }}
                            className="bg-emerald-500 h-full transition-all"
                            title={`金山店: ${item.jinshanStock} 隻`}
                          />
                        </div>
                      </div>
                    </div>

                    {/* 補平決策建議標籤 */}
                    <div className="mt-2 pt-2 border-t border-slate-800/80">
                      {renderStatusBadge(item.status, item.rebalanceSuggestion, item.statusLabel)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. 兩大決策情報排行榜 (爆款狂銷 Top 5 & 庫存積壓滯銷預警 Top 5) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 爆款狂銷榜 Top 5 */}
            <div className="bg-slate-900/70 border border-rose-500/20 rounded-2xl p-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Flame className="w-5 h-5 text-rose-400" />
                  <h3 className="text-sm font-bold text-white">🔥 爆款狂銷榜 Top 5 (提示盡速追單)</h3>
                </div>
                <span className="text-[11px] text-rose-300 bg-rose-500/10 px-2.5 py-0.5 rounded-lg border border-rose-500/20 font-semibold">
                  近 30 天銷量最高
                </span>
              </div>

              <div className="divide-y divide-slate-800/60 mt-2">
                {!decisionData?.topSelling || decisionData.topSelling.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-500">近期尚無大量銷售數據</div>
                ) : (
                  decisionData.topSelling.map((item: any, idx: number) => (
                    <div
                      key={item.id}
                      onClick={() => onSearchProduct(item.name)}
                      className="py-2.5 px-2 flex flex-col gap-1.5 cursor-pointer hover:bg-slate-800/70 rounded-xl transition border border-transparent hover:border-slate-700/60"
                      title="點擊於下方試算表即時定位此品項"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 ${
                              idx === 0
                                ? 'bg-amber-500 text-slate-950'
                                : idx === 1
                                ? 'bg-slate-300 text-slate-950'
                                : idx === 2
                                ? 'bg-amber-700 text-white'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {idx + 1}
                          </span>
                          <span className="text-xs font-bold text-slate-200 truncate hover:text-amber-300" title={item.name}>
                            {item.name}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-800 text-indigo-300 rounded shrink-0">
                            {item.ip}
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-mono text-sm font-extrabold text-rose-400">
                            {item.salesCount30d} 隻
                          </span>
                          <span className="text-[10px] text-slate-400 block font-mono">
                            現餘 {item.currentStock} 隻 (約 {item.estimatedStockoutDays} 天斷貨)
                          </span>
                        </div>
                      </div>
                      <div className="text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
                        💡 {item.decisionAdvice}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 庫存積壓滯銷榜 Top 5 */}
            <div className="bg-slate-900/70 border border-indigo-500/20 rounded-2xl p-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Snowflake className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-sm font-bold text-white">❄️ 庫存積壓滯銷預警 Top 5 (大賞消化 / 福袋出清)</h3>
                </div>
                <span className="text-[11px] text-indigo-300 bg-indigo-500/10 px-2.5 py-0.5 rounded-lg border border-indigo-500/20 font-semibold">
                  現貨積壓且 30 天零動銷
                </span>
              </div>

              <div className="divide-y divide-slate-800/60 mt-2">
                {!decisionData?.slowMoving || decisionData.slowMoving.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-500">目前各品項動銷健康，無重大積壓</div>
                ) : (
                  decisionData.slowMoving.map((item: any, idx: number) => (
                    <div
                      key={item.id}
                      onClick={() => onSearchProduct(item.name)}
                      className="py-2.5 px-2 flex flex-col gap-1.5 cursor-pointer hover:bg-slate-800/70 rounded-xl transition border border-transparent hover:border-slate-700/60"
                      title="點擊於下方試算表即時定位此品項"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center font-bold text-[11px] shrink-0">
                            {idx + 1}
                          </span>
                          <span className="text-xs font-bold text-slate-200 truncate" title={item.name}>
                            {item.name}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-800 text-indigo-300 rounded shrink-0">
                            {item.ip}
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-mono text-sm font-extrabold text-indigo-300">
                            {item.currentStock} 隻積壓
                          </span>
                          <span className="text-[10px] text-slate-400 block font-mono">
                            壓資 ${item.tiedCapital.toLocaleString()} (30天 0 銷量)
                          </span>
                        </div>
                      </div>
                      <div className="text-[11px] text-indigo-300/90 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-lg">
                        🎯 {item.decisionAdvice}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* 3. 近 30 天各 IP 銷量趨勢視覺圖表 */}
          <div className="bg-slate-900/70 border border-slate-700/60 rounded-2xl p-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold text-slate-200">近 30 天各 IP 銷量趨勢與動銷走勢視覺分析</h3>
              </div>
              <span className="text-[11px] text-slate-400">
                總計動銷: {decisionData?.salesTrend?.totalSales || 0} 隻公仔
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* IP 銷量佔比長條圖 */}
              <div className="space-y-2">
                <div className="text-[11px] text-slate-400 font-semibold mb-1">主要 IP 動銷佔比排行：</div>
                {decisionData?.salesTrend?.byIP?.slice(0, 6).map((item) => (
                  <div key={item.ip} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300 font-medium flex items-center gap-1.5">
                        <span>{getIpIcon(item.ip)}</span>
                        <span>{item.ip}</span>
                      </span>
                      <span className="font-mono text-slate-300 font-bold">
                        {item.sales} 隻 <span className="text-slate-500 text-[10px]">({item.percentage}%)</span>
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                      <div
                        style={{ width: `${Math.max(item.percentage, 3)}%` }}
                        className="bg-gradient-to-r from-indigo-500 to-amber-500 h-full rounded-full"
                      />
                    </div>
                  </div>
                ))}
                {(!decisionData?.salesTrend?.byIP || decisionData.salesTrend.byIP.length === 0) && (
                  <div className="py-4 text-center text-xs text-slate-500">暫無 IP 銷量數據</div>
                )}
              </div>

              {/* 4 週銷售節奏與動能走勢 */}
              <div className="flex flex-col justify-between">
                <div className="text-[11px] text-slate-400 font-semibold mb-2">
                  近 4 週動銷節奏變化走勢 (週度動能)：
                </div>
                <div className="grid grid-cols-4 gap-2 h-28 items-end p-2 bg-slate-950/60 rounded-xl border border-slate-800">
                  {decisionData?.salesTrend?.weeklyTrend?.map((wb, wIdx) => {
                    const maxWeekly = Math.max(
                      1,
                      ...(decisionData.salesTrend.weeklyTrend.map((w) => w.totalSales) || [1])
                    );
                    const heightPct = Math.max(12, Math.round((wb.totalSales / maxWeekly) * 100));
                    return (
                      <div key={wIdx} className="flex flex-col items-center h-full justify-end group">
                        <span className="font-mono text-[10px] font-bold text-amber-300 mb-1 opacity-80 group-hover:opacity-100">
                          {wb.totalSales}隻
                        </span>
                        <div
                          style={{ height: `${heightPct}%` }}
                          className="w-full bg-indigo-600/70 hover:bg-indigo-500 rounded-t-lg transition-all shadow"
                          title={`${wb.weekLabel}: ${wb.totalSales} 隻`}
                        />
                        <span className="text-[10px] text-slate-400 mt-1.5 whitespace-nowrap">
                          {wb.weekLabel}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 text-[11px] text-slate-400 italic">
                  💡 提示：若連續兩週動銷走跌，建議調整櫥窗陳列或評估上架新一番賞以帶動零售客流。
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
