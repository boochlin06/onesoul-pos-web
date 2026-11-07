import React, { useState, useEffect } from 'react';
import { Plus, X, Sparkles, Store, AlertCircle } from 'lucide-react';
import { inventoryApi } from '../../../api/client';
import type { StoreItem } from '../types.js';

interface CreateProductModalProps {
  isOpen: boolean;
  stores: StoreItem[];
  isSingleStore: boolean;
  categories: string[];
  onClose: () => void;
  onCreated: () => void;
  onRegisterNewCategory: (cat: string) => void;
}

export const CreateProductModal: React.FC<CreateProductModalProps> = ({
  isOpen,
  stores,
  isSingleStore,
  categories,
  onClose,
  onCreated,
  onRegisterNewCategory,
}) => {
  const [createForm, setCreateForm] = useState({
    id: '',
    name: '',
    category: 'GENERAL',
    customCategory: '',
    costPrice: 0,
    sellingPrice: 0,
    suggestedPoints: 0,
    barcode: '',
    safetyStock: 2,
    initialStocks: {} as Record<string, number>,
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const initMap: Record<string, number> = {};
      stores.forEach((s) => {
        initMap[s.id] = 0;
      });
      setCreateForm({
        id: '',
        name: '',
        category: 'GENERAL',
        customCategory: '',
        costPrice: 0,
        sellingPrice: 0,
        suggestedPoints: 0,
        barcode: '',
        safetyStock: 2,
        initialStocks: initMap,
      });
      setCreateError(null);
    }
  }, [isOpen, stores]);

  if (!isOpen) return null;

  const handleGenerateId = () => {
    const cat = createForm.category === 'CUSTOM' ? (createForm.customCategory || 'GEN') : createForm.category;
    const prefix = cat.slice(0, 3).toUpperCase();
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    setCreateForm((prev) => ({ ...prev, id: `${prefix}-${randomSuffix}` }));
  };

  const handleGenerateBarcode = () => {
    const randomDigits = Math.floor(1000000 + Math.random() * 9000000);
    setCreateForm((prev) => ({ ...prev, barcode: `471${randomDigits}` }));
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim()) {
      setCreateError('請填寫商品名稱');
      return;
    }

    const finalCategory = createForm.category === 'CUSTOM'
      ? (createForm.customCategory.trim() || 'GENERAL')
      : createForm.category;

    setCreateLoading(true);
    setCreateError(null);
    try {
      await inventoryApi.createProduct({
        id: createForm.id.trim() || undefined,
        name: createForm.name.trim(),
        category: finalCategory,
        costPrice: createForm.costPrice,
        sellingPrice: createForm.sellingPrice,
        suggestedPoints: createForm.suggestedPoints,
        barcode: createForm.barcode.trim() || undefined,
        safetyStock: createForm.safetyStock,
        initialStocks: createForm.initialStocks,
      });

      onRegisterNewCategory(finalCategory);
      onCreated();
      onClose();
    } catch (err: any) {
      setCreateError(err.message || '新增商品失敗');
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-xl w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 mb-2">
          <Plus className="w-5 h-5 text-emerald-400" />
          <h3 className="text-lg font-bold text-white">新增單品主檔與期初入庫</h3>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          設定商品基礎規格、售價成本，並動態指派各門市初始現貨量。
        </p>

        {createError && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{createError}</span>
          </div>
        )}

        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              商品品名 <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              placeholder="例如: 海賊王 索隆 三千世界 雕像"
              className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-slate-300">商品貨號 (ID)</label>
                <button
                  type="button"
                  onClick={handleGenerateId}
                  className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" />
                  自動產生
                </button>
              </div>
              <input
                type="text"
                value={createForm.id}
                onChange={(e) => setCreateForm({ ...createForm, id: e.target.value })}
                placeholder="留空將自動生成"
                className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-slate-300">商品條碼 (Barcode)</label>
                <button
                  type="button"
                  onClick={handleGenerateBarcode}
                  className="text-[11px] text-indigo-400 hover:underline flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" />
                  產生 471 條碼
                </button>
              </div>
              <input
                type="text"
                value={createForm.barcode}
                onChange={(e) => setCreateForm({ ...createForm, barcode: e.target.value })}
                placeholder="例如: 471000888 (選填)"
                className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">商品類別 (Spinner 選擇)</label>
              <select
                value={createForm.category}
                onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <optgroup label="核心大類">
                  <option value="GENERAL">一般商品 (GENERAL)</option>
                  <option value="GK">GK 雕像 (GK)</option>
                  <option value="FIGURE">景品公仔 (FIGURE)</option>
                  <option value="BLIND_BOX">盒玩盲盒 (BLIND_BOX)</option>
                </optgroup>
                <optgroup label="現存 IP 與分類">
                  {categories.filter((c) => !['GK', 'BLIND_BOX', 'FIGURE', 'GENERAL'].includes(c)).map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </optgroup>
                <option value="CUSTOM" className="text-amber-400 font-bold bg-slate-800">+ 自訂新類別</option>
              </select>
            </div>
            {createForm.category === 'CUSTOM' && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">輸入自訂類別名稱</label>
                <input
                  type="text"
                  value={createForm.customCategory}
                  onChange={(e) => setCreateForm({ ...createForm, customCategory: e.target.value })}
                  placeholder="例如: 咒術迴戰、一番賞..."
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">進貨成本價</label>
              <input
                type="number"
                min="0"
                value={createForm.costPrice}
                onChange={(e) => setCreateForm({ ...createForm, costPrice: parseFloat(e.target.value) || 0 })}
                className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                建議售價 <span className="text-rose-400">*</span>
              </label>
              <input
                type="number"
                min="0"
                value={createForm.sellingPrice}
                onChange={(e) => {
                  const sp = parseFloat(e.target.value) || 0;
                  setCreateForm({
                    ...createForm,
                    sellingPrice: sp,
                    suggestedPoints: Math.round(sp * 0.05),
                  });
                }}
                className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono font-bold text-amber-400 focus:outline-none focus:border-emerald-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">折抵點數 (5%)</label>
              <input
                type="number"
                min="0"
                value={createForm.suggestedPoints}
                onChange={(e) => setCreateForm({ ...createForm, suggestedPoints: parseInt(e.target.value, 10) || 0 })}
                className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono text-slate-300 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-700/60 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5 text-indigo-400" />
                {isSingleStore ? '期初入庫庫存' : '各門市期初入庫數量'}
              </span>
              <div className="flex items-center gap-2">
                <label className="text-[11px] text-slate-400">安全庫存預警值:</label>
                <input
                  type="number"
                  min="0"
                  value={createForm.safetyStock}
                  onChange={(e) => setCreateForm({ ...createForm, safetyStock: parseInt(e.target.value, 10) || 0 })}
                  className="w-16 px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-center text-xs font-mono text-white focus:outline-none"
                />
              </div>
            </div>

            {isSingleStore ? (
              <div>
                <label className="text-[11px] font-medium text-slate-300 mb-1 block">現貨庫存數量</label>
                <input
                  type="number"
                  min="0"
                  value={createForm.initialStocks[stores[0]?.id || 'chupei'] ?? 0}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10) || 0;
                    const targetId = stores[0]?.id || 'chupei';
                    setCreateForm({
                      ...createForm,
                      initialStocks: { ...createForm.initialStocks, [targetId]: val },
                    });
                  }}
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                  placeholder="0"
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {stores.map((s) => (
                  <div key={s.id} className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/50">
                    <div className="text-[11px] font-medium text-slate-300 mb-1">{s.name}</div>
                    <input
                      type="number"
                      min="0"
                      value={createForm.initialStocks[s.id] ?? 0}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10) || 0;
                        setCreateForm({
                          ...createForm,
                          initialStocks: { ...createForm.initialStocks, [s.id]: val },
                        });
                      }}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-center text-white focus:outline-none focus:border-indigo-500"
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>
            )}
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
              disabled={createLoading}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition disabled:opacity-50 shadow"
            >
              {createLoading ? '建立中...' : '確認建立單品主檔'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
