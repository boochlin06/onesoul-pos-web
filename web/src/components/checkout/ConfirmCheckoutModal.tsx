import { useState, useEffect } from 'react';
import { ShoppingCart, CheckCircle, PackageSearch, X, Gift, AlertTriangle } from 'lucide-react';
import type { LotteryItem, MerchItem } from '../../types';

interface ConfirmCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  lotteries: LotteryItem[];
  merchandises: MerchItem[];
  summary: { dueAmount: number; pointsChange: number };
  payment: { cash: number; remittance: number; creditCard: number };
}

export function ConfirmCheckoutModal({
  isOpen, onClose, onConfirm, lotteries, merchandises, summary, payment
}: ConfirmCheckoutModalProps) {
  const [isBigPrizeConfirmed, setIsBigPrizeConfirmed] = useState(false);

  // 當 isOpen 改變時重置勾選狀態
  useEffect(() => {
    if (isOpen) setIsBigPrizeConfirmed(false);
  }, [isOpen]);

  if (!isOpen) return null;

  // 結算統計資料
  let totalTakeawayCount = 0;
  let totalPointsCount = 0;
  let totalGiftCount = 0;

  // 定義大獎規則：除了 X 與 Z 之外，其他有輸入的獎項代碼皆為大獎
  const isBigPrize = (prizeCode: string) => {
    const code = prizeCode.trim().toLowerCase();
    if (!code) return false;
    return code !== 'x' && code !== 'z';
  };
  
  const bigPrizePointsItems: LotteryItem[] = [];
  const smallPrizeTakeawayItems: LotteryItem[] = [];

  // 計算福袋/抽獎
  lotteries.forEach(item => {
    if (!item.id && !item.prize && !item.setName) return; // 略過空白列
    
    // 檢查大獎與小獎情況
    const big = isBigPrize(item.prize?.trim() || '');
    
    if (item.type === '帶走') {
      totalTakeawayCount += item.draws || 1;
      if (!big && item.prize?.trim()) { // 非大獎但選帶走
        smallPrizeTakeawayItems.push(item);
      }
    } else if (item.type === '點數') {
      totalPointsCount += item.draws || 1;
      if (big) {
        bigPrizePointsItems.push(item);
      }
    }
  });

  // 計算直購商品
  merchandises.forEach(item => {
    if (!item.id && !item.name) return; // 略過空白列
    if (item.paymentType === '贈送') {
      totalGiftCount += item.quantity || 1;
    } else if (item.paymentType === '點數') {
      totalPointsCount += item.quantity || 1;
    } else {
      // 現金等視為帶走
      totalTakeawayCount += item.quantity || 1;
    }
  });
  // 計算各套抽數總結
  const setDrawsSummary = lotteries.reduce((acc, item) => {
    if (item.id?.trim() || item.prize?.trim()) { // 確保該列有資料
      if (item.remark !== '點數套') { // 排除點數套，點數套是直購不是抽
        const key = item.setName?.trim() || '未命名商品';
        acc[key] = (acc[key] || 0) + (item.draws || 1);
      }
    }
    return acc;
  }, {} as Record<string, number>);

  const hasDraws = Object.keys(setDrawsSummary).length > 0;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex justify-center items-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-800">結帳內容最終確認</h3>
              <p className="text-sm text-slate-500">請確認商品發放方式後再送出訂單</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* 套組抽數總結 */}
          {hasDraws && (
            <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 animate-in slide-in-from-top-2">
              <p className="text-xs text-amber-600 font-bold tracking-wider mb-2 flex items-center gap-1.5">
                <PackageSearch className="w-4 h-4" /> 本次抽賞清單
              </p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(setDrawsSummary).map(([setName, draws]) => (
                  <div key={setName} className="px-3 py-1.5 bg-white border border-amber-200 text-amber-900 text-sm font-bold rounded-lg shadow-sm flex items-center gap-2">
                    <span>{setName}</span>
                    <span className="text-amber-500 bg-amber-50 px-2 py-0.5 rounded text-xs">共 {draws} 抽</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Level Summary */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <p className="text-xs text-slate-400 font-bold tracking-wider mb-1">應收總金額</p>
              <p className="text-3xl font-black text-slate-800">NT$ {summary.dueAmount.toLocaleString()}</p>
              <div className="mt-2 text-xs flex gap-2 font-medium">
                {payment.cash > 0 && <span className="text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded">現 ${payment.cash}</span>}
                {payment.remittance > 0 && <span className="text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded">匯 ${payment.remittance}</span>}
                {payment.creditCard > 0 && <span className="text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded">刷 ${payment.creditCard}</span>}
              </div>
            </div>
            <div className={`p-4 rounded-xl border ${summary.pointsChange >= 0 ? 'bg-indigo-50 border-indigo-100' : 'bg-rose-50 border-rose-100'}`}>
              <p className="text-xs font-bold tracking-wider mb-1 opacity-60">點數異動總計</p>
              <p className={`text-3xl font-black ${summary.pointsChange >= 0 ? 'text-indigo-700' : 'text-rose-700'}`}>
                {summary.pointsChange > 0 ? '+' : ''}{summary.pointsChange.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Item Allocation Breakdown */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider pl-1">商品發放統計</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="flex flex-col p-4 bg-emerald-50 border border-emerald-100 rounded-xl relative overflow-hidden group">
                <div className="absolute -right-3 -bottom-3 opacity-[0.05] group-hover:opacity-10 transition-opacity">
                  <PackageSearch className="w-16 h-16" />
                </div>
                <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-1">🛍️ 實體帶走</span>
                <div className="flex items-end gap-1.5 focus:outline-none">
                  <span className="text-2xl font-black text-emerald-900 leading-none">{totalTakeawayCount}</span>
                  <span className="text-sm font-bold text-emerald-700 mb-0.5">項</span>
                </div>
              </div>

              <div className="flex flex-col p-4 border border-indigo-100 rounded-xl relative overflow-hidden group bg-indigo-50">
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-1">✨ 換點數量</span>
                <div className="flex items-end gap-1.5 focus:outline-none">
                  <span className="text-2xl font-black text-indigo-900 leading-none">{totalPointsCount}</span>
                  <span className="text-sm font-bold text-indigo-700 mb-0.5">項</span>
                </div>
              </div>

              <div className="flex flex-col p-4 bg-rose-50 border border-rose-100 rounded-xl relative overflow-hidden group">
                <div className="absolute -right-3 -bottom-3 opacity-[0.05] group-hover:opacity-10 transition-opacity">
                  <Gift className="w-16 h-16" />
                </div>
                <span className="text-xs font-bold text-rose-600 uppercase tracking-widest mb-1">🎁 直接贈送</span>
                <div className="flex items-end gap-1.5 focus:outline-none">
                  <span className="text-2xl font-black text-rose-900 leading-none">{totalGiftCount}</span>
                  <span className="text-sm font-bold text-rose-700 mb-0.5">項</span>
                </div>
              </div>
            </div>
            
            {/* 警告紅字 */}
            {(totalPointsCount > 0 && summary.pointsChange === 0) && (
              <p className="text-xs text-rose-500 font-bold pl-2 bg-rose-50 p-2 rounded flex items-center gap-2">⚠️ 注意：有設定換點數的項目，但總點數異動為 0</p>
            )}
            {(totalTakeawayCount === 0 && totalPointsCount === 0 && totalGiftCount === 0) && (
              <p className="text-xs text-rose-500 font-bold pl-2 bg-rose-50 p-2 rounded flex items-center gap-2">⚠️ 警告：目前沒有任何實質商品，請確認是否為純給點/扣點操作</p>
            )}

            {/* 新增功能：小獎帶走警示 / 大獎換點警示 */}
            {smallPrizeTakeawayItems.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex gap-3 text-amber-800 animate-in slide-in-from-top-1">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-sm w-full">
                  <p className="font-bold">小獎帶走確認</p>
                  <p className="text-xs mt-0.5 opacity-90 mb-1">有 {smallPrizeTakeawayItems.reduce((acc, item) => acc + (item.draws || 1), 0)} 項非大獎商品被設定為「實體帶走」，請確認現場確實要交付以下小獎商品：</p>
                  <ul className="list-disc pl-4 text-xs font-bold text-amber-700 space-y-0.5 mt-1 mix-blend-multiply">
                    {smallPrizeTakeawayItems.map((sp, idx) => (
                      <li key={idx}>{sp.setName || '無套名'} - {sp.prize}賞 ({sp.prizeName || '無獎項名'}) {sp.draws > 1 ? `x${sp.draws}` : ''}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            {bigPrizePointsItems.length > 0 && (
              <div className="bg-rose-50 border-2 border-rose-300 p-3 rounded-xl flex gap-3 text-rose-900 shadow-sm animate-in slide-in-from-top-1">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="text-sm w-full">
                  <p className="font-black text-rose-700 uppercase tracking-widest text-xs mb-1">!!! 大獎換點再三確認 !!!</p>
                  <p className="font-bold mb-1">下方大獎被設定為「點數」，客人將不會帶走實體商品：</p>
                  <ul className="list-disc pl-4 text-xs font-bold text-rose-600 space-y-0.5 mb-3">
                    {bigPrizePointsItems.map((bp, idx) => (
                      <li key={idx}>{bp.setName || '無套名'} - {bp.prize}賞 ({bp.prizeName || '無獎項名'})</li>
                    ))}
                  </ul>
                  <label className="flex items-start gap-2 bg-white/60 p-2 rounded cursor-pointer border border-rose-200 hover:bg-white transition-colors">
                    <input 
                      type="checkbox" 
                      className="mt-0.5 w-4 h-4 text-rose-600 rounded border-rose-300 focus:ring-rose-500"
                      checked={isBigPrizeConfirmed}
                      onChange={e => setIsBigPrizeConfirmed(e.target.checked)}
                    />
                    <span className="font-bold text-rose-700">我已再三確認以上大獎「換為虛擬點數」，且不須交付實體商品。</span>
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-5 bg-slate-50 border-t border-slate-100 flex justify-end gap-4">
          <button
            onClick={onClose}
            className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-200 bg-slate-100 rounded-xl transition-all"
          >
            取消返回
          </button>
          <button
            onClick={onConfirm}
            disabled={bigPrizePointsItems.length > 0 && !isBigPrizeConfirmed}
            className="flex items-center gap-2 px-8 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:text-slate-500 disabled:scale-100 disabled:shadow-none text-white rounded-xl font-bold shadow-lg shadow-emerald-600/30 transition-all hover:scale-[1.02] active:scale-95"
          >
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            {bigPrizePointsItems.length > 0 && !isBigPrizeConfirmed ? '大獎換點需打勾確認' : '確認無誤，送出訂單'}
          </button>
        </div>
      </div>
    </div>
  );
}
