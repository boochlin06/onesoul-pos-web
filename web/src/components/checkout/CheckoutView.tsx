import { Search, Users, Receipt, BookOpen, Plus, Trash2, Archive, ShoppingCart, LayoutGrid, Table2 } from 'lucide-react';
import type { Branch, MemberEntry, PrizeEntry, StockEntry, BlindBoxEntry } from '../../types';
import { branchBadge, branchGradient } from '../../constants';
import { useCheckout } from '../../hooks/useCheckout';
import { useStickyState } from '../../hooks/useStickyState';
import { CardCheckoutView } from './CardCheckoutView';
import type { BannerState } from '../../hooks/useBanner';

// ── Shared input styles ──
const inpBase = "w-full outline-none rounded-md px-2 py-1.5 transition-all text-sm";
const editableStyles = "bg-white border border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 hover:border-slate-400 text-slate-800 placeholder:text-slate-300";
const readonlyStyles = "disabled:bg-transparent disabled:border-transparent disabled:shadow-none disabled:text-slate-500 read-only:bg-transparent read-only:border-transparent read-only:shadow-none read-only:text-slate-500 disabled:cursor-not-allowed";
const inp = `${inpBase} ${editableStyles} ${readonlyStyles}`;
const numInp = `${inp} text-right`;

export interface CheckoutViewProps {
  branch: Branch;
  prizes: PrizeEntry[];
  stocks: StockEntry[];
  blindBoxes: BlindBoxEntry[];
  members: MemberEntry[];
  setMembers: React.Dispatch<React.SetStateAction<MemberEntry[]>>;
  fetchMembers: () => void;
  showBanner: (msg: string, type: BannerState['type'], autoDismiss?: boolean) => void;
  setActiveTab: (t: string) => void;
}

