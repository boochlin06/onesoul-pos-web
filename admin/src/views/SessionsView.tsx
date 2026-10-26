import React, { useEffect, useState, useRef } from 'react';
import { sessionsAdminApi } from '../api/client';
import { 
  CircleDollarSign, 
  Store, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw,
  Coins,
  Package,
  CreditCard,
  Banknote,
  Search,
  Filter,
  ShieldCheck,
  Award,
  ChevronRight,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Receipt,
  UserCheck,
  DoorOpen,
  DoorClosed,
  X
} from 'lucide-react';

export const SessionsView: React.FC = () => {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStore, setSelectedStore] = useState('ALL');
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // 開櫃 Modal
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [openAmount, setOpenAmount] = useState<number>(8000);
  const [openStore, setOpenStore] = useState('chupei');
  const [openLoading, setOpenLoading] = useState(false);

  // 關櫃 Modal
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [actualCashInput, setActualCashInput] = useState<number>(0);
  const [closeNote, setCloseNote] = useState('');
  const [closeLoading, setCloseLoading] = useState(false);

  // 測試下單 Loading
  const [simLoading, setSimLoading] = useState(false);

  // 自動輪詢 Timer
  const timerRef = useRef<any>(null);

  useEffect(() => {
    loadLiveShift();
  }, [selectedStore, selectedSessionId]);

  useEffect(() => {
    if (autoRefresh && (!selectedSessionId || data?.isLive)) {
      timerRef.current = setInterval(() => {
        loadLiveShift(true);
      }, 20000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [autoRefresh, selectedStore, selectedSessionId, data?.isLive]);

  const loadLiveShift = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await sessionsAdminApi.getLiveShift(
        selectedStore !== 'ALL' ? selectedStore : undefined,
        selectedSessionId || undefined
      );
      if (res.success && res.data) {
        setData(res.data);
      }
    } catch (err) {
      console.error('Failed to load shift data', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleQuickOpen = async (e: React.FormEvent) => {
    e.preventDefault();
    setOpenLoading(true);
    try {
      await sessionsAdminApi.openSession({
        storeId: openStore,
        amount: openAmount,
        openedBy: 'admin@onesoul.com',
      });
      setShowOpenModal(false);
      setSelectedSessionId('');
      loadLiveShift();
    } catch (err: any) {
      alert(err.message || '開櫃失敗');
    } finally {
      setOpenLoading(false);
    }
  };

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data?.session) return;
    setCloseLoading(true);
    try {
      await sessionsAdminApi.closeSession({
        storeId: data.session.storeId,
        actualCash: actualCashInput,
        note: closeNote,
        closedBy: 'admin@onesoul.com',
      });
      setShowCloseModal(false);
      loadLiveShift();
    } catch (err: any) {
      alert(err.message || '關櫃失敗');
    } finally {
      setCloseLoading(false);
    }
  };

  const handleSimulateOrder = async () => {
    setSimLoading(true);
    try {
      await sessionsAdminApi.simulateOrder({
        storeId: data?.session?.storeId || (selectedStore !== 'ALL' ? selectedStore : 'chupei'),
        prizeName: '海賊王 魯夫五檔 太陽神巨型公仔 - 非GK',
        prizeGrade: 'A賞',
        amount: 760,
        draws: 2,
        pickType: 'TAKE_AWAY',
        memberName: '曾瑋崧',
        memberPhone: '0955881093',
      });
      loadLiveShift();
    } catch (err: any) {
      alert(err.message || '測試下單失敗');
    } finally {
      setSimLoading(false);
    }
  };

  const session = data?.session;
  const metrics = data?.metrics || {
    totalRevenue: 0,
    cashRevenue: 0,
    cardRevenue: 0,
    remitRevenue: 0,
    openingCash: 0,
    expectedDrawerCash: 0,
    txCount: 0,
    drawsCount: 0,
    takeawayCount: 0,
    pointsCount: 0,
    voidCount: 0,
    voidAmount: 0,
  };
  const orders = data?.orders || [];
  const topPrizesHit = data?.topPrizesHit || [];
  const recentSessions = data?.recentSessions || [];
  const isLive = Boolean(data?.isLive);

  // 篩選當前班次訂單流水
  const filteredOrders = orders.filter((o: any) => {
    if (statusFilter !== 'ALL') {
      if (statusFilter === 'COMPLETED' && o.status === 'CANCELLED') return false;
      if (statusFilter === 'CANCELLED' && o.status !== 'CANCELLED') return false;
    }
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      const matchItem = (o.items || []).some(
        (it: any) =>
          (it.prizeName || '').toLowerCase().includes(term) ||
          (it.prizeGrade || '').toLowerCase().includes(term) ||
          (it.bagId || '').includes(term)
      );
      const matchMember =
        o.member?.name?.toLowerCase().includes(term) ||
        o.member?.phone?.includes(term) ||
        o.checkoutUID?.includes(term);
      if (!matchItem && !matchMember) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* 頂部戰情控制台橫幅 */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-800/80 p-5 rounded-2xl border border-slate-700/80 shadow-lg backdrop-blur-md">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
              isLive 
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 animate-pulse' 
                : 'bg-slate-700 text-slate-300 border-slate-600'
            }`}>
              <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-400' : 'bg-slate-400'}`} />
              {isLive ? '營業開班中 (LIVE X-Report)' : '已打烊關櫃日結 (Z-Report 封存)'}
            </span>

            {session && (
              <>
                <span className="text-xs px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 font-medium">
                  {session.storeName || (session.storeId === 'jinshan' ? '金山概念店' : '竹北旗艦店')}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  班次號: {session.id}
                </span>
              </>
            )}
          </div>

          <h1 className="text-xl font-bold text-white mt-2 flex items-center gap-2">
            <CircleDollarSign className="w-6 h-6 text-amber-400" />
            {isLive ? '今日開櫃到關櫃即時銷售戰情 (X-Report)' : '營業班次銷售與日結日報 (Z-Report)'}
          </h1>

          <p className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-3">
            {session ? (
              <>
                <span>開櫃時間: <span className="font-mono text-slate-200">{new Date(session.openedAt).toLocaleString('zh-TW')}</span></span>
                {session.closedAt && (
                  <span>• 關櫃時間: <span className="font-mono text-slate-200">{new Date(session.closedAt).toLocaleString('zh-TW')}</span></span>
                )}
                <span>• 營業時長: <span className="font-bold text-amber-300">{Math.floor(session.durationMinutes / 60)} 小時 {session.durationMinutes % 60} 分鐘</span></span>
                <span>• 開櫃人員: <span className="text-slate-200 font-medium">{session.openedBy}</span></span>
              </>
            ) : (
              <span>門市目前尚未開啟今日班次。可點擊右側開櫃開店開始營業。</span>
            )}
          </p>
        </div>

        {/* 頂部操作群組 */}
        <div className="flex flex-wrap items-center gap-2.5">
          <label className="flex items-center gap-1.5 px-3 py-2 bg-slate-900/60 border border-slate-700/60 rounded-xl text-xs text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded text-indigo-500 focus:ring-0"
            />
            <span>20s 即時輪詢</span>
          </label>

          <button
            onClick={() => loadLiveShift()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-750 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-600 transition disabled:opacity-50"
            title="立即更新即時流水"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${loading ? 'animate-spin' : ''}`} />
            <span>重新整理</span>
          </button>

          {isLive ? (
            <>
              <button
                onClick={handleSimulateOrder}
                disabled={simLoading}
                className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 text-xs font-semibold rounded-xl border border-indigo-500/40 transition disabled:opacity-50"
                title="模擬現場收銀一筆交易（測試即時流水更新）"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{simLoading ? '結帳中...' : '模擬結帳 1 筆'}</span>
              </button>

              <button
                onClick={() => {
                  setActualCashInput(metrics.expectedDrawerCash);
                  setShowCloseModal(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl transition shadow-lg shadow-amber-500/20"
              >
                <DoorClosed className="w-3.5 h-3.5" />
                <span>打烊關櫃日結 (Z-Report)</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowOpenModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-emerald-600/20"
            >
              <DoorOpen className="w-3.5 h-3.5" />
              <span>快速開店開櫃</span>
            </button>
          )}
        </div>
      </div>

      {/* 四大即時金流與營收情報卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 當班累計總營業額 */}
        <div className="bg-slate-800/80 p-5 rounded-2xl border border-slate-700/80 shadow-md">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs text-slate-400 font-medium">當班實收總營業額</span>
            <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">
            NT$ {metrics.totalRevenue.toLocaleString()}
          </div>
          <div className="text-xs text-slate-400 mt-2 flex items-center justify-between">
            <span>客單價 (AOV): <span className="font-mono text-white">NT$ {metrics.txCount > 0 ? Math.round(metrics.totalRevenue / metrics.txCount).toLocaleString() : 0}</span></span>
            <span className="font-semibold text-emerald-300 font-mono">{metrics.txCount} 筆交易</span>
          </div>
        </div>

        {/* 錢櫃抽屜此時應有現金 */}
        <div className="bg-slate-800/80 p-5 rounded-2xl border border-slate-700/80 shadow-md">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs text-slate-400 font-medium">錢櫃抽屜此時應有現金</span>
            <div className="p-2 bg-amber-500/10 rounded-xl text-amber-400">
              <Banknote className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-amber-400">
            NT$ {metrics.expectedDrawerCash.toLocaleString()}
          </div>
          <div className="text-xs text-slate-400 mt-2 flex items-center justify-between">
            <span>開班備金: <span className="font-mono text-slate-200">NT$ {metrics.openingCash.toLocaleString()}</span></span>
            <span>現金實收: <span className="font-mono text-amber-300">+${metrics.cashRevenue.toLocaleString()}</span></span>
          </div>
        </div>

        {/* 金流支付拆分 */}
        <div className="bg-slate-800/80 p-5 rounded-2xl border border-slate-700/80 shadow-md">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs text-slate-400 font-medium">多元支付拆分明細</span>
            <div className="p-2 bg-blue-500/10 rounded-xl text-blue-400">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1 mt-1 text-xs font-mono">
            <div className="flex justify-between items-center text-slate-300">
              <span>💵 現金收入:</span>
              <span className="font-bold text-white">NT$ {metrics.cashRevenue.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span>💳 信用卡刷卡:</span>
              <span className="font-bold text-white">NT$ {metrics.cardRevenue.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span>📱 匯款/行動支付:</span>
              <span className="font-bold text-white">NT$ {metrics.remitRevenue.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* 一番賞去化與點數 */}
        <div className="bg-slate-800/80 p-5 rounded-2xl border border-slate-700/80 shadow-md">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs text-slate-400 font-medium">當班抽賞去化與點數</span>
            <div className="p-2 bg-purple-500/10 rounded-xl text-purple-400">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold font-mono text-purple-300">
            {metrics.drawsCount} <span className="text-xs font-normal text-slate-400">抽累計</span>
          </div>
          <div className="text-xs text-slate-400 mt-2 space-y-0.5">
            <div className="flex justify-between">
              <span>📦 實物帶走: <span className="font-mono text-emerald-400 font-bold">{metrics.takeawayCount} 抽</span></span>
              <span>🪙 轉為點數: <span className="font-mono text-amber-400 font-bold">{metrics.pointsCount} 抽</span></span>
            </div>
            <div className="text-[11px] text-slate-500">
              發放點數: +{metrics.pointsIssued} pts · 折抵: -{metrics.pointsRedeemed} pts
            </div>
          </div>
        </div>
      </div>

      {/* 大獎開出即時廣播橫幅 (Top Prizes Hit) */}
      {topPrizesHit.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-indigo-500/10 border border-amber-500/30 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2 text-xs font-bold uppercase tracking-wider text-amber-400">
            <Award className="w-4 h-4" />
            <span>當班開出之大獎動態 (A / B / 最後賞即時廣播)</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {topPrizesHit.map((pz: any, idx: number) => (
              <div key={idx} className="bg-slate-900/80 border border-slate-700/60 p-2.5 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 truncate">
                  <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 font-bold rounded-lg shrink-0">
                    {pz.prizeGrade}
                  </span>
                  <span className="text-white font-medium truncate" title={pz.prizeName}>
                    {pz.prizeName}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 shrink-0 ml-2 font-mono">
                  {pz.memberName}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 核心模組：開櫃到關櫃之間即時訂單流水 ───────────────────── */}
      <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-lg space-y-4">
        {/* 流水工具列 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-700/60">
          <div>
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-indigo-400" />
              <h2 className="text-lg font-bold text-white">開櫃到關櫃即時訂單流水 (Shift Order Stream)</h2>
              <span className="px-2.5 py-0.5 bg-indigo-500/20 text-indigo-300 text-xs font-mono font-bold rounded-full">
                共 {filteredOrders.length} 筆明細
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              時間倒序呈現每筆交易、付款拆分、抽中賞級、品名與取貨型態 (帶走實物 / 轉為點數)。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* 搜尋品名、賞級或會員 */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="搜尋品名、賞級、會員電話..."
                className="pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-48 sm:w-60"
              />
            </div>

            {/* 門市切換 */}
            <select
              value={selectedStore}
              onChange={(e) => {
                setSelectedStore(e.target.value);
                setSelectedSessionId('');
              }}
              className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">全部門市</option>
              <option value="chupei">竹北旗艦店</option>
              <option value="jinshan">金山概念店</option>
            </select>

            {/* 狀態過濾 */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">全部狀態</option>
              <option value="COMPLETED">正常結帳</option>
              <option value="CANCELLED">中途作廢</option>
            </select>
          </div>
        </div>

        {/* 訂單流水清單列表 */}
        {filteredOrders.length === 0 ? (
          <div className="py-16 text-center text-slate-500 space-y-2">
            <Package className="w-10 h-10 mx-auto opacity-40 text-slate-400" />
            <div className="text-sm font-medium">當前班次尚無符合條件的結帳訂單流水</div>
            <div className="text-xs text-slate-500">
              現場 POS 收銀機結帳後將即時在此同步更新，亦可點擊右上角「模擬結帳 1 筆」進行即時展示。
            </div>
          </div>
        ) : (
          <div className="space-y-3.5">
            {filteredOrders.map((o: any) => (
              <div
                key={o.id}
                className={`p-4 rounded-xl border transition ${
                  o.status === 'CANCELLED'
                    ? 'bg-rose-500/5 border-rose-500/30 opacity-75'
                    : 'bg-slate-900/60 border-slate-700/60 hover:border-slate-600'
                }`}
              >
                {/* 訂單頂部資訊列 */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-800 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-slate-400">
                      {o.createdAt ? new Date(o.createdAt).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-'}
                    </span>
                    <span className="font-mono text-[11px] text-slate-500">
                      {o.checkoutUID || o.id}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-medium text-[11px]">
                      {o.storeName}
                    </span>
                    {o.status === 'CANCELLED' && (
                      <span className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 font-bold text-[11px] border border-rose-500/30">
                        已作廢 (退款)
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {/* 會員資訊 */}
                    {o.member ? (
                      <div className="flex items-center gap-1.5 text-slate-300">
                        <span className="font-semibold text-white">{o.member.name}</span>
                        <span className="font-mono text-[11px] text-slate-400">({o.member.phone})</span>
                        <span className="px-1.5 py-0.2 bg-purple-500/10 text-purple-300 text-[10px] rounded border border-purple-500/20">
                          {o.member.tier}
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-500 text-[11px]">散客 / 非會員</span>
                    )}

                    {/* 實付金額 */}
                    <div className="text-right">
                      <span className={`text-base font-bold font-mono ${o.status === 'CANCELLED' ? 'text-rose-400 line-through' : 'text-amber-400'}`}>
                        NT$ {Number(o.receivedAmount || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 支付與點數標籤列 */}
                <div className="flex flex-wrap items-center justify-between gap-2 py-2 text-[11px] text-slate-400">
                  <div className="flex items-center gap-2">
                    <span>付款拆分:</span>
                    {o.cash > 0 && <span className="text-slate-200">現金 ${o.cash}</span>}
                    {o.creditCard > 0 && <span className="text-slate-200">刷卡 ${o.creditCard}</span>}
                    {o.remittance > 0 && <span className="text-slate-200">轉帳 ${o.remittance}</span>}
                    {o.cash === 0 && o.creditCard === 0 && o.remittance === 0 && (
                      <span className="text-slate-500">純點數兌換</span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 font-mono">
                    {o.netPointsDelta !== 0 && (
                      <span className={o.netPointsDelta > 0 ? 'text-emerald-400' : 'text-amber-400'}>
                        點數 {o.netPointsDelta > 0 ? `+${o.netPointsDelta}` : o.netPointsDelta} pt
                      </span>
                    )}
                    {o.pointsUsed > 0 && (
                      <span className="text-rose-400">使用 {o.pointsUsed} pt</span>
                    )}
                  </div>
                </div>

                {/* 商品項目明細列表 (賞級、品名、抽數、帶走/換點) */}
                <div className="space-y-1.5 pt-1">
                  {(o.items || []).map((it: any, itIdx: number) => (
                    <div
                      key={itIdx}
                      className="bg-slate-950/60 p-2.5 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs border border-slate-850"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {it.prizeGrade ? (
                          <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] shrink-0 ${
                            it.prizeGrade.includes('A') || it.prizeGrade.includes('1') ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                            it.prizeGrade.includes('B') || it.prizeGrade.includes('2') ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' :
                            it.prizeGrade.includes('LAST') || it.prizeGrade.includes('最後') ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                            'bg-slate-800 text-slate-300'
                          }`}>
                            {it.prizeGrade} 賞
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 font-mono text-[11px]">
                            商品
                          </span>
                        )}

                        <span className="text-slate-200 font-medium truncate" title={it.prizeName}>
                          {it.prizeName || '一番賞獎項'}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 font-mono text-xs">
                        <span className="text-slate-400 font-sans">
                          x <span className="font-bold text-white">{it.draws || 1}</span> 抽
                        </span>

                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                          it.pickType === 'TAKE_AWAY'
                            ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}>
                          {it.pickType === 'TAKE_AWAY' ? '📦 帶走實物' : '🪙 轉為點數'}
                        </span>

                        <span className="font-bold text-slate-300 w-16 text-right">
                          ${(it.amount || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 底部歷史關櫃班次切換器 (Z-Report Historical Shifts) */}
      <div className="bg-slate-800/60 p-5 rounded-2xl border border-slate-700/60 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-bold text-white">歷史班次日結紀錄 (點選切換回溯覆盤)</h3>
          </div>
          {selectedSessionId && (
            <button
              onClick={() => setSelectedSessionId('')}
              className="text-xs text-indigo-400 hover:text-indigo-300 underline font-medium"
            >
              ← 返回當前即時開班戰情
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-60 overflow-y-auto pr-1">
          {recentSessions.map((s: any) => (
            <button
              key={s.id}
              onClick={() => setSelectedSessionId(s.id)}
              className={`text-left p-3 rounded-xl border transition text-xs space-y-1 ${
                selectedSessionId === s.id
                  ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-md'
                  : 'bg-slate-900/60 border-slate-750 hover:border-slate-600 text-slate-300'
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="font-mono font-bold text-[11px] truncate max-w-[120px]">{s.id}</span>
                <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                  s.status === 'OPEN' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'
                }`}>
                  {s.status === 'OPEN' ? 'OPEN' : 'CLOSED'}
                </span>
              </div>
              <div className="text-slate-400 text-[11px]">
                {s.storeName} · {s.openedAt ? new Date(s.openedAt).toLocaleDateString('zh-TW') : '-'}
              </div>
              <div className="flex justify-between items-center font-mono pt-1 text-slate-200">
                <span>營收: <span className="font-bold text-emerald-400">${Number(s.totalRevenue).toLocaleString()}</span></span>
                <span>備金: ${Number(s.openingCash).toLocaleString()}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 快速開櫃 Modal */}
      {showOpenModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700 mb-4">
              <div className="flex items-center gap-2">
                <DoorOpen className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">門市開班開櫃</h3>
              </div>
              <button onClick={() => setShowOpenModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleQuickOpen} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">營運門市</label>
                <select
                  value={openStore}
                  onChange={(e) => setOpenStore(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="chupei">竹北旗艦店</option>
                  <option value="jinshan">金山概念店</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  開班零錢備用金 (元)
                </label>
                <input
                  type="number"
                  value={openAmount}
                  onChange={(e) => setOpenAmount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white font-mono font-bold focus:outline-none focus:border-emerald-500"
                  required
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  系統將以此金額為基底，即時比對營業期間現金進出與抽屜應有現金。
                </span>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowOpenModal(false)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium rounded-xl transition"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={openLoading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition disabled:opacity-50"
                >
                  {openLoading ? '開櫃中...' : '確認開班營業'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 打烊關櫃日結 Modal */}
      {showCloseModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700 mb-4">
              <div className="flex items-center gap-2">
                <DoorClosed className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">打烊關櫃日結 (Z-Report 封存)</h3>
              </div>
              <button onClick={() => setShowCloseModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCloseShift} className="space-y-4">
              <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-700/60 text-xs space-y-1.5 font-mono">
                <div className="flex justify-between text-slate-300">
                  <span>開班備用金:</span>
                  <span>NT$ {metrics.openingCash.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>當班現金實收:</span>
                  <span className="text-amber-300 font-bold">+${metrics.cashRevenue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-white font-bold border-t border-slate-800 pt-1.5 text-sm">
                  <span>抽屜系統應有現金:</span>
                  <span className="text-amber-400">NT$ {metrics.expectedDrawerCash.toLocaleString()}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  現場店員實盤抽屜現金 (元)
                </label>
                <input
                  type="number"
                  value={actualCashInput}
                  onChange={(e) => setActualCashInput(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-base text-white font-mono font-bold focus:outline-none focus:border-amber-500"
                  required
                />
                {/* 溢短差額即時試算 */}
                <div className="mt-1 flex justify-between items-center text-xs font-mono">
                  <span className="text-slate-400">溢短差額:</span>
                  <span className={`font-bold ${
                    actualCashInput - metrics.expectedDrawerCash === 0
                      ? 'text-emerald-400'
                      : actualCashInput - metrics.expectedDrawerCash > 0
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }`}>
                    {actualCashInput - metrics.expectedDrawerCash >= 0 ? '+' : ''}
                    ${(actualCashInput - metrics.expectedDrawerCash).toLocaleString()}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">關帳備註 (可選)</label>
                <textarea
                  rows={2}
                  value={closeNote}
                  onChange={(e) => setCloseNote(e.target.value)}
                  placeholder="例如: 點鈔正常、零錢袋清點無誤..."
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCloseModal(false)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium rounded-xl transition"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={closeLoading}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl transition disabled:opacity-50"
                >
                  {closeLoading ? '封存中...' : '確認日結並封存 Z-Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
