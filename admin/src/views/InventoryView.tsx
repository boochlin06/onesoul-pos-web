import React, { useEffect, useState } from 'react';
import { inventoryApi, reportsApi } from '../api/client';
import { 
  Package, 
  Search, 
  AlertTriangle, 
  Download, 
  UploadCloud, 
  Edit3, 
  Sliders, 
  X, 
  CheckCircle2, 
  AlertCircle,
  FileSpreadsheet
} from 'lucide-react';

export const InventoryView: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // 改價 Modal (含樂觀鎖版本號)
  const [editProduct, setEditProduct] = useState<any | null>(null);
  const [sellingPrice, setSellingPrice] = useState<number>(0);
  const [costPrice, setCostPrice] = useState<number>(0);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // 調庫存 Modal
  const [stockAdjustTarget, setStockAdjustTarget] = useState<any | null>(null);
  const [adjustStore, setAdjustStore] = useState<'chupei' | 'jinshan'>('chupei');
  const [adjustDelta, setAdjustDelta] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<string>('');
  const [adjustLoading, setAdjustLoading] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  // 批量上架精靈 Modal
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkCsvText, setBulkCsvText] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState<any | null>(null);

  useEffect(() => {
    loadInventory();
  }, [searchTerm, selectedCategory, lowStockOnly]);

  const loadInventory = async () => {
    setLoading(true);
    try {
      const res = await inventoryApi.summary({
        q: searchTerm || undefined,
        category: selectedCategory !== 'ALL' ? selectedCategory : undefined,
        lowStockOnly,
      });
      if (res.success) {
        setItems(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProduct) return;

    setEditLoading(true);
    setEditError(null);
    try {
      await inventoryApi.updateProduct(editProduct.id, {
        sellingPrice,
        costPrice,
        version: editProduct.version, // 樂觀鎖版本驗證
      });
      setEditProduct(null);
      loadInventory();
    } catch (err: any) {
      setEditError(err.message || '更新商品失敗');
    } finally {
      setEditLoading(false);
    }
  };

  const handleStockAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockAdjustTarget) return;

    if (!adjustReason || adjustReason.trim().length < 2) {
      setAdjustError('請輸入調帳具體原因');
      return;
    }

    setAdjustLoading(true);
    setAdjustError(null);
    try {
      await inventoryApi.adjustStock(
        adjustStore,
        stockAdjustTarget.id,
        adjustDelta,
        adjustReason.trim()
      );
      setStockAdjustTarget(null);
      setAdjustDelta(0);
      setAdjustReason('');
      loadInventory();
    } catch (err: any) {
      setAdjustError(err.message || '庫存調帳失敗');
    } finally {
      setAdjustLoading(false);
    }
  };

  const handleBulkImport = async () => {
    if (!bulkCsvText.trim()) return;

    setBulkLoading(true);
    setBulkResult(null);
    try {
      // 解析 CSV 格式: 貨號,品名,成本,售價,數量,安全庫存
      const lines = bulkCsvText.trim().split('\n');
      const parsedItems = [];
      for (const line of lines) {
        const parts = line.split(',').map((p) => p.trim().replace(/^"|"$/g, ''));
        if (parts.length >= 4 && parts[0] && parts[0] !== '貨號' && parts[0] !== 'id') {
          parsedItems.push({
            id: parts[0],
            name: parts[1],
            costPrice: parseFloat(parts[2]) || 0,
            sellingPrice: parseFloat(parts[3]) || 0,
            quantity: parts[4] ? parseInt(parts[4], 10) : 0,
            safetyStock: parts[5] ? parseInt(parts[5], 10) : 2,
          });
        }
      }

      const res = await inventoryApi.bulkImport(parsedItems);
      if (res.success) {
        setBulkResult(res.data);
        loadInventory();
      }
    } catch (err: any) {
      setBulkResult({ error: err.message || '匯入失敗' });
    } finally {
      setBulkLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 標題列 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-800/60 p-5 rounded-2xl border border-slate-700/60">
        <div>
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-amber-400" />
            <h1 className="text-xl font-bold text-white">雙門市庫存水平對照與主檔維護</h1>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            竹北店與金山店雙門市水平庫存並排比對、樂觀鎖版本防衝撞改價、Excel 批次上架精靈。
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setShowBulkModal(true);
              setBulkResult(null);
              setBulkCsvText('');
            }}
            className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow transition"
          >
            <UploadCloud className="w-4 h-4" />
            Excel/CSV 批次上架精靈
          </button>
          <a
            href={reportsApi.getExportUrl('inventory')}
            download
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium rounded-xl border border-slate-600 transition"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            匯出主檔 CSV
          </a>
        </div>
      </div>

      {/* 篩選欄 */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="搜尋商品貨號、品名、條碼..."
            className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-amber-500"
          >
            <option value="ALL">全部類別</option>
            <option value="GK">GK 雕像</option>
            <option value="FIGURE">景品公仔</option>
            <option value="GENERAL">一般商品</option>
            <option value="BLIND_BOX">盒玩盲盒</option>
          </select>

          <button
            onClick={() => setLowStockOnly(!lowStockOnly)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 ${
              lowStockOnly
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            僅看缺貨預警
          </button>
        </div>
      </div>

      {/* 雙門市庫存對照表格 */}
      <div className="bg-slate-800/70 border border-slate-700/80 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900/60 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-700">
              <tr>
                <th className="py-3 px-4">貨號 / 條碼</th>
                <th className="py-3 px-4">品名</th>
                <th className="py-3 px-4">類別</th>
                <th className="py-3 px-4 text-right">成本價</th>
                <th className="py-3 px-4 text-right">建議售價</th>
                <th className="py-3 px-4 text-center bg-blue-950/20 text-blue-300">竹北店庫存</th>
                <th className="py-3 px-4 text-center bg-amber-950/20 text-amber-300">金山店庫存</th>
                <th className="py-3 px-4 text-center">雙店合計</th>
                <th className="py-3 px-4 text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60 text-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    載入中...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    查無商品庫存資料
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const totalStock = (item.chupeiStock || 0) + (item.jinshanStock || 0);
                  return (
                    <tr key={item.id} className="hover:bg-slate-750/50 transition">
                      <td className="py-3.5 px-4 font-mono text-xs">
                        <div className="font-semibold text-white">{item.id}</div>
                        {item.barcode && <div className="text-[11px] text-slate-500">{item.barcode}</div>}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-white max-w-xs truncate">
                        {item.name}
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        <span className="px-2 py-0.5 rounded-md bg-slate-700 text-slate-300">
                          {item.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-400">
                        ${item.costPrice?.toLocaleString() || 0}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-amber-400">
                        ${item.sellingPrice?.toLocaleString() || 0}
                      </td>
                      {/* 竹北店庫存 */}
                      <td className="py-3.5 px-4 text-center bg-blue-950/10 font-bold font-mono">
                        <span className={item.chupeiStock <= (item.safetyStock || 1) ? 'text-rose-400' : 'text-blue-300'}>
                          {item.chupeiStock ?? 0}
                        </span>
                      </td>
                      {/* 金山店庫存 */}
                      <td className="py-3.5 px-4 text-center bg-amber-950/10 font-bold font-mono">
                        <span className={item.jinshanStock <= (item.safetyStock || 1) ? 'text-rose-400' : 'text-amber-300'}>
                          {item.jinshanStock ?? 0}
                        </span>
                      </td>
                      {/* 雙店合計 */}
                      <td className="py-3.5 px-4 text-center font-extrabold text-white">
                        {totalStock}
                        {item.isLowStock && (
                          <span className="ml-1.5 inline-block text-[10px] px-1.5 py-0.2 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded">
                            低量
                          </span>
                        )}
                      </td>
                      {/* 操作按鈕 */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => {
                              setEditProduct(item);
                              setSellingPrice(item.sellingPrice || 0);
                              setCostPrice(item.costPrice || 0);
                              setEditError(null);
                            }}
                            className="p-1.5 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition"
                            title="修改價格與主檔"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setStockAdjustTarget(item);
                              setAdjustStore('chupei');
                              setAdjustDelta(0);
                              setAdjustReason('');
                              setAdjustError(null);
                            }}
                            className="p-1.5 hover:bg-slate-700 text-amber-400 hover:text-amber-300 rounded-lg transition"
                            title="手動調撥/盤差調帳"
                          >
                            <Sliders className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 修改價格 Modal (樂觀鎖版本號) */}
      {editProduct && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button onClick={() => setEditProduct(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 mb-4">
              <Edit3 className="w-5 h-5 text-amber-400" />
              <h3 className="text-lg font-bold text-white">商品主檔改價</h3>
            </div>
            <div className="bg-slate-900/80 p-3 rounded-xl mb-4 text-xs space-y-1">
              <div className="text-slate-300">商品：<span className="text-white font-bold">{editProduct.name}</span></div>
              <div className="text-slate-400 font-mono">貨號：{editProduct.id} • 樂觀鎖版本：v{editProduct.version}</div>
            </div>

            {editError && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">售價 (NT$)</label>
                <input
                  type="number"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(parseFloat(e.target.value) || 0)}
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
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditProduct(null)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium rounded-xl transition"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl transition disabled:opacity-50"
                >
                  {editLoading ? '更新中...' : '確認修改 (版本鎖防衝撞)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 單品調帳 Modal */}
      {stockAdjustTarget && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button onClick={() => setStockAdjustTarget(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 mb-4">
              <Sliders className="w-5 h-5 text-amber-400" />
              <h3 className="text-lg font-bold text-white">單品門市庫存調帳</h3>
            </div>
            <div className="bg-slate-900/80 p-3 rounded-xl mb-4 text-xs space-y-1">
              <div className="text-slate-300">商品：<span className="text-white font-bold">{stockAdjustTarget.name}</span></div>
              <div className="text-slate-400 font-mono">
                竹北庫存: {stockAdjustTarget.chupeiStock ?? 0} | 金山庫存: {stockAdjustTarget.jinshanStock ?? 0}
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
                <select
                  value={adjustStore}
                  onChange={(e: any) => setAdjustStore(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="chupei">竹北門市</option>
                  <option value="jinshan">金山門市</option>
                </select>
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
                  onClick={() => setStockAdjustTarget(null)}
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
      )}

      {/* 批量上架精靈 Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-xl w-full p-6 shadow-2xl relative">
            <button onClick={() => setShowBulkModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 mb-2">
              <FileSpreadsheet className="w-5 h-5 text-indigo-400" />
              <h3 className="text-lg font-bold text-white">Excel / CSV 批次上架入庫精靈</h3>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              支援從 Excel 複製貼上。欄位順序：<span className="text-amber-400 font-mono">貨號,品名,成本,售價,初始入庫量,安全庫存</span>
            </p>

            <textarea
              rows={8}
              value={bulkCsvText}
              onChange={(e) => setBulkCsvText(e.target.value)}
              placeholder="例：&#10;GK101,航海王艾斯,5000,9800,2,1&#10;FIG202,七龍珠悟飯,400,850,10,3"
              className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl font-mono text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 mb-3"
            />

            {bulkResult && (
              <div className={`p-3 rounded-xl text-xs mb-3 ${bulkResult.error ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                {bulkResult.error ? bulkResult.error : `✅ 批量入庫成功！共建立 ${bulkResult.successCount} 項商品。`}
              </div>
            )}

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={() => setBulkCsvText("GK101,航海王艾斯 雕像,5000,9800,2,1\nFIG202,七龍珠 超賽悟飯,400,850,10,3")}
                className="text-xs text-indigo-400 hover:underline"
              >
                帶入範例資料
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium rounded-xl"
                >
                  關閉
                </button>
                <button
                  type="button"
                  onClick={handleBulkImport}
                  disabled={bulkLoading || !bulkCsvText.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl disabled:opacity-50 shadow"
                >
                  {bulkLoading ? '解析入庫中...' : '開始批次解析上架'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
