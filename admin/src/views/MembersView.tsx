import React, { useEffect, useState } from 'react';
import { membersApi, reportsApi } from '../api/client';
import { 
  Users, 
  Search, 
  Sliders, 
  Coins, 
  FileText, 
  Download, 
  X, 
  AlertCircle, 
  CheckCircle, 
  ChevronRight,
  History,
  ShieldCheck
} from 'lucide-react';

export const MembersView: React.FC = () => {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTier, setSelectedTier] = useState('ALL');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // 調整點數 Modal
  const [adjustTarget, setAdjustTarget] = useState<any | null>(null);
  const [pointDelta, setPointDelta] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<string>('');
  const [adjustLoading, setAdjustLoading] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  // 會員歷程抽屜
  const [historyTarget, setHistoryTarget] = useState<any | null>(null);
  const [historyData, setHistoryData] = useState<any | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchMembers();
    }, 250);
    return () => clearTimeout(timer);
  }, [searchTerm, selectedTier, page]);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const res = await membersApi.list({
        q: searchTerm || undefined,
        tier: selectedTier !== 'ALL' ? selectedTier : undefined,
        page,
        pageSize: 15,
      });
      if (res.success) {
        setMembers(res.data);
        setTotal(res.pagination?.total || res.data.length);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustTarget) return;

    if (!adjustReason || adjustReason.trim().length < 4) {
      setAdjustError('請務必填寫至少 4 個字元之調帳具體原因（供審計鏈追蹤）');
      return;
    }

    if (pointDelta === 0) {
      setAdjustError('調整數值不可為 0');
      return;
    }

    if (pointDelta < 0 && adjustTarget.points + pointDelta < 0) {
      setAdjustError(`扣除點數超出該會員現有上限（目前僅有 ${adjustTarget.points} 點）`);
      return;
    }

    setAdjustLoading(true);
    setAdjustError(null);
    try {
      await membersApi.adjustPoints(adjustTarget.id, pointDelta, adjustReason.trim());
      setAdjustTarget(null);
      setPointDelta(0);
      setAdjustReason('');
      fetchMembers();
    } catch (err: any) {
      setAdjustError(err.message || '調整失敗');
    } finally {
      setAdjustLoading(false);
    }
  };

  const openHistoryDrawer = async (member: any) => {
    setHistoryTarget(member);
    setHistoryLoading(true);
    try {
      const res = await membersApi.history(member.id);
      if (res.success) {
        setHistoryData(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 標題與操作工具列 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-800/60 p-5 rounded-2xl border border-slate-700/60">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" />
            <h1 className="text-xl font-bold text-white">會員主檔與點數審計</h1>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            完全取代舊版 Google Sheets 會員分頁。支援即時快搜、防誤扣與防竄改雜湊鏈審計。
          </p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href={reportsApi.getExportUrl('members')}
            download
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium rounded-xl border border-slate-600 transition"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            串流匯出名冊 CSV
          </a>
        </div>
      </div>

      {/* 篩選欄 */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="搜尋姓名、手機號碼 (支援模糊搜尋)..."
            className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedTier}
            onChange={(e) => setSelectedTier(e.target.value)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">全部會員等級</option>
            <option value="GENERAL">一般會員</option>
            <option value="VIP">VIP 貴賓</option>
            <option value="SVIP">SVIP 尊爵</option>
          </select>
        </div>
      </div>

      {/* 會員表格 */}
      <div className="bg-slate-800/70 border border-slate-700/80 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900/60 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-700">
              <tr>
                <th className="py-3 px-4">會員姓名</th>
                <th className="py-3 px-4">手機號碼</th>
                <th className="py-3 px-4">會員等級</th>
                <th className="py-3 px-4 text-right">可用點數</th>
                <th className="py-3 px-4">註冊時間</th>
                <th className="py-3 px-4 text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60 text-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    載入中...
                  </td>
                </tr>
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    查無符合條件的會員
                  </td>
                </tr>
              ) : (
                members.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-750/50 transition">
                    <td className="py-3.5 px-4 font-semibold text-white">
                      {m.name}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-300">
                      {m.phone}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        m.tier === 'SVIP' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                        m.tier === 'VIP' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' :
                        'bg-slate-700 text-slate-300'
                      }`}>
                        {m.tier || 'GENERAL'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-amber-400">
                      {m.points.toLocaleString()} <span className="text-xs text-slate-400 font-normal">pts</span>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-400">
                      {new Date(m.createdAt).toLocaleDateString('zh-TW')}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => {
                            setAdjustTarget(m);
                            setPointDelta(0);
                            setAdjustReason('');
                            setAdjustError(null);
                          }}
                          className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 text-xs font-medium rounded-lg border border-amber-500/20 transition flex items-center gap-1"
                        >
                          <Coins className="w-3.5 h-3.5" />
                          調點
                        </button>
                        <button
                          onClick={() => openHistoryDrawer(m)}
                          className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium rounded-lg transition flex items-center gap-1"
                        >
                          <History className="w-3.5 h-3.5" />
                          歷程
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 手動調整點數 Modal */}
      {adjustTarget && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setAdjustTarget(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-4">
              <Coins className="w-5 h-5 text-amber-400" />
              <h3 className="text-lg font-bold text-white">手動點數審計調帳</h3>
            </div>

            <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-700/60 mb-4 text-xs space-y-1">
              <div className="text-slate-300">
                目標會員：<span className="text-white font-bold">{adjustTarget.name}</span> ({adjustTarget.phone})
              </div>
              <div className="text-slate-300">
                現有點數：<span className="text-amber-400 font-bold">{adjustTarget.points} 點</span>
              </div>
            </div>

            {adjustError && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{adjustError}</span>
              </div>
            )}

            <form onSubmit={handleAdjustSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  點數增減量 (正數增加，負數扣除)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={pointDelta}
                    onChange={(e) => setPointDelta(parseInt(e.target.value, 10) || 0)}
                    placeholder="例如: +100 或 -50"
                    className="flex-1 px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
                    required
                  />
                  <span className="text-xs text-slate-400">
                    調整後: <span className="font-bold text-white">{adjustTarget.points + pointDelta}</span>
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  異動事由 (強制要求 ≥ 4 個字元，寫入審計雜湊鏈)
                </label>
                <textarea
                  rows={3}
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="例如: 店長手動補償一番賞斷籤、消費滿額補登..."
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustTarget(null)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium rounded-xl transition"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={adjustLoading}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl transition disabled:opacity-50"
                >
                  {adjustLoading ? '審計處理中...' : '確認調帳並簽名'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 會員歷程抽屜 (Drawer) */}
      {historyTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex justify-end z-50">
          <div className="w-full max-w-md bg-slate-900 border-l border-slate-800 h-full p-6 overflow-y-auto space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white">{historyTarget.name} 的消費與點數歷程</h3>
                <p className="text-xs text-slate-400 font-mono">{historyTarget.phone}</p>
              </div>
              <button
                onClick={() => setHistoryTarget(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {historyLoading ? (
              <div className="text-center py-12 text-slate-500 text-sm">載入會員歷史中...</div>
            ) : (
              <div className="space-y-6">
                {/* 點數歷程 */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Coins className="w-4 h-4 text-amber-400" />
                    <h4 className="text-sm font-semibold text-white">點數異動紀錄</h4>
                  </div>
                  {(!historyData?.pointLogs || historyData.pointLogs.length === 0) ? (
                    <div className="text-xs text-slate-500 bg-slate-800/40 p-3 rounded-xl">尚無點數記錄</div>
                  ) : (
                    <div className="space-y-2">
                      {historyData.pointLogs.map((log: any, idx: number) => (
                        <div key={idx} className="bg-slate-800/60 border border-slate-700/60 p-3 rounded-xl text-xs">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-semibold text-slate-300">{log.reason || '點數變更'}</span>
                            <span className={`font-bold ${log.delta > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {log.delta > 0 ? `+${log.delta}` : log.delta} pts
                            </span>
                          </div>
                          <div className="flex justify-between text-[11px] text-slate-500">
                            <span>結餘: {log.balance} pts</span>
                            <span>{new Date(log.createdAt).toLocaleString('zh-TW')}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 審計鏈日誌 */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-sm font-semibold text-white">防竄改審計日誌 (Audit Chain)</h4>
                  </div>
                  {(!historyData?.auditLogs || historyData.auditLogs.length === 0) ? (
                    <div className="text-xs text-slate-500 bg-slate-800/40 p-3 rounded-xl">尚無審計日誌</div>
                  ) : (
                    <div className="space-y-2">
                      {historyData.auditLogs.map((aud: any, idx: number) => (
                        <div key={idx} className="bg-slate-800/40 border border-slate-700/40 p-3 rounded-xl text-xs font-mono">
                          <div className="text-slate-300 font-sans font-medium">{aud.action}</div>
                          <div className="text-[11px] text-slate-400 mt-1">{aud.reason}</div>
                          <div className="text-[10px] text-slate-500 truncate mt-1">Hash: {aud.currentHash}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
