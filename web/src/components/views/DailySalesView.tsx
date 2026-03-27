import { useState, useMemo, useEffect, useRef } from 'react';
import { Search, ClipboardList, Receipt, Loader2, Trash2, Archive, MessageSquare, AlertCircle } from 'lucide-react';
import { useStickyState } from '../../hooks/useStickyState';
import { Pagination } from '../ui/Pagination';
import type { Branch, DailySalesEntry, MemberEntry } from '../../types';

interface DailySalesViewProps {
  branch: Branch;
  records: DailySalesEntry[];
  members: MemberEntry[];
  isLoading: boolean;
  onDelete: (uid: string) => void;
  openingCash: number | null;
  onSetOpeningCash: (amt: number) => void;
  readOnly?: boolean;
}

export function DailySalesView({ branch, records, members, isLoading, onDelete, openingCash, onSetOpeningCash, readOnly = false }: DailySalesViewProps) {
  const [search, setSearch] = useState('');
  const [uiMode, setUiMode] = useStickyState<'classic' | 'audit'>('audit', 'pos_daily_ui_mode');
  const [voidConfirmUid, setVoidConfirmUid] = useState<string | null>(null);

  // 開櫃準備金 local state：避免每打一字就 API call
  const [localCash, setLocalCash] = useState<string>(openingCash != null ? String(openingCash) : '');
  const prevBranchRef = useRef(branch);
  useEffect(() => {
    // 外部值變更或切門市時同步
    if (branch !== prevBranchRef.current) {
      prevBranchRef.current = branch;
    }
    setLocalCash(openingCash != null ? String(openingCash) : '');
  }, [openingCash, branch]);

  const commitOpeningCash = () => {
    const val = Number(localCash) || 0;
    if (val !== (openingCash ?? 0)) {
      onSetOpeningCash(val);
    }
  };

  const allGroups = useMemo(() => {
    const map = new Map<string, DailySalesEntry[]>();
    records.forEach(r => {
      const uid = r.checkoutUID?.toString().trim();
      if (!uid) return;
      if (!map.has(uid)) map.set(uid, []);
      map.get(uid)!.push(r);
    });
    return Array.from(map.values());
  }, [records]);

  const stats = useMemo(() => {
    let rev = 0, cash = 0, remit = 0, credit = 0, pts = 0;
    allGroups.forEach(items => {
      const pay = items.find(r => r.receivedAmount || r.creditCard || r.cash || r.remittance) || items[0];
      rev += Number(pay.receivedAmount) || 0;
      cash += Number(pay.cash) || 0;
      remit += Number(pay.remittance) || 0;
      credit += Number(pay.creditCard) || 0;
      // V 欄 pointDelta 優先，為 0 時 fallback 到 K 欄逐行加總
      const vDelta = Number(pay.pointDelta) || 0;
      const kSum = items.reduce((s, r) => s + (Number(r.points) || 0), 0);
      pts += vDelta || kSum;
    });
    return { rev, cash, remit, credit, pts };
  }, [allGroups]);

  const groupedRecords = useMemo(() => {
    const q = search.toLowerCase();
    const result: { uid: string; items: DailySalesEntry[] }[] = [];
    allGroups.forEach((items) => {
      const uid = items[0].checkoutUID ? items[0].checkoutUID.toString() : '';
      const match = !q || uid.toLowerCase().includes(q) || items.some(r =>
        r.phone.includes(q) ||
        (r.setName && r.setName.toLowerCase().includes(q)) ||
        (r.name && r.name.toLowerCase().includes(q)) ||
        (r.prizeName && r.prizeName.toLowerCase().includes(q)) ||
        (r.type && r.type.toLowerCase().includes(q))
      );
      if (match) result.push({ uid, items });
    });
    return result;
  }, [search, allGroups]);

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
    <div className="flex flex-col gap-6 mb-24 max-w-screen-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">當日銷售資料 ({branch})</h2>
          <p className="text-sm text-slate-500 mt-1">尚未關帳的當日明細。以交易單號分組，點擊整組底部的垃圾桶可作廢該筆交易 (每頁顯示約 100 筆資料)。</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex bg-slate-200/50 p-1 rounded-lg">
             <button onClick={() => setUiMode('audit')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${uiMode === 'audit' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>精簡對帳</button>
             <button onClick={() => setUiMode('classic')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${uiMode === 'classic' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>經典表格</button>
          </div>
          <div className="relative w-72">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="搜尋電話、單號、商品..."
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Daily Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="bg-indigo-50/50 rounded-2xl shadow-sm border border-indigo-100 p-5 flex flex-col justify-center relative group">
          <p className="text-xs text-indigo-500 font-bold mb-2 tracking-widest uppercase flex items-center gap-1"><Archive className="w-3 h-3"/> 開櫃準備金</p>
          <div className="flex items-center gap-2">
            <span className="text-sm text-indigo-400 font-bold">NT$</span>
            <input
              type="number"
            className="w-full bg-transparent outline-none font-bold text-xl text-indigo-700 tracking-tight"
            value={localCash}
            placeholder="0"
            onChange={(e) => setLocalCash(e.target.value)}
            onBlur={commitOpeningCash}
            onKeyDown={(e) => { if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); } }}
            />
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col justify-center">
          <p className="text-xs text-slate-400 font-bold mb-1 tracking-widest uppercase">本日營業額</p>
          <p className="text-2xl font-bold text-slate-800 tracking-tight">NT$ {stats.rev.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col justify-center">
          <p className="text-xs text-slate-400 font-bold mb-1 tracking-widest uppercase">現金總額</p>
          <p className="text-xl font-bold text-emerald-600 tracking-tight">NT$ {stats.cash.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col justify-center">
          <p className="text-xs text-slate-400 font-bold mb-1 tracking-widest uppercase">信用卡總額</p>
          <p className="text-xl font-bold text-emerald-600 tracking-tight">NT$ {stats.credit.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col justify-center">
          <p className="text-xs text-slate-400 font-bold mb-1 tracking-widest uppercase">匯款總額</p>
          <p className="text-xl font-bold text-emerald-600 tracking-tight">NT$ {stats.remit.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col justify-center">
          <p className="text-xs tracking-widest font-bold mb-1 uppercase text-indigo-400">點數發放與異動</p>
          <p className={`text-2xl font-bold tracking-tight ${stats.pts >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
            {stats.pts > 0 ? '+' : ''}{stats.pts.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {isLoading ? (
          <div className="bg-white rounded-2xl p-16 text-center text-slate-400 border border-slate-100 shadow-sm"><Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin text-emerald-500" />資料讀取中...</div>
        ) : groupedRecords.length === 0 && (
          <div className="bg-white rounded-2xl p-16 text-center text-slate-400 border border-slate-100 shadow-sm"><ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-20" /><p>目前無當日銷售紀錄</p></div>
        )}

        {currentVisibleGroups.map(({ uid, items }) => {
          const first = items[0];
          const pay = items.find(r => r.receivedAmount || r.creditCard || r.cash || r.remittance) || first;
          // V 欄 pointDelta 優先，舊資料可能為 0 → fallback 用 K 欄加總
          const effectivePointDelta = (pay.pointDelta != null && pay.pointDelta !== 0)
            ? pay.pointDelta
            : items.reduce((s, r) => s + (Number(r.points) || 0), 0);

          return (
            <div key={uid} className="bg-white rounded-2xl border border-slate-200 shadow-[0_2px_10px_rgba(0,0,0,0.02)] overflow-hidden transition-all hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] relative group">
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
                    <span className="text-slate-400 text-xs">客戶電話：</span>
                    <span className="font-mono font-medium text-slate-700 bg-white px-2 py-0.5 border border-slate-200 rounded text-sm">{first.phone || '無電話'}</span>
                    {first.phone && (() => { const m = members.find(mb => String(mb.phone) === String(first.phone)); return m ? <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded ml-1">{m.name}</span> : null; })()}
                  </div>
                </div>
              </div>

              {/* Dynamic Items List */}
              {uiMode === 'audit' ? (
                <div className="overflow-x-auto">
                   <table className="w-full text-sm min-w-[700px] whitespace-nowrap">
                     <thead className="bg-slate-50 border-b border-slate-100">
                       <tr>
                         <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500">哪幾套 (商品/套名)</th>
                         <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500">抽/數量</th>
                         <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500">中了啥 (獎項內容)</th>
                         <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500">換點數 / 帶走</th>
                         <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500">單項金額</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-50">
                       {items.map((r, i) => {
                         const isLottery = Boolean(r.lotteryId);
                         return (
                           <tr key={i} className="hover:bg-slate-50/50">
                             <td className="px-6 py-3">
                               <div className="flex items-center gap-2">
                                 <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-bold ${isLottery ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{isLottery ? '福袋' : '商品'}</span>
                                 {isLottery && r.lotteryId && <span className="font-mono text-xs text-slate-400">#{r.lotteryId}</span>}
                                 <span className="font-bold text-slate-700 text-[15px]">{r.setName || r.name || '-'}</span>
                               </div>
                             </td>
                             <td className="px-6 py-3 text-center font-bold text-slate-700 text-[15px]">x{r.draws || 1}</td>
                             <td className="px-6 py-3 font-medium text-slate-600">
                               <div className="flex items-center gap-2">
                                 {isLottery && r.prize ? <span className="bg-slate-100 px-2 py-0.5 rounded font-bold text-slate-700">{r.prize}</span> : null}
                                 <span>{r.prizeName || r.name || '-'}</span>
                                 <span className="text-xs text-slate-400">({r.lotteryId || '-'})</span>
                               </div>
                             </td>
                             <td className="px-6 py-3 text-center">
                               <div className="flex items-center justify-center gap-1.5">
                                 <span className={`px-2 py-0.5 rounded text-[11px] font-bold leading-none ${['帶走', '現金'].includes(r.type) ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'}`}>
                                   {r.type || '-'}
                                 </span>
                                 {Boolean(r.points) && (
                                   <span className="px-2 py-0.5 rounded text-[11px] font-bold text-indigo-600">({r.type === '點數' ? '換' : '得'} {r.points} 點)</span>
                                 )}
                               </div>
                             </td>
                             <td className="px-6 py-3 text-right font-mono font-bold text-slate-800 text-[15px]">${r.amount ? r.amount.toLocaleString() : '0'}</td>
                           </tr>
                         );
                       })}
                     </tbody>
                   </table>
                </div>
              ) : (
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
              )}

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
                  {!pay.receivedAmount && !pay.cash && !pay.creditCard && !pay.remittance && <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-violet-50 text-violet-600 border border-violet-100">純點數交易</span>}
                  {pay.channel ? <div className="text-slate-500 text-xs flex items-center gap-1.5 bg-amber-50/80 px-2.5 py-1 rounded-md border border-amber-100 max-w-sm shadow-sm ml-2" title={pay.channel}><MessageSquare className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" /><span className="truncate flex-1 font-medium">{pay.channel}</span></div> : null}
                  {effectivePointDelta !== 0 ? <span className="text-slate-500 font-medium bg-white px-3 py-1 rounded-lg border border-slate-200 shadow-sm ml-2">點數異動 <strong className={`font-mono text-[15px] ${effectivePointDelta > 0 ? 'text-indigo-600' : 'text-rose-600'}`}>{effectivePointDelta > 0 ? `+${effectivePointDelta}` : effectivePointDelta}</strong></span> : null}
                </div>
                {!readOnly && (
                <div>
                  <button onClick={() => setVoidConfirmUid(uid)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-500 bg-rose-50 border border-rose-100 rounded-lg hover:bg-rose-500 hover:text-white transition-colors shadow-sm" title="作廢訂單">
                    <Trash2 className="w-3.5 h-3.5" /> 作廢
                  </button>
                </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalItems={records.length} />

      {/* Void Confirmation Modal */}
      {voidConfirmUid && (() => {
        const voidGroup = groupedRecords.find(g => g.uid === voidConfirmUid);
        const voidFirst = voidGroup?.items[0];
        const voidPay = voidGroup?.items.find(r => r.receivedAmount || r.cash) || voidFirst;

        return (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col transform transition-all border border-slate-100 p-6 m-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-5 h-5 text-rose-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-800">確定作廢訂單？</h3>
              </div>

              {/* 訂單資訊摘要 */}
              <div className="bg-rose-50/50 border border-rose-100 rounded-xl p-4 mb-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">客戶電話</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-800 text-lg">{voidFirst?.phone || '未知'}</span>
                    {voidFirst?.phone && (() => { const m = members.find(mb => String(mb.phone) === String(voidFirst.phone)); return m ? <span className="text-xs font-medium text-indigo-600">{m.name}</span> : null; })()}
                  </div>
                </div>
                {voidFirst?.date && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">結帳時間</span>
                    <span className="font-medium text-slate-700">{voidFirst.date}</span>
                  </div>
                )}
                {voidPay?.receivedAmount != null && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">實收金額</span>
                    <span className="font-mono font-bold text-rose-600">NT$ {voidPay.receivedAmount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">商品數</span>
                  <span className="font-bold text-slate-700">{voidGroup?.items.length || 0} 項</span>
                </div>
                {(() => {
                  const voidEffective = (voidPay?.pointDelta != null && voidPay.pointDelta !== 0)
                    ? voidPay.pointDelta
                    : (voidGroup?.items.reduce((s, r) => s + (Number(r.points) || 0), 0) || 0);
                  return voidEffective !== 0 ? (
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">點數異動</span>
                    <span className={`font-mono font-bold ${voidEffective > 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                      {voidEffective > 0 ? `+${voidEffective}` : voidEffective}（作廢後將退回）
                    </span>
                  </div>
                  ) : null;
                })()}
              </div>

              <p className="text-slate-500 text-sm mb-5 leading-relaxed">
                作廢後，該筆<strong>當日交易紀錄</strong>將被刪除，且其產生的點數變化會自動退回給會員。<br/>⚠️ 此操作無法復原。
              </p>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setVoidConfirmUid(null)} className="px-5 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors">
                  取消
                </button>
                <button 
                  onClick={() => { onDelete(voidConfirmUid); setVoidConfirmUid(null); }} 
                  className="px-5 py-2.5 rounded-xl font-bold text-white bg-rose-500 hover:bg-rose-600 shadow-md shadow-rose-500/20 transition-all flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" /> 確認作廢
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
