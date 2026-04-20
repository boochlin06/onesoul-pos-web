import { useState, useMemo, useCallback } from 'react';
import { Search, BookOpen, Trash2, X, Loader2, Plus, BarChart3 } from 'lucide-react';
import { RefreshButton } from '../ui/RefreshButton';
import { branchBadge } from '../../constants';
import { apiGetDrawCounts } from '../../services/api';
import { CreateSetModal } from '../checkout/CreateSetModal';
import { CreateSetSuccessModal } from '../checkout/CreateSetSuccessModal';
import type { Branch, PrizeEntry } from '../../types';

interface PrizeLibraryViewProps {
  branch: Branch;
  prizes: PrizeEntry[];
  isLoading: boolean;
  onDeletePrize: (entries: PrizeEntry[]) => void;
  onCreateSetSuccess: () => void;
  showBanner: (msg: string, type: 'ok' | 'err' | 'loading', autoDismiss?: boolean) => void;
  onRefresh?: () => void;
  isAdmin?: boolean;
}

export function PrizeLibraryView({ branch, prizes, isLoading, onDeletePrize, onCreateSetSuccess, showBanner, onRefresh, isAdmin }: PrizeLibraryViewProps) {
  const [search, setSearch] = useState('');
  const [filterBranch, setFilterBranch] = useState<'all' | Branch>('all');
  const [drawCounts, setDrawCounts] = useState<Record<string, number> | null>(null);
  const [loadingDrawCounts, setLoadingDrawCounts] = useState(false);

  // ── Create Set Modal State ──
  const [showCreateSet, setShowCreateSet] = useState(false);
  const [csSuccess, setCsSuccess] = useState<{ setId: string; setName: string } | null>(null);

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
      const matchSearch = !q
        || (p.setName || '').toLowerCase().includes(q)
        || (p.setId || '').includes(q)
        || (p.prizeName || '').toLowerCase().includes(q)
        || (p.prizeId || '').includes(q);
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
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-800">福袋獎項庫</h2>
            {onRefresh && <RefreshButton onClick={onRefresh} isLoading={isLoading} />}
          </div>
          <p className="text-sm text-slate-500 mt-1">點擊「加入結帳」可直接帶入結帳表單</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <button
            onClick={() => setShowCreateSet(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white text-sm font-bold rounded-lg shadow-md shadow-amber-500/20 hover:bg-amber-600 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" /> 開套
          </button>
          {isAdmin && (
            <button
              onClick={async () => {
                setLoadingDrawCounts(true);
                try {
                  const res = await apiGetDrawCounts();
                  if (res.success && res.data) {
                    setDrawCounts(res.data);
                    showBanner('✓ 抽選狀況已更新', 'ok');
                  } else {
                    showBanner(res.message || '查詢失敗', 'err');
                  }
                } catch { showBanner('查詢失敗', 'err'); }
                finally { setLoadingDrawCounts(false); }
              }}
              disabled={loadingDrawCounts}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-500 text-white text-sm font-bold rounded-lg shadow-md shadow-indigo-500/20 hover:bg-indigo-600 transition-all active:scale-95 disabled:opacity-50"
            >
              {loadingDrawCounts ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
              查詢抽選狀況
            </button>
          )}
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
                <th className="px-4 py-2 text-right font-semibold text-indigo-600">已抽</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {entries.map((p, i) => (
                  <tr key={i} className="hover:bg-amber-50/40 transition-colors">
                    <td className="px-4 py-2 font-medium text-amber-600">{p.prize}</td>
                    <td className="px-4 py-2 text-slate-500 text-xs">{p.prizeId}</td>
                    <td className="px-4 py-2 text-slate-700">{p.prizeName}</td>
                    <td className="px-4 py-2 text-right text-indigo-600 font-semibold">{Number(p.points).toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-slate-500">{p.draws}</td>
                    {(() => {
                      const key = p.setId + '_' + String(p.prize || '').toLowerCase();
                      const drawn = drawCounts ? (drawCounts[key] || 0) : (p.drawnCount || 0);
                      const full = drawn >= p.draws;
                      return <td className={`px-4 py-2 text-right font-bold ${full ? 'text-emerald-600' : 'text-rose-500'}`}>{drawn}</td>;
                    })()}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {showCreateSet && (
        <CreateSetModal
          branch={branch}
          onClose={() => setShowCreateSet(false)}
          onSuccess={(setId, setName) => {
            setShowCreateSet(false);
            setCsSuccess({ setId, setName });
            onCreateSetSuccess();
          }}
        />
      )}

      {csSuccess && (
        <CreateSetSuccessModal
          setId={csSuccess.setId}
          setName={csSuccess.setName}
          onDismiss={dismissSuccess}
        />
      )}
    </div>
  );
}
