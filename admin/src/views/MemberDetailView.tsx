import React, { useEffect, useState } from 'react';
import { membersApi } from '../api/client';
import { 
  ArrowLeft,
  Users,
  Wallet,
  Sparkles,
  Calendar,
  Receipt,
  Coins,
  Package,
  Store,
  CreditCard,
  Banknote,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  ChevronDown,
  Gift
} from 'lucide-react';

interface MemberDetailViewProps {
  memberId: string;
  onBack: () => void;
}

export const MemberDetailView: React.FC<MemberDetailViewProps> = ({ memberId, onBack }) => {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'orders' | 'points' | 'audit'>('orders');
  const [searchItem, setSearchItem] = useState('');
  const [selectedStore, setSelectedStore] = useState('ALL');

  // 手動調點數 Modal
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [pointDelta, setPointDelta] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<string>('');
  const [adjustLoading, setAdjustLoading] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  useEffect(() => {
    loadMemberHistory();
  }, [memberId]);

  const loadMemberHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await membersApi.history(memberId);
      if (res.success) {
        setData(res.data);
      } else {
        setError(res.message || '無法載入會員資料');
      }
    } catch (err: any) {
      setError(err.message || '連線錯誤');
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data?.member) return;

    if (!adjustReason || adjustReason.trim().length < 4) {
      setAdjustError('請務必填寫至少 4 個字元之調帳具體原因（供審計鏈追蹤）');
      return;
    }

    if (pointDelta === 0) {
      setAdjustError('調整數值不可為 0');
      return;
    }

    if (pointDelta < 0 && data.member.points + pointDelta < 0) {
      setAdjustError(`扣除點數超出該會員現有上限（目前僅有 ${data.member.points} 點）`);
      return;
    }

    setAdjustLoading(true);
    setAdjustError(null);
    try {
      await membersApi.adjustPoints(data.member.id, pointDelta, adjustReason.trim());
      setShowAdjustModal(false);
      setPointDelta(0);
      setAdjustReason('');
      loadMemberHistory();
    } catch (err: any) {
      setAdjustError(err.message || '調整失敗');
    } finally {
      setAdjustLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-500">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <div className="text-sm">載入會員完整消費歷程與大數據畫像中...</div>
      </div>
    );
  }

  if (error || !data || !data.member) {
    return (
      <div className="bg-slate-800/80 p-8 rounded-2xl border border-slate-700 text-center max-w-xl mx-auto space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-400 mx-auto" />
        <h2 className="text-lg font-bold text-white">查無會員資料</h2>
        <p className="text-sm text-slate-400">{error || '該會員可能不存在或已註銷'}</p>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold rounded-xl transition"
        >
          返回會員名冊
        </button>
      </div>
    );
  }

  const { member, intelligence, orders = [], pointLogs = [], auditLogs = [] } = data;

  // 篩選消費流水
  const filteredOrders = orders.filter((o: any) => {
    if (selectedStore !== 'ALL' && o.storeId !== selectedStore) return false;
    if (searchItem.trim()) {
      const term = searchItem.trim().toLowerCase();
      const hasMatch = (o.items || []).some((it: any) =>
        (it.prizeName || '').toLowerCase().includes(term) ||
        (it.bagId || '').includes(term)
      );
      if (!hasMatch) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 頂部導航與會員身份名片列 */}
      <div className="bg-slate-800/80 p-5 rounded-2xl border border-slate-700/80 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="px-3 py-2 bg-slate-900/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition flex items-center gap-1.5 text-xs font-medium"
            title="返回會員名冊"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>返回列表</span>
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-white">{member.name}</h1>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                member.tier === 'VIP' || member.tier === 'SVIP'
                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                  : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
              }`}>
                {member.tier || 'GENERAL'}
              </span>
              <span className="text-xs font-mono text-slate-400">
                {member.phone}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-3">
              <span>註冊門市: <span className="text-slate-300 font-medium">{member.storeId === 'jinshan' ? '金山概念店' : '竹北旗艦店'}</span></span>
              <span>•</span>
              <span>註冊日期: <span className="font-mono text-slate-300">{member.registeredAt ? new Date(member.registeredAt).toLocaleDateString('zh-TW') : '歷史會員'}</span></span>
              <span>•</span>
              <span>有效點數: <span className="font-mono text-amber-400 font-bold">{member.points} pts</span></span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAdjustModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl shadow transition"
          >
            <Coins className="w-4 h-4" />
            手動調整點數
          </button>
        </div>
      </div>

      {/* 🌟 頂部四大客戶情報提示看板 (Customer Intelligence Hero Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 卡片 1: 總消費金額 */}
        <div className="bg-gradient-to-br from-slate-800/90 to-slate-850 p-4 rounded-2xl border border-slate-700/80 shadow-md">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">總消費金額</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold font-mono text-white tracking-tight">
            NT$ {Number(intelligence?.totalSpent || 0).toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1.5 flex items-center justify-between">
            <span>客單價 (AOV): <span className="text-emerald-400 font-mono font-medium">NT$ {intelligence?.averageOrderValue?.toLocaleString() || 0}</span></span>
            <span>共 {intelligence?.totalOrders || 0} 筆訂單</span>
          </div>
        </div>

        {/* 卡片 2: 喜歡的貨物類型 (雙軌智慧畫像) */}
        <div className="bg-gradient-to-br from-slate-800/90 to-slate-850 p-4 rounded-2xl border border-slate-700/80 shadow-md">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">喜歡的貨物類型</span>
            <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-extrabold text-purple-300 flex items-center gap-1.5 truncate" title={intelligence?.favoriteIp}>
            <span>{intelligence?.favoriteIp || '綜合'}</span>
            {intelligence?.favoriteIpPercent > 0 && (
              <span className="text-xs font-mono font-normal px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                {intelligence.favoriteIpPercent}% 佔比
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-400 mt-1.5 truncate">
            畫像特徵: <span className="text-amber-300 font-medium">{intelligence?.personaTag || '公仔潮玩愛好者'}</span>
          </div>
        </div>

        {/* 卡片 3: 最近一次消費 */}
        <div className="bg-gradient-to-br from-slate-800/90 to-slate-850 p-4 rounded-2xl border border-slate-700/80 shadow-md">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">最近一次消費</span>
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="text-base font-bold text-white truncate" title={intelligence?.lastOrder?.itemName}>
            {intelligence?.lastOrder?.itemName || '尚無近期消費'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1.5 flex items-center justify-between">
            <span className="font-mono text-blue-300">{intelligence?.lastOrder?.date || '-'}</span>
            <span>{intelligence?.lastOrder?.storeId === 'jinshan' ? '金山店' : '竹北店'}</span>
          </div>
        </div>

        {/* 卡片 4: 最近花掉金額 */}
        <div className="bg-gradient-to-br from-slate-800/90 to-slate-850 p-4 rounded-2xl border border-slate-700/80 shadow-md">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">最近花掉金額</span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold font-mono text-amber-400">
            NT$ {Number(intelligence?.lastOrder?.spent || 0).toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1.5">
            最近一筆訂單實收總金額
          </div>
        </div>
      </div>

      {/* 主體內容分頁 Tab */}
      <div className="bg-slate-800/70 rounded-2xl border border-slate-700/70 overflow-hidden shadow-lg">
        <div className="flex items-center justify-between border-b border-slate-700 px-5 pt-3">
          <div className="flex items-center gap-6">
            <button
              onClick={() => setActiveTab('orders')}
              className={`pb-3 text-sm font-bold transition flex items-center gap-1.5 border-b-2 ${
                activeTab === 'orders'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Receipt className="w-4 h-4" />
              過往消費紀錄流水 ({orders.length})
            </button>
            <button
              onClick={() => setActiveTab('points')}
              className={`pb-3 text-sm font-bold transition flex items-center gap-1.5 border-b-2 ${
                activeTab === 'points'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Coins className="w-4 h-4" />
              點數異動歷史 ({pointLogs.length})
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`pb-3 text-sm font-bold transition flex items-center gap-1.5 border-b-2 ${
                activeTab === 'audit'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              防竄改審計日誌 ({auditLogs.length})
            </button>
          </div>
        </div>

        {/* Tab 1: 過往消費紀錄流水 */}
        {activeTab === 'orders' && (
          <div className="p-5 space-y-4">
            {/* 流水篩選工具列 */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-700/50">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchItem}
                  onChange={(e) => setSearchItem(e.target.value)}
                  placeholder="搜尋消費紀錄中之商品品名、套組編號..."
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={selectedStore}
                  onChange={(e) => setSelectedStore(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                >
                  <option value="ALL">全部消費門市</option>
                  <option value="chupei">竹北旗艦店</option>
                  <option value="jinshan">金山概念店</option>
                </select>
                <span className="text-xs text-slate-400 font-mono">
                  共 {filteredOrders.length} 筆
                </span>
              </div>
            </div>

            {/* 流水式卡片展開清單 */}
            {filteredOrders.length === 0 ? (
              <div className="py-16 text-center text-slate-500 text-sm">
                查無符合條件之消費紀錄
              </div>
            ) : (
              <div className="space-y-3">
                {filteredOrders.map((ord: any) => {
                  const items = ord.items || [];
                  const dateStr = ord.createdAt ? new Date(ord.createdAt).toLocaleString('zh-TW', { hour12: false }) : '-';
                  const storeName = ord.storeId === 'jinshan' ? '金山概念店' : '竹北旗艦店';
                  const paidAmount = Number(ord.receivedAmount) || (Number(ord.cash || 0) + Number(ord.creditCard || 0) + Number(ord.remittance || 0));

                  return (
                    <div
                      key={ord.id}
                      className="bg-slate-900/80 border border-slate-700/80 rounded-xl p-4 transition hover:border-slate-600 shadow-sm space-y-3"
                    >
                      {/* 訂單頂部資訊 */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            {storeName}
                          </span>
                          <span className="font-mono text-xs text-slate-400">
                            {dateStr}
                          </span>
                          <span className="text-xs text-slate-600">|</span>
                          <span className="font-mono text-[11px] text-slate-500 truncate" title={ord.id}>
                            #{ord.id}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 self-end sm:self-auto">
                          {ord.netPointsDelta !== undefined && ord.netPointsDelta !== 0 && (
                            <span className="text-xs font-mono text-indigo-300 bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-500/30">
                              點數 +{ord.netPointsDelta} pt
                            </span>
                          )}
                          <div className="text-base font-extrabold font-mono text-amber-400">
                            NT$ {paidAmount.toLocaleString()}
                          </div>
                        </div>
                      </div>

                      {/* 購買與抽賞明細 (流水展開條列) */}
                      {items.length === 0 ? (
                        <div className="text-xs text-slate-500 italic py-1">
                          無明細商品資訊（可能為直接金額扣帳或純點數兌換）
                        </div>
                      ) : (
                        <div className="space-y-1.5 pt-1">
                          {items.map((it: any, idx: number) => {
                            const isTakeAway = it.pickType === 'TAKE_AWAY';
                            return (
                              <div
                                key={idx}
                                className="flex items-center justify-between bg-slate-800/50 hover:bg-slate-800/80 px-3 py-2 rounded-lg text-xs transition border border-slate-750"
                              >
                                <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                                  {it.prizeGrade && (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                                      {it.prizeGrade} 賞
                                    </span>
                                  )}
                                  <div className="truncate text-white font-medium">
                                    {it.prizeName || '未標註品名'}
                                  </div>
                                  {it.bagId && (
                                    <span className="text-[10px] text-slate-500 font-mono shrink-0">
                                      (套號: {it.bagId})
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-3 shrink-0">
                                  <span className="text-slate-400 font-mono">
                                    x {it.draws || 1} 抽
                                  </span>

                                  {/* 取貨狀態：帶走實物 vs 轉為點數 */}
                                  {isTakeAway ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                      📦 帶走實物
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                      🪙 轉為點數
                                    </span>
                                  )}

                                  {it.amount > 0 && (
                                    <span className="font-mono font-bold text-slate-200 min-w-[70px] text-right">
                                      $ {Number(it.amount).toLocaleString()}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: 點數異動歷史 */}
        {activeTab === 'points' && (
          <div className="p-5">
            {pointLogs.length === 0 ? (
              <div className="py-16 text-center text-slate-500 text-sm">尚無點數異動記錄</div>
            ) : (
              <div className="space-y-2">
                {pointLogs.map((log: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between bg-slate-900/80 border border-slate-700/80 p-3.5 rounded-xl text-xs"
                  >
                    <div>
                      <div className="text-white font-semibold">{log.reason || '點數異動'}</div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        {new Date(log.createdAt).toLocaleString('zh-TW')}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-mono text-sm font-bold ${log.delta > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {log.delta > 0 ? `+${log.delta}` : log.delta} pts
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        結餘: {log.balance} pts
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: 防竄改審計日誌 */}
        {activeTab === 'audit' && (
          <div className="p-5">
            {auditLogs.length === 0 ? (
              <div className="py-16 text-center text-slate-500 text-sm">尚無審計日誌</div>
            ) : (
              <div className="space-y-2">
                {auditLogs.map((aud: any, idx: number) => (
                  <div
                    key={idx}
                    className="bg-slate-900/80 border border-slate-700/80 p-3.5 rounded-xl text-xs font-mono space-y-1"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-indigo-300 font-bold">{aud.action}</span>
                      <span className="text-slate-500 text-[11px]">{new Date(aud.createdAt).toLocaleString('zh-TW')}</span>
                    </div>
                    <div className="text-slate-300 font-sans">{aud.reason}</div>
                    <div className="text-[10px] text-slate-500 truncate">Hash: {aud.currentHash}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 手動調整點數 Modal */}
      {showAdjustModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center gap-2.5 mb-4">
              <Coins className="w-5 h-5 text-amber-400" />
              <h3 className="text-lg font-bold text-white">手動點數審計調帳</h3>
            </div>

            <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-700/60 mb-4 text-xs space-y-1">
              <div className="text-slate-300">
                目標會員：<span className="text-white font-bold">{member.name}</span> ({member.phone})
              </div>
              <div className="text-slate-300">
                現有點數：<span className="text-amber-400 font-bold">{member.points} 點</span>
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
                    調整後: <span className="font-bold text-white">{member.points + pointDelta}</span>
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
                  onClick={() => setShowAdjustModal(false)}
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
    </div>
  );
};
