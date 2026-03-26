import { useState, useMemo } from 'react';
import { Search, Users, Receipt, Loader2 } from 'lucide-react';
import { MEMBER_AUTOCOMPLETE_LIMIT } from '../../config';
import type { MemberEntry } from '../../types';

interface MemberHistoryViewProps {
  phone: string;
  setPhone: (p: string) => void;
  member: MemberEntry | null;
  records: any[];
  isLoading: boolean;
  onSearch: () => void;
  allMembers: MemberEntry[];
}

export function MemberHistoryView({ phone, setPhone, member, records, isLoading, onSearch, allMembers }: MemberHistoryViewProps) {
  const [showAutoComplete, setShowAutoComplete] = useState(false);
  const filteredCache = useMemo(() => {
    if (!phone) return [];
    return allMembers.filter((m: any) => String(m.phone || '').includes(phone) || String(m.name || '').includes(phone)).slice(0, MEMBER_AUTOCOMPLETE_LIMIT);
  }, [phone, allMembers]);

  const selectMember = (m: any) => {
    setPhone(m.phone);
    setShowAutoComplete(false);
  };

  const groups = useMemo(() => {
    const map = new Map();
    records.forEach((r: any) => {
      const gUID = r.checkoutUID || 'unknown';
      if (!map.has(gUID)) {
        map.set(gUID, {
          uid: gUID,
          date: r.date,
          branch: r.branch,
          receivedAmount: r.receivedAmount || 0,
          remittance: r.remittance || 0,
          creditCard: r.creditCard || 0,
          cash: r.cash || 0,
          pointsUsed: r.pointsUsed || 0,
          pointDelta: r.pointDelta || 0,
          items: []
        });
      } else {
        const existing = map.get(gUID);
        if (!existing.receivedAmount && r.receivedAmount) existing.receivedAmount = r.receivedAmount;
        if (!existing.remittance && r.remittance) existing.remittance = r.remittance;
        if (!existing.creditCard && r.creditCard) existing.creditCard = r.creditCard;
        if (!existing.cash && r.cash) existing.cash = r.cash;
        if (!existing.pointsUsed && r.pointsUsed) existing.pointsUsed = r.pointsUsed;
        if (!existing.pointDelta && r.pointDelta) existing.pointDelta = r.pointDelta;
      }
      map.get(gUID).items.push(r);
    });
    return Array.from(map.values()).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [records]);

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full mb-24">
      {/* Search Bar */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 overflow-visible">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-end">
          <div className="w-full md:w-96 relative">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">會員電話 / 姓名</label>
            <input
              type="text"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 rounded-xl outline-none font-bold text-slate-800 transition-all text-lg tracking-wider placeholder:text-slate-300 placeholder:font-medium"
              placeholder="輸入手機號碼或姓名..."
              value={phone}
              onChange={e => {
                setPhone(e.target.value);
                setShowAutoComplete(true);
              }}
              onKeyDown={e => e.key === 'Enter' && onSearch()}
            />
            {showAutoComplete && filteredCache.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden break-words">
                {filteredCache.map((m: any, i: number) => (
                  <div key={i} className="px-5 py-3 hover:bg-indigo-50 cursor-pointer border-b border-slate-50 last:border-0" onClick={() => selectMember(m)}>
                    <div className="font-bold text-slate-800 text-lg">{m.name}</div>
                    <div className="text-slate-400 font-mono text-sm tracking-widest">{m.phone}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button onClick={onSearch} disabled={isLoading} className="w-full md:w-auto px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/30 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2">
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
            搜尋紀錄
          </button>
        </div>
      </div>

      {/* Member Details */}
      {member && (
        <div className="bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl shadow-xl p-6 text-white relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 opacity-10">
            <Users className="w-48 h-48" />
          </div>
          <div className="relative z-10 flex flex-col md:flex-row justify-between gap-6">
            <div>
              <div className="text-indigo-200 font-bold uppercase tracking-widest text-xs mb-1">會員資料</div>
              <h2 className="text-3xl font-black mb-2 flex items-center gap-3">
                {member.name}
                <span className="text-sm font-bold px-3 py-1 bg-white/20 rounded-full">{member.gender || '無性別資訊'}</span>
              </h2>
              <div className="font-mono text-indigo-100 tracking-widest text-lg">{member.phone}</div>
            </div>
            <div className="flex flex-row md:flex-col gap-4 items-center md:items-end justify-center md:justify-start">
              <div className="bg-white/10 backdrop-blur-md rounded-2xl px-6 py-4 flex flex-col items-center flex-1 md:flex-none">
                <span className="text-indigo-200 text-[10px] font-bold uppercase tracking-widest mb-1">累積點數</span>
                <span className="text-4xl font-black text-white">{member.points.toLocaleString()} <span className="text-base text-indigo-200">pt</span></span>
              </div>
              <div className="text-indigo-200 text-sm font-bold px-3">
                生日：{member.birthday || '未填寫'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Timeline List */}
      <div className="flex flex-col gap-6">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center text-slate-400">
            <Loader2 className="w-10 h-10 animate-spin text-indigo-400 mb-4" />
            <span className="font-bold tracking-wider">正在撈取消費宇宙紀錄...</span>
          </div>
        ) : member && groups.length === 0 ? (
          <div className="py-20 text-center text-slate-400 font-bold text-lg bg-white rounded-2xl border border-slate-200 border-dashed">
             這位會員還沒有任何消費紀錄喔！
          </div>
        ) : (
          groups.map((g: any, i: number) => (
            <div key={i} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
              {/* Group Header */}
              <div className="bg-slate-50 border-b border-slate-100 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="bg-indigo-100 text-indigo-700 w-12 h-12 rounded-full flex items-center justify-center font-bold shadow-inner">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-black text-slate-800 text-lg">{g.date}</span>
                      <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black tracking-widest uppercase border ${g.branch === '金山' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>{g.branch}</span>
                    </div>
                    <div className="font-mono text-xs text-slate-400 uppercase tracking-wider">{g.uid}</div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                  <div className="px-4 py-2 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col items-end">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">實收金額</span>
                    <span className="font-black text-rose-600">NT$ {(g.receivedAmount || 0).toLocaleString()}</span>
                  </div>
                  {(g.pointsUsed > 0 || g.pointDelta !== 0) && (
                    <div className="px-4 py-2 bg-indigo-50 rounded-xl border border-indigo-100 shadow-sm flex flex-col items-end">
                      <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-widest">點數異動</span>
                      <span className="font-black text-indigo-700">{g.pointDelta > 0 ? '+' : ''}{g.pointDelta}</span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Items List */}
              <div className="p-0 overflow-x-auto">
                <table className="w-full text-sm text-slate-600 whitespace-nowrap min-w-[700px]">
                  <thead className="bg-white border-b border-slate-100 text-slate-400 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3 text-left font-bold">品項</th>
                      <th className="px-5 py-3 text-left font-bold w-1/4">名稱</th>
                      <th className="px-5 py-3 text-center font-bold">抽數/數量</th>
                      <th className="px-5 py-3 text-right font-bold w-32">金額</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {g.items.map((item: any, idx: number) => {
                      const isMerch = !item.lotteryId || (String(item.prize).trim() === '' && String(item.setName).trim() === '');
                      const isLottery = !isMerch;
                      
                      const actualDraws = Number(item.draws) || 1;
                      const merchQty = isMerch && item.draws ? item.draws : (item.prize || 1);
                      const merchName = String(item.prizeName || item.setName || '-');
                      const isLegacyAdHoc = ['88888', '99999'].includes(String(item.lotteryId)) || merchName.includes('隨便加') || merchName.includes('隨便扣') || merchName.includes('加點');
                      
                      const parsedPoints = Math.abs(Number(item.points)) || (isLegacyAdHoc ? actualDraws : 0);
                      const merchPoints = parsedPoints;

                      return (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-5 py-3">
                            {isLottery ? (
                              <div className="flex flex-col gap-1.5 items-start">
                                <span className="flex items-center gap-2">
                                  <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px] font-black tracking-widest uppercase">福袋</span>
                                  <span className="font-bold text-slate-700">{item.lotteryId}</span>
                                </span>
                                <span className={`text-[10px] font-black tracking-widest px-1.5 py-0.5 rounded ${['點數', '換點數'].includes(item.type) ? 'text-indigo-700 bg-indigo-50 border border-indigo-100' : 'text-slate-500 bg-slate-100 border border-slate-200'}`}>
                                  {item.type}
                                </span>
                              </div>
                            ) : (
                              <div className="flex flex-col gap-1.5 items-start">
                                <span className="flex items-center gap-2">
                                  <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-black tracking-widest uppercase">商品</span>
                                  <span className="font-mono text-slate-500">{item.lotteryId}</span>
                                </span>
                                {item.type === '點數' && <span className="text-[10px] font-black tracking-widest px-1.5 py-0.5 rounded text-indigo-700 bg-indigo-50 border border-indigo-100">點數兌換</span>}
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-3 font-bold text-slate-800 whitespace-normal">
                            {isLottery ? (
                              <div className="flex flex-col gap-0.5">
                                <span className="text-slate-500 text-xs">{item.setName}</span>
                                <span className="text-rose-600">[{item.prize}] {item.prizeName}</span>
                                {item.remark && <span className="text-[10px] text-slate-400 font-medium bg-slate-50 w-fit px-1.5 py-0.5 mt-0.5 rounded border border-slate-100">{item.remark}</span>}
                              </div>
                            ) : (
                              <div className="flex flex-col gap-1 items-start">
                                <span>{merchName}</span>
                                {item.remark && <span className="text-[10px] text-slate-400 font-medium bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">{item.remark}</span>}
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-3 text-center font-bold text-slate-700">
                            {isLottery ? `${item.draws} 抽` : `${merchQty} 個`}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <div className="flex flex-col items-end">
                              <span className="font-bold font-mono text-slate-600">NT$ {(item.amount || 0).toLocaleString()}</span>
                              {!isLottery && merchPoints > 0 && (
                                <span className={`font-bold text-[11px] mt-1.5 px-2 py-0.5 rounded ${item.lotteryId === '88888' || merchName.includes('加點') || merchName.includes('隨便加') ? 'text-emerald-700 bg-emerald-50 border border-emerald-100' : 'text-indigo-600 bg-indigo-50 border border-indigo-100'}`}>
                                  {item.lotteryId === '88888' || merchName.includes('加點') || merchName.includes('隨便加') ? '送' : '扣'} {merchPoints} 點
                                </span>
                              )}
                              {isLottery && ['點數', '換點數'].includes(item.type) && (
                                <span className="text-emerald-700 bg-emerald-50 border border-emerald-100 font-bold text-[11px] mt-1.5 px-2 py-0.5 rounded">
                                  換得 {item.points || 0} 點
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
