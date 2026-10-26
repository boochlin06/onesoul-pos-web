import React, { useEffect, useState } from 'react';
import { reportsApi } from '../api/client';
import { 
  BarChart3, 
  Search, 
  Trash2, 
  AlertCircle, 
  X, 
  TrendingUp, 
  DollarSign, 
  CreditCard,
  Building,
  Calendar,
  CheckCircle2
} from 'lucide-react';

export const ReportsView: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<any>(null);
  
  // 篩選條件
  const [storeFilter, setStoreFilter] = useState('ALL');
  const [paymentFilter, setPaymentFilter] = useState('ALL');
  const [page, setPage] = useState(1);

  // 訂單作廢 Modal
  const [voidTarget, setVoidTarget] = useState<any | null>(null);
  const [voidReason, setVoidReason] = useState('店長確認後台作廢');
  const [voidLoading, setVoidLoading] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);

  useEffect(() => {
    loadSales();
  }, [storeFilter, paymentFilter, page]);

  const loadSales = async () => {
    setLoading(true);
    try {
      const [salesRes, analyticsRes] = await Promise.all([
        reportsApi.sales({
          storeId: storeFilter !== 'ALL' ? storeFilter : undefined,
          paymentMethod: paymentFilter !== 'ALL' ? paymentFilter : undefined,
          page,
          pageSize: 20,
        }),
        reportsApi.analytics(storeFilter !== 'ALL' ? storeFilter : undefined, '7'),
      ]);

      if (salesRes.success) setOrders(salesRes.data);
      if (analyticsRes.success) setAnalytics(analyticsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleVoidSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voidTarget) return;

    setVoidLoading(true);
    setVoidError(null);
    try {
      await reportsApi.voidOrder(voidTarget.id, voidReason);
      setVoidTarget(null);
      loadSales();
    } catch (err: any) {
      setVoidError(err.message || '作廢失敗');
    } finally {
      setVoidLoading(false);
    }
  };

  const rawKpi = analytics?.kpi || {};
  const totalRevenue = Number(rawKpi.totalRevenue || 0);
  const totalOrders = Number(rawKpi.totalOrders ?? rawKpi.orderCount ?? 0);
  const cashAmount = Number(rawKpi.cashRevenue ?? rawKpi.cashAmount ?? 0);
  const cardAmount = Number(rawKpi.cardRevenue ?? rawKpi.cardAmount ?? 0);
  const remitAmount = Number(rawKpi.remitRevenue ?? rawKpi.remitAmount ?? 0);
  const voidCount = Number(rawKpi.voidCount || 0);
  const avgTicket = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

  const totalAmount = cashAmount + cardAmount + remitAmount || 1;
  const cashPct = Math.round((cashAmount / totalAmount) * 100);
  const cardPct = Math.round((cardAmount / totalAmount) * 100);
  const remitPct = Math.round((remitAmount / totalAmount) * 100);

  return (
    <div className="space-y-6">
      {/* 標題與串流匯出 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-800/60 p-5 rounded-2xl border border-slate-700/60">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-400" />
            <h1 className="text-xl font-bold text-white">財務營收流水與多維銷售報表</h1>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            提供多維金流拆分、跨日作廢庫存點數原子回退、以及日結營運指標審計。
          </p>
        </div>
      </div>

      {/* KPI 卡片區 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800/70 border border-slate-700/80 rounded-2xl p-4">
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>累計營業額</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-white mt-2">
            ${totalRevenue.toLocaleString()}
          </div>
          <div className="text-[11px] text-emerald-400 font-medium mt-1">
            客單價: ${avgTicket}
          </div>
        </div>

        <div className="bg-slate-800/70 border border-slate-700/80 rounded-2xl p-4">
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>總訂單數</span>
            <TrendingUp className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-extrabold text-white mt-2">
            {totalOrders} <span className="text-xs font-normal text-slate-400">筆交易</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            作廢率: {totalOrders > 0 ? Math.round((voidCount / totalOrders) * 100) : 0}% ({voidCount} 筆作廢)
          </div>
        </div>

        {/* 支付管道佔比條 */}
        <div className="lg:col-span-2 bg-slate-800/70 border border-slate-700/80 rounded-2xl p-4">
          <div className="text-xs text-slate-400 mb-2 flex justify-between">
            <span>金流管道分佈比例 (現金 / 刷卡 / 匯款)</span>
            <span className="font-semibold text-slate-300">總實收: ${totalRevenue.toLocaleString()}</span>
          </div>
          {/* 彩色比例長條 */}
          <div className="w-full h-3.5 bg-slate-900 rounded-full overflow-hidden flex border border-slate-700">
            <div style={{ width: `${cashPct}%` }} className="bg-emerald-500 h-full" title={`現金 ${cashPct}%`}></div>
            <div style={{ width: `${cardPct}%` }} className="bg-blue-500 h-full" title={`刷卡 ${cardPct}%`}></div>
            <div style={{ width: `${remitPct}%` }} className="bg-amber-500 h-full" title={`匯款 ${remitPct}%`}></div>
          </div>
          <div className="flex justify-between items-center text-[11px] text-slate-400 mt-2">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span> 現金: ${cashAmount.toLocaleString()} ({cashPct}%)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span> 刷卡: ${cardAmount.toLocaleString()} ({cardPct}%)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span> 匯款: ${remitAmount.toLocaleString()} ({remitPct}%)
            </span>
          </div>
        </div>
      </div>

      {/* 篩選欄 */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={storeFilter}
          onChange={(e) => setStoreFilter(e.target.value)}
          className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200"
        >
          <option value="ALL">全部門市</option>
          <option value="chupei">竹北門市</option>
          <option value="jinshan">金山門市</option>
        </select>

        <select
          value={paymentFilter}
          onChange={(e) => setPaymentFilter(e.target.value)}
          className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200"
        >
          <option value="ALL">全部支付方式</option>
          <option value="CASH">純現金支付</option>
          <option value="CREDIT_CARD">信用卡</option>
          <option value="REMITTANCE">銀行匯款</option>
        </select>
      </div>

      {/* 銷售訂單表格 */}
      <div className="bg-slate-800/70 border border-slate-700/80 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900/60 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-700">
              <tr>
                <th className="py-3 px-4">訂單單號</th>
                <th className="py-3 px-4">門市</th>
                <th className="py-3 px-4 text-right">實收金額</th>
                <th className="py-3 px-4">支付拆分</th>
                <th className="py-3 px-4 text-center">狀態</th>
                <th className="py-3 px-4">交易時間</th>
                <th className="py-3 px-4 text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60 text-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    載入中...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    查無銷售流水紀錄
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-750/50 transition">
                    <td className="py-3 px-4 font-mono text-xs font-semibold text-white">
                      {o.checkoutUID || o.id}
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <span className="px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
                        {o.storeId === 'chupei' ? '竹北店' : '金山店'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                      ${o.receivedAmount?.toLocaleString() || 0}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-400">
                      {o.cash > 0 && <span className="mr-1.5 text-emerald-300">現${o.cash}</span>}
                      {o.creditCard > 0 && <span className="mr-1.5 text-blue-300">卡${o.creditCard}</span>}
                      {o.remittance > 0 && <span className="text-amber-300">匯${o.remittance}</span>}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                        o.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-300' :
                        o.status === 'CANCELLED' ? 'bg-rose-500/20 text-rose-300' :
                        'bg-slate-700 text-slate-300'
                      }`}>
                        {o.status === 'COMPLETED' ? '已完成' : o.status === 'CANCELLED' ? '已作廢' : o.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-400">
                      {new Date(o.createdAt).toLocaleString('zh-TW')}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {o.status !== 'CANCELLED' && (
                        <button
                          onClick={() => {
                            setVoidTarget(o);
                            setVoidError(null);
                          }}
                          className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg text-xs font-medium transition"
                        >
                          作廢
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 作廢訂單 Modal (原子庫存回退與 Outbox LINE 通知) */}
      {voidTarget && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button onClick={() => setVoidTarget(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 mb-2">
              <Trash2 className="w-5 h-5 text-rose-400" />
              <h3 className="text-lg font-bold text-white">訂單作廢與沖帳</h3>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              作廢後系統將自動將<strong className="text-emerald-400">訂單內商品回補門市庫存</strong>，並將消耗或贈送之點數回退。
            </p>

            <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-700/60 mb-4 text-xs space-y-1">
              <div>單號：<span className="font-mono text-white">{voidTarget.checkoutUID || voidTarget.id}</span></div>
              <div>金額：<span className="font-bold text-amber-400">${voidTarget.receivedAmount} 元</span></div>
            </div>

            {voidError && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{voidError}</span>
              </div>
            )}

            <form onSubmit={handleVoidSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">作廢原因 (寫入審計鏈與 LINE 通知)</label>
                <input
                  type="text"
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setVoidTarget(null)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium rounded-xl"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={voidLoading}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl disabled:opacity-50"
                >
                  {voidLoading ? '作廢中...' : '確認作廢並回退'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
