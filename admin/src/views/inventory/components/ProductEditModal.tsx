import React, { useState, useEffect } from 'react';
import { Package, X, AlertCircle } from 'lucide-react';
import { inventoryApi } from '../../../api/client';
import type { InventoryItem } from '../types.js';

interface ProductEditModalProps {
  editProduct: InventoryItem | null;
  categories: string[];
  onClose: () => void;
  onSaved: () => void;
  onRegisterNewCategory: (cat: string) => void;
}

export const ProductEditModal: React.FC<ProductEditModalProps> = ({
  editProduct,
  categories,
  onClose,
  onSaved,
  onRegisterNewCategory,
}) => {
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('GENERAL');
  const [editCustomCategory, setEditCustomCategory] = useState('');
  const [isEditCustomCategory, setIsEditCustomCategory] = useState(false);
  const [sellingPrice, setSellingPrice] = useState(0);
  const [costPrice, setCostPrice] = useState(0);
  const [editSuggestedPoints, setEditSuggestedPoints] = useState(0);
  const [editBarcode, setEditBarcode] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    if (editProduct) {
      setEditName(editProduct.name || '');
      const cat = editProduct.category || 'GENERAL';
      const isKnown = categories.includes(cat);
      setEditCategory(isKnown ? cat : 'CUSTOM');
      setEditCustomCategory(isKnown ? '' : cat);
      setIsEditCustomCategory(!isKnown);
      setSellingPrice(editProduct.sellingPrice || 0);
      setCostPrice(editProduct.costPrice || 0);
      setEditSuggestedPoints(editProduct.suggestedPoints || Math.round((editProduct.sellingPrice || 0) * 0.05));
      setEditBarcode(editProduct.barcode || '');
      setEditError(null);
    }
  }, [editProduct, categories]);

  if (!editProduct) return null;

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const finalCategory = isEditCustomCategory
      ? (editCustomCategory.trim() || 'GENERAL')
      : editCategory;

    setEditLoading(true);
    setEditError(null);
    try {
      await inventoryApi.updateProduct(editProduct.id, {
        name: editName.trim() || editProduct.name,
        category: finalCategory,
        sellingPrice,
        costPrice,
        suggestedPoints: editSuggestedPoints,
        barcode: editBarcode.trim() || undefined,
        version: editProduct.version,
      });
      onRegisterNewCategory(finalCategory);
      onSaved();
      onClose();
    } catch (err: any) {
      setEditError(err.message || '更新商品失敗');
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white">
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 mb-4">
          <Package className="w-5 h-5 text-amber-400" />
          <h3 className="text-lg font-bold text-white">編輯商品主檔</h3>
        </div>
        <div className="bg-slate-900/80 p-3 rounded-xl mb-4 text-xs space-y-1">
          <div className="text-slate-400 font-mono">
            貨號：<span className="text-white font-bold">{editProduct.id}</span> • 樂觀鎖版本：v{editProduct.version}
          </div>
        </div>

        {editError && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{editError}</span>
          </div>
        )}

        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">商品名稱</label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-300 mb-1">商品類別 (Spinner 選擇)</label>
            <select
              value={isEditCustomCategory ? 'CUSTOM' : editCategory}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'CUSTOM') {
                  setIsEditCustomCategory(true);
                } else {
                  setIsEditCustomCategory(false);
                  setEditCategory(val);
                }
              }}
              className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500 cursor-pointer"
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
              <option value="CUSTOM" className="text-amber-400 font-bold bg-slate-800">+ 新增自訂類別...</option>
            </select>

            {isEditCustomCategory && (
              <div className="p-3 bg-amber-950/20 border border-amber-500/30 rounded-xl space-y-1">
                <label className="block text-xs font-medium text-amber-300">輸入自訂類別名稱</label>
                <input
                  type="text"
                  autoFocus
                  value={editCustomCategory}
                  onChange={(e) => setEditCustomCategory(e.target.value)}
                  placeholder="例如: 咒術迴戰、一番賞..."
                  className="w-full px-3.5 py-2 bg-slate-900 border border-amber-500/50 rounded-xl text-sm text-white focus:outline-none focus:border-amber-400"
                  required
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">售價 (NT$)</label>
              <input
                type="number"
                value={sellingPrice}
                onChange={(e) => {
                  const price = parseFloat(e.target.value) || 0;
                  setSellingPrice(price);
                  setEditSuggestedPoints(Math.round(price * 0.05));
                }}
                className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">進貨成本價 (NT$)</label>
              <input
                type="number"
                value={costPrice}
                onChange={(e) => setCostPrice(parseFloat(e.target.value) || 0)}
                className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">建議回饋點數 (5%)</label>
              <input
                type="number"
                value={editSuggestedPoints}
                onChange={(e) => setEditSuggestedPoints(parseInt(e.target.value, 10) || 0)}
                className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">條碼 (Barcode)</label>
              <input
                type="text"
                value={editBarcode}
                onChange={(e) => setEditBarcode(e.target.value)}
                placeholder="可留空或輸入 EAN-13"
                className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>
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
              disabled={editLoading}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl transition disabled:opacity-50 flex items-center gap-1.5 shadow-md"
            >
              {editLoading ? '更新中...' : '確認修改 (版本鎖防衝撞)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
