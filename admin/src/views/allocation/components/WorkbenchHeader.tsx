import React from 'react';
import {
  Boxes,
  Plus,
  Pause,
  X,
  Copy,
  Save,
  Layers,
  Clock,
  Calculator,
} from 'lucide-react';
import { SetPlan, StoreOption, NamingMode, AllocationTab } from '../types';

interface WorkbenchHeaderProps {
  plans: SetPlan[];
  activePlanIdx: number;
  stores: StoreOption[];
  namingMode: NamingMode;
  activeTab: AllocationTab;
  lastAutoSavedTime: string | null;
  isSavingDraft: boolean;
  isPublishing: boolean;
  templatesCount: number;
  draftsCount: number;
  onSelectPlan: (idx: number) => void;
  onAddPlan: () => void;
  onDuplicatePlan: () => void;
  onRemovePlan: (idx: number) => void;
  onParkPlan: () => void;
  onStoreChange: (storeId: string) => void;
  onBatchCountChange: (count: number) => void;
  onNamingModeChange: (mode: NamingMode) => void;
  onTabChange: (tab: AllocationTab) => void;
  onSaveDraft: () => void;
  onPublishAllPlans?: () => void;
}

export const WorkbenchHeader: React.FC<WorkbenchHeaderProps> = ({
  plans,
  activePlanIdx,
  stores,
  namingMode,
  activeTab,
  lastAutoSavedTime,
  isSavingDraft,
  isPublishing,
  templatesCount,
  draftsCount,
  onSelectPlan,
  onAddPlan,
  onDuplicatePlan,
  onRemovePlan,
  onParkPlan,
  onStoreChange,
  onBatchCountChange,
  onNamingModeChange,
  onTabChange,
  onSaveDraft,
  onPublishAllPlans,
}) => {
  const currentPlan = plans[activePlanIdx] || plans[0];

  return (
    <div className="bg-slate-900 border-b border-slate-800 px-4 py-2 shrink-0 select-none shadow-sm space-y-2">
      {/* 頂層主控制列：標籤頁切換 + 方案 Tab Pills + 快速操作 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* 左側：主視圖標籤頁 + 多套工作台 Tab Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {/* 視圖標籤頁切換 */}
          <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => onTabChange('canvas')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition font-medium ${
                activeTab === 'canvas'
                  ? 'bg-amber-600 text-white font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>工作台</span>
            </button>
            <button
              onClick={() => onTabChange('templates')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition font-medium ${
                activeTab === 'templates'
                  ? 'bg-amber-600 text-white font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>範本庫 ({templatesCount})</span>
            </button>
            <button
              onClick={() => onTabChange('drafts')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition font-medium ${
                activeTab === 'drafts'
                  ? 'bg-amber-600 text-white font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>草稿箱 ({draftsCount})</span>
            </button>
          </div>

          <div className="h-4 w-[1px] bg-slate-800 mx-1 hidden sm:block" />

          {/* 方案 Tabs Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
              <Boxes className="w-3.5 h-3.5 text-amber-400" />
              <span>方案:</span>
            </span>

            {plans.map((p, idx) => {
              const isActive = idx === activePlanIdx;
              return (
                <div
                  key={p.id}
                  onClick={() => onSelectPlan(idx)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition select-none ${
                    isActive
                      ? 'bg-amber-500 text-slate-950 shadow-md ring-1 ring-amber-400'
                      : p.isParked
                      ? 'bg-slate-800/80 text-amber-300 border border-amber-500/40'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-750 hover:text-white border border-slate-700'
                  }`}
                >
                  {p.isParked && (
                    <span className="flex items-center text-[10px] text-amber-400" title="已暫存掛單">
                      <Pause className="w-3 h-3 fill-amber-400 mr-0.5" />
                      (掛單)
                    </span>
                  )}
                  <span className="truncate max-w-[120px]">{p.name || `套組 #${idx + 1}`}</span>
                  <span
                    className={`text-[10px] font-mono px-1 py-0.2 rounded ${
                      isActive ? 'bg-slate-950/20 text-slate-900' : 'bg-slate-900 text-amber-400'
                    }`}
                  >
                    {p.totalDraws}抽
                  </span>

                  {p.batchCount > 1 && (
                    <span
                      className={`text-[9px] font-mono px-1 rounded ${
                        isActive ? 'bg-amber-800 text-white' : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      x{p.batchCount}套
                    </span>
                  )}

                  {plans.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemovePlan(idx);
                      }}
                      className={`hover:opacity-75 p-0.5 rounded ${
                        isActive ? 'text-slate-950' : 'text-slate-400'
                      }`}
                      title="關閉此套組"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}

            <button
              onClick={onAddPlan}
              className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 hover:border-amber-400/50 rounded-lg text-xs font-bold transition cursor-pointer"
              title="新增另一個套組方案並行配置"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>新增套組</span>
            </button>
          </div>
        </div>

        {/* 右側：自動儲存狀態、掛單、儲存草稿、批次發布 (flex-wrap 確保 375px 窄螢幕乾淨折行不溢出) */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {lastAutoSavedTime && (
            <span className="text-[10px] text-emerald-400 font-mono hidden md:flex items-center gap-1 px-2 py-1 rounded bg-emerald-950/50 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>已即時暫存 ({lastAutoSavedTime})</span>
            </span>
          )}

          <button
            onClick={onDuplicatePlan}
            className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-medium transition cursor-pointer"
            title="複製當前套組配置為新分頁"
          >
            <Copy className="w-3 h-3 text-indigo-400" />
            <span className="hidden sm:inline">複製當前</span>
          </button>

          <button
            onClick={onParkPlan}
            className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-bold transition shadow-sm cursor-pointer"
            title="配到一半臨時有事離開，將此套掛單先放著"
          >
            <Pause className="w-3 h-3" />
            <span className="hidden xs:inline">暫存掛單</span>
            <span className="xs:hidden">掛單</span>
          </button>

          <button
            onClick={onSaveDraft}
            disabled={isSavingDraft}
            className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5 text-amber-400" />
            <span>{isSavingDraft ? '儲存中...' : '儲存草稿'}</span>
          </button>

          {plans.length > 1 && onPublishAllPlans && (
            <button
              onClick={onPublishAllPlans}
              disabled={isPublishing}
              className="flex items-center gap-1 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg shadow-sm transition disabled:opacity-50"
              title="一次發布工作台中所有套組方案"
            >
              <Boxes className="w-3.5 h-3.5" />
              <span>批次發布 ({plans.length}套)</span>
            </button>
          )}
        </div>
      </div>

      {/* 輔助控制細項 (門市切換、開套數量、命名風格) */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1.5 border-t border-slate-800/80 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-400">門市:</span>
            <select
              value={currentPlan.storeId}
              onChange={(e) => onStoreChange(e.target.value)}
              className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-xs text-white outline-none focus:border-amber-500"
            >
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-400">開套數量:</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="1"
                max="20"
                value={currentPlan.batchCount || 1}
                onChange={(e) => onBatchCountChange(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-12 px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-xs text-white text-center font-mono font-bold outline-none focus:border-amber-500"
              />
              <span className="text-[11px] text-slate-400 font-mono">套</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-400">賞位風格:</span>
            <div className="flex items-center bg-slate-950 p-0.5 rounded border border-slate-800 text-[10px]">
              <button
                type="button"
                onClick={() => onNamingModeChange('number')}
                className={`px-2 py-0.5 rounded font-bold transition ${
                  namingMode === 'number' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
                }`}
                title="數字格式: 1, 2, 3..."
              >
                1, 2, 3
              </button>
              <button
                type="button"
                onClick={() => onNamingModeChange('letter')}
                className={`px-2 py-0.5 rounded font-bold transition ${
                  namingMode === 'letter' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
                }`}
                title="字母格式: A, B, C..."
              >
                A, B, C
              </button>
            </div>
          </div>
        </div>

        <div className="text-[11px] text-slate-400 font-mono">
          <span>當前方案總抽數: </span>
          <strong className="text-amber-400 font-bold">{currentPlan.totalDraws}</strong> 抽
        </div>
      </div>
    </div>
  );
};
