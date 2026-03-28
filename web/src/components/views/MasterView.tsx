import { useState } from 'react';
import { Crown, Send, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import type { EmergencyNotice } from '../../hooks/useEmergencyNotice';

interface MasterViewProps {
  notice: EmergencyNotice | null;
  isSending: boolean;
  onSend: (message: string) => Promise<boolean>;
  onClear: () => Promise<boolean>;
}

export function MasterView({ notice, isSending, onSend, onClear }: MasterViewProps) {
  const [message, setMessage] = useState('');
  const [feedback, setFeedback] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

  const handleSend = async () => {
    if (!message.trim()) return;
    if (!confirm('確認發送緊急通知？所有正在使用 POS 的視窗都會收到此通知。')) return;
    const ok = await onSend(message.trim());
    if (ok) {
      setMessage('');
      setFeedback({ msg: '✓ 緊急通知已發佈', type: 'ok' });
    } else {
      setFeedback({ msg: '✗ 發送失敗', type: 'err' });
    }
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleClear = async () => {
    if (!confirm('確認撤回緊急通知？所有視窗的通知彈窗將消失。')) return;
    const ok = await onClear();
    if (ok) {
      setFeedback({ msg: '✓ 通知已撤回', type: 'ok' });
    } else {
      setFeedback({ msg: '✗ 撤回失敗', type: 'err' });
    }
    setTimeout(() => setFeedback(null), 3000);
  };

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <Crown className="w-6 h-6 text-amber-500" />
          <h2 className="text-xl font-bold text-slate-800">大師專用</h2>
        </div>
        <p className="text-sm text-slate-500 mt-1">管理員工具 — 發送緊急通知給所有 POS 視窗</p>
      </div>

      {/* 當前狀態 */}
      <div className={`rounded-2xl p-6 border ${notice ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
        <div className="flex items-center gap-3 mb-2">
          <AlertTriangle className={`w-5 h-5 ${notice ? 'text-red-500' : 'text-emerald-500'}`} />
          <h3 className="font-bold text-slate-700">通知狀態</h3>
        </div>
        {notice ? (
          <div>
            <p className="text-red-700 font-bold text-lg mb-2">🔴 有效通知中</p>
            <div className="bg-white rounded-xl p-4 border border-red-100 mb-3">
              <p className="text-slate-800 font-semibold whitespace-pre-wrap">{notice.message}</p>
              <p className="text-slate-400 text-xs mt-2">
                {notice.sender && <span>發送者：{notice.sender} · </span>}
                {notice.timestamp}
              </p>
            </div>
            <button
              onClick={handleClear}
              disabled={isSending}
              className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all active:scale-95 disabled:opacity-50"
            >
              {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              撤回通知
            </button>
          </div>
        ) : (
          <p className="text-emerald-700 font-bold">🟢 目前沒有通知</p>
        )}
      </div>

      {/* 發送區 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h3 className="font-bold text-slate-700 mb-3">發送新通知</h3>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="輸入緊急通知內容…"
          rows={4}
          className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400 transition-all"
          maxLength={500}
        />
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-slate-400">{message.length}/500</span>
          <button
            onClick={handleSend}
            disabled={isSending || !message.trim()}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white font-bold rounded-xl shadow-lg shadow-red-500/25 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            發送緊急通知
          </button>
        </div>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`text-center py-2 px-4 rounded-xl font-bold text-sm ${feedback.type === 'ok' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
          {feedback.msg}
        </div>
      )}
    </div>
  );
}
