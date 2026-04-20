import { useState, useEffect } from 'react';
import { Crown, Send, Trash2, AlertTriangle, Loader2, MessageSquare, BarChart3 } from 'lucide-react';
import type { EmergencyNotice } from '../../hooks/useEmergencyNotice';
import { apiGetLineChannels, apiSendLineMessage, apiGetQuotaUsage } from '../../services/api';

interface MasterViewProps {
  notice: EmergencyNotice | null;
  isSending: boolean;
  onSend: (message: string) => Promise<boolean>;
  onClear: () => Promise<boolean>;
}

export function MasterView({ notice, isSending, onSend, onClear }: MasterViewProps) {
  const [message, setMessage] = useState('');
  const [feedback, setFeedback] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

  // LINE Message state
  const [lineChannels, setLineChannels] = useState<{ value: string; label: string }[]>([]);
  const [lineChannel, setLineChannel] = useState('');
  const [lineMessage, setLineMessage] = useState('');
  const [lineSending, setLineSending] = useState(false);
  const [lineFeedback, setLineFeedback] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

interface QuotaInfo {
  gasApiToday: number;
  gasApiMonth: number;
  urlFetchToday: number;
  urlFetchLimit: number;
  linePushMonth: number;
  linePushLimit: number;
}

  const [quota, setQuota] = useState<QuotaInfo | null>(null);

  useEffect(() => {
    apiGetLineChannels().then(res => {
      if (res.success && res.data) {
        setLineChannels(res.data);
        if (res.data.length > 0) setLineChannel(res.data[0].value);
      }
    });
    apiGetQuotaUsage().then(res => {
      if (res.success && res.data) setQuota(res.data);
    });
  }, []);

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

  const handleLineSend = async () => {
    if (!lineChannel || !lineMessage.trim()) return;
    const target = lineChannels.find(c => c.value === lineChannel);
    if (!confirm(`確認發送 LINE 訊息到「${target?.label || lineChannel}」？`)) return;
    setLineSending(true);
    try {
      const res = await apiSendLineMessage(lineChannel, lineMessage.trim());
      if (res.success) {
        setLineMessage('');
        setLineFeedback({ msg: '✓ ' + (res.message || '發送成功'), type: 'ok' });
      } else {
        setLineFeedback({ msg: '✗ ' + (res.message || '發送失敗'), type: 'err' });
      }
    } catch {
      setLineFeedback({ msg: '✗ 發送失敗', type: 'err' });
    } finally {
      setLineSending(false);
      setTimeout(() => setLineFeedback(null), 3000);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <Crown className="w-6 h-6 text-amber-500" />
          <h2 className="text-xl font-bold text-slate-800">大師專用</h2>
        </div>
        <p className="text-sm text-slate-500 mt-1">管理員工具 — 緊急通知 & LINE 訊息發送</p>
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

      {/* POS 緊急通知發送區 */}
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

      {/* ── LINE 訊息發送專區 ── */}
      <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <MessageSquare className="w-5 h-5 text-emerald-600" />
          <h3 className="font-bold text-slate-700">LINE 訊息發送</h3>
        </div>

        {lineChannels.length === 0 ? (
          <p className="text-slate-400 text-sm">尚未設定 LINE 通知 channel（請在後台「LINE通知設定」分頁設定）</p>
        ) : (
          <>
            {/* Channel 選擇 */}
            <div className="mb-3">
              <label className="block text-xs text-slate-500 mb-1.5 font-medium">發送目標</label>
              <div className="flex flex-wrap gap-2">
                {lineChannels.map(ch => (
                  <button
                    key={ch.value}
                    onClick={() => setLineChannel(ch.value)}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                      lineChannel === ch.value
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/25'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {ch.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 訊息輸入 */}
            <textarea
              value={lineMessage}
              onChange={e => setLineMessage(e.target.value)}
              placeholder="輸入 LINE 訊息內容…"
              rows={4}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 transition-all"
              maxLength={2000}
            />

            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-slate-400">{lineMessage.length}/2000</span>
              <button
                onClick={handleLineSend}
                disabled={lineSending || !lineMessage.trim() || !lineChannel}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/25 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {lineSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                發送 LINE 訊息
              </button>
            </div>

            {/* LINE Feedback */}
            {lineFeedback && (
              <div className={`text-center py-2 px-4 rounded-xl font-bold text-sm mt-3 ${lineFeedback.type === 'ok' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                {lineFeedback.msg}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── 用量儀表板 ── */}
      {quota && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-slate-700">GAS / LINE 用量</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {/* GAS API */}
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">今日 GAS API</p>
              <p className="text-2xl font-bold text-slate-800">{quota.gasApiToday}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">本月 GAS API</p>
              <p className="text-2xl font-bold text-slate-800">{quota.gasApiMonth}</p>
            </div>
            {/* UrlFetchApp */}
            <div className="bg-blue-50 rounded-xl p-4">
              <p className="text-xs text-blue-500 mb-1">今日 UrlFetchApp</p>
              <p className="text-2xl font-bold text-blue-800">{quota.urlFetchToday}<span className="text-sm font-normal text-blue-400"> / {quota.urlFetchLimit.toLocaleString()}</span></p>
            </div>
            {/* LINE Push */}
            <div className="bg-emerald-50 rounded-xl p-4">
              <p className="text-xs text-emerald-500 mb-1">本月 LINE Push</p>
              <p className="text-2xl font-bold text-emerald-800">{quota.linePushMonth}<span className="text-sm font-normal text-emerald-400"> / {quota.linePushLimit}</span></p>
              <div className="w-full bg-emerald-200 rounded-full h-2 mt-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    quota.linePushMonth / quota.linePushLimit > 0.8 ? 'bg-red-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, (quota.linePushMonth / quota.linePushLimit) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
