import React, { useState } from 'react';
import { Sparkles, Coins, Percent, ChevronDown, ChevronUp, ShieldAlert } from 'lucide-react';
import { SetPlan, FinancialSummary } from '../types';
import { getTopPrizeName } from '../utils/calculations';

interface PlanMetadataConfigProps {
  currentPlan: SetPlan;
  financialSummary: FinancialSummary;
  onUpdatePlan: (field: keyof SetPlan, val: any) => void;
  onPrice1Change: (newP1: number) => void;
  onTenPlusOneToggle: () => void;
  onReversePriceFromMargin: () => void;
}

const quickDrawChips = [50, 80, 100, 120, 300, 500, 1000, 3000];

export const PlanMetadataConfig: React.FC<PlanMetadataConfigProps> = ({
  currentPlan,
  financialSummary,
  onUpdatePlan,
  onPrice1Change,
  onTenPlusOneToggle,
  onReversePriceFromMargin,
}) => {
  const [isPricingExpanded, setIsPricingExpanded] = useState<boolean>(true);
  const topPrizeName = getTopPrizeName(currentPlan.items);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-md space-y-3">
      {/* 套組品名與總抽數設定行 */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
        {/* 套組名稱 */}
        <div className="md:col-span-7">
          <div className="flex items-center justify-between mb-1">
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              套組名稱
            </label>
            {!currentPlan.isNameCustomized && topPrizeName && (
              <span className="text-[10px] text-amber-400 flex items-center gap-1 font-mono">
                <Sparkles className="w-3 h-3" />
                <span>已自動套用第 1 大獎品名</span>
              </span>
            )}
          </div>
          <input
            type="text"
            value={currentPlan.name}
            onChange={(e) => {
              const val = e.target.value;
              const isCustom = val.trim().length > 0;
              onUpdatePlan('isNameCustomized', isCustom);
              if (!isCustom) {
                onUpdatePlan('name', topPrizeName || '');
              } else {
                onUpdatePlan('name', val);
              }
            }}
            className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-amber-500 font-bold"
            placeholder={topPrizeName || '例如: 海賊王 魯夫 MASTERLISE 或 自訂套組名稱...'}
          />
        </div>

        {/* 總抽數自訂輸入 */}
        <div className="md:col-span-5 flex flex-col justify-end">
          <div className="flex items-center justify-between mb-1">
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              總抽數 (Total Draws)
            </label>
            <span className="text-[10px] text-slate-500 font-mono">支援至 3000 抽</span>
          </div>
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
            <input
              type="number"
              min="1"
              max="10000"
              value={currentPlan.totalDraws}
              onChange={(e) => onUpdatePlan('totalDraws', Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="w-20 sm:w-24 px-2 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-amber-300 focus:outline-none focus:border-amber-500 font-mono font-bold text-center shrink-0"
            />
            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 sm:flex-wrap">
              {quickDrawChips.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => onUpdatePlan('totalDraws', d)}
                  className={`px-1.5 py-1 rounded text-[10px] font-mono transition ${
                    currentPlan.totalDraws === d
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-slate-800 text-slate-300 hover:text-white'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 階梯定價與損益引擎折疊區塊 */}
      <div className="border-t border-slate-800 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          {/* 標題與行動端折疊開關 */}
          <div className="flex items-center justify-between sm:justify-start gap-2">
            <div className="flex items-center gap-2">
              <Coins className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="text-xs font-bold text-slate-200">階梯定價與目標毛利</span>
              <span className="text-[10px] text-slate-400 hidden lg:inline">
                (單抽 / 3抽97折 / 5抽95折 / 10抽90折或10送1)
              </span>
            </div>
            {/* 行動端折疊切換按鈕 */}
            <button
              type="button"
              onClick={() => setIsPricingExpanded(!isPricingExpanded)}
              className="sm:hidden p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition cursor-pointer"
            >
              {isPricingExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* 目標毛利逆推工具與桌機端折疊開關 */}
          <div className="flex items-center justify-between sm:justify-end gap-2">
            {/* 目標毛利逆推工具 */}
            <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 text-[11px]">
              <Percent className="w-3 h-3 text-indigo-400 shrink-0" />
              <span className="text-slate-300 font-medium">目標毛利:</span>
              <input
                type="number"
                value={currentPlan.targetMargin}
                onChange={(e) => onUpdatePlan('targetMargin', Number(e.target.value))}
                className="w-11 bg-slate-900 text-center font-mono text-xs text-white px-1 py-0.5 rounded border border-slate-700 outline-none focus:border-indigo-400 font-bold"
              />
              <span className="text-slate-400 font-mono">%</span>
              <button
                type="button"
                onClick={onReversePriceFromMargin}
                className="ml-1 px-2 py-0.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold rounded shadow transition cursor-pointer whitespace-nowrap active:scale-95"
                title="依據當前獎品總成本與目標毛利率，自動逆推建議單抽價"
              >
                反推抽價
              </button>
            </div>

            {/* 桌機端折疊按鈕 */}
            <button
              type="button"
              onClick={() => setIsPricingExpanded(!isPricingExpanded)}
              className="hidden sm:flex p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition cursor-pointer"
            >
              {isPricingExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {isPricingExpanded && (
          <div className="mt-2.5 space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {/* 單抽 */}
              <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                  單抽基準 (1 Draw)
                </div>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-xs text-slate-400 font-mono">$</span>
                  <input
                    type="number"
                    value={currentPlan.price1}
                    onChange={(e) => onPrice1Change(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-xs font-bold text-white font-mono outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {/* 3 抽 */}
              <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                <div className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider">
                  3 抽打包 (97折)
                </div>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-xs text-slate-400 font-mono">$</span>
                  <input
                    type="number"
                    value={currentPlan.price3}
                    onChange={(e) => onUpdatePlan('price3', Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-xs font-bold text-indigo-200 font-mono outline-none focus:border-indigo-400"
                  />
                </div>
              </div>

              {/* 5 抽 */}
              <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                <div className="text-[10px] font-bold text-blue-300 uppercase tracking-wider">
                  5 抽打包 (95折)
                </div>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-xs text-slate-400 font-mono">$</span>
                  <input
                    type="number"
                    value={currentPlan.price5}
                    onChange={(e) => onUpdatePlan('price5', Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-xs font-bold text-blue-200 font-mono outline-none focus:border-blue-400"
                  />
                </div>
              </div>

              {/* 10 抽 */}
              <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">
                    10 抽大連抽
                  </span>
                  <button
                    type="button"
                    onClick={onTenPlusOneToggle}
                    className={`text-[9px] px-1 py-0.2 rounded font-bold transition ${
                      currentPlan.isTenPlusOne ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {currentPlan.isTenPlusOne ? '10送1' : '9折'}
                  </button>
                </div>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-xs text-slate-400 font-mono">$</span>
                  <input
                    type="number"
                    value={currentPlan.price10}
                    onChange={(e) => onUpdatePlan('price10', Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-xs font-bold text-emerald-200 font-mono outline-none focus:border-emerald-400"
                  />
                </div>
              </div>
            </div>

            {/* 即時預算快報 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
              <div className="p-1.5 bg-slate-950 rounded border border-slate-800/80">
                <span className="text-slate-500 text-[10px]">成本: </span>
                <strong className="text-rose-300">${financialSummary.totalCost.toLocaleString()}</strong>
              </div>
              <div className="p-1.5 bg-slate-950 rounded border border-slate-800/80">
                <span className="text-slate-500 text-[10px]">預期營收: </span>
                <strong className="text-emerald-300">${financialSummary.expectedRevenue.toLocaleString()}</strong>
              </div>
              <div className="p-1.5 bg-slate-950 rounded border border-slate-800/80 flex items-center justify-between">
                <span className="text-slate-500 text-[10px]">現金毛利: </span>
                <span
                  className={`font-bold flex items-center gap-0.5 ${
                    financialSummary.cashMargin >= 35
                      ? 'text-emerald-400'
                      : financialSummary.cashMargin >= 20
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }`}
                >
                  {financialSummary.cashMargin}%
                  {financialSummary.cashMargin < 20 && <ShieldAlert className="w-3 h-3 text-rose-400" />}
                </span>
              </div>
              <div className="p-1.5 bg-slate-950 rounded border border-slate-800/80 flex items-center justify-between">
                <span className="text-slate-500 text-[10px] truncate">8:2期望毛利:</span>
                <strong className="text-indigo-300 font-bold shrink-0">{financialSummary.hybridMargin}%</strong>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
