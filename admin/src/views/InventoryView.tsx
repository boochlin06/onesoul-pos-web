import React, { useEffect, useState, useCallback } from 'react';
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
  Zap,
  Save,
  Undo2,
  Check,
  CornerDownLeft,
  Rows,
  Layers
} from 'lucide-react';

interface PendingCellChange {
  type: 'product' | 'stock';
  productId: string;
  storeId?: string;
  field: string;
  originalValue: any;
  currentValue: any;
}

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

  // ── Google Sheet 試算表核心體驗狀態 ────────────────────────────
  // 雙軌模式: 'auto' (Enter/失焦立即自動儲存) | 'batch' (批次暫存手動/Ctrl+S送出)
  const [saveMode, setSaveMode] = useState<'auto' | 'batch'>('auto');
  // 行高密度: 'compact' (32px 試算表高密度) | 'standard' (44px 標準舒適)
  const [density, setDensity] = useState<'compact' | 'standard'>('compact');

  // 當前選取與編輯單元格焦點
  const [activeCell, setActiveCell] = useState<{ rowId: string; colId: string } | null>(null);
  const [editingCell, setEditingCell] = useState<{ rowId: string; colId: string; value: any } | null>(null);

  // 單元格儲存狀態反饋微閃 (key: `${rowId}_${colId}`)
  const [cellFeedback, setCellFeedback] = useState<Record<string, { status: 'saving' | 'saved' | 'error'; message?: string }>>({});

  // 批次暫存變更集合 (key: `${rowId}_${colId}`)
  const [pendingChanges, setPendingChanges] = useState<Map<string, PendingCellChange>>(new Map());
  const [batchSaving, setBatchSaving] = useState(false);
  const [batchToast, setBatchToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // 改價 Modal (含樂觀鎖版本號，作為進階輔助視窗)
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

  // ── 試算表可導航欄位定義 ──────────────────────────────────────
  const getNavigableColIds = useCallback(() => {
    const cols = ['name', 'category', 'costPrice', 'sellingPrice', 'suggestedPoints'];
    const visibleStores = stores.filter((s) => visibleStoreIds.includes(s.id));
    visibleStores.forEach((s) => {
      cols.push(`store_${s.id}`);
    });
    cols.push('safetyStock');
    return cols;
  }, [stores, visibleStoreIds]);

  // 取得單元格即時數值
  const getCellValue = (item: any, colId: string) => {
    if (colId.startsWith('store_')) {
      const storeId = colId.replace('store_', '');
      return item.storeStocks?.[storeId] ?? (storeId === 'chupei' ? item.chupeiStock : storeId === 'jinshan' ? item.jinshanStock : 0) ?? 0;
    }
    return item[colId] ?? '';
  };

  // ── 單元格送出與即時公式連動 ────────────────────────────────────
  const handleCellCommit = async (rowId: string, colId: string, inputVal: any) => {
    const item = items.find((i) => i.id === rowId);
    if (!item) return;

    const oldValue = getCellValue(item, colId);
    const isNumeric = ['costPrice', 'sellingPrice', 'suggestedPoints', 'safetyStock'].includes(colId) || colId.startsWith('store_');
    let parsedNew = inputVal;
    if (isNumeric) {
      parsedNew = Number(inputVal);
      if (isNaN(parsedNew)) parsedNew = 0;
    } else {
      parsedNew = String(inputVal || '').trim();
    }

    if (parsedNew === oldValue) {
      setEditingCell(null);
      return;
    }

    // 1. 前端樂觀更新 + 即時公式計算連動
    setItems((prevItems) =>
      prevItems.map((prod) => {
        if (prod.id !== rowId) return prod;
        const updated = { ...prod };
        if (colId.startsWith('store_')) {
          const storeId = colId.replace('store_', '');
          const newStocks = { ...(prod.storeStocks || {}), [storeId]: parsedNew };
          updated.storeStocks = newStocks;
          if (storeId === 'chupei') updated.chupeiStock = parsedNew;
          if (storeId === 'jinshan') updated.jinshanStock = parsedNew;
          // 動態重算合計庫存
          updated.totalStock = Object.values(newStocks).reduce((a: number, b: any) => a + (Number(b) || 0), 0);
          updated.isLowStock = updated.totalStock <= (updated.safetyStock || 2);
        } else {
          updated[colId] = parsedNew;
          // 修改售價自動連動 5% 點數回饋
          if (colId === 'sellingPrice') {
            updated.suggestedPoints = Math.round(parsedNew * 0.05);
          }
        }
        return updated;
      })
    );

    const cellKey = `${rowId}_${colId}`;
    setEditingCell(null);

    // 2. 批次錄入模式：寫入 pendingChanges
    if (saveMode === 'batch') {
      setPendingChanges((prev) => {
        const next = new Map(prev);
        const isStock = colId.startsWith('store_');
        const storeId = isStock ? colId.replace('store_', '') : undefined;
        const existingChange = next.get(cellKey);
        const originalVal = existingChange ? existingChange.originalValue : oldValue;

        if (parsedNew === originalVal) {
          next.delete(cellKey);
        } else {
          next.set(cellKey, {
            type: isStock ? 'stock' : 'product',
            productId: rowId,
            storeId,
            field: isStock ? storeId! : colId,
            originalValue: originalVal,
            currentValue: parsedNew,
          });
        }
        return next;
      });
      return;
    }

    // 3. 即時自動存檔模式：直接發送 API 並給予微閃反饋
    setCellFeedback((prev) => ({ ...prev, [cellKey]: { status: 'saving' } }));
    try {
      if (colId.startsWith('store_')) {
        const storeId = colId.replace('store_', '');
        await inventoryApi.adjustStock(
          storeId,
          rowId,
          0,
          '試算表原地儲存格快速調帳',
          parsedNew
        );
      } else {
        const payload: any = {
          [colId]: parsedNew,
          version: item.version,
        };
        if (colId === 'sellingPrice') {
          payload.suggestedPoints = Math.round(parsedNew * 0.05);
        }
        await inventoryApi.updateProduct(rowId, payload);
      }

      // 儲存成功：綠光微閃
      setCellFeedback((prev) => ({ ...prev, [cellKey]: { status: 'saved' } }));
      setTimeout(() => {
        setCellFeedback((prev) => {
          const c = { ...prev };
          delete c[cellKey];
          return c;
        });
      }, 1200);
    } catch (err: any) {
      console.error(err);
      // 復原資料
      setItems((prevItems) =>
        prevItems.map((prod) => (prod.id === rowId ? item : prod))
      );
      setCellFeedback((prev) => ({
        ...prev,
        [cellKey]: { status: 'error', message: err.message || '儲存失敗' },
      }));
    }
  };

  // ── 全套鍵盤流快捷導航 (Tab/Enter/Esc) ─────────────────────────
  const handleCellKeyDown = (e: React.KeyboardEvent, rowId: string, colId: string) => {
    const navigableCols = getNavigableColIds();
    const currentColIdx = navigableCols.indexOf(colId);
    const currentRowIdx = items.findIndex((i) => i.id === rowId);

    if (e.key === 'Enter') {
      e.preventDefault();
      const currentVal = editingCell?.value;
      handleCellCommit(rowId, colId, currentVal);

      // 移動到下一列相同欄位 (Shift+Enter 往上)
      const targetRowIdx = e.shiftKey ? currentRowIdx - 1 : currentRowIdx + 1;
      if (targetRowIdx >= 0 && targetRowIdx < items.length) {
        const nextItem = items[targetRowIdx];
        setActiveCell({ rowId: nextItem.id, colId });
        setEditingCell({ rowId: nextItem.id, colId, value: getCellValue(nextItem, colId) });
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const currentVal = editingCell?.value;
      handleCellCommit(rowId, colId, currentVal);

      // 移動到下一欄 (Shift+Tab 往上一欄)
      if (e.shiftKey) {
        if (currentColIdx > 0) {
          const prevCol = navigableCols[currentColIdx - 1];
          setActiveCell({ rowId, colId: prevCol });
          setEditingCell({ rowId, colId: prevCol, value: getCellValue(items[currentRowIdx], prevCol) });
        } else if (currentRowIdx > 0) {
          const prevCol = navigableCols[navigableCols.length - 1];
          const prevItem = items[currentRowIdx - 1];
          setActiveCell({ rowId: prevItem.id, colId: prevCol });
          setEditingCell({ rowId: prevItem.id, colId: prevCol, value: getCellValue(prevItem, prevCol) });
        }
      } else {
        if (currentColIdx < navigableCols.length - 1) {
          const nextCol = navigableCols[currentColIdx + 1];
          setActiveCell({ rowId, colId: nextCol });
          setEditingCell({ rowId, colId: nextCol, value: getCellValue(items[currentRowIdx], nextCol) });
        } else if (currentRowIdx < items.length - 1) {
          const nextCol = navigableCols[0];
          const nextItem = items[currentRowIdx + 1];
          setActiveCell({ rowId: nextItem.id, colId: nextCol });
          setEditingCell({ rowId: nextItem.id, colId: nextCol, value: getCellValue(nextItem, nextCol) });
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditingCell(null);
    }
  };

  // ── 全域快捷鍵監聽 (Ctrl+S / Cmd+S 批次儲存) ───────────────────
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (pendingChanges.size > 0 && !batchSaving) {
          handleBatchSave();
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [pendingChanges, batchSaving]);

  // ── 批次儲存提交 (Batch Save) ──────────────────────────────────
  const handleBatchSave = async () => {
    if (pendingChanges.size === 0 || batchSaving) return;

    setBatchSaving(true);
    setBatchToast(null);

    const productMap = new Map<string, any>();
    const stockAdjustments: Array<{ productId: string; storeId: string; newQuantity: number; reason: string }> = [];

    pendingChanges.forEach((change) => {
      if (change.type === 'product') {
        const prodData = productMap.get(change.productId) || { id: change.productId };
        prodData[change.field] = change.currentValue;
        if (change.field === 'sellingPrice') {
          prodData.suggestedPoints = Math.round(Number(change.currentValue) * 0.05);
        }
        productMap.set(change.productId, prodData);
      } else if (change.type === 'stock' && change.storeId) {
        stockAdjustments.push({
          productId: change.productId,
          storeId: change.storeId,
          newQuantity: Number(change.currentValue),
          reason: '試算表批次原地更新庫存',
        });
      }
    });

    const productUpdates = Array.from(productMap.values());

    try {
      const res = await inventoryApi.batchUpdate({
        productUpdates,
        stockAdjustments,
      });

      if (res.success) {
        setBatchToast({
          type: 'success',
          message: `✅ 批次更新成功！已儲存 ${productUpdates.length} 筆商品主檔與 ${stockAdjustments.length} 筆庫存紀錄。`,
        });
        setPendingChanges(new Map());
        loadInventory();
        setTimeout(() => setBatchToast(null), 3500);
      }
    } catch (err: any) {
      setBatchToast({
        type: 'error',
        message: err.message || '批次更新失敗，請檢查資料',
      });
    } finally {
      setBatchSaving(false);
    }
  };

  // 放棄所有暫存變更
  const handleDiscardChanges = () => {
    if (pendingChanges.size === 0) return;
    if (!window.confirm(`確定要放棄目前未儲存的 ${pendingChanges.size} 筆暫存變更嗎？`)) return;

    setItems((prevItems) => {
      return prevItems.map((prod) => {
        let updated = { ...prod };
        pendingChanges.forEach((change) => {
          if (change.productId === prod.id) {
            if (change.type === 'product') {
              updated[change.field] = change.originalValue;
            } else if (change.type === 'stock' && change.storeId) {
              const newStocks = { ...(updated.storeStocks || {}), [change.storeId]: change.originalValue };
              updated.storeStocks = newStocks;
              updated.totalStock = Object.values(newStocks).reduce((a: number, b: any) => a + (Number(b) || 0), 0);
            }
          }
        });
        return updated;
      });
    });

    setPendingChanges(new Map());
    setBatchToast({ type: 'success', message: '已還原所有暫存變更' });
    setTimeout(() => setBatchToast(null), 2000);
  };

  // 排序切換處理
  const handleSortToggle = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  // 門市顯示切換
  const toggleStoreVisibility = (storeId: string) => {
    if (visibleStoreIds.includes(storeId)) {
      if (visibleStoreIds.length === 1) return;
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
        version: editProduct.version,
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

  // 生成分頁頁碼
  const generatePageNumbers = (current: number, total: number): number[] => {
    if (total <= 7) {
      return Array.from({ length: Math.max(1, total) }, (_, i) => i + 1);
    }
    const pages: number[] = [];
    pages.push(1);
    if (current > 3) pages.push(-1);
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (current < total - 2) pages.push(-1);
    pages.push(total);
    return pages;
  };

  // 緊湊/標準樣式輔助變數
  const isCompact = density === 'compact';
  const rowHeightClass = isCompact ? 'h-8 text-xs' : 'h-11 text-sm';
  const cellPaddingClass = isCompact ? 'px-2.5 py-0.5' : 'px-3 py-2';

  // 渲染可原地編輯之單元格
  const renderEditableCell = (
    item: any,
    colId: string,
    align: 'left' | 'center' | 'right' = 'left',
    formatValue?: (val: any) => string | React.ReactNode,
    customClass = ''
  ) => {
    const rawVal = getCellValue(item, colId);
    const cellKey = `${item.id}_${colId}`;
    const isEditing = editingCell?.rowId === item.id && editingCell?.colId === colId;
    const isActive = activeCell?.rowId === item.id && activeCell?.colId === colId;
    const isPending = pendingChanges.has(cellKey);
    const feedback = cellFeedback[cellKey];

    // 動態狀態樣式
    let stateStyles = 'border-b border-r border-slate-800/80 hover:bg-slate-750/70 transition-colors';
    if (isEditing) {
      stateStyles = 'ring-2 ring-blue-400 bg-slate-900 z-10 relative';
    } else if (feedback?.status === 'saving') {
      stateStyles = 'ring-2 ring-cyan-500 bg-cyan-950/30 text-cyan-200 animate-pulse z-10 relative';
    } else if (feedback?.status === 'saved') {
      stateStyles = 'ring-2 ring-emerald-400 bg-emerald-950/40 text-emerald-300 transition-all duration-700 z-10 relative';
    } else if (feedback?.status === 'error') {
      stateStyles = 'ring-2 ring-rose-500 bg-rose-950/40 text-rose-300 z-10 relative';
    } else if (isPending) {
      stateStyles = 'bg-amber-950/25 border-b border-r border-amber-600/40 text-amber-200 relative';
    } else if (isActive) {
      stateStyles = 'ring-2 ring-blue-500 bg-blue-950/30 z-10 relative';
    }

    return (
      <td
        key={colId}
        onClick={() => {
          setActiveCell({ rowId: item.id, colId });
        }}
        onDoubleClick={() => {
          setActiveCell({ rowId: item.id, colId });
          setEditingCell({ rowId: item.id, colId, value: rawVal });
        }}
        className={`${cellPaddingClass} ${rowHeightClass} ${stateStyles} ${customClass} cursor-text select-none text-${align}`}
      >
        {isEditing ? (
          <input
            type={['costPrice', 'sellingPrice', 'suggestedPoints', 'safetyStock'].includes(colId) || colId.startsWith('store_') ? 'number' : 'text'}
            autoFocus
            value={editingCell.value}
            onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
            onBlur={() => handleCellCommit(item.id, colId, editingCell.value)}
            onKeyDown={(e) => handleCellKeyDown(e, item.id, colId)}
            onFocus={(e) => e.target.select()}
            className="w-full h-full bg-transparent text-white font-mono outline-none px-0.5 border-none"
          />
        ) : (
          <div className="flex items-center justify-between w-full h-full gap-1">
            <span className="truncate w-full">
              {formatValue ? formatValue(rawVal) : rawVal}
            </span>
            {/* 批次模式黃色角標 */}
            {isPending && (
              <span 
                className="w-2 h-2 rounded-full bg-amber-400 shrink-0 ml-1 shadow-sm shadow-amber-400/50" 
                title="已暫存修改 (待提交)"
              />
            )}
          </div>
        )}
      </td>
    );
  };

  return (
    <div className="space-y-4">
      {/* 頂部標題與主操作列 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-800/80 p-4 rounded-2xl border border-slate-700/80 shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-amber-400" />
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              試算表級庫存工作台
              <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                Google Sheets UX
              </span>
            </h1>
            {metaInfo.totalProducts > 0 && (
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
                全庫共 {metaInfo.totalProducts.toLocaleString()} 品項
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            雙向凍結窗格、單元格原地打字輸入、雙軌自動/批次儲存 (Ctrl+S)、即時公式連動。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => loadInventory()}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition"
            title="重新載入庫存"
          >
            <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
          </button>

          <button
            onClick={() => {
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
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow transition"
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
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow transition"
          >
            <UploadCloud className="w-4 h-4" />
            批次上架精靈
          </button>

          <a
            href={reportsApi.getExportUrl('inventory')}
            download
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium rounded-xl border border-slate-600 transition"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            匯出 CSV
          </a>
        </div>
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

          {/* 分類篩選 */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-amber-500"
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

          {/* 門市欄位挑選器 */}
          <div className="relative">
            <button
              onClick={() => setShowStorePicker(!showStorePicker)}
              className="px-2.5 py-1.5 bg-slate-900 border border-slate-700 hover:border-slate-600 rounded-xl text-xs text-slate-300 hover:text-white flex items-center gap-1.5 transition"
            >
              <Store className="w-3.5 h-3.5 text-indigo-400" />
              門市 ({visibleStoreIds.length}/{stores.length})
            </button>
            {showStorePicker && (
              <div className="absolute left-0 top-10 w-44 bg-slate-800 border border-slate-700 rounded-xl p-2.5 shadow-2xl z-50 space-y-1.5">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  自訂可見門市欄位
                </div>
                {stores.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer hover:text-white">
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

          {/* 缺貨預警 */}
          <button
            onClick={() => setLowStockOnly(!lowStockOnly)}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 ${
              lowStockOnly
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow'
                : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            缺貨預警
            {metaInfo.lowStockCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                lowStockOnly ? 'bg-amber-400 text-slate-950 font-bold' : 'bg-rose-500/20 text-rose-300'
              }`}>
                {metaInfo.lowStockCount}
              </span>
            )}
          </button>
        </div>

        {/* 試算表核心切換開關 (雙軌模式 + 緊湊密度) */}
        <div className="flex items-center gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-700/60">
          {/* 行高密度切換 */}
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

          {/* 雙軌存檔模式切換 */}
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

      {/* 批次模式懸浮提交橫條 (當有待儲存變更時亮起) */}
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
              onClick={handleDiscardChanges}
              className="flex items-center gap-1 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold rounded-xl border border-slate-600 transition"
            >
              <Undo2 className="w-3.5 h-3.5" />
              全部放棄
            </button>
            <button
              onClick={handleBatchSave}
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
        <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
          batchToast.type === 'success' 
            ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300' 
            : 'bg-rose-500/20 border border-rose-500/40 text-rose-300'
        }`}>
          {batchToast.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{batchToast.message}</span>
        </div>
      )}

      {/* 操作提示小語 */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 font-mono">
        <div className="flex items-center gap-3">
          <span>💡 鍵盤流: <kbd className="px-1 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">Tab</kbd> 下一格</span>
          <span><kbd className="px-1 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">Enter</kbd> 下一行</span>
          <span><kbd className="px-1 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">Esc</kbd> 還原</span>
          <span>雙擊或打字即可原地編輯</span>
        </div>
        <div>
          <span>凍結狀態: 貨號與品名固定於左側、表頭固定於頂部</span>
        </div>
      </div>

      {/* ── Google Sheet 旗艦雙向凍結表格 ────────────────────────── */}
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl overflow-hidden shadow-2xl relative">
        <div className="overflow-auto max-h-[calc(100vh-320px)] relative">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-30 bg-slate-900 border-b border-slate-700 shadow-sm text-slate-300 text-xs font-semibold select-none">
              <tr className={rowHeightClass}>
                {/* 凍結欄 1: 貨號 (Sticky Top + Sticky Left: Z-40) */}
                <th
                  onClick={() => handleSortToggle('createdAt')}
                  className="sticky left-0 top-0 z-40 bg-slate-900 border-r border-b border-slate-700/80 min-w-[130px] w-[130px] px-3 py-2 cursor-pointer hover:text-white transition"
                  title="點擊依建立時間排序"
                >
                  <div className="flex items-center gap-1">
                    <span>貨號 / 條碼</span>
                    {sortBy === 'createdAt' ? (
                      sortOrder === 'desc' ? <ArrowDown className="w-3 h-3 text-amber-400" /> : <ArrowUp className="w-3 h-3 text-amber-400" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-600" />
                    )}
                  </div>
                </th>

                {/* 凍結欄 2: 品名 (Sticky Top + Sticky Left: Z-40 加上陰影區隔) */}
                <th 
                  onClick={() => handleSortToggle('name')}
                  className="sticky left-[130px] top-0 z-40 bg-slate-900 border-r border-b border-slate-700/80 shadow-[4px_0_8px_rgba(0,0,0,0.35)] min-w-[200px] w-[200px] px-3 py-2 cursor-pointer hover:text-white transition"
                  title="點擊依品名排序"
                >
                  <div className="flex items-center gap-1">
                    <span>商品名稱</span>
                    {sortBy === 'name' ? (
                      sortOrder === 'desc' ? <ArrowDown className="w-3 h-3 text-amber-400" /> : <ArrowUp className="w-3 h-3 text-amber-400" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-600" />
                    )}
                  </div>
                </th>

                {/* 右側一般滑動欄位 */}
                <th className="min-w-[90px] w-[90px] px-3 py-2 border-r border-b border-slate-700/80">類別</th>

                <th className="min-w-[95px] w-[95px] px-3 py-2 text-right border-r border-b border-slate-700/80">
                  成本 (NT$)
                </th>

                <th
                  onClick={() => handleSortToggle('sellingPrice')}
                  className="min-w-[95px] w-[95px] px-3 py-2 text-right cursor-pointer hover:text-white transition border-r border-b border-slate-700/80"
                  title="點擊依售價排序"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>售價</span>
                    {sortBy === 'sellingPrice' ? (
                      sortOrder === 'desc' ? <ArrowDown className="w-3 h-3 text-amber-400" /> : <ArrowUp className="w-3 h-3 text-amber-400" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-600" />
                    )}
                  </div>
                </th>

                <th className="min-w-[90px] w-[90px] px-3 py-2 text-right border-r border-b border-slate-700/80" title="售價之 5% 自動連動回饋點數">
                  點數 (5%)
                </th>

                {/* 動態多門市現貨欄位 */}
                {stores.filter((s) => visibleStoreIds.includes(s.id)).map((s, idx) => {
                  const headerStyles = [
                    'bg-blue-950/40 text-blue-200 border-blue-500/20',
                    'bg-amber-950/40 text-amber-200 border-amber-500/20',
                    'bg-emerald-950/40 text-emerald-200 border-emerald-500/20',
                    'bg-purple-950/40 text-purple-200 border-purple-500/20',
                    'bg-cyan-950/40 text-cyan-200 border-cyan-500/20',
                  ];
                  const theme = headerStyles[idx % headerStyles.length];
                  return (
                    <th key={s.id} className={`min-w-[100px] w-[100px] px-3 py-2 text-center font-bold border-r border-b border-slate-700/80 ${theme}`}>
                      {s.name}現貨
                    </th>
                  );
                })}

                <th
                  onClick={() => handleSortToggle('totalStock')}
                  className="min-w-[95px] w-[95px] px-3 py-2 text-center cursor-pointer hover:text-white transition border-r border-b border-slate-700/80"
                  title="所有門市庫存自動合計公式"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>全店合計</span>
                    {sortBy === 'totalStock' ? (
                      sortOrder === 'desc' ? <ArrowDown className="w-3 h-3 text-amber-400" /> : <ArrowUp className="w-3 h-3 text-amber-400" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-600" />
                    )}
                  </div>
                </th>

                <th className="min-w-[90px] w-[90px] px-3 py-2 text-center border-r border-b border-slate-700/80">
                  安全門檻
                </th>

                <th className="min-w-[80px] w-[80px] px-2 py-2 text-center border-b border-slate-700/80">
                  更多
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800 text-slate-200 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={8 + visibleStoreIds.length} className="py-12 text-center text-slate-500">
                    <RotateCw className="w-5 h-5 animate-spin mx-auto text-amber-400 mb-2" />
                    資料載入中...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8 + visibleStoreIds.length} className="py-12 text-center text-slate-500">
                    查無符合條件之商品庫存
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const visibleStores = stores.filter((s) => visibleStoreIds.includes(s.id));
                  return (
                    <tr key={item.id} className="hover:bg-slate-800/40 transition">
                      {/* 凍結欄 1: 貨號 / 條碼 (Sticky Left: Z-20) */}
                      <td className={`sticky left-0 z-20 bg-slate-900 border-r border-b border-slate-800 min-w-[130px] w-[130px] ${cellPaddingClass} ${rowHeightClass}`}>
                        <div className="font-semibold text-white truncate" title={item.id}>
                          {item.id}
                        </div>
                        {item.barcode && (
                          <div className="text-[10px] text-slate-500 truncate" title={item.barcode}>
                            {item.barcode}
                          </div>
                        )}
                      </td>

                      {/* 凍結欄 2: 品名 (Sticky Left: Z-20 加上陰影) */}
                      <td 
                        onClick={() => setActiveCell({ rowId: item.id, colId: 'name' })}
                        onDoubleClick={() => {
                          setActiveCell({ rowId: item.id, colId: 'name' });
                          setEditingCell({ rowId: item.id, colId: 'name', value: item.name });
                        }}
                        className={`sticky left-[130px] z-20 bg-slate-900 border-r border-b border-slate-800 shadow-[4px_0_8px_rgba(0,0,0,0.35)] min-w-[200px] w-[200px] ${cellPaddingClass} ${rowHeightClass} ${
                          activeCell?.rowId === item.id && activeCell?.colId === 'name' ? 'ring-2 ring-blue-500' : ''
                        }`}
                      >
                        {editingCell?.rowId === item.id && editingCell?.colId === 'name' ? (
                          <input
                            type="text"
                            autoFocus
                            value={editingCell.value}
                            onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                            onBlur={() => handleCellCommit(item.id, 'name', editingCell.value)}
                            onKeyDown={(e) => handleCellKeyDown(e, item.id, 'name')}
                            onFocus={(e) => e.target.select()}
                            className="w-full bg-slate-800 text-white px-1 py-0.5 rounded outline-none border border-blue-400"
                          />
                        ) : (
                          <div className="truncate text-white font-sans font-medium" title={item.name}>
                            {item.name}
                          </div>
                        )}
                      </td>

                      {/* 類別 */}
                      {renderEditableCell(item, 'category', 'left', (val) => (
                        <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 text-[11px]">
                          {val || '未分類'}
                        </span>
                      ))}

                      {/* 成本價 */}
                      {renderEditableCell(item, 'costPrice', 'right', (val) => `$${Number(val || 0).toLocaleString()}`, 'text-slate-400')}

                      {/* 售價 */}
                      {renderEditableCell(item, 'sellingPrice', 'right', (val) => `$${Number(val || 0).toLocaleString()}`, 'font-bold text-amber-400')}

                      {/* 點數 (5%) */}
                      {renderEditableCell(item, 'suggestedPoints', 'right', (val) => `${Number(val || 0)} pt`, 'text-indigo-300')}

                      {/* 動態多門市現貨 */}
                      {visibleStores.map((s, idx) => {
                        const colKey = `store_${s.id}`;
                        const colorThemes = [
                          'text-blue-300 font-bold',
                          'text-amber-300 font-bold',
                          'text-emerald-300 font-bold',
                          'text-purple-300 font-bold',
                          'text-cyan-300 font-bold',
                        ];
                        const theme = colorThemes[idx % colorThemes.length];
                        return renderEditableCell(
                          item,
                          colKey,
                          'center',
                          (qty) => {
                            const num = Number(qty || 0);
                            const isLow = num <= (item.safetyStock || 2);
                            return (
                              <span className={isLow ? 'text-rose-400' : theme}>
                                {num}
                              </span>
                            );
                          }
                        );
                      })}

                      {/* 全店合計 (公式自動合計，唯讀) */}
                      <td className={`border-b border-r border-slate-800 text-center font-extrabold text-white ${cellPaddingClass} ${rowHeightClass}`}>
                        {item.totalStock ?? 0}
                        {item.isLowStock && (
                          <span className="ml-1 text-[10px] px-1 py-0.2 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded">
                            低量
                          </span>
                        )}
                      </td>

                      {/* 安全門檻 */}
                      {renderEditableCell(item, 'safetyStock', 'center', (val) => `${val ?? 2}`, 'text-slate-400')}

                      {/* 彈出 Modal 工具按鈕 */}
                      <td className={`border-b border-slate-800 text-center ${cellPaddingClass} ${rowHeightClass}`}>
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => {
                              setEditProduct(item);
                              setSellingPrice(item.sellingPrice || 0);
                              setCostPrice(item.costPrice || 0);
                              setEditError(null);
                            }}
                            className="p-1 hover:bg-slate-700 text-slate-400 hover:text-white rounded transition"
                            title="進階改價彈窗"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setStockAdjustTarget(item);
                              setAdjustStore(stores[0]?.id || 'chupei');
                              setAdjustDelta(0);
                              setAdjustReason('');
                              setAdjustError(null);
                            }}
                            className="p-1 hover:bg-slate-700 text-amber-400 hover:text-amber-300 rounded transition"
                            title="進階調撥調帳彈窗"
                          >
                            <Sliders className="w-3.5 h-3.5" />
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

      {/* 分頁控制器 Pagination */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-800/60 p-3.5 rounded-2xl border border-slate-700/60 text-xs">
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

      {/* 修改價格 Modal (輔助) */}
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

      {/* 手動新增單品主檔 Modal */}
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
