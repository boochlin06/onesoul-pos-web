import { useState, useEffect, useCallback } from 'react';
import { Radio, Loader2, User, Clock, ShoppingCart, Package } from 'lucide-react';
import { apiGetDrafts } from '../../services/api';
import type { Branch } from '../../types';

interface DraftSession {
  sessionId: string;
  email: string;
  data: {
    customer?: { phoneName?: string; name?: string };
    lotteries?: { id?: string; setName?: string; prize?: string; draws?: number; amount?: number }[];
    merchandises?: { id?: string; name?: string; quantity?: number; actualAmount?: number }[];
    payment?: { cash?: number; creditCard?: number; remittance?: number };
    orderNote?: string;
  };
  ts: number;
  ago: number;
}

interface MonitorViewProps {
  branch: Branch;
}

function formatAgo(seconds: number): string {
  if (seconds < 60) return `${seconds} 秒前`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分鐘前`;
  return `${Math.floor(seconds / 3600)} 小時前`;
}

export function MonitorView({ branch }: MonitorViewProps) {
  const [enabled, setEnabled] = useState(false);
  const [drafts, setDrafts] = useState<DraftSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastFetch, setLastFetch] = useState<number | null>(null);

  const fetchDrafts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGetDrafts(branch);
      if (res.success && res.data) {
        setDrafts(res.data as DraftSession[]);
        setLastFetch(Date.now());
      }
    } catch {}
    finally { setLoading(false); }
  }, [branch]);

  // Polling every 60s when enabled
  useEffect(() => {
    if (!enabled) return;
    fetchDrafts();
    const timer = setInterval(fetchDrafts, 60000);
    return () => clearInterval(timer);
  }, [enabled, fetchDrafts]);

  // Reset when branch changes
  useEffect(() => { setDrafts([]); setLastFetch(null); }, [branch]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Radio className={`w-5 h-5 ${enabled ? 'text-emerald-500 animate-pulse' : 'text-slate-400'}`} />
            <h2 className="text-xl font-bold text-slate-800">即時結帳監控</h2>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            查看店員目前正在輸入的結帳資料（{branch}）
          </p>
        </div>
        <div className="flex items-center gap-4">
          {lastFetch && (
            <span className="text-xs text-slate-400">
              上次更新：{new Date(lastFetch).toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={() => setEnabled(e => !e)}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${enabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
          <span className={`text-sm font-bold ${enabled ? 'text-emerald-600' : 'text-slate-400'}`}>
            {enabled ? '監控中' : '已關閉'}
          </span>
        </div>
      </div>

      {!enabled ? (
        <div className="bg-white rounded-2xl p-16 text-center text-slate-400 border border-slate-100">
          <Radio className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p>點擊右上角開關啟動監控</p>
          <p className="text-xs mt-1">啟動後每 60 秒自動更新</p>
        </div>
      ) : loading && drafts.length === 0 ? (
        <div className="bg-white rounded-2xl p-16 text-center text-slate-400 border border-slate-100">
          <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin text-emerald-500" />
          <p>載入中...</p>
        </div>
      ) : drafts.length === 0 ? (
        <div className="bg-white rounded-2xl p-16 text-center text-slate-400 border border-slate-100">
          <ShoppingCart className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p>目前沒有進行中的結帳</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {drafts.map(d => {
            const { customer, lotteries, merchandises, payment, orderNote } = d.data;
            const activeLotteries = (lotteries || []).filter(l => l.id || l.prize);
            const activeMerch = (merchandises || []).filter(m => m.id || m.name);
            const totalAmount = (payment?.cash || 0) + (payment?.creditCard || 0) + (payment?.remittance || 0);

            return (
              <div key={d.sessionId} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {/* Header */}
                <div className="px-5 py-3 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-emerald-600" />
                    <span className="text-sm font-bold text-emerald-700">{d.email}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    <Clock className="w-3 h-3" />
                    {formatAgo(d.ago)}
                    {loading && <Loader2 className="w-3 h-3 animate-spin ml-1" />}
                  </div>
                </div>

                <div className="px-5 py-4 space-y-3">
                  {/* Customer */}
                  {customer?.phoneName && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 w-12">顧客</span>
                      <span className="text-sm font-semibold text-slate-700">
                        {customer.name || '—'} ({customer.phoneName})
                      </span>
                    </div>
                  )}

                  {/* Lotteries */}
                  {activeLotteries.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1 text-xs text-amber-600 font-bold mb-1">
                        <ShoppingCart className="w-3 h-3" /> 福袋 ({activeLotteries.length})
                      </div>
                      {activeLotteries.map((l, i) => (
                        <div key={i} className="text-xs text-slate-600 pl-4">
                          #{l.id} {l.setName} — {l.prize || '?'}賞 × {l.draws || 0}抽
                          {l.amount ? ` $${l.amount}` : ''}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Merchandise */}
                  {activeMerch.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1 text-xs text-indigo-600 font-bold mb-1">
                        <Package className="w-3 h-3" /> 直購 ({activeMerch.length})
                      </div>
                      {activeMerch.map((m, i) => (
                        <div key={i} className="text-xs text-slate-600 pl-4">
                          {m.id} {m.name} × {m.quantity || 1}
                          {m.actualAmount ? ` $${m.actualAmount}` : ''}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Payment summary */}
                  {totalAmount > 0 && (
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                      <span className="text-xs text-slate-400 w-12">金額</span>
                      <span className="text-sm font-bold text-slate-800">NT$ {totalAmount.toLocaleString()}</span>
                      <span className="text-xs text-slate-400 ml-auto">
                        {payment?.cash ? `現${payment.cash}` : ''}
                        {payment?.creditCard ? ` 卡${payment.creditCard}` : ''}
                        {payment?.remittance ? ` 匯${payment.remittance}` : ''}
                      </span>
                    </div>
                  )}

                  {/* Order note */}
                  {orderNote && (
                    <div className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-1.5">
                      📝 {orderNote}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
