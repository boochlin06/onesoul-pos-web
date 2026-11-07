import React from 'react';
import { Store, RotateCw, Search, Plus } from 'lucide-react';
import { LiveStockItem, StoreOption, StockMainType, SetPlan } from '../types';
import { cleanPrizeName } from '../utils/calculations';

interface LiveStockRadarProps {
  currentPlan: SetPlan;
  plans: SetPlan[];
  stores: StoreOption[];
  liveStockItems: LiveStockItem[];
  stockLoading: boolean;
  availableCategories: string[];
  stockStoreFilter: string;
  stockMainTypeFilter: StockMainType;
  stockCategoryFilter: string;
  stockSearchInput: string;
  workbenchAllocMap: Map<string, number>;
  onStoreFilterChange: (val: string) => void;
  onMainTypeFilterChange: (val: StockMainType) => void;
  onCategoryFilterChange: (val: string) => void;
  onSearchInputChange: (val: string) => void;
  onPickStockItem: (item: LiveStockItem) => void;
}

export const LiveStockRadar: React.FC<LiveStockRadarProps> = ({
  currentPlan,
  plans,
  stores,
  liveStockItems,
  stockLoading,
  availableCategories,
  stockStoreFilter,
  stockMainTypeFilter,
  stockCategoryFilter,
  stockSearchInput,
  workbenchAllocMap,
  onStoreFilterChange,
  onMainTypeFilterChange,
  onCategoryFilterChange,
  onSearchInputChange,
  onPickStockItem,
}) => {
  return (
    <div className="flex flex-col bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-xl h-auto xl:h-full select-none">
      {/* 看板頂部標題 */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-1.5">
          <Store className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-bold text-white">門市現貨雷達看板</h3>
          <span className="text-[10px] text-slate-400 font-mono">
            (共 {liveStockItems.length} 款)
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span
            className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20"
            title="包含工作台所有方案正在配且未發布的即時累加總量"
          >
            正在配防撞
          </span>
        </div>
      </div>

      {/* 門市、大項分類與搜尋篩選器 */}
      <div className="space-y-1.5 py-2 border-b border-slate-800 shrink-0">
        {/* 大項切換：預設 GK 雕像 */}
        <div className="flex items-center gap-1 p-0.5 bg-slate-950 border border-slate-800 rounded-lg text-[10px]">
          <button
            type="button"
            onClick={() => {
              onMainTypeFilterChange('GK');
              onCategoryFilterChange('ALL');
            }}
            className={`flex-1 py-1 rounded text-center font-bold transition ${
              stockMainTypeFilter === 'GK'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            👑 GK 雕像 (預設)
          </button>
          <button
            type="button"
            onClick={() => {
              onMainTypeFilterChange('ALL');
              onCategoryFilterChange('ALL');
            }}
            className={`flex-1 py-1 rounded text-center transition ${
              stockMainTypeFilter === 'ALL'
                ? 'bg-slate-750 text-white font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            全部商品
          </button>
          <button
            type="button"
            onClick={() => {
              onMainTypeFilterChange('BLIND_BOX');
              onCategoryFilterChange('ALL');
            }}
            className={`flex-1 py-1 rounded text-center transition ${
              stockMainTypeFilter === 'BLIND_BOX'
                ? 'bg-pink-600 text-white font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🎁 盒玩盲盒
          </button>
        </div>

        <div className="flex gap-1.5 text-xs">
          <select
            value={stockStoreFilter}
            onChange={(e) => onStoreFilterChange(e.target.value)}
            className="flex-1 px-2 py-1 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 outline-none text-[11px]"
          >
            <option value="ALL">全店門市現貨</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <select
            value={stockCategoryFilter}
            onChange={(e) => onCategoryFilterChange(e.target.value)}
            className="flex-1 px-2 py-1 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 outline-none text-[11px]"
          >
            <option value="ALL">全部類別</option>
            {availableCategories.length > 0 ? (
              availableCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))
            ) : (
              <>
                <option value="GK">GK 雕像</option>
                <option value="海賊王">海賊王</option>
                <option value="GENERAL">一般周邊</option>
                <option value="BLIND_BOX">盲盒</option>
              </>
            )}
          </select>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
          <input
            type="text"
            value={stockSearchInput}
            onChange={(e) => onSearchInputChange(e.target.value)}
            placeholder="搜尋品名/貨號..."
            className="w-full pl-8 pr-3 py-1 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 outline-none focus:border-amber-500 font-mono"
          />
        </div>
      </div>

      {/* 欄位小表頭 */}
      <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 px-2 py-1 shrink-0 border-b border-slate-800/80">
        <span>貨號 · 品名</span>
        <div className="flex items-center gap-1.5">
          <span className="w-11 text-right">成本</span>
          <span className="text-center w-[96px]">現貨 ┆ 沙盤狀態</span>
          <span className="w-5 text-center">配</span>
        </div>
      </div>

      {/* 現貨清單滾動容器：< xl 採用受控高度並遏制過滾，xl 完全 flex-1 填滿 sticky 容器 */}
      <div className="flex-1 max-h-[380px] sm:max-h-[460px] xl:max-h-none overflow-y-auto overscroll-contain pr-1 py-1 space-y-1">
        {stockLoading ? (
          <div className="py-8 text-center text-slate-500 text-xs">
            <RotateCw className="w-4 h-4 animate-spin mx-auto text-amber-400 mb-1" />
            載入店內現貨與在場抽況中...
          </div>
        ) : liveStockItems.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs">
            目前無符合條件之現貨 (店內庫存 &gt; 0)
          </div>
        ) : (
          liveStockItems.map((prod) => {
            const sStock =
              stockStoreFilter === 'ALL'
                ? prod.totalStock ?? prod.stock ?? 0
                : ((prod.storeStocks && prod.storeStocks[stockStoreFilter]) ?? prod.stock ?? 0);
            const sAlloc =
              stockStoreFilter === 'ALL'
                ? prod.totalAllocated ?? prod.allocatedCount ?? 0
                : ((prod.storeAllocated && prod.storeAllocated[stockStoreFilter]) ?? prod.allocatedCount ?? 0);

            // 1. 統計沙盤推演各維度用量
            const workbenchAlloc = workbenchAllocMap.get(prod.id) || 0;
            // 當前編輯中的這套方案配入的數量
            const thisPlanQty = currentPlan.items
              .filter((it) => it.productId === prod.id)
              .reduce((s, it) => s + (Number(it.draws) || 0), 0);
            // 其他草稿方案配入的數量
            const otherPlanAlloc = Math.max(0, workbenchAlloc - thisPlanQty);

            // 跨套沙盤參與的總方案數
            const plansInvolvedCount = plans.filter((p) =>
              p.items.some((it) => it.productId === prod.id && (Number(it.draws) || 0) > 0)
            ).length;

            // 物理與推演衝突判斷
            const totalDemand = sAlloc + workbenchAlloc;
            const isOverPhysical = totalDemand > sStock;
            const isMultiPlanCollision = sStock <= 1 && plansInvolvedCount > 1;

            const tooltipText =
              `【${prod.name}】\n` +
              `• 門市實體現貨: ${sStock} 尊\n` +
              `• 在場機台已開抽: ${sAlloc} 尊\n` +
              `────────────────────────\n` +
              `• 當前方案試配: ${thisPlanQty} 尊\n` +
              `• 其他草稿方案試配: ${otherPlanAlloc} 尊 (共 ${plansInvolvedCount} 個方案試用中)\n` +
              `────────────────────────\n` +
              (isMultiPlanCollision
                ? `⚠️ 提醒：此品項為極少現貨，多個方案正在沙盤試配中，正式發布前需擇一保留。\n`
                : '') +
              (isOverPhysical
                ? `🚨 警告：總試配量 (${totalDemand}) 超出實體現貨 (${sStock})！`
                : `▸ 扣除目前所有試配後淨餘: ${sStock - totalDemand}`);

            return (
              <div
                key={prod.id}
                className={`h-[34px] px-2 flex items-center justify-between gap-1.5 rounded-lg border text-xs transition group ${
                  isOverPhysical
                    ? 'bg-rose-950/25 border-rose-500/50 hover:bg-rose-950/40'
                    : isMultiPlanCollision
                    ? 'bg-amber-950/20 border-amber-500/40 hover:bg-amber-950/35'
                    : thisPlanQty > 0
                    ? 'bg-indigo-950/25 border-indigo-500/40 hover:bg-indigo-950/40'
                    : 'bg-slate-950/80 border-slate-800/80 hover:bg-slate-800/80 hover:border-slate-700'
                }`}
                title={tooltipText}
              >
                {/* 左側：貨號 + 純品名 + 當前方案配入量標記 */}
                <div className="min-w-0 flex-1 flex items-center gap-1.5 overflow-hidden">
                  <span className="font-mono text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1 py-0.5 rounded shrink-0">
                    #{prod.id}
                  </span>
                  <span
                    className="text-xs font-medium text-slate-200 truncate group-hover:text-amber-300 transition cursor-default"
                    title={prod.name}
                  >
                    {cleanPrizeName(prod.name)}
                  </span>
                  {thisPlanQty > 0 && (
                    <span
                      className="text-[9px] font-mono font-bold text-indigo-300 bg-indigo-500/20 px-1 py-0.2 rounded shrink-0 border border-indigo-500/30"
                      title={`當前方案正在試配 ${thisPlanQty} 件`}
                    >
                      本套x{thisPlanQty}
                    </span>
                  )}
                </div>

                {/* 右側：成本 + 雙聯微型狀態徽章 + 快速配入按鈕 */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="font-mono text-xs font-bold text-rose-300 w-11 text-right">
                    ${Number(prod.costPrice || 0).toLocaleString()}
                  </span>

                  <div className="w-[96px] inline-flex rounded overflow-hidden border border-slate-700/80 text-[10px] font-mono shrink-0 select-none shadow-sm">
                    {/* 左半部：實體現貨 */}
                    <div className="bg-slate-800 text-slate-300 px-1.5 py-0.5 font-bold border-r border-slate-700/60 shrink-0">
                      現{sStock}
                    </div>

                    {/* 右半部：動態沙盤推演語意 */}
                    <div
                      className={`flex-1 px-1 py-0.5 font-bold text-center truncate ${
                        isOverPhysical
                          ? 'bg-rose-500/25 text-rose-300 animate-pulse'
                          : isMultiPlanCollision
                          ? 'bg-amber-500/20 text-amber-300'
                          : sAlloc > 0 && sStock <= sAlloc
                          ? 'bg-slate-800 text-slate-400'
                          : thisPlanQty > 0
                          ? 'bg-indigo-500/20 text-indigo-300'
                          : otherPlanAlloc > 0
                          ? 'bg-purple-500/15 text-purple-300'
                          : 'bg-emerald-500/15 text-emerald-300'
                      }`}
                    >
                      {isOverPhysical
                        ? `超配${Math.abs(sStock - totalDemand)}`
                        : isMultiPlanCollision
                        ? `${plansInvolvedCount}套共用`
                        : sAlloc > 0 && sStock <= sAlloc
                        ? `機台抽中`
                        : thisPlanQty > 0
                        ? `本套試配`
                        : otherPlanAlloc > 0
                        ? `他套試算`
                        : `可試配`}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onPickStockItem(prod)}
                    className={`w-5 h-5 flex items-center justify-center rounded transition shadow shrink-0 cursor-pointer ${
                      isOverPhysical || isMultiPlanCollision
                        ? 'bg-amber-500/80 hover:bg-amber-400 text-slate-950 active:scale-95 border border-amber-300/40'
                        : 'bg-amber-500 hover:bg-amber-400 text-slate-950 hover:scale-105 active:scale-95 shadow-amber-500/20'
                    }`}
                    title={
                      isMultiPlanCollision
                        ? '加入當前方案試算（注意：此品項已有其他方案試配中，發布前需擇一）'
                        : '帶入賞位試算'
                    }
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[3]" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
