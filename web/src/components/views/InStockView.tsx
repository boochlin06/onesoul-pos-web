import { useState, useMemo } from 'react';
import { PackageSearch, Search, ArrowUpDown } from 'lucide-react';
import { RefreshButton } from '../ui/RefreshButton';
import type { StockEntry } from '../../types';

interface Props {
  stocks: StockEntry[];
  isLoading: boolean;
  onRefresh: () => void;
}

type SortField = 'id' | 'name' | 'points' | 'category' | 'branch';
type SortOrder = 'asc' | 'desc';

export function InStockView({ stocks, isLoading, onRefresh }: Props) {
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('points');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const filteredAndSorted = useMemo(() => {
    // 1. 過濾：數量 >= 1 且類別包含 GK 且符合搜尋
    const q = search.toLowerCase();
    const result = stocks.filter(s => {
      if (s.quantity < 1) return false;
      
      if (q) {
        return s.name.toLowerCase().includes(q) ||
               s.id.toLowerCase().includes(q) ||
               s.category.toLowerCase().includes(q) ||
               s.branch.toLowerCase().includes(q);
      }
      return true;
    });

    // 2. 排序
    return result.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }
      return 0;
    });
  }, [stocks, search, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc'); // 預設切到新欄位數值大的在前
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => (
    <button onClick={() => handleSort(field)} className="inline-flex items-center gap-1 hover:text-indigo-600 transition-colors focus:outline-none">
      {field === 'id' ? '貨號' : field === 'name' ? '商品名稱' : field === 'points' ? '販售點數' : field === 'category' ? '類別' : '店面'}
      <ArrowUpDown className={`w-3.5 h-3.5 ${sortField === field ? 'text-indigo-500' : 'text-slate-300 opacity-0 group-hover:opacity-100'}`} />
    </button>
  );

  return (
    <div className="flex flex-col gap-6 mb-24 max-w-7xl mx-auto w-full">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
              <PackageSearch className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="font-extrabold text-slate-800 text-lg tracking-tight">現貨查詢 (GK專區)</h2>
              <p className="text-xs text-slate-500 font-bold mt-0.5">顯示各店數量大於 0 的 GK 商品</p>
            </div>
            <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              共查到 {filteredAndSorted.length} 筆
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl outline-none font-bold text-sm text-slate-700 transition-all shadow-sm"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="搜尋貨號、名稱、店面..."
              />
            </div>
            <RefreshButton onClick={onRefresh} isLoading={isLoading} variant="toolbar" />
          </div>
        </div>

        {/* List */}
        <div className="overflow-x-auto max-h-[70vh]">
          <table className="w-full text-sm text-slate-700 whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="px-5 py-3.5 text-left font-extrabold text-xs group">
                  <SortIcon field="id" />
                </th>
                <th className="px-5 py-3.5 text-left font-extrabold text-xs group">
                  <SortIcon field="name" />
                </th>
                <th className="px-5 py-3.5 text-right font-extrabold text-xs group">
                  <SortIcon field="points" />
                </th>
                <th className="px-5 py-3.5 text-center font-extrabold text-xs group">
                  <SortIcon field="category" />
                </th>
                <th className="px-5 py-3.5 text-center font-extrabold text-xs group">
                  <SortIcon field="branch" />
                </th>
                <th className="px-5 py-3.5 text-center font-extrabold text-xs text-slate-500">數量</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAndSorted.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center text-slate-400 font-bold">
                    {search ? '沒有符合搜尋條件的 GK 現貨' : '目前沒有任何 GK 現貨'}
                  </td>
                </tr>
              ) : (
                filteredAndSorted.map((s, i) => (
                  <tr key={`${s.id}-${s.branch}-${i}`} className="hover:bg-indigo-50/50 transition-colors bg-white">
                    <td className="px-5 py-3 font-mono font-bold text-slate-500 text-xs">{s.id}</td>
                    <td className="px-5 py-3 font-bold text-slate-800 whitespace-normal min-w-[200px] hover:text-indigo-700 transition-colors cursor-default">
                      {s.name}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className="inline-flex items-center gap-1 font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                        {s.points.toLocaleString()} 點
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-extrabold tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                        {s.category || '未分類'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-extrabold tracking-wider border ${s.branch === '金山' ? 'text-blue-700 bg-blue-50 border-blue-200' : s.branch === '竹北' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-slate-700 bg-slate-50 border-slate-200'}`}>
                        📍 {s.branch}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center font-mono font-extrabold text-slate-700 text-base">
                      {s.quantity}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
