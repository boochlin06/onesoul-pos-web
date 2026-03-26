import { Search, Users, Receipt, BookOpen, Plus, Trash2, Archive, ShoppingCart } from 'lucide-react';
import type { Branch, LotteryItem, MerchItem } from '../../types';
import { branchBadge, branchGradient } from '../../constants';




interface CardCheckoutProps {
  branch: Branch;
  customer: { phoneName: string; name: string; gender: string; birthday: string; currentPoints: number };
  setCustomer: (fn: any) => void;
  showMemberDropdown: boolean;
  setShowMemberDropdown: (v: boolean) => void;
  filteredCacheMembers: any[];
  selectCacheMember: (m: any) => void;
  handlePhoneKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  payment: { cash: number; remittance: number; creditCard: number };
  setPayment: (fn: any) => void;
  lotteries: LotteryItem[];
  addLotteryRow: () => void;
  removeLotteryRow: (i: number) => void;
  updateLottery: (i: number, field: keyof LotteryItem, value: unknown) => void;
  merchandises: MerchItem[];
  addMerchRow: () => void;
  removeMerchRow: (i: number) => void;
  updateMerch: (i: number, field: keyof MerchItem, value: unknown) => void;
  summary: { pointsChange: number; dueAmount: number };
  orderNote: string;
  setOrderNote: (v: string) => void;
  handleResetCheckout: () => void;
  handleCheckout: () => void;
  setActiveTab: (t: string) => void;
}

