import { AlertTriangle, X } from 'lucide-react';
import type { EmergencyNotice } from '../../hooks/useEmergencyNotice';

interface Props {
  notice: EmergencyNotice;
  isAdmin: boolean;
  onDismiss: () => void;
  onClear: () => void;
}

export function EmergencyNoticeModal({ notice, isAdmin, onDismiss, onClear }: Props) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-lg mx-4 bg-gradient-to-br from-red-600 to-rose-700 rounded-3xl shadow-2xl shadow-red-500/30 p-8 animate-pulse-slow">
        {/* 關閉按鈕 */}
        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center animate-bounce">
            <AlertTriangle className="w-9 h-9 text-yellow-300" />
          </div>
        </div>

        {/* 標題 */}
        <h2 className="text-center text-2xl font-black text-white mb-4 tracking-wide">
          ⚠️ 緊急通知
        </h2>

        {/* 內容 */}
        <div className="bg-white/15 rounded-2xl px-6 py-4 mb-4">
          <p className="text-white text-lg font-bold leading-relaxed whitespace-pre-wrap break-words">
            {notice.message}
          </p>
        </div>

        {/* 發送資訊 */}
        <p className="text-center text-white/60 text-xs mb-6">
          {notice.sender && <span>發送者：{notice.sender} · </span>}
          {notice.timestamp}
        </p>

        {/* 按鈕 */}
        <div className="flex justify-center gap-3">
          <button
            onClick={onDismiss}
            className="px-8 py-3 bg-white text-red-700 font-bold rounded-xl shadow-lg hover:bg-red-50 transition-all active:scale-95"
          >
            我知道了
          </button>
          {isAdmin && (
            <button
              onClick={onClear}
              className="px-6 py-3 bg-white/20 text-white font-bold rounded-xl border border-white/30 hover:bg-white/30 transition-all active:scale-95"
            >
              撤回通知
            </button>
          )}
        </div>
      </div>

      {/* 自訂 animation */}
      <style>{`
        @keyframes pulse-slow {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.01); }
        }
        .animate-pulse-slow { animation: pulse-slow 3s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
