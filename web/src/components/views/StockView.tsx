import { useState, useMemo } from 'react';
import { Search, Package, ChevronDown, Loader2, ArrowUpDown } from 'lucide-react';
import { RefreshButton } from '../ui/RefreshButton';
import { useStickyState } from '../../hooks/useStickyState';
import type { Branch, StockEntry } from '../../types';

interface StockViewProps {
  branch: Branch;
  records: StockEntry[];
  isLoading: boolean;
  onRefresh: () => void;
  setBranch: (b: Branch) => void;
}

type SortField = 'id' | 'name' | 'points' | 'category' | 'quantity' | 'branch';
type SortOrder = 'asc' | 'desc';

export function StockView({ branch, records, isLoading, onRefresh, setBranch }: StockViewProps) {
  const [search, setSearch] = useState('');
  const [uiMode, setUiMode] = useStickyState<'classic' | 'cards'>('cards', 'pos_stock_ui_mode');
  const [sortField, setSortField] = useState<SortField>('id');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const filteredAndSorted = useMemo(() => {
    let result = records.filter(r => r.name && String(r.name).trim() !== '');
    
    // 搜尋
    const q = search.toLowerCase();
    if (q) {
      result = result.filter(r =>
        r.name.toLowerCase().includes(q) ||
        (r.category && r.category.toLowerCase().includes(q)) ||
        String(r.id).toLowerCase().includes(q)
      );
    }

    // 排序
    return result.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (sortField === 'id') {
        const strA = String(valA);
        const strB = String(valB);
        return sortOrder === 'asc' 
             ? strA.localeCompare(strB, undefined, { numeric: true, sensitivity: 'base' })
             : strB.localeCompare(strA, undefined, { numeric: true, sensitivity: 'base' });
      }

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }
      return 0;
    });
  }, [records, search, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc'); // 切換欄位時預設數字大/字母後的在前
    }
  };

  const SortIcon = ({ field, label, extra, justify = 'left' }: { field: SortField, label: string, extra?: React.ReactNode, justify?: 'left' | 'center' | 'right' }) => (
    <button onClick={() => handleSort(field)} className={`inline-flex items-center gap-1 hover:text-indigo-600 transition-colors focus:outline-none w-full uppercase tracking-wider ${justify === 'left' ? 'justify-start' : justify === 'right' ? 'justify-end' : 'justify-center'}`}>
      {label}
      {extra}
      <ArrowUpDown className={`w-3.5 h-3.5 shrink-0 ${sortField === field ? 'text-indigo-500' : 'text-slate-300 opacity-0 group-hover:opacity-100'}`} />
    </button>
  );

  return (
    <div className="flex flex-col gap-6 mb-24 max-w-7xl mx-auto w-full">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        
        {/* Header toolbar */}
        <div className="p-4 sm:p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-slate-200 bg-slate-50">
          <div className="flex bg-slate-200/50 p-1 rounded-lg shrink-0 self-start">
             <button onClick={() => setUiMode('cards')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${uiMode === 'cards' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>庫存看板</button>
             <button onClick={() => setUiMode('classic')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${uiMode === 'classic' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>經典表格</button>
          </div>
          
          <div className="relative flex-1 max-w-md w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl outline-none font-bold text-slate-700 transition-all shadow-sm placeholder:text-slate-400 placeholder:font-medium"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜尋貨號、名稱或類別..."
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
             <div className="hidden lg:flex flex-col justify-center bg-rose-50 border border-rose-100 px-3 py-1.5 rounded-lg text-[10px] font-bold text-rose-600 tracking-wide uppercase shadow-sm shrink-0">
                <span>🔴 點數異常為採購報價</span>
                <span>🔥 重複品項以價高為主</span>
             </div>

             <div className="relative shrink-0 flex-1 sm:flex-none">
               <select 
                 className="appearance-none w-full pl-4 pr-10 py-2.5 bg-white border border-slate-300 focus:border-indigo-500 focus:ring-2 hover:bg-slate-50 focus:ring-indigo-100 rounded-xl outline-none font-bold text-slate-700 transition-all cursor-pointer shadow-sm text-sm"
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

             <RefreshButton onClick={onRefresh} isLoading={isLoading} variant="toolbar" />
          </div>
        </div>

        {/* Table Area */}
        {isLoading ? (
          <div className="p-24 flex flex-col items-center justify-center text-slate-500">
            <Loader2 className="w-10 h-10 mb-4 animate-spin text-indigo-500" />
            <span className="font-bold tracking-wider">正在讀取庫存資料...</span>
          </div>
        ) : filteredAndSorted.length === 0 ? (
          <div className="p-24 flex flex-col items-center justify-center text-slate-400">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 border border-slate-100">
              <Package className="w-8 h-8 text-slate-300" />
            </div>
            <span className="font-bold tracking-wider text-base">找不到相符的貨品</span>
          </div>
        ) : uiMode === 'cards' ? (
          <div className="p-5 bg-slate-50/50">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredAndSorted.map((r, i) => (
                <div key={i} className={`bg-white rounded-2xl p-5 border transition-all hover:shadow-lg hover:-translate-y-1 flex flex-col gap-4 relative overflow-hidden ${r.quantity <= 1 ? 'border-rose-200 ring-1 ring-rose-50 shadow-sm' : 'border-slate-200'}`}>
                  <div className="flex items-start justify-between">
                     <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-slate-100 text-[10px] font-bold text-slate-500 tracking-widest">{r.category || '未分類'}</span>
                     <span className={`inline-flex px-2.5 py-1 rounded-md text-[10px] font-extrabold tracking-widest border ${(r.branch || branch) === '金山' ? 'text-blue-700 bg-blue-50 border-blue-200' : 'text-emerald-700 bg-emerald-50 border-emerald-200'}`}>{r.branch || branch}</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-base leading-snug line-clamp-2" title={r.name}>{r.name}</h3>
                    <p className="font-mono text-xs font-semibold text-slate-400 mt-1.5 uppercase tracking-wide">NO. {r.id}</p>
                  </div>
                  <div className="mt-auto flex items-end justify-between pt-4 border-t border-slate-100">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">販售點數</span>
                      <span className={`font-mono font-black text-xl leading-none ${r.points !== 0 ? 'text-indigo-600' : 'text-slate-300'}`}>{r.points !== 0 ? r.points : '0'}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">剩餘數量</span>
                      <span className={`font-mono font-black text-3xl leading-none ${r.quantity <= 0 ? 'text-rose-500' : r.quantity <= 2 ? 'text-amber-500' : 'text-emerald-600'}`}>{r.quantity}</span>
                    </div>
                  </div>
                  {r.quantity <= 0 && <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] flex items-center justify-center z-10"><span className="text-xl font-black text-rose-500 rotate-[-15deg] border-4 border-rose-500 px-5 py-1.5 rounded-2xl bg-white/90 shadow-sm uppercase tracking-widest">缺貨中</span></div>}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[75vh]">
            <table className="w-full text-sm text-slate-700 whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="px-5 py-3.5 text-left font-extrabold text-xs group">
                    <SortIcon field="id" label="貨號" />
                  </th>
                  <th className="px-5 py-3.5 text-left font-extrabold text-xs group">
                    <SortIcon field="name" label="商品名稱" extra={<span className="ml-2 font-bold text-[10px] bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full lowercase tracking-normal">非指定人士請勿進入</span>} />
                  </th>
                  <th className="px-5 py-3.5 text-right font-extrabold text-xs group w-24">
                    <SortIcon field="points" label="販售點數" justify="right" />
                  </th>
                  <th className="px-5 py-3.5 text-left font-extrabold text-xs group w-24">
                    <SortIcon field="category" label="類別" />
                  </th>
                  <th className="px-5 py-3.5 text-right font-extrabold text-xs group w-32">
                    <SortIcon field="quantity" label="剩餘數量" justify="right" />
                  </th>
                  <th className="px-5 py-3.5 text-center font-extrabold text-xs group w-24">
                    <SortIcon field="branch" label="地點" justify="center" />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAndSorted.map((r, i) => (
                  <tr key={i} className="hover:bg-indigo-50/50 transition-all bg-white group">
                    <td className="px-5 py-3 text-left font-mono font-bold text-slate-500">{r.id}</td>
                    <td className="px-5 py-3 font-bold text-slate-800 whitespace-normal min-w-[280px] leading-relaxed group-hover:text-indigo-900 transition-colors">
                      {r.name}
                    </td>
                    <td className={`px-5 py-3 text-right font-bold`}>
                      <span className={`inline-flex px-2.5 py-1 rounded-lg text-[13px] ${r.points !== 0 ? 'bg-indigo-50 text-indigo-600 border border-indigo-200' : 'text-slate-400'}`}>
                        {r.points !== 0 ? r.points : '0'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600">
                        {r.category || '未分類'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-mono font-extrabold text-slate-700">{r.quantity}</td>
                    <td className="px-5 py-3 text-center">
                      <span className={`inline-flex px-3 py-1 rounded-full text-[11px] font-extrabold tracking-widest border ${(r.branch || branch) === '金山' ? 'text-blue-700 bg-blue-50 border-blue-200' : 'text-emerald-700 bg-emerald-50 border-emerald-200'}`}>
                        {r.branch || branch}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
