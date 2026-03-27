import { useState, useMemo } from 'react';
import { Search, Users, BookOpen, Loader2 } from 'lucide-react';
import { RefreshButton } from '../ui/RefreshButton';
import { useStickyState } from '../../hooks/useStickyState';
import type { MemberEntry } from '../../types';

interface MembersViewProps {
  members: MemberEntry[];
  isLoading: boolean;
  onRefresh: () => void;
}

export function MembersView({ members, isLoading, onRefresh }: MembersViewProps) {
  const [search, setSearch] = useState('');
  const [uiMode, setUiMode] = useStickyState<'classic' | 'cards'>('cards', 'pos_members_ui_mode');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return members.filter(m =>
      !q ||
      String(m.name || '').toLowerCase().includes(q) ||
      String(m.phone || '').includes(q) ||
      String(m.note || '').toLowerCase().includes(q)
    );
  }, [search, members]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-800">會員資料</h2>
            <RefreshButton onClick={onRefresh} isLoading={isLoading} />
          </div>
          <p className="text-sm text-slate-500 mt-1">目前共有 {filtered.length} 筆資料</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full md:w-auto">
          <div className="flex bg-slate-200/50 p-1 rounded-lg shrink-0">
             <button onClick={() => setUiMode('cards')} className={`flex-1 px-4 py-1.5 text-xs font-bold rounded-md transition-all ${uiMode === 'cards' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>名片網格</button>
             <button onClick={() => setUiMode('classic')} className={`flex-1 px-4 py-1.5 text-xs font-bold rounded-md transition-all ${uiMode === 'classic' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>經典表格</button>
          </div>
          <div className="relative flex-1 md:w-72">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="搜尋姓名、電話、備註..."
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {uiMode === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {isLoading ? (
            <div className="col-span-full p-24 text-center text-slate-400 bg-white rounded-2xl border border-slate-100">
              <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin text-indigo-500" />
              資料讀取中...
            </div>
          ) : filtered.length === 0 ? (
            <div className="col-span-full p-24 text-center text-slate-400 bg-white rounded-2xl border border-slate-100">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-20" />
              無符合條件的會員
            </div>
          ) : (
            filtered.map((m, i) => (
              <div key={i} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col gap-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 text-indigo-600 flex items-center justify-center font-black text-2xl uppercase border border-indigo-100/50 shadow-inner">
                      {m.name ? String(m.name).charAt(0) : '?'}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-lg leading-tight">{m.name || '未命名'}</h3>
                      <p className="text-slate-500 font-mono text-sm mt-1 bg-slate-100 inline-block px-1.5 rounded">{m.phone}</p>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">目前點數</span>
                    <span className="font-mono text-2xl font-black text-indigo-600 leading-none mt-1.5">{m.points}</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-100 flex flex-col gap-1">
                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">生日</span>
                    <span className="font-bold text-slate-700">{m.birthday || '-'}</span>
                  </div>
                  <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-100 flex flex-col gap-1">
                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">性別 / 註冊店</span>
                    <span className="font-bold text-slate-700">{m.gender || '-'} / <span className={`${m.store === '竹北' ? 'text-emerald-600' : 'text-blue-600'}`}>{m.store || '-'}</span></span>
                  </div>
                </div>

                {m.note && (
                  <div className="px-3 py-2.5 bg-amber-50/50 rounded-xl border border-amber-100 text-xs text-amber-800 flex items-start gap-2 leading-relaxed">
                    <BookOpen className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                    <span className="font-medium">{m.note}</span>
                  </div>
                )}
                
                <div className="mt-auto pt-3 border-t border-slate-100 text-right">
                   <span className="text-[10px] font-mono text-slate-300">建立於: {m.timestamp}</span>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto max-h-[70vh] relative">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
                <tr>
                  {['時間戳記', '姓名', '電話', '性別', '生日', '註冊店', '點數', '備註'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((m, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{m.timestamp}</td>
                    <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap">{m.name}</td>
                    <td className="px-4 py-3 text-slate-600 font-mono whitespace-nowrap">{m.phone}</td>
                    <td className="px-4 py-3 text-slate-600">{m.gender}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{m.birthday}</td>
                    <td className="px-4 py-3 text-slate-600 truncate max-w-[120px]">{m.store}</td>
                    <td className="px-4 py-3 text-indigo-600 font-bold text-right">{m.points}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs truncate max-w-[150px]">{m.note}</td>
                  </tr>
                ))}
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center text-slate-400">
                      <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin text-emerald-500" />
                      資料讀取中...
                    </td>
                  </tr>
                ) : filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center text-slate-400">
                      <Users className="w-10 h-10 mx-auto mb-3 opacity-20" />
                      無符合條件的會員
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
