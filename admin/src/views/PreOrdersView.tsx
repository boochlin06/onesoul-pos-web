import React, { useEffect, useState, useCallback } from 'react';
import { preOrdersApi } from '../api/client';
import { 
  ShoppingBag, 
  Search, 
  Plus, 
  RotateCw, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  DollarSign, 
  Truck, 
  ArrowRight, 
  Store as StoreIcon, 
  Tag, 
  Layers,
  AlertCircle,
  AlertTriangle
} from 'lucide-react';

interface PreOrderItem {
  id: string;
  name: string;
  version: string | null;
  quantity: number;
  deposit: number;
  finalPayment: number;
  shippingFee: number;
  totalCost: number;
  supplier: string | null;
  targetStoreId: string | null;
  targetStoreName?: string;
  productId: string | null;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
  arrivedAt: string | null;
  note: string | null;
  createdAt: string;
  product?: {
    id: string;
    name: string;
    category: string;
    costPrice: number;
  } | null;
}

export const PreOrdersView: React.FC = () => {
  const [items, setItems] = useState<PreOrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [summary, setSummary] = useState({
    total: 0,
    pendingCount: 0,
    completedCount: 0,
    cancelledCount: 0,
    totalDepositPending: 0,
  });

  // Modal 狀態
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [activeItem, setActiveItem] = useState<PreOrderItem | null>(null);

  // 新增預購單表單
  const [createForm, setCreateForm] = useState({
    name: '',
    version: '',
    quantity: 1,
    deposit: 0,
    supplier: '玩譯',
    targetStoreId: 'chupei',
    note: '',
  });

  // 驗收入庫表單
  const [receiveForm, setReceiveForm] = useState({
    finalPayment: 0,
    shippingFee: 0,
    productId: '',
    productName: '',
    allocationCost: 0,
    sellingPrice: 0,
    suggestedPoints: 0,
    storeId: 'chupei',
    offsetHistoricalDraw: false,
    confirmLink: true,
  });

  // 取消原因表單
  const [cancelReason, setCancelReason] = useState('廠商/工作室通知砍單退訂');
  const [submitting, setSubmitting] = useState(false);

  const fetchPreOrders = useCallback(async () => {
    try {
      setLoading(true);
      const res = await preOrdersApi.list({
        status: statusFilter,
        q: searchTerm,
      });
      if (res.success) {
        setItems(res.data);
        setSummary(res.summary);
      }
    } catch (e: any) {
      console.error('載入預購單失敗:', e);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchTerm]);

  useEffect(() => {
    fetchPreOrders();
  }, [fetchPreOrders]);

  // 開啟驗收入庫彈窗
  const handleOpenReceiveModal = async (item: PreOrderItem) => {
    setActiveItem(item);
    setSubmitting(false);
    try {
      // 取得建議貨號 (優先使用已預綁定之主檔貨號)
      let suggestedPid = item.productId || '';
      if (!suggestedPid) {
        const nextIdRes = await preOrdersApi.suggestNextId();
        suggestedPid = nextIdRes?.suggestedId || '8045';
      }
      const initialTotalCost = (item.deposit || 0);
      const qty = Math.max(1, item.quantity || 1);
      const initialUnitCost = Math.round(initialTotalCost / qty);
      const isHistoricalFutures = Boolean(
        item.productId === '3214' ||
        item.productId === '3211' ||
        item.note?.includes('歷史曾於一番賞預開抽')
      );

      setReceiveForm({
        finalPayment: 0,
        shippingFee: 0,
        productId: suggestedPid,
        productName: item.version ? `${item.name} (${item.version})` : item.name,
        allocationCost: initialUnitCost,
        sellingPrice: Math.round(initialUnitCost * 1.5),
        suggestedPoints: Math.round((initialUnitCost * 1.5) / 20),
        storeId: item.targetStoreId || 'chupei',
        offsetHistoricalDraw: isHistoricalFutures,
        confirmLink: true,
      });
      setShowReceiveModal(true);
    } catch (e: any) {
      alert(`取得推薦貨號失敗: ${e.message}`);
    }
  };

  // 執行補款驗收入庫
  const handleConfirmReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeItem) return;
    try {
      setSubmitting(true);
      const res = await preOrdersApi.receive(activeItem.id, receiveForm);
      if (res.success) {
        alert(res.message);
        setShowReceiveModal(false);
        setActiveItem(null);
        fetchPreOrders();
      }
    } catch (err: any) {
      alert(`入庫失敗: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // 執行新增預購單
  const handleConfirmCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim()) {
      alert('請輸入商品名稱');
      return;
    }
    try {
      setSubmitting(true);
      const res = await preOrdersApi.create(createForm);
      if (res.success) {
        setShowCreateModal(false);
        setCreateForm({
          name: '',
          version: '',
          quantity: 1,
          deposit: 0,
          supplier: '玩譯',
          targetStoreId: 'chupei',
          note: '',
        });
        fetchPreOrders();
      }
    } catch (err: any) {
      alert(`建立失敗: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // 執行取消預購單
  const handleConfirmCancel = async () => {
    if (!activeItem) return;
    try {
      setSubmitting(true);
      const res = await preOrdersApi.cancel(activeItem.id, cancelReason);
      if (res.success) {
        setShowCancelModal(false);
        setActiveItem(null);
        fetchPreOrders();
      }
    } catch (err: any) {
      alert(`取消失敗: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // 計算即時總成本
  const liveTotalCost = activeItem 
    ? (activeItem.deposit || 0) + (Number(receiveForm.finalPayment) || 0) + (Number(receiveForm.shippingFee) || 0)
    : 0;

  return (
    <div className="space-y-6">
      {/* 頂部標題與行動列 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Truck className="w-7 h-7 text-indigo-600" />
            廠商預購與長期跟蹤管理
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            追蹤提早半年以上向代理商（玩譯、燃點等）預定之 GK 雕像，記錄已付訂金、通知補款與正式入庫轉為主檔
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchPreOrders}
            className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600 transition"
            title="重新整理"
          >
            <RotateCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition"
          >
            <Plus className="w-5 h-5" />
            新增廠商預購單
          </button>
        </div>
      </div>

      {/* 統計指標卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">總預購項目</div>
            <div className="text-2xl font-bold text-slate-800">{summary.total} <span className="text-sm font-normal text-slate-400">款</span></div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-amber-200 bg-amber-50/20 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-xl flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-amber-700 font-medium">等待廠商發貨</div>
            <div className="text-2xl font-bold text-amber-800">{summary.pendingCount} <span className="text-sm font-normal text-amber-600">款在途</span></div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-blue-200 bg-blue-50/20 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-100 text-blue-700 rounded-xl flex items-center justify-center">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-blue-700 font-medium">等待中已付總訂金</div>
            <div className="text-2xl font-bold text-blue-800">
              ${summary.totalDepositPending.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-emerald-700 font-medium">已補款入庫完成</div>
            <div className="text-2xl font-bold text-emerald-800">{summary.completedCount} <span className="text-sm font-normal text-emerald-600">款結案</span></div>
          </div>
        </div>
      </div>

      {/* 搜尋與篩選列 */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* 狀態切換 Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
          {[
            { id: 'ALL', label: '全部' },
            { id: 'PENDING', label: `等待中 (${summary.pendingCount})` },
            { id: 'COMPLETED', label: `已入庫 (${summary.completedCount})` },
            { id: 'CANCELLED', label: `已取消 (${summary.cancelledCount})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                statusFilter === tab.id
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 搜尋框 */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="搜尋品名、版本或廠商 (玩譯/燃點)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* 預購清單列表 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase tracking-wider font-semibold">
                <th className="py-3 px-4">預購商品名稱 / 版本</th>
                <th className="py-3 px-3">廠商 / 代理商</th>
                <th className="py-3 px-3 text-center">預訂數量</th>
                <th className="py-3 px-3 text-right">已付訂金</th>
                <th className="py-3 px-3 text-right">補款尾款 / 總成本</th>
                <th className="py-3 px-3 text-center">入庫門市</th>
                <th className="py-3 px-3 text-center">狀態</th>
                <th className="py-3 px-4">備註說明</th>
                <th className="py-3 px-4 text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    載入中...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    目前無符合條件的預購單
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3.5 px-4 font-medium text-slate-800">
                      <div className="flex flex-col">
                        <span>{item.name}</span>
                        {item.version && (
                          <span className="inline-block mt-0.5 text-xs text-indigo-600 font-semibold">
                            規格: {item.version}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                        {item.supplier || '未指定'}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-center font-semibold text-slate-700">
                      {item.quantity}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono font-bold text-amber-700">
                      ${(item.deposit || 0).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono">
                      {item.status === 'COMPLETED' ? (
                        <div className="flex flex-col items-end">
                          <span className="text-slate-800 font-bold">${item.totalCost?.toLocaleString()}</span>
                          <span className="text-xs text-slate-400 font-normal">
                            (尾款 ${item.finalPayment?.toLocaleString()} + 運 ${item.shippingFee})
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs italic">待補款出貨</span>
                      )}
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <span className="text-xs px-2 py-1 rounded-md bg-slate-100 text-slate-600">
                        {item.targetStoreId === 'jinshan' ? '金山店' : '竹北店'}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      {item.status === 'PENDING' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                          <Clock className="w-3 h-3" /> 等待中
                        </span>
                      )}
                      {item.status === 'COMPLETED' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3 h-3" /> 已入庫
                        </span>
                      )}
                      {item.status === 'CANCELLED' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-500">
                          <XCircle className="w-3 h-3" /> 已取消
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-500 max-w-xs truncate" title={item.note || ''}>
                      {item.note || '-'}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {item.status === 'PENDING' ? (
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleOpenReceiveModal(item)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium px-2.5 py-1.5 rounded-lg shadow-sm transition flex items-center gap-1"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                            補款入庫
                          </button>
                          <button
                            onClick={() => {
                              setActiveItem(item);
                              setShowCancelModal(true);
                            }}
                            className="text-xs text-slate-400 hover:text-rose-600 px-1 py-1 transition"
                          >
                            退訂
                          </button>
                        </div>
                      ) : item.status === 'COMPLETED' ? (
                        <span className="text-xs font-mono font-semibold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                          主檔 #{item.productId}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">已結案</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal 1: 新增廠商預購單 ── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-indigo-600" />
              新增廠商 GK 預購單
            </h3>
            <form onSubmit={handleConfirmCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  公仔/雕像名稱 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="例如: 海賊王 火龍大炬vs業火魯夫 X 燃點工作室"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">版本 / 規格</label>
                  <input
                    type="text"
                    placeholder="例如: 業火巨雕S+版 / EX版"
                    value={createForm.version}
                    onChange={(e) => setCreateForm({ ...createForm, version: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">預訂數量</label>
                  <input
                    type="number"
                    min="1"
                    value={createForm.quantity}
                    onChange={(e) => setCreateForm({ ...createForm, quantity: parseInt(e.target.value, 10) || 1 })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">預付訂金 (NT$)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="例如: 8640"
                    value={createForm.deposit}
                    onChange={(e) => setCreateForm({ ...createForm, deposit: parseInt(e.target.value, 10) || 0 })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-bold text-amber-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">廠商 / 代理商</label>
                  <input
                    type="text"
                    placeholder="例如: 玩譯 / 燃點 / 神隱"
                    value={createForm.supplier}
                    onChange={(e) => setCreateForm({ ...createForm, supplier: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">預計到貨門市</label>
                <select
                  value={createForm.targetStoreId}
                  onChange={(e) => setCreateForm({ ...createForm, targetStoreId: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="chupei">竹北店</option>
                  <option value="jinshan">金山店</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">備註說明</label>
                <textarea
                  rows={2}
                  placeholder="例如: 代理商告知 2026 Q4 出貨，已匯款第一期款項..."
                  value={createForm.note}
                  onChange={(e) => setCreateForm({ ...createForm, note: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  {submitting ? '建立中...' : '確認建立'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal 2: 補款並驗收入庫 (核心轉主檔操作) ── */}
      {showReceiveModal && activeItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-xl w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  補款並驗收入庫 (轉入商品主檔)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  廠商通知發貨，填寫尾款與運費後，系統將自動加總總成本並轉入門市現貨庫存
                </p>
              </div>
            </div>

            <form onSubmit={handleConfirmReceive} className="space-y-4">
              {/* 原預購項目摘要卡片 */}
              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl space-y-1.5">
                <div className="text-sm font-bold text-slate-800">{activeItem.name}</div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                  <span>廠商: <b className="text-slate-800">{activeItem.supplier || '無'}</b></span>
                  <span>數量: <b className="text-slate-800">{activeItem.quantity} 件</b></span>
                  <span>已付訂金: <b className="text-amber-700 font-mono">${(activeItem.deposit || 0).toLocaleString()}</b></span>
                </div>
              </div>

              {/* 尾款與運費輸入 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    補款尾款 (NT$)
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={receiveForm.finalPayment}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10) || 0;
                      const nextTotal = (activeItem.deposit || 0) + val + (receiveForm.shippingFee || 0);
                      const qty = Math.max(1, activeItem.quantity || 1);
                      const nextUnitCost = Math.round(nextTotal / qty);
                      setReceiveForm({ 
                        ...receiveForm, 
                        finalPayment: val,
                        allocationCost: nextUnitCost,
                        sellingPrice: Math.round(nextUnitCost * 1.5),
                        suggestedPoints: Math.round((nextUnitCost * 1.5) / 20)
                      });
                    }}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono font-bold text-emerald-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    國際/國內運費 (NT$)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={receiveForm.shippingFee}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10) || 0;
                      const nextTotal = (activeItem.deposit || 0) + (receiveForm.finalPayment || 0) + val;
                      const qty = Math.max(1, activeItem.quantity || 1);
                      const nextUnitCost = Math.round(nextTotal / qty);
                      setReceiveForm({ 
                        ...receiveForm, 
                        shippingFee: val,
                        allocationCost: nextUnitCost,
                        sellingPrice: Math.round(nextUnitCost * 1.5),
                        suggestedPoints: Math.round((nextUnitCost * 1.5) / 20)
                      });
                    }}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>
              </div>

              {/* 即時總成本儀表 */}
              <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-emerald-900 block">真實進貨總成本 (訂金+尾款+運費)</span>
                  {activeItem.quantity > 1 && (
                    <span className="text-[11px] text-emerald-700 font-medium">
                      💡 入庫 {activeItem.quantity} 隻，單隻成本約 <b className="font-mono text-emerald-900">${Math.round(liveTotalCost / activeItem.quantity).toLocaleString()}</b>
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-xl font-bold font-mono text-emerald-800">
                    ${liveTotalCost.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* 貨號與品名確認 */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    商品貨號 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={receiveForm.productId}
                    onChange={(e) => setReceiveForm({ ...receiveForm, productId: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-bold text-indigo-700 bg-indigo-50/30"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">系統推薦下一號，可微調</span>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">入庫品名</label>
                  <input
                    type="text"
                    required
                    value={receiveForm.productName}
                    onChange={(e) => setReceiveForm({ ...receiveForm, productName: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* 配賞用成本、售價與點數 */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    配賞成本 (防虧專用)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={receiveForm.allocationCost}
                    onChange={(e) => setReceiveForm({ ...receiveForm, allocationCost: parseInt(e.target.value, 10) || 0 })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-indigo-700 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">建議售價 (NT$)</label>
                  <input
                    type="number"
                    min="0"
                    value={receiveForm.sellingPrice}
                    onChange={(e) => setReceiveForm({ ...receiveForm, sellingPrice: parseInt(e.target.value, 10) || 0 })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">換點點數 (Points)</label>
                  <input
                    type="number"
                    min="0"
                    value={receiveForm.suggestedPoints}
                    onChange={(e) => setReceiveForm({ ...receiveForm, suggestedPoints: parseInt(e.target.value, 10) || 0 })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-amber-700 font-semibold"
                  />
                </div>
              </div>

              {/* 期貨到貨履約沖抵警示與選項 */}
              {(activeItem.productId === '3214' || activeItem.productId === '3211' || activeItem.note?.includes('歷史曾於一番賞預開抽')) && (
                <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl space-y-2">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-amber-900">歷史一番賞預開抽平帳提醒</h4>
                      <p className="text-[11px] text-amber-800 mt-0.5">
                        此預購品項曾於門市一番賞套組被客人兌換帶走。若實物直接交付客人，請勾選履約沖抵以平帳。
                      </p>
                      <label className="flex items-center gap-2 mt-2 text-xs font-bold text-amber-950 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={receiveForm.offsetHistoricalDraw}
                          onChange={(e) => setReceiveForm({ ...receiveForm, offsetHistoricalDraw: e.target.checked })}
                          className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-amber-300"
                        />
                        <span>期貨到貨履約沖抵（入庫量記為 0，門市現貨庫存不重複增加）</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* 實際入庫門市 */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">實體入庫門市</label>
                <select
                  value={receiveForm.storeId}
                  onChange={(e) => setReceiveForm({ ...receiveForm, storeId: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="chupei">
                    竹北店 {receiveForm.offsetHistoricalDraw ? '(履約平帳沖抵，現貨維持 +0)' : `(增加 ${activeItem.quantity} 件現貨)`}
                  </option>
                  <option value="jinshan">
                    金山店 {receiveForm.offsetHistoricalDraw ? '(履約平帳沖抵，現貨維持 +0)' : `(增加 ${activeItem.quantity} 件現貨)`}
                  </option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowReceiveModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {submitting ? '入庫處理中...' : '確認補款並轉入庫存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal 3: 取消退訂 ── */}
      {showCancelModal && activeItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-600" />
              確認取消退訂預購項目？
            </h3>
            <p className="text-sm text-slate-600 mb-4">
              您即將取消預購項目 <b>{activeItem.name}</b>（廠商: {activeItem.supplier}，已付訂金 ${activeItem.deposit}）。
            </p>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-600 mb-1">取消退訂原因</label>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                返回
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleConfirmCancel}
                className="px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition disabled:opacity-50"
              >
                {submitting ? '處理中...' : '確認退訂取消'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
