import { useState, useMemo, useEffect } from 'react';
import { Search, BarChart3, Receipt, Loader2, MessageSquare } from 'lucide-react';
import { RefreshButton } from '../ui/RefreshButton';
import { Pagination } from '../ui/Pagination';
import type { SalesRecordEntry, MemberEntry } from '../../types';

interface SalesViewProps {
  records: SalesRecordEntry[];
  isLoading: boolean;
  onRefresh: () => void;
  onClearCache: () => void;
  lastCacheTime: string;
  members: MemberEntry[];
}

export function SalesView({ records, isLoading, onRefresh, onClearCache, lastCacheTime, members }: SalesViewProps) {
  const [search, setSearch] = useState('');

  const groupedRecords = useMemo(() => {
    const q = search.toLowerCase();
    const map = new Map<string, SalesRecordEntry[]>();
    records.forEach(r => {
      if (!map.has(r.checkoutUID)) map.set(r.checkoutUID, []);
      map.get(r.checkoutUID)!.push(r);
    });

    const result: { uid: string; items: SalesRecordEntry[] }[] = [];
    map.forEach((items, uid) => {
      const match = !q || uid.toLowerCase().includes(q) || items.some(r =>
        r.phone.includes(q) ||
        r.setName.toLowerCase().includes(q) ||
        (r.name && r.name.toLowerCase().includes(q)) ||
        r.prizeName.toLowerCase().includes(q) ||
        r.type.toLowerCase().includes(q)
      );
      if (match) result.push({ uid, items });
    });
    return result;
  }, [search, records]);

  const [currentPage, setCurrentPage] = useState(1);
  useEffect(() => { setCurrentPage(1); }, [search]);

  const pages = useMemo(() => {
    const list: typeof groupedRecords[] = [];
    let currentChunk: typeof groupedRecords = [];
    let currentItemCount = 0;

    for (const group of groupedRecords) {
      if (currentItemCount + group.items.length > 100 && currentChunk.length > 0) {
        list.push(currentChunk);
        currentChunk = [];
        currentItemCount = 0;
      }
      currentChunk.push(group);
      currentItemCount += group.items.length;
    }
    if (currentChunk.length > 0) list.push(currentChunk);
    return list;
  }, [groupedRecords]);

  const totalPages = pages.length || 1;
  const currentVisibleGroups = pages[currentPage - 1] || [];

  return (
    <div className="flex flex-col gap-6 mb-24">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">歷史銷售紀錄 (全部店面)</h2>
          <p className="text-sm text-slate-500 mt-1 whitespace-pre-line">
            每次載入最新 1000 筆，為加快速度預設使用快取。以交易單號分組檢視 (每頁顯示約 100 筆資料)。
            {lastCacheTime && <span className="text-emerald-600 font-medium ml-2">上次更新時間：{lastCacheTime}</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="搜尋電話、單號、商品..."
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <RefreshButton onClick={onRefresh} isLoading={isLoading} variant="toolbar" />
          <button onClick={onClearCache} className="flex flex-col items-center justify-center px-4 py-1.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors">
            <span>清除快取</span><span className="text-[10px] opacity-70">(清空版面資料)</span>
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {isLoading ? (
          <div className="bg-white rounded-2xl p-16 text-center text-slate-400 border border-slate-100 shadow-sm">
            <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin text-emerald-500" />
            資料讀取中...
          </div>
        ) : groupedRecords.length === 0 && (
          <div className="bg-white rounded-2xl p-16 text-center text-slate-400 border border-slate-100 shadow-sm">
            <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p>目前無符合條件的銷售紀錄</p>
          </div>
        )}

        {currentVisibleGroups.map(({ uid, items }) => {
          const first = items[0];
          const pay = items.find(r => r.receivedAmount || r.creditCard || r.cash || r.remittance) || first;

          return (
            <div key={uid} className="bg-white rounded-2xl border border-slate-200 shadow-[0_2px_10px_rgba(0,0,0,0.02)] overflow-hidden transition-all hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 bg-slate-50/50 border-b border-slate-100">
                <div className="flex items-center gap-4">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-slate-200 text-slate-600">{uid}</span>
                      <span className="text-sm font-semibold text-slate-700">{first.date}</span>
                    </div>
                  </div>
                  <div className="h-4 w-px bg-slate-200 mx-1"></div>
                  <div className="flex items-center gap-2">
                    {first.phone && (() => { const m = members.find(mb => String(mb.phone) === String(first.phone)); return m ? <span className="text-sm font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-lg">{m.name}</span> : null; })()}
                    <span className="font-mono font-medium text-slate-500 bg-white px-2 py-0.5 border border-slate-200 rounded text-sm">{first.phone || '無電話'}</span>
                  </div>
                </div>
                <div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold shadow-sm ${first.branch === '竹北' ? 'bg-indigo-50 text-indigo-700 border-indigo-100 border' : 'bg-rose-50 text-rose-700 border-rose-100 border'}`}>{first.branch || '未知店面'}</span>
                </div>
              </div>

              {/* Items Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[1200px] whitespace-nowrap">
                  <thead className="bg-white border-b border-slate-100">
                    <tr>
                      {['福袋編號', '獎項', '抽數', '帶走/點數', '套名', '單抽價', '獎項編號', '獎項/商品名稱', '單抽點數', '點數總計', '金額', '備註'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {items.map((r, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 text-xs">
                        <td className="px-4 py-2 font-mono text-slate-500">{r.lotteryId || '-'}</td>
                        <td className="px-4 py-2 font-semibold text-slate-700">{r.prize || '-'}</td>
                        <td className="px-4 py-2 text-center font-medium text-slate-600">{r.draws || '-'}</td>
                        <td className="px-4 py-2"><span className={`px-2 py-0.5 rounded text-[10px] font-medium ${r.type === '帶走' || r.type === '現金' ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'}`}>{r.type || '-'}</span></td>
                        <td className="px-4 py-2 font-medium text-slate-700">{r.setName || r.name || '-'}</td>
                        <td className="px-4 py-2 font-mono text-slate-600">{r.unitPrice ? `$${r.unitPrice}` : '-'}</td>
                        <td className="px-4 py-2 font-mono text-slate-400">{r.prizeId || '-'}</td>
                        <td className="px-4 py-2 font-medium text-slate-700">{r.prizeName || '-'}</td>
                        <td className="px-4 py-2 font-mono text-slate-500">{r.unitPoints || '-'}</td>
                        <td className="px-4 py-2 font-mono font-bold text-indigo-600">{r.points !== 0 ? r.points : '-'}</td>
                        <td className="px-4 py-2 font-mono font-bold text-amber-600">{r.amount !== 0 ? `$${r.amount.toLocaleString()}` : '-'}</td>
                        <td className="px-4 py-2 text-slate-400 truncate max-w-[150px]" title={r.remark}>{r.remark || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Transaction Footer */}
              <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-3 bg-slate-50 border-t border-slate-100 text-sm">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-slate-400" />
                    <span className="font-semibold text-slate-600">結帳明細：</span>
                  </div>
                  {pay.receivedAmount ? <span className="text-slate-500">實收 <strong className="text-emerald-600 font-mono text-[15px]">${pay.receivedAmount.toLocaleString()}</strong></span> : null}
                  {pay.cash ? <span className="text-slate-500">現金 <strong className="text-slate-700 font-mono">${pay.cash.toLocaleString()}</strong></span> : null}
                  {pay.creditCard ? <span className="text-slate-500">信用卡 <strong className="text-slate-700 font-mono">${pay.creditCard.toLocaleString()}</strong></span> : null}
                  {pay.remittance ? <span className="text-slate-500">匯款 <strong className="text-slate-700 font-mono">${pay.remittance.toLocaleString()}</strong></span> : null}
                  {pay.pointsUsed ? <span className="text-slate-500">點數扣 <strong className="text-rose-500 font-mono">-{pay.pointsUsed}</strong></span> : null}
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  {pay.channel ? <div className="text-slate-500 text-xs flex items-center gap-1.5 bg-amber-50/80 px-2.5 py-1 rounded-md border border-amber-100 max-w-xs shadow-sm" title={pay.channel}><MessageSquare className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" /><span className="truncate flex-1 font-medium">{pay.channel}</span></div> : null}
                  {pay.pointDelta ? <span className="text-slate-500 font-medium bg-white px-3 py-1 rounded-lg border border-slate-200 shadow-sm">點數異動 <strong className={`font-mono text-[15px] ${pay.pointDelta > 0 ? 'text-indigo-600' : 'text-slate-600'}`}>{pay.pointDelta > 0 ? `+${pay.pointDelta}` : pay.pointDelta}</strong></span> : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalItems={records.length} />
    </div>
  );
}
