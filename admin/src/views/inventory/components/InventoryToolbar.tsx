import React from 'react';
import {
  Search,
  X,
  Rows,
  Layers,
  Zap,
  FileSpreadsheet,
  Undo2,
  Save,
  Check,
  AlertCircle,
} from 'lucide-react';
import type { StoreItem, PendingCellChange } from '../types.js';

export interface InventoryToolbarProps {
  selectedMainType: 'ALL' | 'GK' | 'BLIND_BOX';
  setSelectedMainType: (val: 'ALL' | 'GK' | 'BLIND_BOX') => void;
  selectedCategory: string;
  setSelectedCategory: (val: string) => void;
  categories: string[];
  searchInput: string;
  setSearchInput: (val: string) => void;
  selectedStoreId: string;
  setSelectedStoreId: (val: string) => void;
  stores: StoreItem[];
  density: 'compact' | 'standard';
  setDensity: (val: 'compact' | 'standard') => void;
  saveMode: 'auto' | 'batch';
  setSaveMode: (val: 'auto' | 'batch') => void;
  pendingChanges: Map<string, PendingCellChange>;
  batchSaving: boolean;
  batchToast: { type: 'success' | 'error'; message: string } | null;
  onBatchSave: () => void;
  onDiscardChanges: () => void;
}

