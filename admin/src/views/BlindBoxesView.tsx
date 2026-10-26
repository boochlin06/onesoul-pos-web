import React, { useEffect, useState, useCallback } from 'react';
import { blindBoxesApi } from '../api/client';
import { 
  Boxes, 
  Search, 
  Save, 
  Undo2, 
  Check, 
  RotateCw, 
  Download, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  Sparkles, 
  DollarSign, 
  Layers, 
  TrendingUp, 
  AlertCircle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface BlindBoxItem {
  id: string;
  barcode: string;
  name: string;
  category: string;
  costPrice: number;
  sellingPrice: number;
  profit: number;
  marginRate: number;
  suggestedPoints: number;
  stock: number;
  currentStock: number;
  storeStocks: {
    chupei: number;
    jinshan: number;
  };
  note: string;
  version: number;
}

interface PendingChange {
  id: string;
  field: string;
  originalValue: any;
  currentValue: any;
}

export const BlindBoxesView: React.FC = () => {
  const [items, setItems] = useState<BlindBoxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStore, setSelectedStore] = useState('all');
  
  // 排序狀態
  const [sortBy, setSortBy] = useState<string>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // 分頁狀態
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // 頂部 KPI
  const [kpi, setKpi] = useState({
    totalCount: 0,
    totalStock: 0,
    totalCostValue: 0,
    totalSalesValue: 0,
    avgMargin: 0,
  });

  // 試算表編輯狀態
  const [editingCell, setEditingCell] = useState<{ id: string; field: string; value: any } | null>(null);
  const [pendingChanges, setPendingChanges] = useState<Map<string, PendingChange>>(new Map());
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // 載入資料
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await blindBoxesApi.list({
        q: searchTerm,
        storeId: selectedStore,
        sortBy,
        sortOrder,
        page,
        pageSize,
      });

      if (res.success) {
        setItems(res.data || []);
        if (res.meta) {
          setKpi(res.meta);
          setTotalCount(res.meta.totalCount);
        }
        if (res.pagination) {
          setTotalPages(res.pagination.totalPages || 1);
        }
      }
    } catch (err: any) {
      console.error(err);
      setToast({ type: 'error', message: '載入盲盒資料庫失敗：' + err.message });
    } finally {
      setLoading(false);
    }
  }, [searchTerm, selectedStore, sortBy, sortOrder, page, pageSize]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Toast 自動消失
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // 排序切換
  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  // 處理單元格雙擊進入編輯
  const handleStartEdit = (id: string, field: string, currentValue: any) => {
    setEditingCell({ id, field, value: currentValue });
  };

  // 處理單元格編輯確認
  const handleCommitEdit = (id: string, field: string, newValue: any) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    let originalVal: any;
    if (field === 'chupeiStock') originalVal = item.storeStocks?.chupei ?? 0;
    else if (field === 'jinshanStock') originalVal = item.storeStocks?.jinshan ?? 0;
    else originalVal = (item as any)[field];

    const key = `${id}_${field}`;
    const newPending = new Map(pendingChanges);

    // 格式轉換
    let parsedVal = newValue;
    if (['costPrice', 'sellingPrice', 'stock', 'chupeiStock', 'jinshanStock'].includes(field)) {
      parsedVal = Math.max(0, parseInt(String(newValue || 0), 10));
    }

    if (parsedVal === originalVal) {
      newPending.delete(key);
    } else {
      newPending.set(key, {
        id,
        field,
        originalValue: originalVal,
        currentValue: parsedVal,
      });
    }

    setPendingChanges(newPending);
    setEditingCell(null);

    // 本地即時更新 UI
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const copy = { ...it };
        if (field === 'costPrice') {
          copy.costPrice = parsedVal;
          copy.profit = copy.sellingPrice - parsedVal;
          copy.marginRate = copy.sellingPrice > 0 ? Number((((copy.sellingPrice - parsedVal) / copy.sellingPrice) * 100).toFixed(1)) : 0;
        } else if (field === 'sellingPrice') {
          copy.sellingPrice = parsedVal;
          copy.profit = parsedVal - copy.costPrice;
          copy.marginRate = parsedVal > 0 ? Number((((parsedVal - copy.costPrice) / parsedVal) * 100).toFixed(1)) : 0;
          copy.suggestedPoints = Math.round(parsedVal * 0.05);
        } else if (field === 'chupeiStock') {
          copy.storeStocks = { ...copy.storeStocks, chupei: parsedVal };
          copy.stock = copy.storeStocks.chupei + copy.storeStocks.jinshan;
        } else if (field === 'jinshanStock') {
          copy.storeStocks = { ...copy.storeStocks, jinshan: parsedVal };
          copy.stock = copy.storeStocks.chupei + copy.storeStocks.jinshan;
        } else {
          (copy as any)[field] = parsedVal;
        }
        return copy;
      })
    );
  };

  // 批次儲存
  const handleBatchSave = async () => {
    if (pendingChanges.size === 0) return;
    setSaving(true);

    try {
      // 依 item id 聚合成 updates
      const updateMap = new Map<string, any>();
      for (const change of pendingChanges.values()) {
        const existing = updateMap.get(change.id) || { id: change.id };
        if (change.field === 'chupeiStock') {
          existing.storeStocks = existing.storeStocks || {};
          existing.storeStocks.chupei = change.currentValue;
        } else if (change.field === 'jinshanStock') {
          existing.storeStocks = existing.storeStocks || {};
          existing.storeStocks.jinshan = change.currentValue;
        } else {
          existing[change.field] = change.currentValue;
        }
        updateMap.set(change.id, existing);
      }

      const updates = Array.from(updateMap.values());
      const res = await blindBoxesApi.batchUpdate(updates, '盲盒資料庫後台原地試算表儲存');
      if (res.success) {
        setPendingChanges(new Map());
        setToast({ type: 'success', message: `✅ 成功儲存 ${res.data?.updatedCount || updates.length} 筆盲盒修改` });
        loadData();
      } else {
        setToast({ type: 'error', message: res.message || '儲存失敗' });
      }
    } catch (err: any) {
      console.error(err);
      setToast({ type: 'error', message: '儲存失敗：' + err.message });
    } finally {
      setSaving(false);
    }
  };

  // 復原所有暫存
  const handleDiscardChanges = () => {
    if (confirm('確定要捨棄所有未儲存的原地變更嗎？')) {
      setPendingChanges(new Map());
      loadData();
    }
  };

  // 鍵盤 Ctrl+S / Cmd+S 快捷鍵儲存
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (pendingChanges.size > 0 && !saving) {
          handleBatchSave();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pendingChanges, saving]);

  // 匯出 CSV
  const handleExportCsv = () => {
    let csv = '\uFEFF貨號,條碼,品名,類別,成本,售價,毛利,毛利率(%),換算點數,竹北庫存,金山庫存,總庫存\n';
    items.forEach((it) => {
      csv += `"${it.id}","${it.barcode}","${it.name.replace(/"/g, '""')}","${it.category}",${it.costPrice},${it.sellingPrice},${it.profit},"${it.marginRate}%",${it.suggestedPoints},${it.storeStocks?.chupei || 0},${it.storeStocks?.jinshan || 0},${it.stock}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `OneSoul_BlindBoxes_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950 text-slate-100">
      {/* 頂部標題與行動列 */}
      <div className="p-6 border-b border-slate-800 shrink-0 bg-slate-900/50 backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-pink-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-pink-500/20">
              <Boxes className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black tracking-tight text-white">盲盒商品資料庫</h1>
                <span className="px-2 py-0.5 text-xs font-semibold bg-pink-500/20 text-pink-300 border border-pink-500/30 rounded-full">
                  獨立專區
                </span>
                <span className="px-2 py-0.5 text-xs text-slate-400 bg-slate-800 border border-slate-700 rounded-full">
                  共 {kpi.totalCount} 款
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                專門管理全門市盲盒款式、成本定價與門市庫存（已從一番賞配賞名單自動排除，不干擾開套）
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* 暫存儲存按鈕 */}
            {pendingChanges.size > 0 && (
              <>
                <button
                  onClick={handleDiscardChanges}
                  disabled={saving}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition flex items-center gap-1.5"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  捨棄變更
                </button>
                <button
                  onClick={handleBatchSave}
                  disabled={saving}
                  className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 animate-pulse"
                >
                  <Save className="w-3.5 h-3.5" />
                  {saving ? '正在儲存...' : `儲存變更 (${pendingChanges.size})`}
                </button>
              </>
            )}

            <button
              onClick={handleExportCsv}
              className="px-3 py-2 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-slate-300 rounded-xl text-xs font-medium transition flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              匯出 CSV
            </button>
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-slate-300 rounded-xl text-xs transition"
              title="重新整理"
            >
              <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* 頂部 4 大 KPI 卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-medium text-slate-400">總盲盒款式</div>
              <div className="text-xl font-black text-white mt-0.5">{kpi.totalCount} 款</div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <Boxes className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-medium text-slate-400">總在庫件數</div>
              <div className="text-xl font-black text-amber-400 mt-0.5">{kpi.totalStock.toLocaleString()} 抽</div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-medium text-slate-400">庫存總成本</div>
              <div className="text-xl font-black text-pink-400 mt-0.5">${kpi.totalCostValue.toLocaleString()}</div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-pink-500/10 text-pink-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-medium text-slate-400">平均毛利率</div>
              <div className="text-xl font-black text-emerald-400 mt-0.5">{kpi.avgMargin}%</div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>

      {/* 搜尋與篩選工具列 */}
      <div className="px-6 py-3 border-b border-slate-800 flex items-center justify-between gap-4 bg-slate-900/30">
        <div className="flex items-center gap-3 flex-1 max-w-xl">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="搜尋貨號 (100xxx)、盲盒品名、條碼..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500 transition"
            />
          </div>

          {/* 門市視角選擇 */}
          <select
            value={selectedStore}
            onChange={(e) => setSelectedStore(e.target.value)}
            className="px-3 py-1.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white focus:outline-none focus:border-pink-500 transition cursor-pointer"
          >
            <option value="all">全門市總庫存</option>
            <option value="chupei">竹北店視角</option>
            <option value="jinshan">金山店視角</option>
          </select>
        </div>

        <div className="text-xs text-slate-400 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          雙擊任一單元格即可「原地快速編輯」售價、成本與門市庫存
        </div>
      </div>

      {/* Toast 訊息反饋 */}
      {toast && (
        <div className={`mx-6 mt-3 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
          toast.type === 'success' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'
        }`}>
          {toast.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.message}
        </div>
      )}

      {/* 試算表表格區 */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-900/90 text-slate-400 font-semibold sticky top-0 z-10 border-b border-slate-800 select-none">
            <tr>
              <th className="py-2.5 px-4 w-24 cursor-pointer hover:text-white" onClick={() => handleSort('id')}>
                <div className="flex items-center gap-1">
                  貨號
                  {sortBy === 'id' ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-pink-400" /> : <ArrowDown className="w-3 h-3 text-pink-400" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
                </div>
              </th>
              <th className="py-2.5 px-3 w-32">條碼</th>
              <th className="py-2.5 px-4 cursor-pointer hover:text-white" onClick={() => handleSort('name')}>
                <div className="flex items-center gap-1">
                  盲盒品名
                  {sortBy === 'name' ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-pink-400" /> : <ArrowDown className="w-3 h-3 text-pink-400" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
                </div>
              </th>
              <th className="py-2.5 px-3 w-24 text-right cursor-pointer hover:text-white" onClick={() => handleSort('costPrice')}>
                <div className="flex items-center justify-end gap-1">
                  成本
                  {sortBy === 'costPrice' ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-pink-400" /> : <ArrowDown className="w-3 h-3 text-pink-400" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
                </div>
              </th>
              <th className="py-2.5 px-3 w-24 text-right cursor-pointer hover:text-white" onClick={() => handleSort('sellingPrice')}>
                <div className="flex items-center justify-end gap-1">
                  售價
                  {sortBy === 'sellingPrice' ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-pink-400" /> : <ArrowDown className="w-3 h-3 text-pink-400" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
                </div>
              </th>
              <th className="py-2.5 px-3 w-24 text-right">毛利</th>
              <th className="py-2.5 px-3 w-24 text-right cursor-pointer hover:text-white" onClick={() => handleSort('marginRate')}>
                <div className="flex items-center justify-end gap-1">
                  毛利率
                  {sortBy === 'marginRate' ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-pink-400" /> : <ArrowDown className="w-3 h-3 text-pink-400" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
                </div>
              </th>
              <th className="py-2.5 px-3 w-20 text-center">換算點數</th>
              <th className="py-2.5 px-3 w-24 text-center">竹北現貨</th>
              <th className="py-2.5 px-3 w-24 text-center">金山現貨</th>
              <th className="py-2.5 px-3 w-24 text-center cursor-pointer hover:text-white" onClick={() => handleSort('stock')}>
                <div className="flex items-center justify-center gap-1">
                  總庫存
                  {sortBy === 'stock' ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-pink-400" /> : <ArrowDown className="w-3 h-3 text-pink-400" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
                </div>
              </th>
              <th className="py-2.5 px-4 w-32">備註</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-800/60 font-mono">
            {loading ? (
              <tr>
                <td colSpan={12} className="py-12 text-center text-slate-500">
                  <div className="flex flex-col items-center gap-2">
                    <RotateCw className="w-6 h-6 animate-spin text-pink-500" />
                    <span>正在載入盲盒商品資料庫...</span>
                  </div>
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={12} className="py-12 text-center text-slate-500">
                  查無符合條件之盲盒商品
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const isPriceDirty = pendingChanges.has(`${item.id}_sellingPrice`);
                const isCostDirty = pendingChanges.has(`${item.id}_costPrice`);
                const isNameDirty = pendingChanges.has(`${item.id}_name`);
                const isChupeiDirty = pendingChanges.has(`${item.id}_chupeiStock`);
                const isJinshanDirty = pendingChanges.has(`${item.id}_jinshanStock`);

                return (
                  <tr key={item.id} className="hover:bg-slate-900/60 transition group">
                    {/* 貨號 */}
                    <td className="py-2 px-4 font-semibold text-slate-300">
                      {item.id}
                    </td>

                    {/* 條碼 */}
                    <td className="py-2 px-3 text-slate-400 text-[11px]">
                      {item.barcode}
                    </td>

                    {/* 品名 (可原地編輯) */}
                    <td
                      className={`py-2 px-4 font-sans font-medium text-white cursor-pointer ${
                        isNameDirty ? 'bg-amber-500/10 border-l-2 border-amber-500' : ''
                      }`}
                      onDoubleClick={() => handleStartEdit(item.id, 'name', item.name)}
                    >
                      {editingCell?.id === item.id && editingCell.field === 'name' ? (
                        <input
                          autoFocus
                          type="text"
                          value={editingCell.value}
                          onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                          onBlur={() => handleCommitEdit(item.id, 'name', editingCell.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCommitEdit(item.id, 'name', editingCell.value);
                            if (e.key === 'Escape') setEditingCell(null);
                          }}
                          className="w-full px-2 py-0.5 bg-slate-900 border border-pink-500 rounded text-xs text-white outline-none font-sans"
                        />
                      ) : (
                        <div className="flex items-center justify-between group-hover:text-pink-300 transition">
                          <span className="truncate">{item.name}</span>
                          {isNameDirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 ml-1"></span>}
                        </div>
                      )}
                    </td>

                    {/* 成本 (可原地編輯) */}
                    <td
                      className={`py-2 px-3 text-right cursor-pointer ${
                        isCostDirty ? 'bg-amber-500/10 font-bold text-amber-300' : 'text-slate-400'
                      }`}
                      onDoubleClick={() => handleStartEdit(item.id, 'costPrice', item.costPrice)}
                    >
                      {editingCell?.id === item.id && editingCell.field === 'costPrice' ? (
                        <input
                          autoFocus
                          type="number"
                          value={editingCell.value}
                          onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                          onBlur={() => handleCommitEdit(item.id, 'costPrice', editingCell.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCommitEdit(item.id, 'costPrice', editingCell.value);
                            if (e.key === 'Escape') setEditingCell(null);
                          }}
                          className="w-full px-1.5 py-0.5 bg-slate-900 border border-pink-500 rounded text-xs text-right text-white outline-none font-mono"
                        />
                      ) : (
                        `$${item.costPrice}`
                      )}
                    </td>

                    {/* 售價 (可原地編輯) */}
                    <td
                      className={`py-2 px-3 text-right cursor-pointer font-semibold ${
                        isPriceDirty ? 'bg-amber-500/10 font-bold text-amber-300' : 'text-amber-400'
                      }`}
                      onDoubleClick={() => handleStartEdit(item.id, 'sellingPrice', item.sellingPrice)}
                    >
                      {editingCell?.id === item.id && editingCell.field === 'sellingPrice' ? (
                        <input
                          autoFocus
                          type="number"
                          value={editingCell.value}
                          onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                          onBlur={() => handleCommitEdit(item.id, 'sellingPrice', editingCell.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCommitEdit(item.id, 'sellingPrice', editingCell.value);
                            if (e.key === 'Escape') setEditingCell(null);
                          }}
                          className="w-full px-1.5 py-0.5 bg-slate-900 border border-pink-500 rounded text-xs text-right text-white outline-none font-mono"
                        />
                      ) : (
                        `$${item.sellingPrice}`
                      )}
                    </td>

                    {/* 毛利 */}
                    <td className="py-2 px-3 text-right text-slate-300">
                      ${item.profit}
                    </td>

                    {/* 毛利率 */}
                    <td className="py-2 px-3 text-right">
                      <span className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                        item.marginRate >= 40
                          ? 'text-emerald-400 bg-emerald-500/10'
                          : item.marginRate >= 25
                          ? 'text-amber-400 bg-amber-500/10'
                          : 'text-red-400 bg-red-500/10'
                      }`}>
                        {item.marginRate}%
                      </span>
                    </td>

                    {/* 點數 */}
                    <td className="py-2 px-3 text-center text-indigo-400 font-semibold">
                      {item.suggestedPoints} pt
                    </td>

                    {/* 竹北庫存 (可原地編輯) */}
                    <td
                      className={`py-2 px-3 text-center cursor-pointer ${
                        isChupeiDirty ? 'bg-amber-500/10 text-amber-300 font-bold' : 'text-slate-300'
                      }`}
                      onDoubleClick={() => handleStartEdit(item.id, 'chupeiStock', item.storeStocks?.chupei ?? 0)}
                    >
                      {editingCell?.id === item.id && editingCell.field === 'chupeiStock' ? (
                        <input
                          autoFocus
                          type="number"
                          value={editingCell.value}
                          onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                          onBlur={() => handleCommitEdit(item.id, 'chupeiStock', editingCell.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCommitEdit(item.id, 'chupeiStock', editingCell.value);
                            if (e.key === 'Escape') setEditingCell(null);
                          }}
                          className="w-16 px-1 py-0.5 bg-slate-900 border border-pink-500 rounded text-xs text-center text-white outline-none font-mono"
                        />
                      ) : (
                        item.storeStocks?.chupei ?? 0
                      )}
                    </td>

                    {/* 金山庫存 (可原地編輯) */}
                    <td
                      className={`py-2 px-3 text-center cursor-pointer ${
                        isJinshanDirty ? 'bg-amber-500/10 text-amber-300 font-bold' : 'text-slate-300'
                      }`}
                      onDoubleClick={() => handleStartEdit(item.id, 'jinshanStock', item.storeStocks?.jinshan ?? 0)}
                    >
                      {editingCell?.id === item.id && editingCell.field === 'jinshanStock' ? (
                        <input
                          autoFocus
                          type="number"
                          value={editingCell.value}
                          onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                          onBlur={() => handleCommitEdit(item.id, 'jinshanStock', editingCell.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCommitEdit(item.id, 'jinshanStock', editingCell.value);
                            if (e.key === 'Escape') setEditingCell(null);
                          }}
                          className="w-16 px-1 py-0.5 bg-slate-900 border border-pink-500 rounded text-xs text-center text-white outline-none font-mono"
                        />
                      ) : (
                        item.storeStocks?.jinshan ?? 0
                      )}
                    </td>

                    {/* 全店總庫存 */}
                    <td className="py-2 px-3 text-center font-bold text-white">
                      {item.stock}
                    </td>

                    {/* 備註 */}
                    <td className="py-2 px-4 text-slate-400 font-sans truncate max-w-[120px]">
                      {item.note || '-'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 底部導航分頁條 */}
      <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/50 flex items-center justify-between text-xs text-slate-400">
        <div>
          顯示第 {(page - 1) * pageSize + 1} 至 {Math.min(page * pageSize, totalCount)} 筆，共 {totalCount} 筆
        </div>

        <div className="flex items-center gap-2">
          <span>每頁顯示:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-white outline-none"
          >
            <option value={20}>20 筆</option>
            <option value={50}>50 筆</option>
            <option value={100}>100 筆</option>
          </select>

          <div className="flex items-center gap-1 ml-4">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-mono">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
