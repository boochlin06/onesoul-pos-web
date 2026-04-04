import { useState, useMemo, useEffect } from 'react';
import { Search, ClipboardCheck, Plus, Trash2, Send, Loader2, ChevronDown, RotateCcw, CheckCircle2, Circle } from 'lucide-react';
import { RefreshButton } from '../ui/RefreshButton';
import { ConfirmModal } from '../ui/ConfirmModal';
import type { Branch, InventoryCheckItem } from '../../types';

// 類別 → 顏色對應
const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string; stripe: string }> = {
  '公仔':   { bg: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-200', stripe: 'border-l-violet-400' },
  '模型':   { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',   stripe: 'border-l-blue-400' },
  '盲盒':   { bg: 'bg-pink-50',    text: 'text-pink-700',    border: 'border-pink-200',   stripe: 'border-l-pink-400' },
  '配件':   { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',  stripe: 'border-l-amber-400' },
  '海報':   { bg: 'bg-cyan-50',    text: 'text-cyan-700',    border: 'border-cyan-200',   stripe: 'border-l-cyan-400' },
  '衣服':   { bg: 'bg-teal-50',    text: 'text-teal-700',    border: 'border-teal-200',   stripe: 'border-l-teal-400' },
  '文具':   { bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200', stripe: 'border-l-orange-400' },
  '食品':   { bg: 'bg-lime-50',    text: 'text-lime-700',    border: 'border-lime-200',   stripe: 'border-l-lime-400' },
  '周邊':   { bg: 'bg-indigo-50',  text: 'text-indigo-700',  border: 'border-indigo-200', stripe: 'border-l-indigo-400' },
  '(新增)': { bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200',   stripe: 'border-l-rose-400' },
};
const DEFAULT_CAT = { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200', stripe: 'border-l-slate-300' };
const getCat = (c: string) => CATEGORY_COLORS[c] || DEFAULT_CAT;

interface Props {
  branch: Branch;
  setBranch: (b: Branch) => void;
  items: InventoryCheckItem[];
  loading: boolean;
  submitting: boolean;
  onRefresh: () => void;
  onUpdateQty: (index: number, qty: number) => void;
  onToggleCheck: (index: number) => void;
  onReset: () => void;
  onUpdateRemark: (index: number, remark: string) => void;
  onAddNew: (id: string, name: string, qty: number) => void;
  onRemoveNew: (index: number) => void;
  onSubmit: (staff: string, note: string) => Promise<{ success: boolean; message?: string }>;
  userEmail: string;
}

export function InventoryCheckView({
  branch, setBranch, items, loading, submitting,
  onRefresh, onUpdateQty, onToggleCheck, onReset, onUpdateRemark,
  onAddNew, onRemoveNew, onSubmit, userEmail,
}: Props) {
  const [search, setSearch] = useState('');
  const [showAddRow, setShowAddRow] = useState(false);
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newQty, setNewQty] = useState(1);
  const [note, setNote] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

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
  const checkedCount = useMemo(() => items.filter(it => it.checked).length, [items]);
  const progress = items.length > 0 ? Math.round((checkedCount / items.length) * 100) : 0;

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
    <div className="flex flex-col gap-4 sm:gap-6 mb-24 max-w-7xl mx-auto w-full">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">

        {/* ═══ Header ═══ */}
        <div className="p-3 sm:p-5 flex flex-col gap-3 border-b border-slate-200 bg-slate-50">
          {/* Title row */}
          <div className="flex items-center gap-2 flex-wrap">
            <ClipboardCheck className="w-5 h-5 text-indigo-600 shrink-0" />
            <h2 className="font-extrabold text-slate-800 text-base sm:text-lg tracking-tight">庫存盤點</h2>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-extrabold tracking-wider border ${branch === '金山' ? 'text-blue-700 bg-blue-50 border-blue-200' : 'text-emerald-700 bg-emerald-50 border-emerald-200'}`}>
              📍 {branch}
            </span>
            {items.length > 0 && (
              <>
                {diffCount > 0 && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">{diffCount} 差異</span>}
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">✅ {checkedCount}/{items.length}</span>
              </>
            )}
          </div>

          {/* Controls row */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                className="w-full pl-9 pr-3 py-2 sm:py-2.5 bg-white border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl outline-none font-bold text-sm text-slate-700 transition-all shadow-sm placeholder:text-slate-400"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="搜尋..."
              />
            </div>
            <div className="relative shrink-0">
              <select
                className="appearance-none pl-3 pr-8 py-2 sm:py-2.5 bg-white border border-slate-300 rounded-xl outline-none font-bold text-sm text-slate-700 cursor-pointer shadow-sm"
                value={branch}
                onChange={e => setBranch(e.target.value as Branch)}
              >
                <option value="竹北">🏪 竹北</option>
                <option value="金山">🏪 金山</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
            {items.length > 0 && (
              <button onClick={onReset} className="flex items-center gap-1 px-2.5 py-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold transition-colors border border-slate-300 hover:border-rose-300 shrink-0" title="重置">
                <RotateCcw className="w-3.5 h-3.5" /> 重置
              </button>
            )}
            <RefreshButton onClick={onRefresh} isLoading={loading} variant="toolbar" />
          </div>
        </div>

        {/* ═══ Progress ═══ */}
        {items.length > 0 && (
          <div className="h-1.5 bg-slate-100">
            <div className={`h-full transition-all duration-500 ease-out rounded-r ${progress === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${progress}%` }} />
          </div>
        )}

        {/* Result Banner */}
        {result && (
          <div className={`px-4 py-2.5 text-sm font-bold border-b ${result.ok ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
            {result.msg}
          </div>
        )}

        {/* ═══ Content ═══ */}
        {loading ? (
          <div className="p-16 sm:p-24 flex flex-col items-center justify-center text-slate-500">
            <Loader2 className="w-10 h-10 mb-4 animate-spin text-indigo-500" />
            <span className="font-bold tracking-wider text-sm">正在讀取 {branch} 盤點清單...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="p-16 sm:p-24 flex flex-col items-center justify-center text-slate-400">
            <ClipboardCheck className="w-12 h-12 mb-4 text-slate-300" />
            <span className="font-bold text-base">目前沒有需要盤點的品項</span>
            <span className="text-sm mt-1">請選擇門市後點擊重新整理載入資料</span>
          </div>
        ) : (
          <>
            {/* ── Mobile Card View (< lg) ── */}
            <div className="block lg:hidden divide-y divide-slate-100 max-h-[65vh] overflow-y-auto">
              {filtered.map((r, i) => {
                const realIndex = items.indexOf(r);
                const diff = r.actualQty - r.systemQty;
                const cat = getCat(r.category || '');
                return (
                  <div key={i} className={`p-3 border-l-4 ${cat.stripe} ${r.checked ? 'bg-emerald-50/40' : diff !== 0 ? 'bg-amber-50/30' : 'bg-white'}`}>
                    {/* Row 1: Check + Name + Category */}
                    <div className="flex items-start gap-2">
                      <button onClick={() => onToggleCheck(realIndex)} className="mt-0.5 shrink-0">
                        {r.checked ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <Circle className="w-5 h-5 text-slate-300" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-bold text-[15px] leading-snug ${r.checked ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{r.name}</span>
                          {r.isNew && (
                            <button onClick={() => onRemoveNew(realIndex)} className="text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="font-mono text-[10px] text-slate-400">{r.id}</span>
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold ${cat.bg} ${cat.text} border ${cat.border}`}>{r.category || '未分類'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Row 2: Qty controls */}
                    <div className="flex items-center gap-3 mt-2.5 ml-7">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">系統</span>
                        <span className="font-mono font-bold text-sm text-slate-600 w-8 text-center">{r.systemQty}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">實際</span>
                        <input
                          type="number"
                          min="0"
                          inputMode="numeric"
                          className={`w-16 px-2 py-1.5 text-center font-mono font-bold text-sm rounded-lg border outline-none ${diff !== 0 ? 'border-amber-400 bg-amber-50 text-amber-800' : 'border-slate-300 bg-white text-slate-700'} focus:ring-2 focus:ring-indigo-200`}
                          value={r.actualQty}
                          onChange={e => onUpdateQty(realIndex, parseInt(e.target.value) || 0)}
                        />
                      </div>
                      {diff !== 0 && (
                        <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-extrabold ${diff > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                          {diff > 0 ? '+' : ''}{diff}
                        </span>
                      )}
                    </div>

                    {/* Row 3: Per-item remark */}
                    <div className="mt-2 ml-7">
                      <input
                        type="text"
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-200 placeholder:text-slate-300 font-medium"
                        placeholder="備註（有損、顏色差...）"
                        value={r.itemRemark || ''}
                        onChange={e => onUpdateRemark(realIndex, e.target.value)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Desktop Table (>= lg) ── */}
            <div className="hidden lg:block overflow-x-auto max-h-[65vh]">
              <table className="w-full text-sm text-slate-700 whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-3 text-center font-extrabold uppercase tracking-wider text-xs w-12">✓</th>
                    <th className="px-4 py-3 text-left font-extrabold uppercase tracking-wider text-xs w-24">貨號</th>
                    <th className="px-4 py-3 text-left font-extrabold uppercase tracking-wider text-xs">品名</th>
                    <th className="px-4 py-3 text-left font-extrabold uppercase tracking-wider text-xs w-20">類別</th>
                    <th className="px-4 py-3 text-center font-extrabold uppercase tracking-wider text-xs w-24">系統</th>
                    <th className="px-4 py-3 text-center font-extrabold uppercase tracking-wider text-xs w-28">實際</th>
                    <th className="px-4 py-3 text-center font-extrabold uppercase tracking-wider text-xs w-20">差異</th>
                    <th className="px-4 py-3 text-left font-extrabold uppercase tracking-wider text-xs w-48">備註</th>
                    <th className="px-3 py-3 w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((r, i) => {
                    const realIndex = items.indexOf(r);
                    const diff = r.actualQty - r.systemQty;
                    const cat = getCat(r.category || '');
                    return (
                      <tr key={i} className={`transition-all border-l-4 ${cat.stripe} ${r.checked ? 'bg-emerald-50/40' : diff !== 0 ? 'bg-amber-50/30' : 'bg-white hover:bg-indigo-50/50'}`}>
                        <td className="px-3 py-3 text-center">
                          <button onClick={() => onToggleCheck(realIndex)} className="transition-colors">
                            {r.checked ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <Circle className="w-5 h-5 text-slate-300 hover:text-slate-500" />}
                          </button>
                        </td>
                        <td className={`px-4 py-3 font-mono font-bold text-xs ${r.checked ? 'text-slate-400 line-through' : 'text-slate-500'}`}>{r.id}</td>
                        <td className={`px-4 py-3 font-bold whitespace-normal min-w-[200px] leading-relaxed text-[15px] ${r.checked ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{r.name}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-extrabold tracking-wider ${cat.bg} ${cat.text} border ${cat.border}`}>{r.category || '未分類'}</span>
                        </td>
                        <td className="px-4 py-3 text-center font-mono font-bold text-slate-600 text-base">{r.systemQty}</td>
                        <td className="px-4 py-3 text-center">
                          <input type="number" min="0"
                            className={`w-20 px-3 py-2 text-center font-mono font-bold text-base rounded-lg border outline-none ${diff !== 0 ? 'border-amber-400 bg-amber-50 text-amber-800' : 'border-slate-300 bg-white text-slate-700'} focus:ring-2 focus:ring-indigo-200`}
                            value={r.actualQty}
                            onChange={e => onUpdateQty(realIndex, parseInt(e.target.value) || 0)}
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          {diff !== 0 && (
                            <span className={`inline-flex px-2.5 py-1 rounded-lg text-sm font-extrabold ${diff > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                              {diff > 0 ? '+' : ''}{diff}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <input type="text"
                            className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-200 placeholder:text-slate-300 font-medium"
                            placeholder="備註..."
                            value={r.itemRemark || ''}
                            onChange={e => onUpdateRemark(realIndex, e.target.value)}
                          />
                        </td>
                        <td className="px-3 py-3 text-center">
                          {r.isNew && (
                            <button onClick={() => onRemoveNew(realIndex)} className="text-rose-400 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ═══ Add New Item ═══ */}
        {items.length > 0 && (
          <div className="p-3 sm:p-4 border-t border-slate-200 bg-slate-50/50">
            {showAddRow ? (
              <div className="flex items-center gap-2 flex-wrap">
                <input type="text" className="w-24 px-2 py-2 border border-slate-300 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-200" placeholder="貨號" value={newId} onChange={e => setNewId(e.target.value)} />
                <input type="text" className="flex-1 min-w-[140px] px-2 py-2 border border-slate-300 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-200" placeholder="品名 *" value={newName} onChange={e => setNewName(e.target.value)} />
                <input type="number" min="1" inputMode="numeric" className="w-16 px-2 py-2 text-center border border-slate-300 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-200" value={newQty} onChange={e => setNewQty(parseInt(e.target.value) || 1)} />
                <button onClick={handleAddNew} className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700">加入</button>
                <button onClick={() => setShowAddRow(false)} className="px-3 py-2 bg-slate-200 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-300">取消</button>
              </div>
            ) : (
              <button onClick={() => setShowAddRow(true)} className="flex items-center gap-2 px-3 py-2 text-indigo-600 hover:bg-indigo-50 rounded-lg text-sm font-bold transition-colors">
                <Plus className="w-4 h-4" /> 新增系統外品項
              </button>
            )}
          </div>
        )}

        {/* ═══ Submit ═══ */}
        {items.length > 0 && (
          <div className="p-3 sm:p-5 border-t border-slate-200 bg-gradient-to-r from-slate-50 to-indigo-50/30">
            <div className="flex items-center gap-3 flex-wrap">
              <input type="text" className="flex-1 min-w-[120px] px-3 py-2 sm:py-2.5 border border-slate-300 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-200 placeholder:text-slate-400" placeholder="總備註（選填）" value={note} onChange={e => setNote(e.target.value)} />
              <button
                onClick={() => {
                  if (diffCount === 0) { setResult({ ok: false, msg: '所有品項數量都和系統一致，沒有差異需要提交' }); return; }
                  setConfirmOpen(true);
                }}
                disabled={submitting || items.length === 0}
                className="flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-extrabold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span className="hidden sm:inline">📤 提交盤點（{diffCount} 筆差異）</span>
                <span className="sm:hidden">📤 提交 ({diffCount})</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirm Modal */}
      {confirmOpen && (
        <ConfirmModal
          title="確認提交盤點"
          confirmLabel="提交"
          message={
            <div className="space-y-2">
              <span className="font-bold text-amber-600">即將提交 {diffCount} 筆差異（{branch}門市）</span>
              <p className="text-sm text-slate-600">提交後由管理者審核才會更新庫存。</p>
              {checkedCount < items.length && (
                <p className="text-xs text-amber-500 font-bold">⚠️ 尚有 {items.length - checkedCount} 筆未勾選確認</p>
              )}
            </div>
          }
          onConfirm={handleSubmit}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </div>
  );
}