export const InventoryToolbar: React.FC<InventoryToolbarProps> = ({
  selectedMainType,
  setSelectedMainType,
  selectedCategory,
  setSelectedCategory,
  categories,
  searchInput,
  setSearchInput,
  selectedStoreId,
  setSelectedStoreId,
  stores,
  density,
  setDensity,
  saveMode,
  setSaveMode,
  pendingChanges,
  batchSaving,
  batchToast,
  onBatchSave,
  onDiscardChanges,
}) => {
  return (
    <div className="space-y-3">
      {/* ── 大項分類切換頁籤 ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="inline-flex bg-slate-900/90 p-1 rounded-2xl border border-slate-700/80 shadow-inner text-xs font-semibold">
          <button
            onClick={() => {
              setSelectedMainType('ALL');
              setSelectedCategory('ALL');
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition ${
              selectedMainType === 'ALL'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>全部商品</span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full ${
                selectedMainType === 'ALL'
                  ? 'bg-amber-600/30 text-slate-950 font-mono font-bold'
                  : 'bg-slate-800 text-slate-400 font-mono'
              }`}
            >
              3,530
            </span>
          </button>

          <button
            onClick={() => {
              setSelectedMainType('GK');
              setSelectedCategory('ALL');
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition ${
              selectedMainType === 'GK'
                ? 'bg-indigo-600 text-white font-bold shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>👑 GK 雕像</span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full ${
                selectedMainType === 'GK'
                  ? 'bg-indigo-700 text-white font-mono font-bold'
                  : 'bg-slate-800 text-slate-400 font-mono'
              }`}
            >
              3,144
            </span>
          </button>

          <button
            onClick={() => {
              setSelectedMainType('BLIND_BOX');
              setSelectedCategory('ALL');
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition ${
              selectedMainType === 'BLIND_BOX'
                ? 'bg-pink-600 text-white font-bold shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>🎁 盒玩盲盒</span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full ${
                selectedMainType === 'BLIND_BOX'
                  ? 'bg-pink-700 text-white font-mono font-bold'
                  : 'bg-slate-800 text-slate-400 font-mono'
              }`}
            >
              384
            </span>
          </button>
        </div>

        {selectedMainType === 'BLIND_BOX' && (
          <div className="text-xs text-pink-400 flex items-center gap-1.5 font-medium bg-pink-950/30 px-3 py-1.5 rounded-xl border border-pink-800/40">
            <span>💡 已鎖定 384 款盒玩盲盒專區（支援零售現貨、一番賞盲盒賞配賞與換點）</span>
          </div>
        )}
      </div>

      {/* 篩選與 Google Sheet 試算表模式工具列 */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-slate-800/60 p-3 rounded-2xl border border-slate-700/60">
        <div className="flex flex-1 flex-col sm:flex-row gap-2">
          {/* 搜尋 */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="搜尋貨號、品名、條碼 (250ms 防抖)..."
              className="w-full pl-9 pr-8 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
            />
            {searchInput && (
              <button
                onClick={() => setSearchInput('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-white transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* 類別篩選 */}
          {selectedMainType !== 'BLIND_BOX' && (
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-medium cursor-pointer"
            >
              <option value="ALL">
                {selectedMainType === 'GK' ? '全部 GK IP (16大系列)' : '全部類別 (全系列)'}
              </option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          )}

          {/* 頂部全域門市過濾切換器 */}
          <div className="flex items-center bg-slate-900 p-0.5 rounded-xl border border-slate-700 text-xs">
            <button
              onClick={() => setSelectedStoreId('all')}
              className={`px-3 py-1 rounded-lg transition font-medium ${
                selectedStoreId === 'all'
                  ? 'bg-indigo-600 text-white font-bold shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              全門市總體
            </button>
            {stores.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedStoreId(s.id)}
                className={`px-3 py-1 rounded-lg transition font-medium ${
                  selectedStoreId === s.id
                    ? 'bg-indigo-600 text-white font-bold shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>

        {/* 雙軌模式 + 密度切換 */}
        <div className="flex items-center gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-700/60">
          <div className="flex items-center bg-slate-900 p-0.5 rounded-xl border border-slate-700 text-xs">
            <button
              onClick={() => setDensity('compact')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition ${
                density === 'compact'
                  ? 'bg-slate-700 text-white font-bold shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="32px 緊湊行高 (試算表高密度)"
            >
              <Rows className="w-3.5 h-3.5" />
              緊湊 32px
            </button>
            <button
              onClick={() => setDensity('standard')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition ${
                density === 'standard'
                  ? 'bg-slate-700 text-white font-bold shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="44px 標準舒適行高"
            >
              <Layers className="w-3.5 h-3.5" />
              標準 44px
            </button>
          </div>

          <div className="flex items-center bg-slate-900 p-0.5 rounded-xl border border-slate-700 text-xs">
            <button
              onClick={() => setSaveMode('auto')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition ${
                saveMode === 'auto'
                  ? 'bg-emerald-600 text-white font-bold shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="即時存檔: Enter 或點擊他處立即寫入資料庫"
            >
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              即時自動儲存
            </button>
            <button
              onClick={() => setSaveMode('batch')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition ${
                saveMode === 'batch'
                  ? 'bg-amber-600 text-white font-bold shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="批次錄入: 暫存所有修改，按下 Ctrl+S 一鍵批量提交"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-white" />
              批次錄入模式
            </button>
          </div>
        </div>
      </div>

      {/* 批次模式懸浮提交橫條 */}
      {pendingChanges.size > 0 && (
        <div className="sticky top-2 z-50 flex items-center justify-between gap-3 bg-amber-500/15 border-2 border-amber-500/50 backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-2xl animate-fade-in">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
            <span className="text-xs font-bold text-amber-200">
              有 <span className="text-white font-mono text-sm underline">{pendingChanges.size}</span> 筆單元格變更尚未儲存
            </span>
            <span className="hidden sm:inline text-[11px] text-amber-300/80 font-mono">
              (快捷鍵: ⌘S / Ctrl+S)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onDiscardChanges}
              className="flex items-center gap-1 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold rounded-xl border border-slate-600 transition"
            >
              <Undo2 className="w-3.5 h-3.5" />
              全部放棄
            </button>
            <button
              onClick={onBatchSave}
              disabled={batchSaving}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold rounded-xl shadow-lg transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {batchSaving ? '儲存中...' : `立即儲存變更 (${pendingChanges.size})`}
            </button>
          </div>
        </div>
      )}

      {/* 批次儲存通知 Toast */}
      {batchToast && (
        <div
          className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
            batchToast.type === 'success'
              ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
              : 'bg-rose-500/20 border border-rose-500/40 text-rose-300'
          }`}
        >
          {batchToast.type === 'success' ? (
            <Check className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          <span>{batchToast.message}</span>
        </div>
      )}

      {/* 操作提示小語 */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 font-mono">
        <div className="flex items-center gap-3">
          <span>
            💡 鍵盤流:{' '}
            <kbd className="px-1 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
              Tab
            </kbd>{' '}
            下一格
          </span>
          <span>
            <kbd className="px-1 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
              Enter
            </kbd>{' '}
            下一行
          </span>
          <span>
            <kbd className="px-1 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
              Esc
            </kbd>{' '}
            還原
          </span>
          <span>雙擊或打字即可原地編輯</span>
        </div>
        <div>
          <span>凍結狀態: 貨號與品名固定於左側、表頭固定於頂部</span>
        </div>
      </div>
    </div>
  );
};
