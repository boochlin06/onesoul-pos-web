import { useState, useMemo, useEffect } from 'react';
import { Search, ClipboardCheck, Plus, Trash2, Send, Loader2, ChevronDown, AlertTriangle } from 'lucide-react';
import { RefreshButton } from '../ui/RefreshButton';
import { ConfirmModal } from '../ui/ConfirmModal';
import type { Branch, InventoryCheckItem } from '../../types';

interface Props {
  branch: Branch;
  setBranch: (b: Branch) => void;
  items: InventoryCheckItem[];
  loading: boolean;
  submitting: boolean;
  onRefresh: () => void;
  onUpdateQty: (index: number, qty: number) => void;
  onAddNew: (id: string, name: string, qty: number) => void;
  onRemoveNew: (index: number) => void;
  onSubmit: (staff: string, note: string) => Promise<{ success: boolean; message?: string }>;
  userEmail: string;
}

export function InventoryCheckView({
  branch, setBranch, items, loading, submitting,
  onRefresh, onUpdateQty, onAddNew, onRemoveNew, onSubmit, userEmail,
}: Props) {
  const [search, setSearch] = useState('');
  const [showAddRow, setShowAddRow] = useState(false);
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newQty, setNewQty] = useState(1);
  const [note, setNote] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // 重新載入時清除結果
  useEffect(() => { setResult(null); }, [items]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return items;
    return items.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.id.toLowerCase().includes(q) ||
      (r.category && r.category.toLowerCase().includes(q))
    );
  }, [items, search]);

  const diffCount = useMemo(() => items.filter(it => it.isNew || it.actualQty !== it.systemQty).length, [items]);

  const handleAddNew = () => {
    if (!newName.trim()) return;
    onAddNew(newId.trim() || '(新增)', newName.trim(), newQty);
    setNewId(''); setNewName(''); setNewQty(1); setShowAddRow(false);
  };

  const handleSubmit = async () => {
    setConfirmOpen(false);
    const res = await onSubmit(userEmail, note);
    setResult({ ok: res.success, msg: res.message || (res.success ? '提交成功' : '提交失敗') });
  };

  return (
    <div className="flex flex-col gap-6 mb-24 max-w-7xl mx-auto w-full">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">

        {/* Header */}
        <div className="p-4 sm:p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <ClipboardCheck className="w-5 h-5 text-indigo-600" />
            <h2 className="font-extrabold text-slate-800 text-lg tracking-tight">庫存盤點清單</h2>
            {diffCount > 0 && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200">
                {diffCount} 筆差異
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl outline-none font-bold text-slate-700 transition-all shadow-sm placeholder:text-slate-400 placeholder:font-medium"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="搜尋貨號、品名..."
              />
            </div>

            <div className="relative shrink-0">
              <select
                className="appearance-none pl-4 pr-10 py-2.5 bg-white border border-slate-300 focus:border-indigo-500 focus:ring-2 hover:bg-slate-50 focus:ring-indigo-100 rounded-xl outline-none font-bold text-slate-700 transition-all cursor-pointer shadow-sm text-sm"
                value={branch}
                onChange={e => setBranch(e.target.value as Branch)}
              >
                <option value="竹北">竹北</option>
                <option value="金山">金山</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <ChevronDown className="w-5 h-5 text-slate-400" />
              </div>
            </div>

            <RefreshButton onClick={onRefresh} isLoading={loading} variant="toolbar" />
          </div>
        </div>

        {/* Result Banner */}
        {result && (
          <div className={`px-5 py-3 text-sm font-bold border-b ${result.ok ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
            {result.msg}
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="p-24 flex flex-col items-center justify-center text-slate-500">
            <Loader2 className="w-10 h-10 mb-4 animate-spin text-indigo-500" />
            <span className="font-bold tracking-wider">正在讀取盤點清單...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="p-24 flex flex-col items-center justify-center text-slate-400">
            <ClipboardCheck className="w-12 h-12 mb-4 text-slate-300" />
            <span className="font-bold text-base">目前沒有需要盤點的品項</span>
            <span className="text-sm mt-1">請先點擊重新整理載入資料</span>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[65vh]">
            <table className="w-full text-sm text-slate-700 whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left font-extrabold uppercase tracking-wider text-xs w-24">貨號</th>
                  <th className="px-4 py-3 text-left font-extrabold uppercase tracking-wider text-xs">品名</th>
                  <th className="px-4 py-3 text-left font-extrabold uppercase tracking-wider text-xs w-20">類別</th>
                  <th className="px-4 py-3 text-center font-extrabold uppercase tracking-wider text-xs w-24">系統數量</th>
                  <th className="px-4 py-3 text-center font-extrabold uppercase tracking-wider text-xs w-28">實際數量</th>
                  <th className="px-4 py-3 text-center font-extrabold uppercase tracking-wider text-xs w-20">差異</th>
                  <th className="px-4 py-3 text-center font-extrabold uppercase tracking-wider text-xs w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r, i) => {
                  const realIndex = items.indexOf(r);
                  const diff = r.actualQty - r.systemQty;
                  return (
                    <tr key={i} className={`hover:bg-indigo-50/50 transition-all bg-white ${diff !== 0 ? 'bg-amber-50/30' : ''}`}>
                      <td className="px-4 py-2.5 font-mono font-bold text-slate-500 text-xs">{r.id}</td>
                      <td className="px-4 py-2.5 font-bold text-slate-800 whitespace-normal min-w-[200px] leading-relaxed">{r.name}</td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600">
                          {r.category || '未分類'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center font-mono font-bold text-slate-600">{r.systemQty}</td>
                      <td className="px-4 py-2.5 text-center">
                        <input
                          type="number"
                          min="0"
                          className={`w-20 px-3 py-1.5 text-center font-mono font-bold rounded-lg border transition-all outline-none ${diff !== 0 ? 'border-amber-400 bg-amber-50 text-amber-800 focus:ring-amber-200' : 'border-slate-300 bg-white text-slate-700 focus:ring-indigo-200'} focus:ring-2`}
                          value={r.actualQty}
                          onChange={e => onUpdateQty(realIndex, parseInt(e.target.value) || 0)}
                        />
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {diff !== 0 && (
                          <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-extrabold ${diff > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                            {diff > 0 ? '+' : ''}{diff}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {r.isNew && (
                          <button onClick={() => onRemoveNew(realIndex)} className="text-rose-400 hover:text-rose-600 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Add New Item Row */}
        {items.length > 0 && (
          <div className="p-4 border-t border-slate-200 bg-slate-50/50">
            {showAddRow ? (
              <div className="flex items-center gap-3 flex-wrap">
                <input
                  type="text"
                  className="w-28 px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-200"
                  placeholder="貨號(選填)"
                  value={newId}
                  onChange={e => setNewId(e.target.value)}
                />
                <input
                  type="text"
                  className="flex-1 min-w-[200px] px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-200"
                  placeholder="品名 *"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                />
                <input
                  type="number"
                  min="1"
                  className="w-20 px-3 py-2 text-center border border-slate-300 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-200"
                  placeholder="數量"
                  value={newQty}
                  onChange={e => setNewQty(parseInt(e.target.value) || 1)}
                />
                <button onClick={handleAddNew} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors">
                  加入
                </button>
                <button onClick={() => setShowAddRow(false)} className="px-4 py-2 bg-slate-200 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-300 transition-colors">
                  取消
                </button>
              </div>
            ) : (
              <button onClick={() => setShowAddRow(true)} className="flex items-center gap-2 px-4 py-2 text-indigo-600 hover:bg-indigo-50 rounded-lg text-sm font-bold transition-colors">
                <Plus className="w-4 h-4" /> 新增系統外品項
              </button>
            )}
          </div>
        )}

        {/* Submit Area */}
        {items.length > 0 && (
          <div className="p-4 sm:p-5 border-t border-slate-200 bg-gradient-to-r from-slate-50 to-indigo-50/30">
            <div className="flex items-center gap-4 flex-wrap">
              <input
                type="text"
                className="flex-1 min-w-[200px] px-4 py-2.5 border border-slate-300 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-200 placeholder:text-slate-400"
                placeholder="備註（選填，例如：有一箱新到貨）"
                value={note}
                onChange={e => setNote(e.target.value)}
              />
              <button
                onClick={() => {
                  if (diffCount === 0) {
                    setResult({ ok: false, msg: '所有品項數量都和系統一致，沒有差異需要提交' });
                    return;
                  }
                  setConfirmOpen(true);
                }}
                disabled={submitting || items.length === 0}
                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-extrabold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                📤 提交盤點（{diffCount} 筆差異）
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirm Modal */}
      {confirmOpen && (
        <ConfirmModal
          title="確認提交盤點"
          onConfirm={handleSubmit}
          onCancel={() => setConfirmOpen(false)}
        >
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-bold">即將提交 {diffCount} 筆差異項目</span>
            </div>
            <p className="text-sm text-slate-600">
              提交後資料會寫入「庫存盤點單」，由管理者審核後才會更新實際庫存。
            </p>
          </div>
        </ConfirmModal>
      )}
    </div>
  );
}
