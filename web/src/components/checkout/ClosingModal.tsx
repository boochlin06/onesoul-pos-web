import { useState, useMemo } from 'react';
import { Archive, X, Check } from 'lucide-react';
import type { Branch, DailySalesEntry, MemberEntry } from '../../types';

interface ClosingModalProps {
  branch: Branch;
  dailySales: DailySalesEntry[];
  members: MemberEntry[];
  openingCash: number | null;
  onClose: () => void;
  onConfirm: (data: {
    actualCash: number;
    actualCreditCard: number;
    actualRemittance: number;
    note: string;
    checkedGks: Set<number>;
  }) => void;
}

export function ClosingModal({
  branch, dailySales, members, openingCash, onClose, onConfirm,
}: ClosingModalProps) {
  const [actualCashInput, setActualCashInput] = useState('');
  const [actualCreditCardInput, setActualCreditCardInput] = useState('');
  const [actualRemittanceInput, setActualRemittanceInput] = useState('');
  const [closeNote, setCloseNote] = useState('');
  const [checkedGks, setCheckedGks] = useState<Set<number>>(new Set());

  const toggleGk = (index: number) => {
    setCheckedGks(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const getExpectedCash = () => (openingCash || 0) + dailySales.reduce((sum, r) => sum + r.cash, 0);
  const getExpectedCreditCard = () => dailySales.reduce((sum, r) => sum + r.creditCard, 0);
  const getExpectedRemittance = () => dailySales.reduce((sum, r) => sum + r.remittance, 0);

  const gkTakenList = useMemo(() => dailySales.filter(r => {
    const iStr = (r.prizeName || '').toLowerCase();
    const isExcluded = iStr.includes('非gk') || iStr.includes('盲盒');
    return r.type === '帶走' && !!r.prizeId && !isExcluded;
  }), [dailySales]);

  const gkPointsList = useMemo(() => dailySales.filter(r => {
    const iStr = (r.prizeName || '').toLowerCase();
    const isExcluded = iStr.includes('非gk') || iStr.includes('盲盒');
    return r.type === '點數' && !!r.prizeId && !isExcluded;
  }), [dailySales]);

  const merchGkPointsList = useMemo(() => dailySales.filter(r => {
    if (r.lotteryId) return false;
    const cStr = String(r.prize || '').trim();
    const cNum = Number(cStr);
    if (cStr === '' || isNaN(cNum) || cNum >= 100000) return false;
    if (cStr === '88888' || cStr === '99999') return false;
    return true;
  }), [dailySales]);

  const resolveCustomerName = (item: DailySalesEntry) => {
    const phoneRaw = String(item.phone || '').trim();
    const cleanP = phoneRaw.replace(/^0+/, '');
    const m = members.find(m => String(m.phone || '').trim().replace(/^0+/, '') === cleanP);
    return m ? m.name : (phoneRaw || '散客');
  };

  const requiredGks = useMemo(() => {
    return Array.from(new Set(
      [...gkTakenList, ...gkPointsList, ...merchGkPointsList].map(r => dailySales.indexOf(r))
    ));
  }, [gkTakenList, gkPointsList, merchGkPointsList, dailySales]);

  const diffCash = actualCashInput !== '' ? Number(actualCashInput) - getExpectedCash() : null;
  const diffCreditCard = actualCreditCardInput !== '' ? Number(actualCreditCardInput) - getExpectedCreditCard() : null;
  const diffRemittance = actualRemittanceInput !== '' ? Number(actualRemittanceInput) - getExpectedRemittance() : null;
  const allFilled = actualCashInput !== '' && actualCreditCardInput !== '' && actualRemittanceInput !== '';
  const allZeroDiff = diffCash === 0 && diffCreditCard === 0 && diffRemittance === 0;
  const allChecked = requiredGks.length === 0 || requiredGks.every(idx => checkedGks.has(idx));
  const canSubmit = allFilled && allZeroDiff && allChecked;

  const handleClose = () => { onClose(); };
  const handleSubmit = () => {
    onConfirm({
      actualCash: Number(actualCashInput),
      actualCreditCard: Number(actualCreditCardInput),
      actualRemittance: Number(actualRemittanceInput),
      note: closeNote,
      checkedGks,
    });
  };

  const renderGkChecklist = (
    title: string,
    list: DailySalesEntry[],
    renderExtra?: (item: DailySalesEntry) => React.ReactNode,
  ) => (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-bold text-slate-700">{title}</span>
      {list.length > 0 ? (
        <div className="ml-2 pl-4 border-l-2 border-indigo-100 flex flex-col gap-1.5">
          {list.map((item) => {
            const idx = dailySales.indexOf(item);
            const customerName = resolveCustomerName(item);
            return (
              <label key={idx} className={`cursor-pointer text-xs p-2 rounded-lg border shadow-sm flex flex-col xl:flex-row xl:items-center gap-2 transition-all ${checkedGks.has(idx) ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-100 text-slate-600 hover:bg-slate-50'}`}>
                <div className="flex items-center gap-2">
                  <div className="relative flex items-center">
                    <input type="checkbox" className="peer w-4 h-4 appearance-none border-2 border-slate-300 rounded focus:ring-2 focus:ring-indigo-500/20 checked:bg-indigo-600 checked:border-indigo-600 transition-all cursor-pointer" checked={checkedGks.has(idx)} onChange={() => toggleGk(idx)} />
                    <Check className="w-3 h-3 text-white absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" />
                  </div>
                  <span className="font-bold text-slate-600 px-2 py-0.5 bg-slate-100 rounded flex-shrink-0">{customerName}</span>
                </div>
                <span className="font-bold flex-1 truncate">{item.setName || item.prizeName || item.name} <span className="text-slate-400 font-normal ml-1">({item.prize || ''}) {item.draws > 1 ? `x${item.draws}` : ''}</span></span>
                {renderExtra?.(item)}
              </label>
            );
          })}
        </div>
      ) : (
        <div className="ml-2 text-xs text-slate-400 italic">今日無此類紀錄</div>
      )}
    </div>
  );

  const renderCounterSection = (
    label: string,
    expected: number,
    inputValue: string,
    onChange: (v: string) => void,
    showOpeningCash = false,
    autoFocus = false,
  ) => {
    const diff = inputValue !== '' ? Number(inputValue) - expected : null;
    return (
      <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex flex-col gap-3">
        {showOpeningCash && (
          <>
            <div className="flex justify-between items-center text-slate-500 text-sm">
              <span className="font-bold tracking-widest uppercase">今日開櫃金</span>
              <span className="font-bold text-slate-700">NT$ {(openingCash || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-slate-500 text-sm">
              <span className="font-bold tracking-widest uppercase">現金營收</span>
              <span className="font-bold text-emerald-600">+ NT$ {(expected - (openingCash || 0)).toLocaleString()}</span>
            </div>
          </>
        )}
        <div className={`flex justify-between items-center ${showOpeningCash ? 'pt-2 border-t border-slate-200/60' : ''}`}>
          <span className="font-black text-slate-800 tracking-wider">{label}應收總計</span>
          <span className="font-black text-xl text-indigo-600 tracking-tight">NT$ {expected.toLocaleString()}</span>
        </div>
        <div className="flex flex-col gap-2 mt-1">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">實際盤點 {label}</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">NT$</span>
            <input type="number" min="0" className="w-full pl-12 pr-4 py-2.5 bg-white border border-slate-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 rounded-xl outline-none font-black text-lg text-slate-800 transition-all shadow-sm" placeholder="0" value={inputValue} onChange={e => onChange(e.target.value)} autoFocus={autoFocus} />
          </div>
        </div>
        {diff !== null && (
          <div className={`p-3 rounded-xl flex items-center justify-between border ${diff === 0 ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-rose-50 border-rose-100 text-rose-700'}`}>
            <span className="font-bold tracking-widest uppercase text-xs">盤差</span>
            <span className="font-black text-sm">{(diff > 0 ? '+' : '')}{diff.toLocaleString()}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col border border-white/20">
        <div className="px-6 py-5 bg-gradient-to-r from-indigo-50 to-white border-b border-indigo-100/50 flex items-center justify-between">
          <h3 className="text-lg font-bold text-indigo-950 flex items-center gap-3 tracking-tight">
            <div className="w-8 h-8 rounded-xl bg-indigo-500 text-white flex items-center justify-center shadow-md shadow-indigo-500/20"><Archive className="w-4 h-4" /></div>
            門市關帳結算 ({branch})
          </h3>
          <button onClick={handleClose} className="text-slate-400 hover:text-rose-500 transition-colors bg-slate-50 hover:bg-rose-50 p-2 rounded-full"><X className="w-4 h-4"/></button>
        </div>

        <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 overflow-y-auto max-h-[75vh]">
          {/* Left: Counters */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            <div className="flex items-center justify-between mb-[-12px] px-2">
              <h3 className="font-bold text-slate-800 tracking-wider">現金、信用卡、匯款盤點</h3>
            </div>
            {renderCounterSection('現金', getExpectedCash(), actualCashInput, setActualCashInput, true, true)}
            {renderCounterSection('信用卡', getExpectedCreditCard(), actualCreditCardInput, setActualCreditCardInput)}
            {renderCounterSection('匯款', getExpectedRemittance(), actualRemittanceInput, setActualRemittanceInput)}
            <div className="flex flex-col gap-2 mt-2">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">備註說明 (選填)</label>
              <textarea className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 rounded-2xl outline-none text-sm text-slate-700 transition-all resize-none h-24 placeholder:text-slate-300" placeholder="若有其他事項請備註..." value={closeNote} onChange={e => setCloseNote(e.target.value)} />
            </div>
          </div>

          {/* Right: GK Checklists */}
          <div className="lg:col-span-7 flex flex-col h-full">
            <div className="bg-indigo-50/50 rounded-2xl p-5 border border-indigo-100 flex flex-col gap-4 shadow-sm h-full">
              <span className="text-[13px] font-black text-indigo-500 uppercase tracking-widest border-b border-indigo-100/50 pb-3">店員關帳確認清單 (必選) - 當日庫存與獎項核查</span>
              {renderGkChecklist('福袋抽中獎項 👉 要帶走的款式', gkTakenList)}
              {renderGkChecklist('福袋抽中獎項 👉 換成點數的款式', gkPointsList, (item) => (
                <span className="text-indigo-500 font-bold ml-1 flex-shrink-0">返 {Math.abs(item.points)} 點</span>
              ))}
              {renderGkChecklist('點數直購區 👉 客戶用點數兌換的商品', merchGkPointsList, (item) => (
                <span className="text-rose-500 font-bold ml-auto flex-shrink-0">扣 {Math.abs(item.points)} 點</span>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col gap-3">
          {canSubmit && (
            <div className="bg-emerald-100 text-emerald-800 text-sm font-bold px-4 py-3 rounded-xl flex items-center justify-center gap-2 shadow-sm border border-emerald-200">
              <Check className="w-5 h-5" /> 所有盤點與確認清單皆已完成，可執行關帳
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <button onClick={handleClose} className="px-4 py-3 rounded-xl font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-200 transition-colors">取消</button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={`px-4 py-3 rounded-xl font-bold text-white transition-all ${canSubmit ? 'bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-500/30 active:scale-95' : 'bg-slate-300 cursor-not-allowed shadow-none'}`}
            >
              確認送出關帳
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