export function CardCheckoutView({
  branch, customer, setCustomer,
  showMemberDropdown, setShowMemberDropdown,
  filteredCacheMembers, selectCacheMember, handlePhoneKeyDown,
  payment, setPayment,
  lotteries, addLotteryRow, removeLotteryRow, updateLottery,
  merchandises, addMerchRow, removeMerchRow, updateMerch,
  summary, orderNote, setOrderNote,
  handleResetCheckout, handleCheckout, setActiveTab,
}: CardCheckoutProps) {
  const totalReceived = payment.cash + payment.remittance + payment.creditCard;

  return (
    <div className="w-full mx-auto flex flex-col gap-6 pb-32">

      {/* ── Top: Customer + Payment ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Customer */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-indigo-100 bg-indigo-50/60 flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-bold">1</div>
            <span className="text-sm font-bold text-indigo-900">顧客資訊</span>
            <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ml-auto ${branchBadge[branch]}`}>{branch}</span>
          </div>
          <div className="p-4 space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
              <input
                type="text"
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 rounded-xl transition-all outline-none font-medium text-sm"
                placeholder="輸入號碼或姓名 (Enter 遠端查詢)"
                value={customer.phoneName}
                onChange={e => { setCustomer((p: any) => ({ ...p, phoneName: e.target.value, name: '' })); setShowMemberDropdown(true); }}
                onFocus={() => setShowMemberDropdown(true)}
                onBlur={() => setTimeout(() => setShowMemberDropdown(false), 200)}
                onKeyDown={handlePhoneKeyDown}
              />
              {showMemberDropdown && filteredCacheMembers.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 shadow-2xl rounded-xl z-50 max-h-52 overflow-y-auto">
                  {filteredCacheMembers.map((m, i) => (
                    <div key={i} className="px-4 py-2.5 hover:bg-indigo-50 cursor-pointer flex justify-between items-center border-b border-slate-50 last:border-0 transition-colors" onClick={() => selectCacheMember(m)}>
                      <div><span className="font-bold text-slate-800 text-sm">{m.name || '無名氏'}</span><span className="text-xs text-slate-400 ml-2 font-mono">{m.phone}</span></div>
                      <span className="text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded text-xs">{m.points}p</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {customer.name && (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl">
                <Users className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-bold text-emerald-700">{customer.name}</span>
                <span className="ml-auto text-xs bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded-full">{customer.currentPoints.toLocaleString()} pts</span>
              </div>
            )}
            {!customer.name && (
              <div className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
                <span className="text-xs text-slate-400">累積點數</span>
                <span className="font-bold text-indigo-700">{customer.currentPoints.toLocaleString()} pts</span>
              </div>
            )}
          </div>
        </div>

        {/* Payment */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-emerald-100 bg-emerald-50/60 flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center text-sm font-bold">2</div>
            <span className="text-sm font-bold text-emerald-900">收款明細</span>
            <Receipt className="w-4 h-4 text-emerald-500 ml-auto" />
          </div>
          <div className="p-4">
            <div className="text-center py-3 mb-4 bg-slate-50 rounded-xl border border-slate-100">
              <div className="text-xs text-slate-400 font-bold">實收合計</div>
              <div className="text-3xl font-black text-slate-800 mt-1">NT$ {totalReceived.toLocaleString()}</div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {([
                { label: '現金', key: 'cash', color: 'emerald' },
                { label: '匯款', key: 'remittance', color: 'blue' },
                { label: '刷卡', key: 'creditCard', color: 'violet' },
              ] as const).map(({ label, key, color }) => (
                <div key={key} className="flex flex-col">
                  <label className={`text-[10px] font-bold text-${color}-500 uppercase tracking-wider mb-1`}>{label}</label>
                  <input
                    type="number" min="0"
                    className={`w-full text-right px-3 py-2 bg-${color}-50/50 border border-${color}-100 focus:border-${color}-400 focus:ring-2 focus:ring-${color}-100 rounded-lg outline-none font-mono text-sm`}
                    value={payment[key]}
                    onChange={e => setPayment((p: any) => ({ ...p, [key]: Number(e.target.value) }))}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Lottery Items (Card-based) ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-amber-200 bg-amber-50">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center text-sm font-bold">3</div>
            <span className="text-sm font-bold text-amber-900">抽獎福袋</span>
            <span className="text-xs bg-amber-200 text-amber-800 font-bold px-2 py-0.5 rounded-full">{lotteries.filter(l => l.id || l.setName || l.amount > 0).length} 筆</span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setActiveTab('library')} className="flex items-center gap-1 text-xs px-3 py-1.5 bg-white border border-amber-200 hover:bg-amber-100 text-amber-700 rounded-lg font-bold transition-all active:scale-95">
              <BookOpen className="w-3.5 h-3.5" /> 獎項庫
            </button>
            <button onClick={addLotteryRow} className="flex items-center gap-1 text-xs px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold transition-all active:scale-95">
              <Plus className="w-3.5 h-3.5" /> 新增
            </button>
          </div>
        </div>

        <div className="p-4 space-y-3">
          {lotteries.length === 0 && (
            <div className="text-center py-12 text-slate-400"><Archive className="w-8 h-8 mx-auto mb-2 opacity-30" /><p className="text-sm">尚無抽獎項目</p></div>
          )}
          {lotteries.map((item, idx) => (
            <div key={idx} className="border border-slate-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow group bg-white">
              {/* Row 1: 套名 + 獎品名稱（大字醒目） */}
              <div className="px-4 py-3 bg-amber-50/50 border-b border-amber-100">
                <div className="flex items-start gap-3">
                  {/* 左：輸入區 */}
                  <div className="flex items-center gap-2 shrink-0 pt-0.5">
                    <div className="flex flex-col items-center">
                      <span className="text-[9px] text-slate-400 font-bold mb-0.5">單號</span>
                      <input type="text" className="w-16 text-center text-sm font-mono bg-white border-2 border-slate-200 rounded-lg px-1 py-1.5 focus:border-amber-400 focus:ring-2 focus:ring-amber-200 outline-none shadow-sm" placeholder="001" value={item.id} onChange={e => updateLottery(idx, 'id', e.target.value)} />
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-[9px] text-slate-400 font-bold mb-0.5">獎項</span>
                      <input type="text" className="w-12 text-center text-sm font-bold text-amber-700 bg-amber-50 border-2 border-amber-300 rounded-lg px-1 py-1.5 focus:border-amber-500 outline-none shadow-sm" placeholder="A" value={item.prize} onChange={e => updateLottery(idx, 'prize', e.target.value)} />
                    </div>
                  </div>
                  {/* 中：套名 + 獎品名稱 */}
                  <div className="flex flex-col min-w-0 flex-1 py-0.5">
                    <span className="text-sm text-slate-500 truncate">{item.setName || <span className="text-slate-300 italic">（填單號帶入套名）</span>}</span>
                    <span className="text-base font-black text-slate-900 truncate mt-0.5">
                      {item.prizeName || <span className="text-slate-300 font-normal text-sm">—</span>}
                    </span>
                  </div>
                  {/* 右：點數 + 抽數 */}
                  <div className="flex items-center gap-2 shrink-0 pt-1">
                    {item.unitPoints > 0 && (
                      <span className="text-xs bg-indigo-100 text-indigo-700 font-bold px-2 py-1 rounded-lg">{item.unitPoints}p/抽</span>
                    )}
                    <select className="text-xs font-bold bg-white border-2 border-slate-200 rounded-lg px-2 py-1.5 text-amber-700 outline-none shadow-sm" value={item.type} onChange={e => updateLottery(idx, 'type', e.target.value)}>
                      <option>帶走</option><option>點數</option>
                    </select>
                    <div className="flex flex-col items-center">
                      <span className="text-[9px] text-slate-400 font-bold mb-0.5">抽數</span>
                      <input type="number" min="0" className="w-14 text-center text-sm font-bold bg-white border-2 border-slate-200 rounded-lg px-1 py-1.5 focus:border-amber-400 outline-none shadow-sm" placeholder="0" value={item.draws} onChange={e => updateLottery(idx, 'draws', Number(e.target.value))} />
                    </div>
                  </div>
                </div>
              </div>
              {/* Row 2: 金額 + 點數 + 備註 */}
              <div className="flex items-center gap-3 px-4 py-2.5 bg-white">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  {item.unitPrice > 0 && <span className="bg-amber-50 text-amber-600 font-bold px-2 py-0.5 rounded-md border border-amber-100">@{item.unitPrice}/抽</span>}
                </div>
                <div className="flex items-center gap-2.5 ml-auto shrink-0">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${item.totalPoints > 0 ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-slate-50 text-slate-400 border border-slate-200'}`}>
                    {item.totalPoints > 0 ? `+${item.totalPoints}` : '0'} pts
                  </span>
                  <div className="flex flex-col items-end">
                    <span className="text-[9px] text-slate-400 font-bold mb-0.5">金額</span>
                    <input type="number" min="0" className="w-24 text-right text-sm font-bold text-amber-700 bg-white border-2 border-amber-200 rounded-lg px-2 py-1.5 focus:border-amber-400 focus:ring-2 focus:ring-amber-200 outline-none shadow-sm" placeholder="0" value={item.amount} onChange={e => updateLottery(idx, 'amount', Number(e.target.value))} />
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="text-[9px] text-slate-400 font-bold mb-0.5">備註</span>
                    <input type="text" className="w-28 text-xs text-slate-600 bg-slate-50 border-2 border-slate-200 rounded-lg px-2 py-1.5 focus:border-slate-400 outline-none shadow-sm" placeholder="選填..." value={item.remark} onChange={e => updateLottery(idx, 'remark', e.target.value)} />
                  </div>
                  <button onClick={() => removeLotteryRow(idx)} className="text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg p-1.5 transition-colors opacity-0 group-hover:opacity-100 mt-3"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Merchandise Items (Card-based) ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-rose-200 bg-rose-50">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-rose-500 text-white flex items-center justify-center text-sm font-bold">4</div>
            <span className="text-sm font-bold text-rose-900">直購商品</span>
            <span className="text-xs bg-rose-200 text-rose-800 font-bold px-2 py-0.5 rounded-full">{merchandises.filter(m => m.id || m.name).length} 筆</span>
          </div>
          <button onClick={addMerchRow} className="flex items-center gap-1 text-xs px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-lg font-bold transition-all active:scale-95">
            <Plus className="w-3.5 h-3.5" /> 新增
          </button>
        </div>

        <div className="p-4 space-y-3">
          {merchandises.length === 0 && (
            <div className="text-center py-12 text-slate-400"><ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-30" /><p className="text-sm">尚無商品</p></div>
          )}
          {merchandises.map((item, idx) => (
            <div key={idx} className="border border-slate-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow group bg-white">
              <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="flex flex-col">
                  <span className="text-[9px] text-slate-400 font-bold mb-0.5">貨號</span>
                  <input type="text" className="w-20 text-xs font-mono text-slate-600 bg-white border-2 border-slate-200 rounded-lg px-2 py-1.5 focus:border-rose-400 outline-none shadow-sm" placeholder="輸入" value={item.id} onChange={e => updateMerch(idx, 'id', e.target.value)} />
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-[9px] text-slate-400 font-bold mb-0.5">名稱</span>
                  <span className="font-black text-slate-900 text-base truncate">{item.name || <span className="text-slate-300 font-normal text-sm">（填貨號帶入）</span>}</span>
                </div>
                <div className="flex items-end gap-2 flex-wrap">
                  <div className="flex flex-col items-center">
                    <span className="text-[9px] text-slate-400 font-bold mb-0.5">數量</span>
                    <input type="number" min="0" className="w-14 text-center text-sm font-bold bg-white border-2 border-slate-200 rounded-lg px-1 py-1.5 focus:border-rose-400 outline-none shadow-sm" value={item.quantity} onChange={e => updateMerch(idx, 'quantity', Number(e.target.value))} />
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[9px] text-slate-400 font-bold mb-0.5">付款</span>
                    <select
                      className={`text-xs font-bold border-2 rounded-lg px-2 py-1.5 outline-none shadow-sm ${item.paymentType === '現金' ? 'bg-rose-50 border-rose-200 text-rose-700' : item.paymentType === '點數' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}
                      value={item.paymentType}
                      onChange={e => updateMerch(idx, 'paymentType', e.target.value as '現金'|'點數'|'贈送')}
                    >
                      {!item.isGk && <option>現金</option>}
                      <option>點數</option><option>贈送</option>
                    </select>
                  </div>
                  {item.paymentType === '點數' && item.totalPoints > 0 && (
                    <span className="text-xs bg-indigo-50 text-indigo-700 font-bold px-2.5 py-1 rounded-lg border border-indigo-200 mb-0.5">-{item.totalPoints}p</span>
                  )}
                  <div className="flex flex-col items-end">
                    <span className="text-[9px] text-slate-400 font-bold mb-0.5">實收</span>
                    <input type="number" min="0" className="w-24 text-right text-sm font-bold text-rose-700 bg-white border-2 border-rose-200 rounded-lg px-2 py-1.5 focus:border-rose-400 outline-none shadow-sm" placeholder="0" value={item.actualAmount} onChange={e => updateMerch(idx, 'actualAmount', Number(e.target.value))} />
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="text-[9px] text-slate-400 font-bold mb-0.5">備註</span>
                    <input type="text" className="w-24 text-xs text-slate-600 bg-slate-50 border-2 border-slate-200 rounded-lg px-2 py-1.5 focus:border-slate-400 outline-none shadow-sm" placeholder="選填" value={item.remark} onChange={e => updateMerch(idx, 'remark', e.target.value)} />
                  </div>
                  <button onClick={() => removeMerchRow(idx)} className="text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg p-1.5 transition-colors opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Note ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-full bg-slate-400 text-white flex items-center justify-center text-xs font-bold">5</div>
          <span className="text-sm font-bold text-slate-700">備註</span>
        </div>
        <textarea
          className="w-full resize-none h-16 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 placeholder:text-slate-300"
          placeholder="結帳備註（選填）"
          value={orderNote}
          onChange={e => setOrderNote(e.target.value)}
        />
      </div>

      {/* ── Sticky Footer ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] z-50">
        <div className="max-w-screen-2xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex gap-6">
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">點數異動</span>
              <span className={`text-xl font-black ${summary.pointsChange >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {summary.pointsChange > 0 ? '+' : ''}{summary.pointsChange}
              </span>
            </div>
            <div className="w-px bg-slate-200" />
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">應收</span>
              <span className="text-xl font-black text-slate-800">NT$ {summary.dueAmount.toLocaleString()}</span>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleResetCheckout} className="bg-white border-2 border-slate-200 hover:border-slate-300 text-slate-500 font-bold px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all active:scale-95 text-sm">
              <Trash2 className="w-4 h-4" /> 清空
            </button>
            <button onClick={handleCheckout} className={`bg-gradient-to-r ${branchGradient[branch]} hover:opacity-90 text-white px-8 py-2.5 rounded-xl font-bold text-sm shadow-lg flex items-center gap-2 transition-all hover:scale-105 active:scale-95`}>
              <ShoppingCart className="w-4 h-4" /> 送出結帳
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
