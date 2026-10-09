import React, { useEffect, useState } from 'react';
import { settingsApi } from '../api/client';
import { OneClickMigrationPanel } from '../components/OneClickMigrationPanel';
import { 
  Settings, 
  MessageSquare, 
  Trello, 
  Radio, 
  BellRing, 
  Save, 
  CheckCircle2, 
  AlertTriangle,
  Send
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  // LINE 設定
  const [lineToken, setLineToken] = useState('mock-line-token-onesoul');
  const [lineAdminId, setLineAdminId] = useState('mock-admin-group');
  const [lineSaving, setLineSaving] = useState(false);
  const [lineSaved, setLineSaved] = useState(false);

  // Trello 設定
  const [trelloKey, setTrelloKey] = useState('mock-trello-key');
  const [trelloToken, setTrelloToken] = useState('mock-trello-token');
  const [trelloListId, setTrelloListId] = useState('mock-gk-list');
  const [trelloSaving, setTrelloSaving] = useState(false);
  const [trelloSaved, setTrelloSaved] = useState(false);

  // 緊急公告
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeContent, setNoticeContent] = useState('');
  const [noticeLevel, setNoticeLevel] = useState<'INFO' | 'WARNING' | 'CRITICAL'>('WARNING');
  const [publishing, setPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [activeNotices, setActiveNotices] = useState<any[]>([]);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const [cfgRes, noticesRes] = await Promise.all([
        settingsApi.getIntegrations(),
        settingsApi.getNotices(),
      ]);

      if (cfgRes.success) {
        const configs = cfgRes.data || [];
        const lineCfg = configs.find((c: any) => c.key === 'LINE_NOTIFY');
        if (lineCfg) {
          setLineToken(lineCfg.value?.token || '');
          setLineAdminId(lineCfg.value?.channels?.[0]?.targetId || '');
        }

        const trelloCfg = configs.find((c: any) => c.key === 'TRELLO_BOARD');
        if (trelloCfg) {
          setTrelloKey(trelloCfg.value?.apiKey || '');
          setTrelloToken(trelloCfg.value?.token || '');
          setTrelloListId(trelloCfg.value?.listId || '');
        }
      }

      if (noticesRes.success) {
        setActiveNotices(noticesRes.data || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveLine = async (e: React.FormEvent) => {
    e.preventDefault();
    setLineSaving(true);
    setLineSaved(false);
    try {
      await settingsApi.saveIntegration('LINE_NOTIFY', {
        token: lineToken,
        channels: [{ name: 'admin', targetId: lineAdminId }],
      }, 'LINE Notify 與群組推播設定');
      setLineSaved(true);
      setTimeout(() => setLineSaved(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setLineSaving(false);
    }
  };

  const handleSaveTrello = async (e: React.FormEvent) => {
    e.preventDefault();
    setTrelloSaving(true);
    setTrelloSaved(false);
    try {
      await settingsApi.saveIntegration('TRELLO_BOARD', {
        apiKey: trelloKey,
        token: trelloToken,
        listId: trelloListId,
      }, 'Trello GK 卡片連動設定');
      setTrelloSaved(true);
      setTimeout(() => setTrelloSaved(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setTrelloSaving(false);
    }
  };

  const handlePublishNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noticeTitle.trim() || !noticeContent.trim()) return;

    setPublishing(true);
    setPublishSuccess(false);
    try {
      await settingsApi.publishNotice({
        title: noticeTitle.trim(),
        content: noticeContent.trim(),
        level: noticeLevel,
      });
      setPublishSuccess(true);
      setNoticeTitle('');
      setNoticeContent('');
      loadSettings();
      setTimeout(() => setPublishSuccess(false), 4000);
    } catch (err) {
      console.error(err);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 🚀 Google Sheets 全量極速一鍵遷移工作台 */}
      <OneClickMigrationPanel />

      {/* 頂部標題 */}
      <div className="bg-slate-800/60 p-5 rounded-2xl border border-slate-700/60">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-indigo-400" />
          <h1 className="text-xl font-bold text-white">外部自動化整合與 POS 即時公告廣播</h1>
        </div>
        <p className="text-xs text-slate-400 mt-0.5">
          配置 LINE 群組推播 (關帳報表/遲到/作廢)、Trello 看板、以及透過 SSE 長連線推播至收銀機前台之緊急廣播公告。
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LINE 推播整合 */}
        <div className="bg-slate-800/70 border border-slate-700/80 rounded-2xl p-6 shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-emerald-400" />
              <h2 className="text-base font-bold text-white">LINE 官方帳號 / Notify 推播通道</h2>
            </div>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
              Transactional Outbox
            </span>
          </div>
          <p className="text-xs text-slate-400 mb-4">
            系統採用非同步 Outbox Worker 發送，外部 LINE 斷線絕不阻斷結帳與打烊流程。
          </p>

          <form onSubmit={handleSaveLine} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                LINE Channel Access Token / Notify Token
              </label>
              <input
                type="password"
                value={lineToken}
                onChange={(e) => setLineToken(e.target.value)}
                placeholder="輸入 LINE Token..."
                className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                管理員推播群組 ID (Admin / Boss Target ID)
              </label>
              <input
                type="text"
                value={lineAdminId}
                onChange={(e) => setLineAdminId(e.target.value)}
                placeholder="例如: C1234567890abcdef..."
                className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              {lineSaved && (
                <span className="text-xs text-emerald-400 flex items-center gap-1 font-semibold">
                  <CheckCircle2 className="w-4 h-4" /> LINE 設定已更新儲存
                </span>
              )}
              <div className="ml-auto">
                <button
                  type="submit"
                  disabled={lineSaving}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  {lineSaving ? '儲存中...' : '儲存 LINE 設定'}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Trello 看板連動 */}
        <div className="bg-slate-800/70 border border-slate-700/80 rounded-2xl p-6 shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Trello className="w-5 h-5 text-blue-400" />
              <h2 className="text-base font-bold text-white">Trello 看板卡片連動</h2>
            </div>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold">
              GK 預約連動
            </span>
          </div>
          <p className="text-xs text-slate-400 mb-4">
            當 POS 售出 GK 雕像或發起特定預約時，自動建立或移動 Trello 待辦卡片。
          </p>

          <form onSubmit={handleSaveTrello} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">API Key</label>
                <input
                  type="password"
                  value={trelloKey}
                  onChange={(e) => setTrelloKey(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">List ID</label>
                <input
                  type="text"
                  value={trelloListId}
                  onChange={(e) => setTrelloListId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">User Token</label>
              <input
                type="password"
                value={trelloToken}
                onChange={(e) => setTrelloToken(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              {trelloSaved && (
                <span className="text-xs text-blue-400 flex items-center gap-1 font-semibold">
                  <CheckCircle2 className="w-4 h-4" /> Trello 設定已更新
                </span>
              )}
              <div className="ml-auto">
                <button
                  type="submit"
                  disabled={trelloSaving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  {trelloSaving ? '儲存中...' : '儲存 Trello 設定'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* POS 即時廣播緊急公告 (SSE 推播) */}
      <div className="bg-slate-800/70 border border-slate-700/80 rounded-2xl p-6 shadow">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold text-white">POS 前台即時廣播緊急公告 (SSE 雙軌推播)</h2>
          </div>
          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold">
            全門市即時同步
          </span>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          發佈後將即時透過 Server-Sent Events (SSE) 推播至竹北與金山店所有收銀 POS 螢幕頂部橫幅，備援支援 30 秒輪詢。
        </p>

        <form onSubmit={handlePublishNotice} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1">公告標題</label>
              <input
                type="text"
                value={noticeTitle}
                onChange={(e) => setNoticeTitle(e.target.value)}
                placeholder="例如: 颱風天竹北店提早於 20:00 打烊通知、網路線路異常提醒..."
                className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">警示層級</label>
              <select
                value={noticeLevel}
                onChange={(e: any) => setNoticeLevel(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
              >
                <option value="INFO">一般通知 (INFO 藍色)</option>
                <option value="WARNING">重要警示 (WARNING 黃色)</option>
                <option value="CRITICAL">緊急告警 (CRITICAL 紅色)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">公告詳細內容</label>
            <textarea
              rows={3}
              value={noticeContent}
              onChange={(e) => setNoticeContent(e.target.value)}
              placeholder="請詳細敘述注意事項與現場店員應變流程..."
              className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
              required
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            {publishSuccess && (
              <span className="text-xs text-emerald-400 flex items-center gap-1 font-semibold">
                <CheckCircle2 className="w-4 h-4" /> 公告已成功發佈並推播至 POS！
              </span>
            )}
            <div className="ml-auto">
              <button
                type="submit"
                disabled={publishing}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl shadow transition disabled:opacity-50 flex items-center gap-1.5"
              >
                <Send className="w-4 h-4" />
                {publishing ? '推播中...' : '立即廣播發佈至全店 POS'}
              </button>
            </div>
          </div>
        </form>

        {/* 生效中公告 */}
        {activeNotices.length > 0 && (
          <div className="mt-6 pt-6 border-t border-slate-700/60 space-y-2">
            <h3 className="text-xs font-semibold text-slate-400">目前生效中之 POS 公告</h3>
            {activeNotices.map((n) => (
              <div key={n.id} className="bg-slate-900/60 border border-slate-700/60 p-3 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-white flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      n.level === 'CRITICAL' ? 'bg-rose-500/20 text-rose-300' :
                      n.level === 'WARNING' ? 'bg-amber-500/20 text-amber-300' :
                      'bg-blue-500/20 text-blue-300'
                    }`}>
                      {n.level}
                    </span>
                    {n.title}
                  </div>
                  <div className="text-slate-400 mt-1">{n.content}</div>
                </div>
                <div className="text-[11px] text-slate-500 font-mono">版本: v{n.version}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
