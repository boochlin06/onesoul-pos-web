import { useState, useMemo } from 'react';
import { Search, Box, Loader2 } from 'lucide-react';
import { useStickyState } from '../../hooks/useStickyState';
import type { BlindBoxEntry } from '../../types';

interface BlindBoxViewProps {
  records: BlindBoxEntry[];
  isLoading: boolean;
  onRefresh: () => void;
}

export function BlindBoxView({ records, isLoading, onRefresh }: BlindBoxViewProps) {
  const [search, setSearch] = useState('');
  const [uiMode, setUiMode] = useStickyState<'classic' | 'grid'>('grid', 'pos_blindbox_ui_mode');
  
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return records;
    return records.filter(r => 
      r.name.toLowerCase().includes(q) || 
      r.category.toLowerCase().includes(q) ||
      r.id.toLowerCase().includes(q)
    );
  }, [records, search]);

  return (
    <div className="flex flex-col gap-6 mb-24">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">盲盒資料庫</h2>
          <p className="text-sm text-slate-500 mt-1">來自 Google Sheet [盲盒資料庫] 的清單。</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full md:w-auto">
          <div className="flex bg-slate-200/50 p-1 rounded-lg shrink-0">
             <button onClick={() => setUiMode('grid')} className={`flex-1 px-4 py-1.5 text-xs font-bold rounded-md transition-all ${uiMode === 'grid' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>卡片排列</button>
             <button onClick={() => setUiMode('classic')} className={`flex-1 px-4 py-1.5 text-xs font-bold rounded-md transition-all ${uiMode === 'classic' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>經典表格</button>
          </div>
          <div className="relative flex-1 md:w-72">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="搜尋貨號、名稱、類別..."
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button onClick={onRefresh} className="flex shrink-0 items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-indigo-600 rounded-lg text-sm font-bold shadow-sm transition-colors">
            <Search className="w-4 h-4" />
            <span className="hidden sm:inline">強制更新</span>
          </button>
        </div>
      </div>

      {uiMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {isLoading ? (
            <div className="col-span-full p-20 text-center text-slate-400 bg-white rounded-2xl border border-slate-100 shadow-sm">
              <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin text-indigo-500" />
              資料讀取中...
            </div>
          ) : filtered.length === 0 ? (
            <div className="col-span-full p-20 text-center text-slate-400 bg-white rounded-2xl border border-slate-100 shadow-sm">
              <Box className="w-10 h-10 mx-auto mb-3 opacity-30 text-indigo-900" />
              無符合條件的項目
            </div>
          ) : (
            filtered.map((r, i) => (
              <div key={i} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] hover:-translate-y-1 transition-all duration-300 flex flex-col gap-4 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-indigo-50 to-transparent -mr-4 -mt-4 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-700"></div>
                
                <div className="flex items-start justify-between relative z-10">
                  <span className="inline-flex px-3 py-1 rounded-lg bg-indigo-50 text-indigo-600 text-[10px] font-black tracking-widest uppercase border border-indigo-100/50 shadow-sm">
                    {r.category || '盲盒'}
                  </span>
                  <span className="font-mono text-[11px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded">NO. {r.id}</span>
                </div>
                
                <div className="relative z-10 flex-1">
                  <h3 className="font-bold text-slate-800 text-[17px] leading-snug line-clamp-2">{r.name}</h3>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-auto relative z-10 border-t border-slate-100 pt-4">
                  <div className="flex flex-col bg-slate-50 p-2.5 rounded-xl border border-slate-100/50">
                    <span className="text-[10px] font-bold text-slate-400 mb-0.5 uppercase tracking-wider">販售點數</span>
                    <span className="font-mono font-black text-xl text-indigo-600 leading-none">{r.points !== 0 ? r.points : '-'}</span>
                  </div>
                  <div className="flex flex-col bg-amber-50/50 p-2.5 rounded-xl border border-amber-100/50">
                    <span className="text-[10px] font-bold text-amber-600/60 mb-0.5 uppercase tracking-wider">手動售價</span>
                    <span className="font-mono font-black text-xl text-amber-600 leading-none">{r.manualPrice !== 0 ? `$${r.manualPrice}` : '-'}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-16 text-center text-slate-400">
              <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin text-indigo-500" />
              資料讀取中...
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-16 text-center text-slate-400">
              <Box className="w-10 h-10 mx-auto mb-3 opacity-20" />
              無符合條件的項目
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[75vh]">
              <table className="w-full text-sm whitespace-nowrap text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    {['貨號', '名稱', '販售點數', '手動售價'].map(h => (
                      <th key={h} className="px-5 py-3.5 text-left font-extrabold uppercase tracking-wider text-xs text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((r, i) => (
                    <tr key={i} className="hover:bg-indigo-50/30 transition-colors">
                      <td className="px-5 py-3 font-mono font-bold text-slate-400">{r.id}</td>
                      <td className="px-5 py-3 font-bold text-slate-800 break-words whitespace-normal min-w-[300px] leading-relaxed">{r.name}</td>
                      <td className="px-5 py-3 font-mono font-black text-indigo-600 text-lg tracking-wide">{r.points !== 0 ? r.points : '-'}</td>
                      <td className="px-5 py-3 font-mono font-bold text-slate-500 text-lg">{r.manualPrice !== 0 ? `$${r.manualPrice}` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
