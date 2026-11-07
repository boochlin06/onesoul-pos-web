import React, { useState, useEffect } from 'react';
import { Sliders, X, AlertCircle } from 'lucide-react';
import { inventoryApi } from '../../../api/client';
import type { InventoryItem, StoreItem } from '../types.js';

interface StockAdjustModalProps {
  target: InventoryItem | null;
  stores: StoreItem[];
  isSingleStore: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const StockAdjustModal: React.FC<StockAdjustModalProps> = ({
  target,
  stores,
  isSingleStore,
  onClose,
  onSaved,
}) => {
  const [adjustStore, setAdjustStore] = useState('chupei');
  const [adjustDelta, setAdjustDelta] = useState(0);
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustLoading, setAdjustLoading] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  useEffect(() => {
    if (stores.length > 0) {
      setAdjustStore(stores[0].id);
    }
    setAdjustDelta(0);
    setAdjustReason('');
    setAdjustError(null);
  }, [target, stores]);

  if (!target) return null;

  const handleStockAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!adjustReason || adjustReason.trim().length < 2) {
      setAdjustError('請輸入調帳具體原因');
      return;
    }

    setAdjustLoading(true);
    setAdjustError(null);
    try {
      await inventoryApi.adjustStock(
        adjustStore,
        target.id,
        adjustDelta,
        adjustReason.trim()
      );
      onSaved();
      onClose();
    } catch (err: any) {
      setAdjustError(err.message || '庫存調帳失敗');
    } finally {
      setAdjustLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white">
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 mb-4">
          <Sliders className="w-5 h-5 text-amber-400" />
          <h3 className="text-lg font-bold text-white">單品門市庫存調帳</h3>
        </div>
        <div className="bg-slate-900/80 p-3 rounded-xl mb-4 text-xs space-y-1">
          <div className="text-slate-300">
            商品：<span className="text-white font-bold">{target.name}</span>
          </div>
          <div className="text-slate-400 font-mono">
            {stores.map((s) => `${s.name}: ${target.storeStocks?.[s.id] ?? 0}`).join(' | ')}
          </div>
        </div>

        {adjustError && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{adjustError}</span>
          </div>
        )}

        <form onSubmit={handleStockAdjustSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">目標門市</label>
            {isSingleStore ? (
              <div className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-300">
                {stores[0]?.name || '本店'} (單店模式)
              </div>
            ) : (
              <select
                value={adjustStore}
                onChange={(e) => setAdjustStore(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">增減數量 (可正負)</label>
            <input
              type="number"
              value={adjustDelta}
              onChange={(e) => setAdjustDelta(parseInt(e.target.value, 10) || 0)}
              placeholder="例如: +5 或 -2"
              className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">調帳原因</label>
            <input
              type="text"
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              placeholder="例如: 門市陳列破損、實體盤差調整..."
              className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium rounded-xl transition"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={adjustLoading}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl transition disabled:opacity-50"
            >
              {adjustLoading ? '調帳中...' : '確認庫存異動'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
