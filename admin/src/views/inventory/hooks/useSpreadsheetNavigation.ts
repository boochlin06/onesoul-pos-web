import { useState, useRef, useEffect, useCallback } from 'react';
import { inventoryApi } from '../../../api/client';
import type {
  InventoryItem,
  ActiveCell,
  EditingCell,
  CellFeedback,
  PendingCellChange,
} from '../types.js';

interface UseSpreadsheetNavigationProps {
  items: InventoryItem[];
  setItems: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
  selectedStoreId: string;
  onRefreshDecisionAnalytics?: () => void;
  onReloadInventory?: () => void;
}

export function useSpreadsheetNavigation({
  items,
  setItems,
  selectedStoreId,
  onRefreshDecisionAnalytics,
  onReloadInventory,
}: UseSpreadsheetNavigationProps) {
  // 雙軌模式: 'auto' (Enter/失焦立即自動儲存) | 'batch' (批次暫存手動/Ctrl+S送出)
  const [saveMode, setSaveMode] = useState<'auto' | 'batch'>('auto');
  // 行高密度: 'compact' (32px 試算表高密度) | 'standard' (44px 標準舒適)
  const [density, setDensity] = useState<'compact' | 'standard'>('compact');

  // 單元格選取與編輯焦點
  const [activeCell, setActiveCell] = useState<ActiveCell | null>(null);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);

  // 反饋與批次暫存
  const [cellFeedback, setCellFeedback] = useState<Record<string, CellFeedback>>({});
  const [pendingChanges, setPendingChanges] = useState<Map<string, PendingCellChange>>(new Map());
  const [batchSaving, setBatchSaving] = useState(false);
  const [batchToast, setBatchToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // 自訂分類模式 (Spinner)
  const [isCustomCategoryMode, setIsCustomCategoryMode] = useState(false);

  // 🛡️ 規則 2：試算表鍵盤閉包防護 - 使用 useRef 維護最新狀態，防止快速鍵盤錄入 Stale State 丟失資料
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const editingCellRef = useRef(editingCell);
  editingCellRef.current = editingCell;

  const activeCellRef = useRef(activeCell);
  activeCellRef.current = activeCell;

  const saveModeRef = useRef(saveMode);
  saveModeRef.current = saveMode;

  const selectedStoreIdRef = useRef(selectedStoreId);
  selectedStoreIdRef.current = selectedStoreId;

  const pendingChangesRef = useRef(pendingChanges);
  pendingChangesRef.current = pendingChanges;

  const batchSavingRef = useRef(batchSaving);
  batchSavingRef.current = batchSaving;

  const committingCellRef = useRef<string | null>(null);

  const getNavigableColIds = useCallback(() => {
    return ['name', 'category', 'costPrice', 'sellingPrice', 'suggestedPoints', 'stock'];
  }, []);

  const getCellValue = useCallback((item: any, colId: string) => {
    if (colId === 'stock') {
      return item.stock ?? item.totalStock ?? 0;
    }
    if (colId.startsWith('store_')) {
      const storeId = colId.replace('store_', '');
      return item.storeStocks?.[storeId] ?? (storeId === 'chupei' ? item.chupeiStock : storeId === 'jinshan' ? item.jinshanStock : item.totalStock) ?? 0;
    }
    return item[colId] ?? '';
  }, []);

  const handleCellCommit = useCallback(async (rowId: string, colId: string, inputVal: any) => {
    const cellKey = `${rowId}_${colId}`;
    if (committingCellRef.current === cellKey) {
      return;
    }
    committingCellRef.current = cellKey;

    try {
      const currentItems = itemsRef.current;
      const item = currentItems.find((i) => i.id === rowId);
      if (!item) return;

      const oldValue = getCellValue(item, colId);
      const isNumeric = ['costPrice', 'sellingPrice', 'suggestedPoints', 'safetyStock', 'stock'].includes(colId) || colId.startsWith('store_');
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

      const currentStoreId = selectedStoreIdRef.current;

      // 1. 前端樂觀更新 + 即時公式計算連動 (同步維護 itemsRef.current 徹底防範閉包 Stale State)
      setItems((prevItems) => {
        const nextItems = prevItems.map((prod) => {
          if (prod.id !== rowId) return prod;
          const updated = { ...prod };
          if (colId === 'stock') {
            const targetStore = currentStoreId !== 'all' ? currentStoreId : 'chupei';
            const newStocks = { ...(prod.storeStocks || {}), [targetStore]: parsedNew };
            updated.storeStocks = newStocks;
            if (targetStore === 'chupei') updated.chupeiStock = parsedNew;
            if (targetStore === 'jinshan') updated.jinshanStock = parsedNew;
            updated.stock = currentStoreId === 'all' ? Object.values(newStocks).reduce((a: number, b: any) => a + (Number(b) || 0), 0) : parsedNew;
            updated.totalStock = Object.values(newStocks).reduce((a: number, b: any) => a + (Number(b) || 0), 0);
            updated.isLowStock = updated.totalStock <= (updated.safetyStock || 2);
          } else if (colId.startsWith('store_')) {
            const storeId = colId.replace('store_', '');
            const newStocks = { ...(prod.storeStocks || {}), [storeId]: parsedNew };
            updated.storeStocks = newStocks;
            if (storeId === 'chupei') updated.chupeiStock = parsedNew;
            if (storeId === 'jinshan') updated.jinshanStock = parsedNew;
            updated.totalStock = Object.values(newStocks).reduce((a: number, b: any) => a + (Number(b) || 0), 0);
            updated.isLowStock = updated.totalStock <= (updated.safetyStock || 2);
          } else {
            updated[colId] = parsedNew;
            if (colId === 'sellingPrice') {
              updated.suggestedPoints = Math.round(parsedNew * 0.05);
            }
          }
          return updated;
        });
        itemsRef.current = nextItems;
        return nextItems;
      });

      setEditingCell(null);

      // 2. 批次錄入模式：寫入 pendingChanges
      if (saveModeRef.current === 'batch') {
        setPendingChanges((prev) => {
          const next = new Map(prev);
          const isStock = colId === 'stock' || colId.startsWith('store_');
          const storeId = colId === 'stock' ? (currentStoreId !== 'all' ? currentStoreId : 'chupei') : (isStock ? colId.replace('store_', '') : undefined);
          const existingChange = next.get(cellKey);
          const originalVal = existingChange ? existingChange.originalValue : oldValue;

          if (parsedNew === originalVal) {
            next.delete(cellKey);
          } else {
            next.set(cellKey, {
              type: isStock ? 'stock' : 'product',
              productId: rowId,
              storeId,
              field: isStock ? (storeId || 'chupei') : colId,
              originalValue: originalVal,
              currentValue: parsedNew,
            });
          }
          return next;
        });
        return;
      }

      // 3. 即時自動存檔模式
      setCellFeedback((prev) => ({ ...prev, [cellKey]: { status: 'saving' } }));
      try {
        if (colId === 'stock') {
          const targetStore = currentStoreId !== 'all' ? currentStoreId : 'chupei';
          await inventoryApi.adjustStock(
            targetStore,
            rowId,
            0,
            '試算表原地儲存格快速調帳',
            parsedNew
          );
        } else if (colId.startsWith('store_')) {
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
          const res = await inventoryApi.updateProduct(rowId, payload);
          // 🛡️ 關鍵防護：同步最新樂觀鎖版本號，防止使用者連續鍵盤 Tab / Enter 修改同列不同格時引發 409 衝突
          const newVersion = res?.data?.version;
          if (newVersion !== undefined) {
            setItems((prev) => {
              const next = prev.map((p) => (p.id === rowId ? { ...p, version: newVersion } : p));
              itemsRef.current = next;
              return next;
            });
          }
        }

        setCellFeedback((prev) => ({ ...prev, [cellKey]: { status: 'saved' } }));
        if (colId === 'stock' || colId.startsWith('store_') || colId === 'category' || colId === 'name' || colId === 'costPrice') {
          onRefreshDecisionAnalytics?.();
        }
        setTimeout(() => {
          setCellFeedback((prev) => {
            const c = { ...prev };
            delete c[cellKey];
            return c;
          });
        }, 1200);
      } catch (err: any) {
        console.error(err);
        setItems((prevItems) => {
          const next = prevItems.map((prod) => (prod.id === rowId ? item : prod));
          itemsRef.current = next;
          return next;
        });
        setCellFeedback((prev) => ({
          ...prev,
          [cellKey]: { status: 'error', message: err.message || '儲存失敗' },
        }));
      }
    } finally {
      committingCellRef.current = null;
    }
  }, [getCellValue, setItems, onRefreshDecisionAnalytics]);

  const handleCellKeyDown = useCallback((e: React.KeyboardEvent, rowId: string, colId: string) => {
    const navigableCols = getNavigableColIds();
    const currentColIdx = navigableCols.indexOf(colId);
    const currentItems = itemsRef.current;
    const currentRowIdx = currentItems.findIndex((i) => i.id === rowId);

    if (e.key === 'Enter') {
      e.preventDefault();
      const currentVal = editingCellRef.current?.value;
      handleCellCommit(rowId, colId, currentVal);

      const targetRowIdx = e.shiftKey ? currentRowIdx - 1 : currentRowIdx + 1;
      if (targetRowIdx >= 0 && targetRowIdx < currentItems.length) {
        const nextItem = currentItems[targetRowIdx];
        setActiveCell({ rowId: nextItem.id, colId });
        setEditingCell({ rowId: nextItem.id, colId, value: getCellValue(nextItem, colId) });
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const currentVal = editingCellRef.current?.value;
      handleCellCommit(rowId, colId, currentVal);

      if (e.shiftKey) {
        if (currentColIdx > 0) {
          const prevCol = navigableCols[currentColIdx - 1];
          setActiveCell({ rowId, colId: prevCol });
          setEditingCell({ rowId, colId: prevCol, value: getCellValue(currentItems[currentRowIdx], prevCol) });
        } else if (currentRowIdx > 0) {
          const prevCol = navigableCols[navigableCols.length - 1];
          const prevItem = currentItems[currentRowIdx - 1];
          setActiveCell({ rowId: prevItem.id, colId: prevCol });
          setEditingCell({ rowId: prevItem.id, colId: prevCol, value: getCellValue(prevItem, prevCol) });
        }
      } else {
        if (currentColIdx < navigableCols.length - 1) {
          const nextCol = navigableCols[currentColIdx + 1];
          setActiveCell({ rowId, colId: nextCol });
          setEditingCell({ rowId, colId: nextCol, value: getCellValue(currentItems[currentRowIdx], nextCol) });
        } else if (currentRowIdx < currentItems.length - 1) {
          const nextCol = navigableCols[0];
          const nextItem = currentItems[currentRowIdx + 1];
          setActiveCell({ rowId: nextItem.id, colId: nextCol });
          setEditingCell({ rowId: nextItem.id, colId: nextCol, value: getCellValue(nextItem, nextCol) });
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsCustomCategoryMode(false);
      setEditingCell(null);
    }
  }, [getNavigableColIds, getCellValue, handleCellCommit]);

  const handleBatchSave = useCallback(async () => {
    const changes = pendingChangesRef.current;
    if (changes.size === 0 || batchSavingRef.current) return;

    setBatchSaving(true);
    setBatchToast(null);

    const productMap = new Map<string, any>();
    const stockAdjustments: Array<{ productId: string; storeId: string; newQuantity: number; reason: string }> = [];

    changes.forEach((change) => {
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
        onReloadInventory?.();
        onRefreshDecisionAnalytics?.();
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
  }, [onReloadInventory, onRefreshDecisionAnalytics]);

  const handleDiscardChanges = useCallback(() => {
    const changes = pendingChangesRef.current;
    if (changes.size === 0) return;
    if (!window.confirm(`確定要放棄目前未儲存的 ${changes.size} 筆暫存變更嗎？`)) return;

    setItems((prevItems) => {
      return prevItems.map((prod) => {
        let updated = { ...prod };
        changes.forEach((change) => {
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
  }, [setItems]);

  // 全域快捷鍵監聽 (Ctrl+S / Cmd+S 批次儲存)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (pendingChangesRef.current.size > 0 && !batchSavingRef.current) {
          handleBatchSave();
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [handleBatchSave]);

  return {
    saveMode,
    setSaveMode,
    density,
    setDensity,
    activeCell,
    setActiveCell,
    editingCell,
    setEditingCell,
    cellFeedback,
    pendingChanges,
    batchSaving,
    batchToast,
    isCustomCategoryMode,
    setIsCustomCategoryMode,
    getNavigableColIds,
    getCellValue,
    handleCellCommit,
    handleCellKeyDown,
    handleBatchSave,
    handleDiscardChanges,
  };
}
