import { Loader2, AlertCircle, X } from 'lucide-react';
import type { BannerState } from '../../types';

interface StatusBannerProps extends BannerState {
  onClose?: () => void;
}

export function StatusBanner({ msg, type, onClose }: StatusBannerProps) {
  if (type === 'loading') {
    return (
      <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-[100] flex flex-col items-center justify-center animate-in fade-in duration-200">
        <div className="bg-white/95 px-10 py-8 rounded-3xl shadow-2xl flex flex-col items-center gap-5 border border-white/50 transform transition-all saturate-150">
          <div className="relative">
            <div className="absolute inset-0 bg-indigo-500 blur-xl opacity-20 rounded-full animate-pulse"></div>
            <Loader2 className="w-14 h-14 animate-spin text-indigo-600 relative z-10" />
          </div>
          <span className="font-black text-indigo-950 text-xl tracking-wider">{msg}</span>
          <span className="text-sm font-medium text-slate-500">請稍候，不要關閉頁面</span>
        </div>
      </div>
    );
  }

  if (type === 'err') {
    return (
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex flex-col items-center justify-center animate-in fade-in duration-200">
        <div className="bg-white px-8 py-6 rounded-3xl shadow-2xl flex flex-col items-center gap-4 border-2 border-rose-500 transform transition-all max-w-lg mx-auto relative">
          {onClose && <button onClick={onClose} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"><X className="w-6 h-6"/></button>}
          <AlertCircle className="w-16 h-16 text-rose-500 mt-2" />
          <span className="font-black text-rose-600 text-xl text-center whitespace-pre-wrap leading-relaxed">{msg}</span>
        </div>
      </div>
    );
  }

  const cls = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  return <div className={`fixed top-4 right-4 z-[100] px-5 py-3 rounded-xl border text-sm font-bold shadow-lg animate-in fade-in slide-in-from-top-4 ${cls}`}>{msg}</div>;
}
