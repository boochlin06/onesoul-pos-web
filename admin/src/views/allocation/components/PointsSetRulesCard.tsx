import React from 'react';
import { SetPlan } from '../types';

interface PointsSetRulesCardProps {
  currentPlan: SetPlan;
  onUpdatePlan: (field: keyof SetPlan, val: any) => void;
}

export const PointsSetRulesCard: React.FC<PointsSetRulesCardProps> = ({
  currentPlan,
  onUpdatePlan,
}) => {
  const pointsPerDraw = Math.max(1, Math.floor((currentPlan.price1 || 0) / 20));

  const handleBlindBoxPointsChange = (val: number) => {
    const nextVal = Math.max(1, val);
    onUpdatePlan('blindBoxPointsValue', nextVal);
    // 同步更新當前所有 X 賞項目的 points
    const updated = currentPlan.items.map((it) =>
      it.prizeGrade.toUpperCase() === 'X' ? { ...it, points: nextVal } : it
    );
    onUpdatePlan('items', updated);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-3 text-xs shadow-sm">
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={!!currentPlan.isPointsSet}
            onChange={(e) => onUpdatePlan('isPointsSet', e.target.checked)}
            className="w-4 h-4 rounded text-violet-600 bg-slate-950 border-slate-700 focus:ring-0 cursor-pointer"
          />
          <span
            className={`font-bold transition ${
              currentPlan.isPointsSet ? 'text-violet-300' : 'text-slate-300'
            }`}
          >
            🎟️ 限定點數套 (限定只能扣點數抽)
          </span>
        </label>

        {currentPlan.isPointsSet && (
          <span className="text-[11px] text-violet-300 font-mono bg-violet-950/80 px-2 py-0.5 rounded border border-violet-800/60 font-bold">
            每抽扣除 {pointsPerDraw} pts (單抽 ${currentPlan.price1} ÷ 20)
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
        <span className="text-[11px] text-amber-300 font-bold flex items-center gap-1">
          🎁 X 賞盲盒等價點數:
        </span>
        <input
          type="number"
          min="1"
          value={currentPlan.blindBoxPointsValue || 10}
          onChange={(e) => handleBlindBoxPointsChange(Number(e.target.value) || 10)}
          className="w-12 bg-slate-900 text-center font-mono text-xs font-bold text-amber-400 px-1 py-0.5 rounded border border-slate-700 outline-none focus:border-amber-400"
        />
        <span className="text-[10px] text-slate-400 font-mono">pts (可微調)</span>
      </div>
    </div>
  );
};
