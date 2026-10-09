import React, { useEffect, useState } from 'react';
import { posCoreApi } from '../api/client';
import { 
  CircleDollarSign, 
  Store, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw,
  FileText
} from 'lucide-react';

export const SessionsView: React.FC = () => {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const res = await posCoreApi.getSessions();
      if (res.success && res.data) {
        setSessions(Array.isArray(res.data) ? res.data : [res.data]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 頂部標題 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-800/60 p-5 rounded-2xl border border-slate-700/60">
        <div>
          <div className="flex items-center gap-2">
            <CircleDollarSign className="w-5 h-5 text-amber-400" />
            <h1 className="text-xl font-bold text-white">門市開關帳班次與 Z-Report 封存日結</h1>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            完全取代 Google Sheets 結帳對帳表。自動比對開班備用金、打烊現金點鈔、溢短差額計算與 LINE 自動推播。
          </p>
        </div>

        <button
          onClick={loadSessions}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold rounded-xl border border-slate-600 transition"
        >
          <RefreshCw className="w-4 h-4 text-amber-400" />
          重新整理班次狀態
        </button>
      </div>

      {/* 班次列表 */}
      <div className="space-y-4">
        {loading ? (
          <div className="py-12 text-center text-slate-500 text-sm">載入班次資訊中...</div>
        ) : sessions.length === 0 ? (
          <div className="py-12 text-center bg-slate-800/50 border border-slate-700/60 rounded-2xl text-slate-400 text-sm">
            目前門市尚未開啟新班次。收銀 POS 連線開班後將自動在此即時連線更新。
          </div>
        ) : (
          sessions.map((sess) => (
            <div key={sess.id} className="bg-slate-800/70 border border-slate-700/80 rounded-2xl p-5 hover:border-slate-600 transition">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-white bg-slate-900 px-2.5 py-1 rounded-lg">
                    {sess.id}
                  </span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-700 text-slate-300">
                    {sess.storeId === 'chupei' ? '竹北旗艦店' : '金山概念店'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    sess.status === 'OPEN'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 animate-pulse'
                      : 'bg-slate-700 text-slate-300'
                  }`}>
                    {sess.status === 'OPEN' ? '營業開班中' : '已打烊關帳'}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    開班時間: {new Date(sess.openedAt).toLocaleTimeString('zh-TW')}
                  </span>
                </div>
              </div>

              {/* 班次金流摘要 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 text-xs">
                <div>
                  <span className="text-slate-400">開班備用金:</span>
                  <div className="font-bold text-white text-sm mt-0.5 font-mono">
                    ${sess.openingCash?.toLocaleString() || 0}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">開班人員:</span>
                  <div className="font-medium text-slate-300 text-sm mt-0.5 truncate">
                    {sess.openedBy || '店長'}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">已收訂單:</span>
                  <div className="font-bold text-emerald-400 text-sm mt-0.5">
                    {sess.orders?.length || 0} 筆交易
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">Transactional Outbox:</span>
                  <div className="font-bold text-indigo-400 text-sm mt-0.5">
                    LINE 雙軌排隊中
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
