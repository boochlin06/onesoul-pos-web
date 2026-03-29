import { useEffect, useState } from 'react';
import { Clock, MapPin, User } from 'lucide-react';
import type { BranchConfig } from '../../hooks/useClockIn';

interface ClockInModalProps {
  branch: string;
  staff: string;
  email: string;
  branchConfig: BranchConfig;
  isClockingIn: boolean;
  onConfirm: () => void;
}

export function ClockInModal({
  branch, staff, email, branchConfig, isClockingIn, onConfirm,
}: ClockInModalProps) {
  const [now, setNow] = useState(new Date());

  // 即時更新時間
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const nowStr = now.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

  // 計算提早/遲到
  const [startH, startM] = branchConfig.startTime.split(':').map(Number);
  const startTotalMin = startH * 60 + startM;
  const nowTotalMin = now.getHours() * 60 + now.getMinutes();
  const diffMin = nowTotalMin - startTotalMin;

  let statusText = '';
  let statusColor = '';
  if (diffMin < 0) {
    statusText = `提早 ${Math.abs(diffMin)} 分鐘 👍`;
    statusColor = 'text-emerald-600';
  } else if (diffMin > 0) {
    statusText = `已遲到 ${diffMin} 分鐘`;
    statusColor = 'text-red-500';
  } else {
    statusText = '準時 ✅';
    statusColor = 'text-emerald-600';
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className={`px-6 py-5 text-center ${
          branch === '竹北'
            ? 'bg-gradient-to-r from-emerald-500 to-teal-600'
            : 'bg-gradient-to-r from-violet-500 to-indigo-600'
        }`}>
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-full mb-3">
            <Clock className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-white text-xl font-bold">上班打卡</h2>
        </div>

        {/* Body */}
        <div className="px-6 py-6 space-y-4">
          <div className="flex items-center gap-3 text-slate-600">
            <MapPin className="w-5 h-5 text-slate-400 shrink-0" />
            <span className="font-medium">{branch}門市</span>
          </div>
          <div className="flex items-center gap-3 text-slate-600">
            <User className="w-5 h-5 text-slate-400 shrink-0" />
            <span className="text-sm">{staff && <span className="font-medium mr-2">今日值班：{staff}</span>}{email}</span>
          </div>

          {/* 時間顯示 */}
          <div className="bg-slate-50 rounded-xl p-4 text-center">
            <p className="text-xs text-slate-400 mb-1">預定上班時間</p>
            <p className="text-2xl font-bold text-slate-700">{branchConfig.startTime}</p>
          </div>

          <div className="text-center">
            <p className="text-xs text-slate-400 mb-1">目前時間</p>
            <p className="text-4xl font-mono font-bold text-slate-800 tracking-wider">{nowStr}</p>
            <p className={`text-sm mt-2 font-medium ${statusColor}`}>{statusText}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          <button
            onClick={onConfirm}
            disabled={isClockingIn}
            className={`w-full py-3.5 rounded-xl text-white font-bold text-lg transition-all ${
              isClockingIn
                ? 'bg-slate-300 cursor-not-allowed'
                : branch === '竹北'
                  ? 'bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98]'
                  : 'bg-violet-500 hover:bg-violet-600 active:scale-[0.98]'
            }`}
          >
            {isClockingIn ? '打卡中...' : '✅ 確認上班'}
          </button>
          <p className="text-xs text-center text-slate-400 mt-3">
            提早打卡也可以，時間會如實記錄
          </p>
        </div>
      </div>
    </div>
  );
}
