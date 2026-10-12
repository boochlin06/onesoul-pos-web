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
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  RotateCw,
  Plus,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Store,
  Eye
} from 'lucide-react';

export const InventoryView: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // 多門市動態擴展狀態
  const [stores, setStores] = useState<Array<{ id: string; name: string; code?: string }>>([
    { id: 'chupei', name: '竹北店' },
    { id: 'jinshan', name: '金山店' },
  ]);
  const [visibleStoreIds, setVisibleStoreIds] = useState<string[]>(['chupei', 'jinshan']);
  const [showStorePicker, setShowStorePicker] = useState(false);

  // 排序狀態 (預設: 最新建立優先 createdAt DESC)
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // 伺服器端分頁與統計狀態
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [metaInfo, setMetaInfo] = useState<{ totalProducts: number; lowStockCount: number }>({
    totalProducts: 0,
    lowStockCount: 0,
  });

  // 改價 Modal (含樂觀鎖版本號)
  const [editProduct, setEditProduct] = useState<any | null>(null);
  const [sellingPrice, setSellingPrice] = useState<number>(0);
  const [costPrice, setCostPrice] = useState<number>(0);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // 調庫存 Modal (動態門市)
  const [stockAdjustTarget, setStockAdjustTarget] = useState<any | null>(null);
  const [adjustStore, setAdjustStore] = useState<string>('chupei');
  const [adjustDelta, setAdjustDelta] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<string>('');
  const [adjustLoading, setAdjustLoading] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  // 批量上架精靈 Modal
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkCsvText, setBulkCsvText] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState<any | null>(null);

  // 手動新增單品主檔 Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState<{
    id: string;
    name: string;
    category: string;
    customCategory: string;
    costPrice: number;
    sellingPrice: number;
    suggestedPoints: number;
    barcode: string;
    safetyStock: number;
    initialStocks: Record<string, number>;
  }>({
    id: '',
    name: '',
    category: 'GENERAL',
    customCategory: '',
    costPrice: 0,
    sellingPrice: 0,
    suggestedPoints: 0,
    barcode: '',
    safetyStock: 2,
    initialStocks: {},
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // 250ms 搜尋輸入防抖 (Debounce)
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // 當搜尋條件、分類、缺貨篩選或排序改變時，重置回第 1 頁
  useEffect(() => {
    setPage(1);
  }, [searchTerm, selectedCategory, lowStockOnly, pageSize, sortBy, sortOrder]);

  // 當分頁或條件改變時加載數據
  useEffect(() => {
    loadInventory();
  }, [page, pageSize, searchTerm, selectedCategory, lowStockOnly, sortBy, sortOrder]);

  const loadInventory = async () => {
    setLoading(true);
    try {
      const res = await inventoryApi.summary({
        q: searchTerm || undefined,
        category: selectedCategory !== 'ALL' ? selectedCategory : undefined,
        lowStockOnly,
        page,
        pageSize,
        sortBy,
        sortOrder,
      });
      if (res.success) {
        setItems(res.data);
        if (res.stores && Array.isArray(res.stores) && res.stores.length > 0) {
          setStores(res.stores);
          // 若初次載入或門市變更，同步預設可見門市
          setVisibleStoreIds((prev) => {
            const existingIds = new Set(prev);
            const valid = res.stores.filter((s: any) => existingIds.has(s.id)).map((s: any) => s.id);
            return valid.length > 0 ? valid : res.stores.map((s: any) => s.id);
          });
        }
        if (res.pagination) {
          setTotalItems(res.pagination.total);
          setTotalPages(res.pagination.totalPages || 1);
        } else {
          setTotalItems(res.data.length);
          setTotalPages(1);
        }
        if (res.meta) {
          setMetaInfo({
            totalProducts: res.meta.totalProducts || 0,
            lowStockCount: res.meta.lowStockCount || 0,
          });
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 排序切換處理
  const handleSortToggle = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc'); // 切換新欄位時預設降序
    }
  };

  // 門市顯示切換
  const toggleStoreVisibility = (storeId: string) => {
    if (visibleStoreIds.includes(storeId)) {
      if (visibleStoreIds.length === 1) return; // 至少保留一間門市
      setVisibleStoreIds(visibleStoreIds.filter((id) => id !== storeId));
    } else {
      setVisibleStoreIds([...visibleStoreIds, storeId]);
    }
  };

  // 自動產生貨號
  const handleGenerateId = () => {
    const cat = createForm.category === 'CUSTOM' ? (createForm.customCategory || 'GEN') : createForm.category;
    const prefix = cat.slice(0, 3).toUpperCase();
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    setCreateForm((prev) => ({ ...prev, id: `${prefix}-${randomSuffix}` }));
  };

  // 自動產生 471 標準條碼
  const handleGenerateBarcode = () => {
    const randomDigits = Math.floor(1000000 + Math.random() * 9000000);
    setCreateForm((prev) => ({ ...prev, barcode: `471${randomDigits}` }));
  };

  // 提交新增單品主檔
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

      setShowCreateModal(false);
      // 重設表單
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
        initialStocks: {},
      });
      // 重新整理 (此時排在最前頭)
      setSortBy('createdAt');
      setSortOrder('desc');
      setPage(1);
      loadInventory();
    } catch (err: any) {
      setCreateError(err.message || '新增商品失敗');
    } finally {
      setCreateLoading(false);
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

  // 生成分頁頁碼按鈕序列
  const generatePageNumbers = (current: number, total: number): number[] => {
    if (total <= 7) {
      return Array.from({ length: Math.max(1, total) }, (_, i) => i + 1);
    }
    const pages: number[] = [];
    pages.push(1);
    if (current > 3) {
      pages.push(-1);
    }
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    if (current < total - 2) {
      pages.push(-1);
    }
    pages.push(total);
    return pages;
  };

  return (
    <div className="space-y-6">
      {/* 標題列 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-800/60 p-5 rounded-2xl border border-slate-700/60">
        <div>
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-amber-400" />
            <h1 className="text-xl font-bold text-white">雙門市庫存水平對照與主檔維護</h1>
            {metaInfo.totalProducts > 0 && (
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
                全庫共 {metaInfo.totalProducts.toLocaleString()} 品項
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            竹北店與金山店雙門市水平庫存並排比對、樂觀鎖版本防衝撞改價、Excel 批次上架精靈。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => loadInventory()}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl border border-slate-700 transition"
            title="重新整理庫存"
          >
            <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
          </button>

          {/* 新增單品主檔 */}
          <button
            onClick={() => {
              // 初始化各門市期初庫存字典
              const initMap: Record<string, number> = {};
              stores.forEach((s) => { initMap[s.id] = 0; });
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
              setShowCreateModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-950/30 transition"
          >
            <Plus className="w-4 h-4" />
            新增單品主檔
          </button>

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

      {/* 篩選與門市顯示列 */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="搜尋商品貨號、品名、條碼 (250ms 即時防抖)..."
            className="w-full pl-10 pr-9 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
          />
          {searchInput && (
            <button
              onClick={() => setSearchInput('')}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-white transition"
              title="清除搜尋"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
            <option value="寶可夢">寶可夢</option>
            <option value="海賊王">海賊王</option>
            <option value="七龍珠">七龍珠</option>
            <option value="宮崎駿">宮崎駿</option>
            <option value="灌籃高手">灌籃高手</option>
          </select>

          {/* 門市欄位自訂顯示開關 */}
          <div className="relative">
            <button
              onClick={() => setShowStorePicker(!showStorePicker)}
              className="px-3 py-2 bg-slate-800 border border-slate-700 hover:border-slate-600 rounded-xl text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 transition"
              title="勾選欲顯示的門市欄位"
            >
              <Store className="w-3.5 h-3.5 text-indigo-400" />
              門市欄位 ({visibleStoreIds.length}/{stores.length})
            </button>
            {showStorePicker && (
              <div className="absolute right-0 top-11 w-48 bg-slate-800 border border-slate-700 rounded-xl p-3 shadow-2xl z-40 space-y-2">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  自訂可見門市
                </div>
                {stores.map((s) => (
                  <label
                    key={s.id}
                    className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer hover:text-white"
                  >
                    <input
                      type="checkbox"
                      checked={visibleStoreIds.includes(s.id)}
                      onChange={() => toggleStoreVisibility(s.id)}
                      className="rounded border-slate-700 text-amber-500 focus:ring-0"
                    />
                    <span>{s.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => setLowStockOnly(!lowStockOnly)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 ${
              lowStockOnly
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            僅看缺貨預警
            {metaInfo.lowStockCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                lowStockOnly ? 'bg-amber-400 text-slate-950 font-bold' : 'bg-rose-500/20 text-rose-300'
              }`}>
                {metaInfo.lowStockCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 多門市動態庫存對照表格 */}
      <div className="bg-slate-800/70 border border-slate-700/80 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900/60 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-700">
              <tr>
                <th
                  onClick={() => handleSortToggle('createdAt')}
                  className="py-3 px-4 cursor-pointer hover:text-white transition select-none"
                  title="點擊依建立時間排序 (最新在上)"
                >
                  <div className="flex items-center gap-1.5">
                    <span>貨號 / 建立時間</span>
                    {sortBy === 'createdAt' ? (
                      sortOrder === 'desc' ? <ArrowDown className="w-3.5 h-3.5 text-amber-400" /> : <ArrowUp className="w-3.5 h-3.5 text-amber-400" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-600" />
                    )}
                  </div>
                </th>
                <th className="py-3 px-4">品名</th>
                <th className="py-3 px-4">類別</th>
                <th className="py-3 px-4 text-right">成本價</th>
                <th
                  onClick={() => handleSortToggle('sellingPrice')}
                  className="py-3 px-4 text-right cursor-pointer hover:text-white transition select-none"
                  title="點擊依售價排序"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>建議售價</span>
                    {sortBy === 'sellingPrice' ? (
                      sortOrder === 'desc' ? <ArrowDown className="w-3.5 h-3.5 text-amber-400" /> : <ArrowUp className="w-3.5 h-3.5 text-amber-400" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-600" />
                    )}
                  </div>
                </th>

                {/* 動態渲染已勾選之門市表頭 */}
                {stores.filter((s) => visibleStoreIds.includes(s.id)).map((s, idx) => {
                  const colorThemes = [
                    'bg-blue-950/20 text-blue-300 border-blue-500/20',
                    'bg-amber-950/20 text-amber-300 border-amber-500/20',
                    'bg-emerald-950/20 text-emerald-300 border-emerald-500/20',
                    'bg-purple-950/20 text-purple-300 border-purple-500/20',
                    'bg-cyan-950/20 text-cyan-300 border-cyan-500/20',
                  ];
                  const theme = colorThemes[idx % colorThemes.length];
                  return (
                    <th key={s.id} className={`py-3 px-4 text-center font-bold ${theme}`}>
                      {s.name}庫存
                    </th>
                  );
                })}

                <th
                  onClick={() => handleSortToggle('totalStock')}
                  className="py-3 px-4 text-center cursor-pointer hover:text-white transition select-none"
                  title="點擊依全店合計庫存排序"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span>全店合計</span>
                    {sortBy === 'totalStock' ? (
                      sortOrder === 'desc' ? <ArrowDown className="w-3.5 h-3.5 text-amber-400" /> : <ArrowUp className="w-3.5 h-3.5 text-amber-400" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-600" />
                    )}
                  </div>
                </th>
                <th className="py-3 px-4 text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60 text-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={6 + visibleStoreIds.length} className="py-8 text-center text-slate-500">
                    載入中...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6 + visibleStoreIds.length} className="py-8 text-center text-slate-500">
                    查無商品庫存資料
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const visibleStores = stores.filter((s) => visibleStoreIds.includes(s.id));
                  return (
                    <tr key={item.id} className="hover:bg-slate-750/50 transition">
                      <td className="py-3.5 px-4 font-mono text-xs">
                        <div className="font-semibold text-white">{item.id}</div>
                        {item.barcode && <div className="text-[11px] text-slate-500">{item.barcode}</div>}
                        {item.createdAt && (
                          <div className="text-[10px] text-slate-500">
                            {new Date(item.createdAt).toLocaleDateString()}
                          </div>
                        )}
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

                      {/* 動態渲染各門市庫存 */}
                      {visibleStores.map((s, idx) => {
                        const colorThemes = [
                          { bg: 'bg-blue-950/10', text: 'text-blue-300' },
                          { bg: 'bg-amber-950/10', text: 'text-amber-300' },
                          { bg: 'bg-emerald-950/10', text: 'text-emerald-300' },
                          { bg: 'bg-purple-950/10', text: 'text-purple-300' },
                          { bg: 'bg-cyan-950/10', text: 'text-cyan-300' },
                        ];
                        const theme = colorThemes[idx % colorThemes.length];
                        const qty = item.storeStocks?.[s.id] ?? (s.id === 'chupei' ? item.chupeiStock : s.id === 'jinshan' ? item.jinshanStock : 0) ?? 0;
                        const safety = item.safetyStocks?.[s.id] ?? item.safetyStock ?? 2;
                        const isStoreLow = qty <= safety && safety > 0;
                        return (
                          <td key={s.id} className={`py-3.5 px-4 text-center font-bold font-mono ${theme.bg}`}>
                            <span className={isStoreLow ? 'text-rose-400' : theme.text}>
                              {qty}
                            </span>
                          </td>
                        );
                      })}

                      {/* 全店合計 */}
                      <td className="py-3.5 px-4 text-center font-extrabold text-white">
                        {item.totalStock ?? 0}
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
                              setAdjustStore(stores[0]?.id || 'chupei');
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

      {/* 分頁控制器 Pagination Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-800/60 p-4 rounded-2xl border border-slate-700/60 text-xs">
        <div className="flex items-center gap-3 text-slate-400">
          <span>
            顯示第 <span className="text-white font-mono font-semibold">{totalItems === 0 ? 0 : (page - 1) * pageSize + 1}</span> 至{' '}
            <span className="text-white font-mono font-semibold">{Math.min(page * pageSize, totalItems)}</span> 筆，
            共 <span className="text-amber-400 font-mono font-bold">{totalItems.toLocaleString()}</span> 筆
          </span>
          <span className="text-slate-600">|</span>
          <div className="flex items-center gap-1.5">
            <span>每頁顯示:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-amber-500 font-mono cursor-pointer"
            >
              <option value={20}>20 筆</option>
              <option value={50}>50 筆</option>
              <option value={100}>100 筆</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setPage(1)}
            disabled={page <= 1 || loading}
            className="p-1.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition"
            title="第一頁"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
            className="p-1.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition"
            title="上一頁"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* 頁碼按鈕 */}
          <div className="flex items-center gap-1 px-1">
            {generatePageNumbers(page, totalPages).map((p, idx) =>
              p === -1 ? (
                <span key={`ellipsis-${idx}`} className="px-1 text-slate-500 font-mono">
                  ...
                </span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`min-w-7 h-7 px-1.5 rounded-lg font-mono text-xs font-semibold transition ${
                    p === page
                      ? 'bg-amber-500 text-slate-950 font-bold shadow'
                      : 'bg-slate-800/80 border border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  {p}
                </button>
              )
            )}
          </div>

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || loading}
            className="p-1.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition"
            title="下一頁"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => setPage(totalPages)}
            disabled={page >= totalPages || loading}
            className="p-1.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition"
            title="最後一頁"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
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
                {stores.map((s) => `${s.name}: ${stockAdjustTarget.storeStocks?.[s.id] ?? 0}`).join(' | ')}
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
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
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

      {/* 手動新增單品主檔 Modal (支援多門市期初庫存與一鍵產號) */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-xl w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowCreateModal(false)}
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
              {/* 品名 */}
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

              {/* 貨號與條碼 (支援一鍵自動產號) */}
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

              {/* 類別 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">商品類別</label>
                  <select
                    value={createForm.category}
                    onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="GENERAL">一般商品 (GENERAL)</option>
                    <option value="GK">GK 雕像 (GK)</option>
                    <option value="FIGURE">景品公仔 (FIGURE)</option>
                    <option value="BLIND_BOX">盒玩盲盒 (BLIND_BOX)</option>
                    <option value="寶可夢">寶可夢</option>
                    <option value="海賊王">海賊王</option>
                    <option value="七龍珠">七龍珠</option>
                    <option value="宮崎駿">宮崎駿</option>
                    <option value="灌籃高手">灌籃高手</option>
                    <option value="CUSTOM">+ 自訂新類別</option>
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

              {/* 成本、售價、點數 */}
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

              {/* 動態多門市期初庫存量輸入 */}
              <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-700/60 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5 text-indigo-400" />
                    各門市期初入庫數量
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
              </div>

              {/* 按鈕 */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
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
      )}
    </div>
  );
};
