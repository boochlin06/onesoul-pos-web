import React from 'react';
import {
  Layers,
  Hash,
  Trash2,
  Plus,
  Minus,
} from 'lucide-react';
import { SetPlan, AllocationPrizeItem, LiveStockItem } from '../types';
import { PrizeTierBadge } from './PrizeTierBadge';
import { ProductAutocompleteInput } from './ProductAutocompleteInput';

interface PrizeAllocationGridProps {
  currentPlan: SetPlan;
  liveStockItems: LiveStockItem[];
  workbenchAllocMap: Map<string, number>;
  onAddBigPrize: (mode?: 'number' | 'letter') => void;
  onAddBlindBoxPrize: () => void;
  onAddSmallPrize: (type?: '1p' | '0p') => void;
  onAutoFillSmallPrizeZ: (type?: '0p' | '1p') => void;
  onSelectProductForItem: (itemId: string, product: any) => void;
  onUpdateItem: (id: string, field: keyof AllocationPrizeItem, val: any) => void;
  onDeleteItem: (id: string) => void;
}

export const PrizeAllocationGrid: React.FC<PrizeAllocationGridProps> = ({
  currentPlan,
  liveStockItems,
  workbenchAllocMap,
  onAddBigPrize,
  onAddBlindBoxPrize,
  onAddSmallPrize,
  onAutoFillSmallPrizeZ,
  onSelectProductForItem,
  onUpdateItem,
  onDeleteItem,
}) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-lg relative flex flex-col">
      {/* 快捷增賞工具列 */}
      <div className="p-2.5 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 rounded-t-xl select-none">
        <div className="flex items-center gap-2 text-xs font-bold text-white">
          <Layers className="w-4 h-4 text-amber-400" />
          <span>獎項配置清單 ({currentPlan.items.length} 賞)</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => onAddBigPrize('number')}
            className="flex items-center gap-1 px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold rounded shadow transition cursor-pointer"
            title="新增數字大賞 (1, 2, 3...)"
          >
            <Hash className="w-3 h-3" />
            <span>+ 數字大賞</span>
          </button>

          <button
            type="button"
            onClick={() => onAddBigPrize('letter')}
            className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold rounded border border-slate-700 transition cursor-pointer"
            title="新增字母大賞 (A, B, C...)"
          >
            <span>+ 字母大賞</span>
          </button>

          <button
            type="button"
            onClick={onAddBlindBoxPrize}
            className="flex items-center gap-1 px-2 py-1 bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-[11px] font-bold rounded shadow transition cursor-pointer"
            title="快捷加入 X 賞 (任選盲盒一個，成本 200)"
          >
            <span>🎁 + X 盲盒</span>
          </button>

          <button
            type="button"
            onClick={() => onAddSmallPrize('0p')}
            className="flex items-center gap-1 px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold rounded shadow transition cursor-pointer"
            title="快捷加入 0P 保底小賞 (成本 0 / 點數 0)"
          >
            <span>⭐ + Z(0P)</span>
          </button>

          <button
            type="button"
            onClick={() => onAddSmallPrize('1p')}
            className="flex items-center gap-1 px-2 py-1 bg-emerald-700 hover:bg-emerald-600 text-white text-[11px] font-bold rounded shadow transition cursor-pointer"
            title="快捷加入 1P 保底小賞 (成本 1 / 點數 1)"
          >
            <span>⭐ + Z(1P)</span>
          </button>

          <button
            type="button"
            onClick={() => onAutoFillSmallPrizeZ('0p')}
            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black rounded shadow transition cursor-pointer"
            title="自動計算剩餘抽數並補平為 0P 保底小賞"
          >
            <span>⚡ 補平 0P</span>
          </button>

          <button
            type="button"
            onClick={() => onAutoFillSmallPrizeZ('1p')}
            className="px-2 py-1 bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-black rounded shadow transition cursor-pointer"
            title="自動計算剩餘抽數並補平為 1P 保底小賞"
          >
            <span>⚡ 補平 1P</span>
          </button>
        </div>
      </div>

      {/* 高密度表格主體：min-w-[780px] 保證列幾何不崩潰，overflow-x-auto 局域平順橫滾 */}
      <div className="overflow-x-auto pb-12 overscroll-x-contain">
        <table className="w-full min-w-[780px] text-left border-collapse text-xs font-mono">
          <thead className="sticky top-0 bg-slate-950/95 backdrop-blur border-b border-slate-800 text-slate-400 select-none font-semibold z-10">
            <tr className="h-9">
              <th className="px-2 py-1.5 w-32 text-center">賞級代號</th>
              <th className="px-2 py-1.5 w-44">貨號 · 現貨狀態</th>
              <th className="px-2 py-1.5">商品品名</th>
              <th className="px-2 py-1.5 w-24 text-center">抽數</th>
              <th className="px-2 py-1.5 w-24 text-right">成本 (NT$)</th>
              <th className="px-2 py-1.5 w-20 text-right">點數</th>
              <th className="px-3 py-1.5 w-24 text-right">小計成本</th>
              <th className="px-2 py-1.5 w-12 text-center">操作</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-800/80 text-slate-200">
            {currentPlan.items.map((it) => {
              const grade = (it.prizeGrade || '').trim().toUpperCase();
              const isBlindBox = grade === 'X';
              const isSmallPrize = grade === 'Z' || it.isNonGk || it.productId === '0p' || it.productId === '1p';
              const isLastPrize = grade === 'LAST' || grade === 'LS' || grade.includes('最後');

              // 行級現貨計算
              let stockPill: React.ReactNode = null;
              if (it.productId && !['0p', '1p', 'x', 'X', 'BLIND_BOX'].includes(it.productId) && !it.isNonGk) {
                const prod = liveStockItems.find(
                  (p) => p.id === it.productId || p.barcode === it.productId
                );
                if (prod) {
                  const sStock =
                    currentPlan.storeId === 'ALL'
                      ? prod.totalStock ?? prod.stock ?? 0
                      : ((prod.storeStocks && prod.storeStocks[currentPlan.storeId]) ?? prod.stock ?? 0);
                  const sAlloc =
                    currentPlan.storeId === 'ALL'
                      ? prod.totalAllocated ?? prod.allocatedCount ?? 0
                      : ((prod.storeAllocated && prod.storeAllocated[currentPlan.storeId]) ?? prod.allocatedCount ?? 0);
                  const workbenchAlloc = workbenchAllocMap.get(prod.id) || 0;
                  const totalDemand = sAlloc + workbenchAlloc;
                  const remaining = sStock - totalDemand;

                  if (sStock <= 0) {
                    stockPill = (
                      <span className="text-[9px] px-1 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold shrink-0">
                        現貨 0
                      </span>
                    );
                  } else if (remaining < 0) {
                    stockPill = (
                      <span className="text-[9px] px-1 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold shrink-0 animate-pulse">
                        現貨 {sStock} (超配 {Math.abs(remaining)})
                      </span>
                    );
                  } else if (remaining === 0) {
                    stockPill = (
                      <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold shrink-0">
                        現貨 {sStock} (配滿)
                      </span>
                    );
                  } else {
                    stockPill = (
                      <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold shrink-0">
                        現貨 {sStock} (剩 {remaining})
                      </span>
                    );
                  }
                }
              }

              return (
                <tr
                  key={it.id}
                  className={`hover:bg-slate-800/50 transition h-10 ${
                    isSmallPrize
                      ? 'bg-emerald-950/15'
                      : isBlindBox
                      ? 'bg-fuchsia-950/15'
                      : isLastPrize
                      ? 'bg-amber-950/20 ring-1 ring-amber-500/20'
                      : ''
                  }`}
                >
                  {/* 賞位代號 (輸入框 + 萬代官方徽章) */}
                  <td className="px-2 py-1">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={it.prizeGrade}
                        onChange={(e) => onUpdateItem(it.id, 'prizeGrade', e.target.value)}
                        className={`w-12 text-center font-bold px-1 py-0.5 rounded border outline-none text-xs font-mono ${
                          isSmallPrize
                            ? 'bg-emerald-950 text-emerald-300 border-emerald-500/50'
                            : isBlindBox
                            ? 'bg-fuchsia-950 text-fuchsia-300 border-fuchsia-500/50'
                            : isLastPrize
                            ? 'bg-amber-950 text-amber-300 border-amber-500/50'
                            : 'bg-slate-800 text-amber-300 border-slate-700'
                        }`}
                        placeholder="1, A, Z"
                      />
                      <PrizeTierBadge grade={it.prizeGrade} />
                    </div>
                  </td>

                  {/* 貨號代碼 + 行級現貨指示藥丸 */}
                  <td className="px-2 py-1 min-w-[170px] relative">
                    <div className="space-y-0.5">
                      <ProductAutocompleteInput
                        itemId={it.id}
                        prizeGrade={it.prizeGrade}
                        value={it.productId}
                        storeId={currentPlan.storeId}
                        onSelectProduct={(prod) => onSelectProductForItem(it.id, prod)}
                        onChangeValue={(val) => onUpdateItem(it.id, 'productId', val)}
                      />
                      {stockPill && <div className="mt-0.5 flex">{stockPill}</div>}
                    </div>
                  </td>

                  {/* 獎品名稱 */}
                  <td className="px-2 py-1 font-sans">
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={it.prizeName}
                        onChange={(e) => onUpdateItem(it.id, 'prizeName', e.target.value)}
                        className="w-full bg-slate-800/90 text-white px-2 py-1 rounded border border-slate-700 outline-none focus:border-amber-500 font-medium text-xs"
                        placeholder="輸入品名或保底名稱"
                      />
                      {it.isPrizeNameCustomized && (
                        <span
                          className="text-[9px] px-1 py-0.2 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded font-mono shrink-0 select-none"
                          title="店長自訂品名 (自動帶入時不被抹除)"
                        >
                          自訂
                        </span>
                      )}
                    </div>
                  </td>

                  {/* 抽數 (Stepper 微調器) */}
                  <td className="px-2 py-1 text-center">
                    <div className="flex items-center justify-center gap-0.5">
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateItem(it.id, 'draws', Math.max(1, (Number(it.draws) || 1) - 1))
                        }
                        className="w-5 h-6 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded flex items-center justify-center border border-slate-700"
                        title="減 1 抽"
                      >
                        <Minus className="w-2.5 h-2.5" />
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={it.draws}
                        onChange={(e) =>
                          onUpdateItem(it.id, 'draws', Math.max(1, parseInt(e.target.value, 10) || 1))
                        }
                        className="w-12 bg-slate-800 text-white text-center px-1 py-1 rounded border border-slate-700 outline-none font-bold text-xs"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateItem(it.id, 'draws', (Number(it.draws) || 1) + 1)
                        }
                        className="w-5 h-6 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded flex items-center justify-center border border-slate-700"
                        title="加 1 抽"
                      >
                        <Plus className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </td>

                  {/* 單件成本 */}
                  <td className="px-2 py-1 text-right">
                    <input
                      type="number"
                      value={it.costPrice}
                      onChange={(e) => onUpdateItem(it.id, 'costPrice', Number(e.target.value))}
                      className="w-20 bg-slate-800 text-slate-200 text-right px-1.5 py-1 rounded border border-slate-700 outline-none text-xs"
                    />
                  </td>

                  {/* 可轉點數 */}
                  <td className="px-2 py-1 text-right">
                    <input
                      type="number"
                      value={it.points}
                      onChange={(e) => onUpdateItem(it.id, 'points', Number(e.target.value))}
                      className="w-14 bg-slate-800 text-indigo-300 text-right px-1.5 py-1 rounded border border-slate-700 outline-none text-xs"
                    />
                  </td>

                  {/* 小計成本 */}
                  <td className="px-3 py-1 text-right font-bold text-rose-300 text-xs">
                    ${((it.draws || 0) * (it.costPrice || 0)).toLocaleString()}
                  </td>

                  {/* 刪除操作 */}
                  <td className="px-2 py-1 text-center">
                    <button
                      type="button"
                      onClick={() => onDeleteItem(it.id)}
                      className="p-1 hover:bg-slate-800 text-slate-500 hover:text-rose-400 rounded transition cursor-pointer"
                      title="移除此賞位"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
