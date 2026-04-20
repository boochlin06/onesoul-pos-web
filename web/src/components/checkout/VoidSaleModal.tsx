import { AlertCircle, Trash2 } from 'lucide-react';
import type { DailySalesEntry, MemberEntry } from '../../types';

interface VoidSaleModalProps {
  uid: string;
  items: DailySalesEntry[];
  members: MemberEntry[];
  onConfirm: (uid: string) => void;
  onCancel: () => void;
}

export function VoidSaleModal({ uid, items, members, onConfirm, onCancel }: VoidSaleModalProps) {
  const voidFirst = items[0];
  const voidPay = items.find(r => r.receivedAmount || r.cash) || voidFirst;

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
              {voidFirst?.phone && (() => { 
                const m = members.find(mb => String(mb.phone) === String(voidFirst.phone)); 
                return m ? <span className="text-xs font-medium text-indigo-600">{m.name}</span> : null; 
              })()}
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
            <span className="font-bold text-slate-700">{items.length || 0} 項</span>
          </div>
          {(() => {
            const voidEffective = (voidPay?.pointDelta != null && voidPay.pointDelta !== 0)
              ? voidPay.pointDelta
              : (items.reduce((s, r) => s + (Number(r.points) || 0), 0) || 0);
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
          <button onClick={onCancel} className="px-5 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors">
            取消
          </button>
          <button 
            onClick={() => onConfirm(uid)} 
            className="px-5 py-2.5 rounded-xl font-bold text-white bg-rose-500 hover:bg-rose-600 shadow-md shadow-rose-500/20 transition-all flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" /> 確認作廢
          </button>
        </div>
      </div>
    </div>
  );
}
