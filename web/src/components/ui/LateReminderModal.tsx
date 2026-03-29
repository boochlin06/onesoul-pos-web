import { AlertTriangle } from 'lucide-react';
import { CLOCK_IN_CONFIG } from '../../config';

interface LateReminderModalProps {
  branch: string;
  lateMinutes: number;
  reminderCount: number;
  isClockingIn: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}

export function LateReminderModal({
  branch, lateMinutes, reminderCount, isClockingIn, onConfirm, onDismiss,
}: LateReminderModalProps) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden">
        {/* Header — red warning */}
        <div className="bg-gradient-to-r from-red-500 to-rose-600 px-6 py-5 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-white/20 rounded-full mb-3">
            <AlertTriangle className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-white text-lg font-bold">遲到提醒</h2>
        </div>

        {/* Body */}
        <div className="px-6 py-6 text-center space-y-4">
          <p className="text-slate-700">
            <span className="font-bold text-lg">{branch}門市</span>
          </p>
          <div className="bg-red-50 rounded-xl px-4 py-3">
            <p className="text-red-600 font-bold text-3xl">{lateMinutes} 分鐘</p>
            <p className="text-red-500 text-sm mt-1">已超過上班時間</p>
          </div>
          <p className="text-xs text-slate-400">
            第 {reminderCount}/{CLOCK_IN_CONFIG.maxReminders} 次提醒
          </p>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 space-y-2">
          <button
            onClick={onConfirm}
            disabled={isClockingIn}
            className={`w-full py-3 rounded-xl text-white font-bold transition-all ${
              isClockingIn
                ? 'bg-slate-300 cursor-not-allowed'
                : 'bg-red-500 hover:bg-red-600 active:scale-[0.98]'
            }`}
          >
            {isClockingIn ? '打卡中...' : '✅ 確認上班'}
          </button>
          <button
            onClick={onDismiss}
            className="w-full py-2.5 rounded-xl text-slate-500 hover:bg-slate-100 text-sm font-medium transition-all"
          >
            我知道了（稍後再打卡）
          </button>
        </div>
      </div>
    </div>
  );
}
