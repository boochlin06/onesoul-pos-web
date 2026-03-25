import { AlertCircle, Trash2, Loader2 } from 'lucide-react';
import type { PrizeEntry } from '../../types';

interface VoidPrizeModalProps {
  entries: PrizeEntry[];
  isLoading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function VoidPrizeModal({ entries, isLoading, onConfirm, onCancel }: VoidPrizeModalProps) {
  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col transform transition-all border border-slate-100 p-6 m-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-5 h-5 text-rose-600" />
          </div>
          <h3 className="text-xl font-bold text-slate-800">確定作廢整套福袋？</h3>
        </div>
        <p className="text-slate-500 text-sm mt-3 mb-6 ml-13 leading-relaxed">
          確定要作廢「<strong className="text-slate-700">{entries[0]?.setName}</strong>」包含的所有 <strong className="text-rose-500">{entries.length}</strong> 個剩餘獎項嗎？<br/><br/>
          ⚠️ 作廢後，這 {entries.length} 筆獎項紀錄將從資料庫永遠刪除，且<strong className="text-rose-500">無法復原</strong>！
        </p>
        <div className="flex gap-3 justify-end mt-2">
          <button onClick={onCancel} disabled={isLoading} className="px-5 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50">
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="px-5 py-2.5 rounded-xl font-bold text-white bg-rose-500 hover:bg-rose-600 shadow-md shadow-rose-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            確認作廢
          </button>
        </div>
      </div>
    </div>
  );
}