export function CheckoutView({
  branch, prizes, stocks, blindBoxes, members, setMembers, fetchMembers, showBanner, setActiveTab,
}: CheckoutViewProps) {
  const {
    customer, setCustomer,
    showMemberDropdown, setShowMemberDropdown,
    filteredCacheMembers, selectCacheMember,
    handlePhoneKeyDown,
    payment, setPayment,
    lotteries, addLotteryRow, removeLotteryRow, updateLottery,
    merchandises, addMerchRow, removeMerchRow, updateMerch,
    summary, orderNote, setOrderNote,
    handleResetCheckout, handleCheckout,
  } = useCheckout({ branch, prizes, stocks, blindBoxes, members, setMembers, fetchMembers, showBanner });

  const [viewMode, setViewMode] = useStickyState<'classic' | 'card'>('classic', 'os_checkout_viewmode');

  // ── Card mode ──
  if (viewMode === 'card') {
    return (
      <div>
        <div className="flex justify-end mb-4">
          <div className="flex bg-slate-100 rounded-lg p-1 shadow-sm">
            <button onClick={() => setViewMode('classic')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md text-slate-500 hover:text-slate-700 transition-all">
              <Table2 className="w-3.5 h-3.5" /> 經典
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-white shadow-sm text-slate-700">
              <LayoutGrid className="w-3.5 h-3.5" /> 卡片
            </button>
          </div>
        </div>
        <CardCheckoutView
          branch={branch}
          customer={customer} setCustomer={setCustomer}
          showMemberDropdown={showMemberDropdown} setShowMemberDropdown={setShowMemberDropdown}
          filteredCacheMembers={filteredCacheMembers} selectCacheMember={selectCacheMember}
          handlePhoneKeyDown={handlePhoneKeyDown}
          payment={payment} setPayment={setPayment}
          lotteries={lotteries} addLotteryRow={addLotteryRow} removeLotteryRow={removeLotteryRow} updateLottery={updateLottery}
          merchandises={merchandises} addMerchRow={addMerchRow} removeMerchRow={removeMerchRow} updateMerch={updateMerch}
          summary={summary} orderNote={orderNote} setOrderNote={setOrderNote}
          handleResetCheckout={handleResetCheckout} handleCheckout={handleCheckout}
          setActiveTab={setActiveTab}
        />
      </div>
    );
  }

  return (
    <div className="w-full mx-auto flex flex-col gap-6 pb-32">

      {/* View toggle */}
      <div className="flex justify-end">
        <div className="flex bg-slate-100 rounded-lg p-1 shadow-sm">
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-white shadow-sm text-slate-700">
            <Table2 className="w-3.5 h-3.5" /> 經典
          </button>
          <button onClick={() => setViewMode('card')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md text-slate-500 hover:text-slate-700 transition-all">
            <LayoutGrid className="w-3.5 h-3.5" /> 卡片
          </button>
        </div>
      </div>

      {/* Top row: Customer & Payment */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Customer Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-visible flex flex-col transition-all hover:shadow-md">
          <div className="px-5 py-4 border-b border-indigo-100 bg-indigo-50/60 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold shadow-sm">1</div>
              <span className="text-base font-bold text-indigo-900">顧客資訊</span>
            </div>
            <span className={`text-xs font-bold px-3 py-1 rounded-full shadow-sm ${branchBadge[branch]}`}>{branch}門市</span>
          </div>
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5 flex-1">
            <div className="col-span-1 md:col-span-2 relative">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">電話號碼 <span className="text-indigo-400 font-normal ml-1">(按 Enter 遠端查詢)</span></label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 rounded-lg transition-all outline-none font-medium"
                  placeholder="輸入號碼或姓名尋找..."
                  value={customer.phoneName}
                  onChange={e => { setCustomer({ ...customer, phoneName: e.target.value, name: '' }); setShowMemberDropdown(true); }}
                  onFocus={() => setShowMemberDropdown(true)}
                  onBlur={() => setTimeout(() => setShowMemberDropdown(false), 200)}
                  onKeyDown={handlePhoneKeyDown}
                />
                {showMemberDropdown && filteredCacheMembers.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 shadow-2xl rounded-xl z-50 max-h-60 overflow-y-auto w-full transition-all">
                    {filteredCacheMembers.map((m, idx) => (
                      <div key={idx} className="px-4 py-3 hover:bg-slate-50 cursor-pointer flex justify-between items-center border-b border-slate-100 last:border-0 transition-colors" onClick={() => selectCacheMember(m)}>
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800">{m.name || '無名氏'}</span>
                          <span className="text-xs text-slate-500 font-mono mt-0.5">{m.phone}</span>
                        </div>
                        <span className="text-indigo-600 font-bold bg-indigo-50 px-2.5 py-1 rounded-lg text-xs">{m.points} pts</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {customer.name && (
                <div className="mt-2.5 flex items-center gap-2">
                  <span className="text-sm font-bold text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-200 shadow-sm flex items-center gap-1.5 w-full">
                    <Users className="w-4 h-4" />
                    已帶入會員：<span className="text-emerald-900">{customer.name}</span>
                  </span>
                </div>
              )}
            </div>
            <div className="col-span-1 md:col-span-2 pt-2 border-t border-slate-100 flex items-center justify-between">
              <span className="text-sm font-bold text-slate-600">目前累積點數</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-indigo-400 font-medium">pts</span>
                <span className="w-24 text-right px-3 py-1.5 bg-indigo-50/50 border border-indigo-100 text-indigo-700 rounded-lg font-bold text-lg select-all">{customer.currentPoints.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col transition-all hover:shadow-md">
          <div className="px-5 py-4 border-b border-emerald-100 bg-emerald-50/60 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold shadow-sm">2</div>
              <span className="text-base font-bold text-emerald-900">收款明細</span>
            </div>
            <Receipt className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="p-5 grid grid-cols-2 gap-x-6 gap-y-4 flex-1">
            <div className="col-span-2 flex items-center justify-between bg-slate-50 border border-slate-100 px-4 py-3 rounded-xl">
              <span className="text-sm font-bold text-slate-700">實收金額</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">NT$</span>
                <span className="w-32 text-right px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xl text-slate-800 font-bold">{payment.cash + payment.remittance + payment.creditCard}</span>
              </div>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">現金 Cash</label>
              <input type="number" min="0" className="w-full text-right px-3 py-2 bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100 rounded-lg outline-none font-mono text-slate-700" value={payment.cash} onChange={e => setPayment({ ...payment, cash: Number(e.target.value) })} />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">匯款 Transfer</label>
              <input type="number" min="0" className="w-full text-right px-3 py-2 bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100 rounded-lg outline-none font-mono text-slate-700" value={payment.remittance} onChange={e => setPayment({ ...payment, remittance: Number(e.target.value) })} />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">信用卡 Card</label>
              <input type="number" min="0" className="w-full text-right px-3 py-2 bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100 rounded-lg outline-none font-mono text-slate-700" value={payment.creditCard} onChange={e => setPayment({ ...payment, creditCard: Number(e.target.value) })} />
            </div>
          </div>
        </div>
      </div>

      {/* Lottery table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden transition-all hover:shadow-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-amber-200 bg-amber-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold shadow-sm">3</div>
            <span className="text-base font-bold text-amber-900">抽獎與福袋清單</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setActiveTab('library')} className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-white border border-amber-200 hover:bg-amber-100 text-amber-700 rounded-lg font-bold transition-all shadow-sm active:scale-95">
              <BookOpen className="w-3.5 h-3.5" /> 獎項庫挑選
            </button>
            <button onClick={addLotteryRow} className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold transition-all shadow-sm active:scale-95">
              <Plus className="w-3.5 h-3.5" /> 手動新增列
            </button>
          </div>
        </div>
        <div className="overflow-x-auto overflow-y-visible">
          <table className="w-full text-sm min-w-[780px]">
            <thead><tr className="bg-amber-100/50 text-amber-900 border-b border-amber-100 text-[13px]">
              {['單號', '獎項', '抽數', '帶走/點數', '套名', '單抽價', '名稱', '單抽點', '點數', '金額', '備註', ''].map(h => (
                <th key={h} className="px-2 py-3 font-bold text-left whitespace-nowrap">{h}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {lotteries.map((item, idx) => (
                <tr key={idx} className="hover:bg-amber-50/30 transition-colors group">
                  <td className="px-1 py-2"><input type="text" className={inp + ' text-center text-xs !w-12 !min-w-[3rem] !px-1'} placeholder="單號" value={item.id} onChange={e => updateLottery(idx, 'id', e.target.value)} /></td>
                  <td className="px-1 py-2"><input type="text" className={inp + ' text-center text-amber-700 font-bold text-xs !w-12 !min-w-[3rem] !px-1'} placeholder="A/1/Z" value={item.prize} onChange={e => updateLottery(idx, 'prize', e.target.value)} /></td>
                  <td className="px-1 py-2"><input type="number" min="0" className={numInp + ' text-xs font-bold !w-12 !min-w-[3rem] !px-1'} value={item.draws} onChange={e => updateLottery(idx, 'draws', Number(e.target.value))} /></td>
                  <td className="px-1 py-2">
                    <select className={inp + ' text-amber-700 font-bold min-w-[5rem]'} value={item.type} onChange={e => updateLottery(idx, 'type', e.target.value)}>
                      <option>帶走</option><option>點數</option>
                    </select>
                  </td>
                  <td className="px-1 py-2"><input type="text" className={inp + ' font-bold text-slate-800 tracking-wide !text-base min-w-[200px]'} placeholder="大套名稱" value={item.setName} disabled readOnly /></td>
                  <td className="px-1 py-2"><input type="number" min="0" className={numInp + ' text-[11px] text-slate-400 font-mono !w-12 !min-w-[3rem] !px-1'} value={item.unitPrice} disabled readOnly /></td>
                  <td className="px-1 py-2"><input type="text" className={inp + ' font-bold text-slate-800 tracking-wide !text-base min-w-[160px]'} placeholder="獎品名稱" value={item.prizeName} disabled readOnly /></td>
                  <td className="px-1 py-2"><input type="number" min="0" className={numInp + ' text-[11px] text-indigo-300 font-mono !w-10 !min-w-[2.5rem] !px-1'} value={item.unitPoints} disabled readOnly /></td>
                  <td className="px-2 py-2 text-right">
                    <span className={`px-2 py-1 rounded flex w-min ml-auto ${item.totalPoints > 0 ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-400'}`}>{item.totalPoints > 0 ? `+${item.totalPoints}` : '0'}</span>
                  </td>
                  <td className="px-1 py-2">
                    {item.remark === '點數套' ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] text-rose-400 font-bold">扣抵點數</span>
                        <input type="number" min="0" className={numInp + ' font-bold text-rose-600 min-w-[6rem] bg-rose-50 border-rose-200'} placeholder="扣抵點數" value={item.pointsCost || ''} onChange={e => updateLottery(idx, 'pointsCost', Number(e.target.value))} />
                      </div>
                    ) : (
                      <input type="number" min="0" className={numInp + ' font-bold text-amber-700 min-w-[6rem]'} placeholder="金額" value={item.amount} onChange={e => updateLottery(idx, 'amount', Number(e.target.value))} />
                    )}
                  </td>
                  <td className="px-1 py-2"><input type="text" className={inp + ' text-slate-400 text-xs min-w-[7rem]'} placeholder="備註..." value={item.remark} onChange={e => updateLottery(idx, 'remark', e.target.value)} /></td>
                  <td className="px-1 py-2 text-center opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => removeLotteryRow(idx)} className="text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded p-1.5 transition-colors"><Trash2 className="w-4 h-4" /></button></td>
                </tr>
              ))}
              {lotteries.length === 0 && <tr><td colSpan={12} className="text-center py-10 bg-slate-50/50 text-slate-400 text-sm font-medium border-t border-slate-100"><Archive className="w-8 h-8 mx-auto mb-2 opacity-20" />請點擊右上方新增列開始輸入</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Merch table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden transition-all hover:shadow-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-rose-200 bg-rose-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-rose-500 text-white flex items-center justify-center font-bold shadow-sm">4</div>
            <span className="text-base font-bold text-rose-900">直購商品清單</span>
          </div>
          <button onClick={addMerchRow} className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-lg font-bold transition-all shadow-sm active:scale-95">
            <Plus className="w-3.5 h-3.5" /> 手動新增列
          </button>
        </div>
        <div className="overflow-x-auto overflow-y-visible">
          <table className="w-full text-sm min-w-[800px]">
            <thead><tr className="bg-rose-100/50 text-rose-900 border-b border-rose-100 text-[13px]">
              {['貨號', '數量', '付款', '售價', '名稱', '扣點', '點數', '實收', '備註', ''].map(h => (
                <th key={h} className="px-2 py-3 font-bold text-left whitespace-nowrap">{h}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {merchandises.map((item, idx) => (
                <tr key={idx} className="hover:bg-rose-50/30 transition-colors group">
                  <td className="px-1 py-2"><input type="text" className={inp + ' text-xs font-mono text-slate-600 !w-24 !min-w-[5rem] !px-1'} placeholder="輸入貨號" value={item.id} onChange={e => updateMerch(idx, 'id', e.target.value)} /></td>
                  <td className="px-1 py-2"><input type="number" min="0" className={numInp + ' text-xs font-bold !w-12 !min-w-[3rem] !px-1'} value={item.quantity} onChange={e => updateMerch(idx, 'quantity', Number(e.target.value))} /></td>
                  <td className="px-1 py-2">
                    <select className={`${inp} text-xs font-bold !w-16 !min-w-[4rem] !px-1 ${item.paymentType === '現金' ? 'text-rose-700' : item.paymentType === '點數' ? 'text-indigo-700' : 'text-emerald-700'}`} value={item.paymentType} onChange={e => updateMerch(idx, 'paymentType', e.target.value as '現金' | '點數' | '贈送')}>
                      {!item.isGk && <option>現金</option>}
                      <option>點數</option>
                      <option>贈送</option>
                    </select>
                  </td>
                  <td className="px-1 py-2"><input type="number" min="0" className={numInp + ' text-[11px] font-mono text-slate-400 !w-14 !min-w-[3.5rem] !px-1'} placeholder="0" value={item.unitAmount} disabled readOnly /></td>
                  <td className="px-1 py-2"><input type="text" className={inp + ' font-bold text-slate-800 tracking-wide !text-base min-w-[200px]'} placeholder="商品名稱" value={item.name} disabled readOnly /></td>
                  <td className="px-1 py-2"><input type="number" min="0" className={numInp + ' text-[11px] font-mono text-indigo-400 !w-12 !min-w-[3rem] !px-1'} placeholder="0" value={item.suggestedPoints} disabled readOnly /></td>
                  <td className="px-2 py-2 text-right">
                    <span className={`px-2 py-1 rounded flex w-min ml-auto text-xs ${item.paymentType === '點數' && item.totalPoints > 0 ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-400'}`}>{item.paymentType === '點數' && item.totalPoints > 0 ? `-${item.totalPoints}` : '0'}</span>
                  </td>
                  <td className="px-1 py-2">
                    <input type="number" min="0" className={numInp + ' text-sm font-bold text-rose-700 !w-20 !min-w-[5rem] !px-1'} placeholder="0" value={item.actualAmount} onChange={e => updateMerch(idx, 'actualAmount', Number(e.target.value))} />
                  </td>
                  <td className="px-1 py-2"><input type="text" className={inp + ' text-slate-400 text-xs !w-20 !min-w-[5rem] !px-1'} placeholder="備註..." value={item.remark} onChange={e => updateMerch(idx, 'remark', e.target.value)} /></td>
                  <td className="px-1 py-2 text-center opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => removeMerchRow(idx)} className="text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded p-1.5 transition-colors"><Trash2 className="w-4 h-4" /></button></td>
                </tr>
              ))}
              {merchandises.length === 0 && <tr><td colSpan={10} className="text-center py-10 bg-slate-50/50 text-slate-400 text-sm font-medium border-t border-slate-100"><ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-20" />請點擊新增列掛載商品</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Note Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold shadow-sm">5</div>
          <span className="text-base font-bold text-amber-900">結帳單備註 (選填)</span>
        </div>
        <textarea
          className={inp + ' resize-none h-20 bg-slate-50 placeholder:text-slate-400 p-3'}
          placeholder="請輸入這筆訂單的結帳備註，將會寫入銷售紀錄的 U 欄..."
          value={orderNote}
          onChange={e => setOrderNote(e.target.value)}
        />
      </div>

      {/* Sticky footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] z-50">
        <div className="max-w-screen-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex gap-8">
            <div className="flex flex-col">
              <span className="text-xs text-slate-400 font-medium uppercase tracking-wide">點數異動</span>
              <span className={`text-2xl font-bold ${summary.pointsChange >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {summary.pointsChange > 0 ? '+' : ''}{summary.pointsChange}
              </span>
            </div>
            <div className="w-px bg-slate-200" />
            <div className="flex flex-col">
              <span className="text-xs text-slate-400 font-medium uppercase tracking-wide">應收金額</span>
              <span className="text-2xl font-bold text-slate-800">NT$ {summary.dueAmount.toLocaleString()}</span>
            </div>
          </div>
          <div className="flex gap-4">
            <button onClick={handleResetCheckout} className="bg-white border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-500 font-bold px-6 py-3 rounded-xl flex items-center gap-2 transition-all active:scale-95 shadow-sm">
              <Trash2 className="w-5 h-5" /> 全新結帳
            </button>
            <button onClick={handleCheckout} className={`bg-gradient-to-r ${branchGradient[branch]} hover:opacity-90 text-white px-10 py-3 rounded-xl font-bold text-base shadow-lg flex items-center gap-2 transition-all hover:scale-105 active:scale-95`}>
              <ShoppingCart className="w-5 h-5" /> 送出結帳
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
