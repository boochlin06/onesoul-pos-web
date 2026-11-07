import React from 'react';
import {
  Rocket,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Coins,
} from 'lucide-react';
import { SetPlan, FinancialSummary } from '../types';

interface FinancialBottomHUDProps {
  currentPlan: SetPlan;
  financialSummary: FinancialSummary;
  isPublishing: boolean;
  onAutoFillSmallPrizeZ: (type: '0p' | '1p') => void;
  onPublishCurrentPlan: () => void;
}

export const FinancialBottomHUD: React.FC<FinancialBottomHUDProps> = ({
  currentPlan,
  financialSummary,
  isPublishing,
  onAutoFillSmallPrizeZ,
  onPublishCurrentPlan,
}) => {
  const { totalDraws, items, batchCount } = currentPlan;
  const count = batchCount || 1;

  // 計算各類別獎項抽數佔比以繪製分段色彩進度條
  const total = Math.max(1, totalDraws);

  let aDraws = 0;
  let bDraws = 0;
  let otherBigDraws = 0;
  let xDraws = 0;
  let zDraws = 0;

  items.forEach((it) => {
    const g = (it.prizeGrade || '').trim().toUpperCase();
    const d = Number(it.draws) || 0;
    if (g === '1' || g === 'A') {
      aDraws += d;
    } else if (g === '2' || g === 'B') {
      bDraws += d;
    } else if (g === 'X') {
      xDraws += d;
    } else if (g === 'Z' || it.isNonGk || it.productId === '0p' || it.productId === '1p') {
      zDraws += d;
    } else {
      otherBigDraws += d;
    }
  });

  const aPct = (aDraws / total) * 100;
  const bPct = (bDraws / total) * 100;
  const otherPct = (otherBigDraws / total) * 100;
  const xPct = (xDraws / total) * 100;
  const zPct = (zDraws / total) * 100;
  const remainingDraws = Math.max(0, financialSummary.drawsDiff);
  const gapPct = (remainingDraws / total) * 100;

  const tooltipSummary =
    `總抽數: ${totalDraws} 抽\n` +
    `• A/1號大賞: ${aDraws} 抽 (${Math.round(aPct)}%)\n` +
    `• B/2號次賞: ${bDraws} 抽 (${Math.round(bPct)}%)\n` +
    `• 其他大賞: ${otherBigDraws} 抽 (${Math.round(otherPct)}%)\n` +
    `• X 盲盒賞: ${xDraws} 抽 (${Math.round(xPct)}%)\n` +
    `• Z 保底小賞: ${zDraws} 抽 (${Math.round(zPct)}%)\n` +
    (remainingDraws > 0 ? `• 尚缺抽數: ${remainingDraws} 抽 (${Math.round(gapPct)}%)` : '• 平帳狀態: 100% 已平衡');

  return (
    <div className="fixed bottom-0 left-0 md:left-64 right-0 z-30 bg-slate-950/95 backdrop-blur-xl border-t border-slate-700/80 px-3 sm:px-6 py-2 sm:py-0 sm:h-14 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-1.5 sm:gap-4 shadow-[0_-10px_25px_rgba(0,0,0,0.5)] select-none transition-[left] duration-200">
      {/* 1. 分段色彩進度條與行動端毛利 (Tier 1 on Mobile / Left on Desktop) */}
      <div className="flex items-center justify-between sm:justify-start gap-3 sm:w-[32%] sm:max-w-md">
        <div className="flex-1 sm:w-full space-y-1 min-w-0">
          <div className="flex items-center justify-between text-[10px] font-mono leading-none">
            <span className="text-slate-400 font-bold flex items-center gap-1 truncate">
              <Coins className="w-3 h-3 text-amber-400 shrink-0" />
              <span className="hidden xs:inline">抽數:</span>
            </span>
            <span
              className={`font-bold ${
                financialSummary.isBalanced ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {financialSummary.allocatedDraws} / {totalDraws} 抽
            </span>
          </div>

          <div
            className="w-full h-2 sm:h-2.5 bg-slate-900 rounded-full overflow-hidden flex border border-slate-700/80 shadow-inner"
            title={tooltipSummary}
          >
            {aPct > 0 && (
              <div
                style={{ width: `${aPct}%` }}
                className="bg-amber-400 hover:opacity-85 transition"
                title={`A/1號大賞: ${aDraws} 抽`}
              />
            )}
            {bPct > 0 && (
              <div
                style={{ width: `${bPct}%` }}
                className="bg-violet-400 hover:opacity-85 transition"
                title={`B/2號次賞: ${bDraws} 抽`}
              />
            )}
            {otherPct > 0 && (
              <div
                style={{ width: `${otherPct}%` }}
                className="bg-blue-400 hover:opacity-85 transition"
                title={`中階大賞: ${otherBigDraws} 抽`}
              />
            )}
            {xPct > 0 && (
              <div
                style={{ width: `${xPct}%` }}
                className="bg-fuchsia-400 hover:opacity-85 transition"
                title={`X盲盒賞: ${xDraws} 抽`}
              />
            )}
            {zPct > 0 && (
              <div
                style={{ width: `${zPct}%` }}
                className="bg-emerald-400 hover:opacity-85 transition"
                title={`Z保底小賞: ${zDraws} 抽`}
              />
            )}
            {gapPct > 0 && (
              <div
                style={{ width: `${gapPct}%` }}
                className="bg-rose-500/80 animate-pulse transition"
                title={`缺額: ${remainingDraws} 抽`}
              />
            )}
          </div>
        </div>

        {/* 行動端毛利徽章 (桌機端由右側財務區顯示) */}
        <div
          className={`sm:hidden flex items-center gap-1 px-2 py-0.5 rounded-lg border font-bold text-xs shrink-0 ${
            financialSummary.cashMargin >= 35
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
              : financialSummary.cashMargin >= 20
              ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
              : 'bg-rose-500/20 border-rose-500/50 text-rose-300'
          }`}
          title="預估單套現金毛利率"
        >
          <span className="text-[10px] text-slate-400 font-normal">毛利</span>
          <span>{financialSummary.cashMargin}%</span>
          {financialSummary.cashMargin < 20 && (
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
          )}
        </div>
      </div>

      {/* 2. 操作按鈕與財務指標 (Tier 2 on Mobile / Right on Desktop) */}
      <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-4">
        <div
          className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-mono font-bold border shrink-0 ${
            financialSummary.isBalanced
              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
          }`}
        >
          {financialSummary.isBalanced ? (
            <>
              <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400 shrink-0" />
              <span>已平帳</span>
            </>
          ) : (
            <>
              <AlertTriangle className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-rose-400 animate-bounce shrink-0" />
              <span>缺 {financialSummary.drawsDiff} 抽</span>
            </>
          )}
        </div>

        {!financialSummary.isBalanced && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => onAutoFillSmallPrizeZ('0p')}
              className="px-1.5 sm:px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] sm:text-[11px] font-bold rounded shadow transition cursor-pointer whitespace-nowrap"
              title="自動計算剩餘缺額並補平為 0P 保底小賞"
            >
              <span className="hidden sm:inline">⚡ 補平 </span>0P
            </button>
            <button
              type="button"
              onClick={() => onAutoFillSmallPrizeZ('1p')}
              className="px-1.5 sm:px-2 py-1 bg-amber-600 hover:bg-amber-500 text-white text-[10px] sm:text-[11px] font-bold rounded shadow transition cursor-pointer whitespace-nowrap"
              title="自動計算剩餘缺額並補平為 1P 保底小賞"
            >
              <span className="hidden sm:inline">⚡ 補平 </span>1P
            </button>
          </div>
        )}

        {/* 桌面端專屬核心財務儀表指標 (毛利指針 + 營收 vs 成本) */}
        <div className="hidden sm:flex items-center gap-3 font-mono text-xs shrink-0">
          <div className="hidden lg:flex items-center gap-2 text-[11px]">
            <span className="text-slate-400">營收:</span>
            <span className="text-emerald-400 font-bold">
              ${(financialSummary.expectedRevenue * count).toLocaleString()}
            </span>
            <span className="text-slate-600">/</span>
            <span className="text-slate-400">成本:</span>
            <span className="text-rose-300 font-bold">
              ${(financialSummary.totalCost * count).toLocaleString()}
            </span>
          </div>

          {/* 毛利率動態徽章 */}
          <div
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border font-bold text-xs ${
              financialSummary.cashMargin >= 35
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                : financialSummary.cashMargin >= 20
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                : 'bg-rose-500/20 border-rose-500/50 text-rose-300'
            }`}
            title="預估單套現金毛利率"
          >
            <span className="text-[10px] text-slate-400 font-normal">毛利</span>
            <span>{financialSummary.cashMargin}%</span>
            {financialSummary.cashMargin < 20 && (
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            )}
          </div>
        </div>

        {/* 4. 發布開套按鈕 */}
        <div className="shrink-0">
          <button
            type="button"
            onClick={onPublishCurrentPlan}
            disabled={isPublishing || !financialSummary.isBalanced}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.3)] transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
            title={
              !financialSummary.isBalanced
                ? `尚缺 ${financialSummary.drawsDiff} 抽未配平，需先補平抽數方可發布`
                : `發布至門市 POS 開抽 (${count} 套)`
            }
          >
            <Rocket className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span>{isPublishing ? '發布中...' : count > 1 ? `發布 (${count}套)` : '發布開抽'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
