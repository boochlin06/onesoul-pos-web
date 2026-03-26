import { useState, useMemo, useCallback } from 'react';
import { Search, BookOpen, Trash2, X, Loader2, Plus, Package } from 'lucide-react';
import { branchBadge, CREATE_SET_CONFIG } from '../../constants';
import { gasPost } from '../../services/api';
import { calcSuggestedPrice, validateCreateSetPrice } from '../../logic/createSet';
import type { Branch, PrizeEntry } from '../../types';

interface PrizeLibraryViewProps {
  branch: Branch;
  prizes: PrizeEntry[];
  isLoading: boolean;
  onDeletePrize: (entries: PrizeEntry[]) => void;
  onCreateSetSuccess: () => void;
  showBanner: (msg: string, type: 'ok' | 'err' | 'loading', autoDismiss?: boolean) => void;
}

const { drawOptions: DRAW_OPTIONS, priceMultiplier, minPriceRatio, maxPriceRatio } = CREATE_SET_CONFIG;

export function PrizeLibraryView({ branch, prizes, isLoading, onDeletePrize, onCreateSetSuccess, showBanner }: PrizeLibraryViewProps) {
  const [search, setSearch] = useState('');
  const [filterBranch, setFilterBranch] = useState<'all' | Branch>('all');

  // ── Create Set Modal State ──
  const [showCreateSet, setShowCreateSet] = useState(false);
  const [csItemNo, setCsItemNo] = useState('');
  const [csItemName, setCsItemName] = useState('');
  const [csItemPoints, setCsItemPoints] = useState(0);
  const [csTotalDraws, setCsTotalDraws] = useState(0);
  const [csActualPrice, setCsActualPrice] = useState('');
  const [csLookupLoading, setCsLookupLoading] = useState(false);
  const [csSubmitting, setCsSubmitting] = useState(false);
  const [csError, setCsError] = useState('');
  const [csSuccess, setCsSuccess] = useState<{ setId: string; setName: string } | null>(null);

  const csSuggestedPrice = useMemo(() => {
    if (!csItemPoints || !csTotalDraws) return 0;
    return calcSuggestedPrice(csItemPoints, csTotalDraws, priceMultiplier);
  }, [csItemPoints, csTotalDraws]);

  const handleLookupItem = useCallback(async () => {
    const no = csItemNo.trim();
    if (!no) { setCsError('請輸入貨號'); return; }
    setCsLookupLoading(true);
    setCsError('');
    try {
      const res = await gasPost('getStockItemByNo', { itemNo: no });
      if (res.success && res.data) {
        setCsItemName(res.data.name);
        setCsItemPoints(res.data.points);
      } else {
        setCsError(res.message || '查無此貨號');
        setCsItemName('');
        setCsItemPoints(0);
      }
    } catch { setCsError('查詢失敗，請重試'); }
    finally { setCsLookupLoading(false); }
  }, [csItemNo]);

  const handleCreateSet = useCallback(async () => {
    if (!csItemNo.trim() || !csItemName) { setCsError('請先查詢貨號'); return; }
    if (!csTotalDraws) { setCsError('請選擇抽數方案'); return; }
    const price = parseInt(csActualPrice);
    if (!price || price <= 0) { setCsError('請輸入有效的單抽價格'); return; }
    const priceErr = validateCreateSetPrice(price, csSuggestedPrice, { minPriceRatio, maxPriceRatio });
    if (priceErr) { setCsError(priceErr); return; }

    setCsSubmitting(true);
    setCsError('');
    try {
      const res = await gasPost('createSet', {
        itemNo: csItemNo.trim(),
        itemName: csItemName,
        totalDraws: csTotalDraws,
        suggestedPrice: csSuggestedPrice,
        actualPrice: price,
        branch,
      });
      if (res.success) {
        const newSetId = res.setId || '';
        setShowCreateSet(false);
        setCsItemNo(''); setCsItemName(''); setCsItemPoints(0); setCsTotalDraws(0); setCsActualPrice('');
        setCsSuccess({ setId: newSetId, setName: csItemName });
        onCreateSetSuccess();
      } else {
        setCsError(res.message || '開套失敗');
      }
    } catch { setCsError('網路錯誤，請重試'); }
    finally { setCsSubmitting(false); }
  }, [csItemNo, csItemName, csTotalDraws, csActualPrice, csSuggestedPrice, branch, onCreateSetSuccess]);

  const resetCreateSet = useCallback(() => {
    setShowCreateSet(false);
    setCsItemNo(''); setCsItemName(''); setCsItemPoints(0); setCsTotalDraws(0); setCsActualPrice(''); setCsError('');
  }, []);

  const dismissSuccess = useCallback(() => {
    const id = csSuccess?.setId;
    setCsSuccess(null);
    if (id) {
      setTimeout(() => {
        const el = document.getElementById(`prize-set-${id}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  }, [csSuccess]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return prizes.filter(p => {
      const matchBranch = filterBranch === 'all' || !p.branch || p.branch === filterBranch;
      const matchSearch = !q || p.setName.toLowerCase().includes(q) || p.setId.includes(q) || p.prizeName.toLowerCase().includes(q) || p.prizeId.includes(q);
      return matchBranch && matchSearch;
    });
  }, [prizes, search, filterBranch]);

  const grouped = useMemo(() => {
    const map = new Map<string, PrizeEntry[]>();
    filtered.forEach(p => { if (!map.has(p.setId)) map.set(p.setId, []); map.get(p.setId)!.push(p); });
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">福袋獎項庫</h2>
          <p className="text-sm text-slate-500 mt-1">點擊「加入結帳」可直接帶入結帳表單</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <button
            onClick={() => setShowCreateSet(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white text-sm font-bold rounded-lg shadow-md shadow-amber-500/20 hover:bg-amber-600 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" /> 開套
          </button>
          <div className="flex bg-slate-100 rounded-lg p-1">
            {(['all', '竹北', '金山'] as const).map(b => (
              <button key={b} onClick={() => setFilterBranch(b)} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${filterBranch === b ? 'bg-white shadow-sm text-slate-700' : 'text-slate-500 hover:text-slate-700'}`}>
                {b === 'all' ? '全部' : b}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm">
            <Search className="w-4 h-4 text-slate-400" />
            <input type="text" placeholder="搜尋福袋名稱、獎項…" value={search} onChange={e => setSearch(e.target.value)} className="text-sm outline-none w-48" />
            {search && <button onClick={() => setSearch('')}><X className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600" /></button>}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <div className="bg-white rounded-2xl p-16 text-center text-slate-400 border border-slate-100"><Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin text-emerald-500" />資料讀取中...</div>
        ) : grouped.length === 0 && (
          <div className="bg-white rounded-2xl p-16 text-center text-slate-400 border border-slate-100"><BookOpen className="w-8 h-8 mx-auto mb-2 opacity-40" /><p>找不到符合的獎項</p></div>
        )}
        {grouped.map(([setId, entries]) => (
          <div key={setId} id={`prize-set-${setId}`} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 bg-amber-50 border-b border-amber-100">
              <div className="flex items-center gap-3">
                <span className="font-bold text-amber-700 text-base">#{setId}</span>
                <span className="font-semibold text-slate-700">{entries[0].setName}</span>
                {entries[0].isPointsSet && <span className="bg-violet-100 text-violet-700 font-bold text-xs px-2 py-0.5 rounded-full">點數套</span>}
                <div className="bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded ml-2">NT${entries[0].unitPrice} / 抽</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  {entries[0].branch && <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${branchBadge[entries[0].branch as Branch] || 'bg-slate-100 text-slate-600'}`}>{entries[0].branch}</span>}
                  <span className="text-xs text-slate-400">{entries[0].date}</span>
                </div>
                <button 
                  onClick={() => {
                    const prizeBranch = entries[0].branch;
                    if (prizeBranch && prizeBranch !== branch) {
                      showBanner(`⚠️ 無法作廢「${prizeBranch}」門市的套組，請先切換門市`, 'err');
                      return;
                    }
                    onDeletePrize(entries);
                  }}
                  className="flex items-center gap-1 text-xs font-bold text-rose-500 hover:text-white hover:bg-rose-500 border border-rose-200 px-3 py-1.5 rounded-lg transition-all shadow-sm"
                  title="作廢整套福袋"
                >
                  <Trash2 className="w-3.5 h-3.5" /> 作廢整套
                </button>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-50 text-xs text-slate-500">
                <th className="px-4 py-2 text-left font-semibold">獎項</th>
                <th className="px-4 py-2 text-left font-semibold">編號</th>
                <th className="px-4 py-2 text-left font-semibold">名稱</th>
                <th className="px-4 py-2 text-right font-semibold">點數</th>
                <th className="px-4 py-2 text-right font-semibold">抽數</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {entries.map((p, i) => (
                  <tr key={i} className="hover:bg-amber-50/40 transition-colors">
                    <td className="px-4 py-2 font-medium text-amber-600">{p.prize}</td>
                    <td className="px-4 py-2 text-slate-500 text-xs">{p.prizeId}</td>
                    <td className="px-4 py-2 text-slate-700">{p.prizeName}</td>
                    <td className="px-4 py-2 text-right text-indigo-600 font-semibold">{Number(p.points).toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-slate-500">{p.draws}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {/* ── Create Set Modal ── */}
      {showCreateSet && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col border border-slate-100 m-4">
            {/* Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Package className="w-5 h-5" />
                <h3 className="text-lg font-bold">開套</h3>
              </div>
              <button onClick={resetCreateSet} className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* 1. 貨號 */}
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">① 貨號</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={csItemNo}
                    onChange={e => { setCsItemNo(e.target.value); setCsItemName(''); setCsItemPoints(0); setCsError(''); }}
                    onKeyDown={e => e.key === 'Enter' && handleLookupItem()}
                    placeholder="輸入貨號後按 Enter 或點查詢"
                    className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
                  />
                  <button
                    onClick={handleLookupItem}
                    disabled={csLookupLoading || !csItemNo.trim()}
                    className="px-4 py-2.5 bg-amber-100 text-amber-700 font-bold text-sm rounded-xl hover:bg-amber-200 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                  >
                    {csLookupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    查詢
                  </button>
                </div>
              </div>

              {/* 2. 名稱 (auto-filled) */}
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">② 對應名稱</label>
                <div className={`border rounded-xl px-4 py-2.5 text-sm ${csItemName ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-semibold' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                  {csItemName || '（請先查詢貨號）'}
                </div>
              </div>

              {/* 3. 抽數方案 */}
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">③ 抽數方案</label>
                <div className="flex gap-2">
                  {DRAW_OPTIONS.map(d => (
                    <button
                      key={d}
                      onClick={() => setCsTotalDraws(d)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all border-2 ${
                        csTotalDraws === d
                          ? 'border-amber-500 bg-amber-50 text-amber-700 shadow-md shadow-amber-500/10' 
                          : 'border-slate-200 bg-white text-slate-500 hover:border-amber-300'
                      }`}
                    >
                      {d} 抽
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. 建議價格 (auto-calculated) */}
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">④ 建議價格</label>
                <div className={`border rounded-xl px-4 py-2.5 text-sm font-mono ${
                  csSuggestedPrice ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-bold text-lg' : 'bg-slate-50 border-slate-200 text-slate-400'
                }`}>
                  {csSuggestedPrice ? `NT$ ${csSuggestedPrice}` : '（選擇抽數後自動計算）'}
                </div>
              </div>

              {/* 5. 實際單抽價格 */}
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">⑤ 實際單抽價格</label>
                <input
                  type="number"
                  value={csActualPrice}
                  onChange={e => { setCsActualPrice(e.target.value); setCsError(''); }}
                  placeholder="店員判斷後的實際單抽價格"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
                />
                {csSuggestedPrice > 0 && csActualPrice && (() => {
                  const err = validateCreateSetPrice(parseInt(csActualPrice), csSuggestedPrice, { minPriceRatio, maxPriceRatio });
                  if (err) return <p className="text-xs text-rose-500 mt-1 font-medium">⚠️ {err}</p>;
                  return null;
                })()}
              </div>

              {/* Error */}
              {csError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm font-medium px-4 py-2.5 rounded-xl">
                  {csError}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button onClick={resetCreateSet} className="flex-1 px-4 py-2.5 rounded-xl font-bold text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors">
                  取消
                </button>
                <button
                  onClick={handleCreateSet}
                  disabled={csSubmitting || !csItemName || !csTotalDraws || !csActualPrice}
                  className="flex-1 px-4 py-2.5 rounded-xl font-bold text-white bg-amber-500 hover:bg-amber-600 shadow-md shadow-amber-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {csSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  確認開套（{branch}）
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Success Modal ── */}
      {csSuccess && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden m-4 text-center">
            <div className="px-6 py-5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white">
              <div className="text-4xl mb-2">📦</div>
              <h3 className="text-lg font-bold">開套成功！</h3>
            </div>
            <div className="p-6 space-y-3">
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <div className="text-xs text-amber-500 font-bold uppercase tracking-wider mb-1">套號</div>
                <div className="text-2xl font-black text-amber-700">#{csSuccess.setId}</div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">套名</div>
                <div className="text-lg font-bold text-slate-700">{csSuccess.setName}</div>
              </div>
              <button
                onClick={dismissSuccess}
                className="w-full mt-2 px-4 py-2.5 rounded-xl font-bold text-white bg-emerald-500 hover:bg-emerald-600 shadow-md shadow-emerald-500/20 transition-all"
              >
                確認
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
