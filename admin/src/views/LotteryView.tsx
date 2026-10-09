import React, { useEffect, useState } from 'react';
import { lotteryApi } from '../api/client';
import { 
  Gift, 
  Calculator, 
  Plus, 
  Trash2, 
  AlertTriangle, 
  CheckCircle2, 
  X, 
  TrendingUp, 
  ShieldAlert,
  ChevronDown,
  ChevronRight,
  Edit2,
  Check,
  Search,
  Filter,
  RefreshCw,
  Sparkles,
  Store,
  Layers,
  ArrowRight
} from 'lucide-react';

// ── 行內編輯單元格組件 (In-line Editable Cell) ──────────────────
interface InlineCellProps {
  value: string | number;
  type?: 'text' | 'number' | 'select';
  options?: Array<{ label: string; value: string }>;
  onSave: (newVal: any) => Promise<void>;
  prefix?: string;
  suffix?: string;
  className?: string;
  isBold?: boolean;
}

const InlineCell: React.FC<InlineCellProps> = ({
  value,
  type = 'text',
  options = [],
  onSave,
  prefix = '',
  suffix = '',
  className = '',
  isBold = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [currentVal, setCurrentVal] = useState<string | number>(value);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setCurrentVal(value);
  }, [value]);

  const handleCommit = async () => {
    if (String(currentVal) === String(value)) {
      setIsEditing(false);
      return;
    }
    setIsSaving(true);
    try {
      await onSave(type === 'number' ? Number(currentVal) || 0 : currentVal);
      setIsEditing(false);
    } catch (err) {
      console.error(err);
      setCurrentVal(value);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCommit();
    } else if (e.key === 'Escape') {
      setCurrentVal(value);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    if (type === 'select') {
      return (
        <select
          autoFocus
          value={currentVal}
          onChange={(e) => setCurrentVal(e.target.value)}
          onBlur={handleCommit}
          className="bg-slate-900 border border-purple-500 text-purple-200 text-xs rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-purple-400"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    }

    return (
      <input
        autoFocus
        type={type}
        value={currentVal}
        onChange={(e) => setCurrentVal(e.target.value)}
        onBlur={handleCommit}
        onKeyDown={handleKeyDown}
        className="bg-slate-900 border border-purple-500 text-purple-200 text-xs rounded px-1.5 py-1 w-full focus:outline-none focus:ring-1 focus:ring-purple-400 shadow-inner"
      />
    );
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      title="點擊直接修改"
      className={`group cursor-pointer flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-slate-800/80 transition border border-transparent hover:border-slate-700/60 ${className}`}
    >
      <span className={`${isBold ? 'font-semibold text-slate-100' : 'text-slate-300'}`}>
        {prefix}
        {value !== null && value !== undefined && value !== '' ? value : '-'}
        {suffix}
      </span>
      {isSaving ? (
        <RefreshCw className="w-3 h-3 text-purple-400 animate-spin shrink-0" />
      ) : (
        <Edit2 className="w-2.5 h-2.5 text-slate-500 opacity-0 group-hover:opacity-100 transition shrink-0" />
      )}
    </div>
  );
};

// ── 主視圖組件 ──────────────────────────────────────────────────
export const LotteryView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'board' | 'simulator' | 'create'>('board');
  const [filterMode, setFilterMode] = useState<'active' | 'chupei' | 'jinshan' | 'drawn' | 'all' | 'voided'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [overviewBags, setOverviewBags] = useState<any[]>([]);
  const [expandedBagIds, setExpandedBagIds] = useState<Set<string>>(new Set(['1556'])); // 預設展開 #1556
  const [loading, setLoading] = useState(true);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // 新增獎項暫存狀態 (Key: bagId)
  const [newPrizeForms, setNewPrizeForms] = useState<Record<string, { code: string; name: string; itemNo: string; points: number; draws: number }>>({});

  // 試算器狀態
  const [simUnitPrice, setSimUnitPrice] = useState<number>(300);
  const [simPrizes, setSimPrizes] = useState<Array<{ grade: string; name: string; cost: number; draws: number }>>([
    { grade: 'A', name: 'A賞 海賊王大雕像', cost: 5000, draws: 1 },
    { grade: 'B', name: 'B賞 景品公仔', cost: 600, draws: 3 },
    { grade: 'C', name: 'C賞 造型公仔', cost: 450, draws: 4 },
    { grade: 'Z', name: 'Z賞 安慰獎徽章/色紙', cost: 50, draws: 72 },
  ]);
  const [simResult, setSimResult] = useState<any | null>(null);
  const [simLoading, setSimLoading] = useState(false);

  // 開套 Modal
  const [openMode, setOpenMode] = useState<'SINGLE' | 'MULTI'>('SINGLE');
  const [storeId, setStoreId] = useState<'chupei' | 'jinshan'>('chupei');
  const [singleItemNo, setSingleItemNo] = useState('GK001');
  const [singleItemName, setSingleItemName] = useState('海賊王 魯夫 GK');
  const [singleTotalDraws, setSingleTotalDraws] = useState(80);
  const [singleSuggestedPrice, setSingleSuggestedPrice] = useState(300);
  const [singleActualPrice, setSingleActualPrice] = useState(300);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // 中途廢套 Modal
  const [voidTarget, setVoidTarget] = useState<any | null>(null);
  const [voidReason, setVoidReason] = useState('店鋪檔期結束撤套');
  const [voidLoading, setVoidLoading] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);

  useEffect(() => {
    loadOverview();
  }, [filterMode, searchQuery]);

  const loadOverview = async () => {
    setLoading(true);
    try {
      let storeParam: string | undefined = undefined;
      let filterParam: string = 'active';

      if (filterMode === 'chupei') {
        storeParam = 'chupei';
        filterParam = 'active';
      } else if (filterMode === 'jinshan') {
        storeParam = 'jinshan';
        filterParam = 'active';
      } else if (filterMode === 'drawn') {
        filterParam = 'drawn';
      } else if (filterMode === 'all') {
        filterParam = 'all';
      } else if (filterMode === 'voided') {
        filterParam = 'voided';
      }

      const res = await lotteryApi.overview({
        storeId: storeParam,
        filter: filterParam,
        search: searchQuery,
      });

      if (res.success) {
        setOverviewBags(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const showFeedback = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  // 摺疊/展開切換
  const toggleExpand = (bagId: string) => {
    setExpandedBagIds((prev) => {
      const next = new Set(prev);
      if (next.has(bagId)) next.delete(bagId);
      else next.add(bagId);
      return next;
    });
  };

  // ── 行內編輯套組 ──
  const handleUpdateBox = async (bagId: string, field: string, val: any) => {
    try {
      const res = await lotteryApi.updateBox(bagId, { [field]: val });
      if (res.success) {
        showFeedback(`✅ 已成功更新套組 #${bagId}`);
        // 局部更新本地狀態
        setOverviewBags((prev) =>
          prev.map((b) => (b.id === bagId ? { ...b, [field]: val } : b))
        );
      }
    } catch (err: any) {
      alert(`更新失敗: ${err.message || '未知錯誤'}`);
    }
  };

  // ── 行內編輯獎項 ──
  const handleUpdatePrize = async (prizeId: string, bagId: string, field: string, val: any) => {
    try {
      const res = await lotteryApi.updatePrize(prizeId, { [field]: val });
      if (res.success) {
        showFeedback(`✅ 已成功更新獎項`);
        loadOverview(); // 重新拉取以精確計算大套總籤數與大獎殘存率
      }
    } catch (err: any) {
      alert(`更新失敗: ${err.message || '未知錯誤'}`);
    }
  };

  // ── 切換獎項在籤狀態 ──
  const handleTogglePrize = async (prizeId: string) => {
    try {
      const res = await lotteryApi.togglePrize(prizeId);
      if (res.success) {
        showFeedback(res.message);
        loadOverview();
      }
    } catch (err: any) {
      alert(`操作失敗: ${err.message || '未知錯誤'}`);
    }
  };

  // ── 刪除獎項 ──
  const handleDeletePrize = async (prizeId: string) => {
    if (!window.confirm('確定要刪除此獎項品項嗎？')) return;
    try {
      const res = await lotteryApi.deletePrize(prizeId);
      if (res.success) {
        showFeedback('已刪除該獎項');
        loadOverview();
      }
    } catch (err: any) {
      alert(`刪除失敗: ${err.message || '未知錯誤'}`);
    }
  };

  // ── 新增獎項 ──
  const handleAddPrize = async (bagId: string) => {
    const form = newPrizeForms[bagId] || { code: '大獎', name: '', itemNo: '', points: 100, draws: 1 };
    if (!form.name.trim()) {
      alert('請輸入獎項品名');
      return;
    }

    try {
      const res = await lotteryApi.addPrize(bagId, {
        prizeCode: form.code,
        prizeName: form.name,
        itemNo: form.itemNo || null,
        points: form.points,
        draws: form.draws,
      });

      if (res.success) {
        showFeedback('已新增獎項');
        setNewPrizeForms((prev) => ({
          ...prev,
          [bagId]: { code: '大獎', name: '', itemNo: '', points: 100, draws: 1 },
        }));
        loadOverview();
      }
    } catch (err: any) {
      alert(`新增失敗: ${err.message || '未知錯誤'}`);
    }
  };

  // ── 廢套處理 ──
  const handleVoidSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voidTarget) return;

    setVoidLoading(true);
    setVoidError(null);
    try {
      const res = await lotteryApi.voidBox(voidTarget.id, voidReason);
      if (res.success) {
        setVoidTarget(null);
        showFeedback(`套組 #${voidTarget.id} 已廢套下架，殘賞已回流庫存`);
        loadOverview();
      }
    } catch (err: any) {
      setVoidError(err.message || '廢套失敗');
    } finally {
      setVoidLoading(false);
    }
  };

  // ── 開套處理 ──
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError(null);
    try {
      if (openMode === 'SINGLE') {
        const res = await lotteryApi.createBox({
          mode: 'SINGLE',
          storeId,
          itemNo: singleItemNo,
          itemName: singleItemName,
          totalDraws: singleTotalDraws,
          suggestedPrice: singleSuggestedPrice,
          actualPrice: singleActualPrice,
        });
        if (res.success) {
          setActiveTab('board');
          showFeedback('開套成功');
          loadOverview();
        }
      } else {
        const res = await lotteryApi.createBox({
          mode: 'MULTI',
          storeId,
          name: `${singleItemName} 多賞一番賞`,
          unitPrice: simUnitPrice,
          prizes: simPrizes.map((p) => ({
            prizeGrade: p.grade,
            prizeName: p.name,
            points: p.grade === 'A' ? 150 : 10,
            draws: p.draws,
          })),
        });
        if (res.success) {
          setActiveTab('board');
          showFeedback('多賞開套成功');
          loadOverview();
        }
      }
    } catch (err: any) {
      setCreateError(err.message || '開套失敗');
    } finally {
      setCreateLoading(false);
    }
  };

  // ── 損平試算 ──
  const handleSimulate = async () => {
    setSimLoading(true);
    try {
      const res = await lotteryApi.simulate(simUnitPrice, simPrizes);
      if (res.success) {
        setSimResult(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSimLoading(false);
    }
  };

  // 統計數值
  const activeCount = overviewBags.filter((b) => b.status === 'ACTIVE' && b.remainingDraws > 0).length;
  const majorActiveCount = overviewBags.filter((b) => b.majorRemaining > 0).length;
  const totalDrawnTickets = overviewBags.reduce((acc, b) => acc + (b.drawnCount || 0), 0);
  const totalAllTickets = overviewBags.reduce((acc, b) => acc + (b.totalDraws || 0), 0);

  return (
    <div className="space-y-6">
      {/* 浮動儲存回饋提示 */}
      {feedbackMsg && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2 bg-emerald-500/90 text-white px-4 py-2.5 rounded-xl shadow-2xl backdrop-blur border border-emerald-400 text-sm animate-bounce">
          <CheckCircle2 className="w-4 h-4" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* 頂部切換頁籤與標題 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-800/60 p-5 rounded-2xl border border-slate-700/60">
        <div>
          <div className="flex items-center gap-2.5">
            <Gift className="w-6 h-6 text-purple-400" />
            <h1 className="text-xl font-bold text-white tracking-wide">在線福袋與一番賞戰情室</h1>
            <span className="text-[11px] bg-purple-500/20 text-purple-300 px-2.5 py-0.5 rounded-full font-semibold border border-purple-500/30">
              主子表 · 試算表行內編輯版
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            即時監控竹北/金山門市進行中套組、大獎在籤率與殘賞；所有欄位點擊即可行內修改，失焦即刻自動同步。
          </p>
        </div>

        <div className="flex bg-slate-900/80 p-1 rounded-xl border border-slate-700/80 shrink-0">
          <button
            onClick={() => setActiveTab('board')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'board' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            在線福袋看板
          </button>
          <button
            onClick={() => {
              setActiveTab('simulator');
              handleSimulate();
            }}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'simulator' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            利潤損平試算器
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'create' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            + 開新套上架
          </button>
        </div>
      </div>

      {/* ── 頁籤 1：在線福袋戰情室 (Master-Detail Table) ── */}
      {activeTab === 'board' && (
        <div className="space-y-4">
          {/* 數據快速指標卡片 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>在線進行中套數</span>
                <Layers className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-2xl font-bold text-white">{activeCount} <span className="text-xs font-normal text-slate-400">套</span></div>
              <div className="text-[11px] text-purple-300 mt-1">未作廢且剩餘籤數 &gt; 0</div>
            </div>

            <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>大獎仍在籤套數</span>
                <Sparkles className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-bold text-amber-400">{majorActiveCount} <span className="text-xs font-normal text-slate-400">套</span></div>
              <div className="text-[11px] text-slate-400 mt-1">核心大賞尚未被抽光</div>
            </div>

            <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>累計已售出籤數</span>
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-emerald-400">{totalDrawnTickets} <span className="text-xs font-normal text-slate-400">抽</span></div>
              <div className="text-[11px] text-slate-400 mt-1">總籤池 {totalAllTickets} 抽</div>
            </div>

            <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>行內編輯模式</span>
                <Edit2 className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-sm font-semibold text-cyan-300 mt-1">點擊表格直接改</div>
              <div className="text-[11px] text-slate-400 mt-1">Enter / 失焦自動保存</div>
            </div>
          </div>

          {/* 篩選工具列與搜尋框 */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
            {/* 快速分頁標籤 */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => setFilterMode('active')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  filterMode === 'active'
                    ? 'bg-purple-600 text-white shadow'
                    : 'bg-slate-900/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                🟢 進行中 ({activeCount})
              </button>
              <button
                onClick={() => setFilterMode('chupei')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  filterMode === 'chupei'
                    ? 'bg-blue-600 text-white shadow'
                    : 'bg-slate-900/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                竹北店
              </button>
              <button
                onClick={() => setFilterMode('jinshan')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  filterMode === 'jinshan'
                    ? 'bg-amber-600 text-white shadow'
                    : 'bg-slate-900/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                金山店
              </button>
              <button
                onClick={() => setFilterMode('drawn')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  filterMode === 'drawn'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'bg-slate-900/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                ⚡ 抽獎進行中
              </button>
              <button
                onClick={() => setFilterMode('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  filterMode === 'all'
                    ? 'bg-slate-700 text-white shadow'
                    : 'bg-slate-900/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                全部套組
              </button>
              <button
                onClick={() => setFilterMode('voided')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  filterMode === 'voided'
                    ? 'bg-rose-600 text-white shadow'
                    : 'bg-slate-900/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                🛑 已作廢/完售
              </button>
            </div>

            {/* 搜尋欄位 */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜尋套號、套名或獎項..."
                className="w-full bg-slate-900/90 border border-slate-700/80 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* 主表格：Master-Detail Table */}
          <div className="bg-slate-800/40 rounded-xl border border-slate-700/60 overflow-hidden shadow-lg">
            {loading ? (
              <div className="py-20 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-purple-400" />
                <span className="text-xs">正在載入福袋大套即時資料...</span>
              </div>
            ) : overviewBags.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs">
                查無符合條件的福袋套組
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-900/80 text-slate-400 border-b border-slate-700/80 uppercase tracking-wider text-[11px]">
                      <th className="py-3 px-3 w-10 text-center">明細</th>
                      <th className="py-3 px-3 w-16">門市</th>
                      <th className="py-3 px-3 w-20">套號</th>
                      <th className="py-3 px-3 min-w-[200px]">套組名稱</th>
                      <th className="py-3 px-3 w-24">單抽價格</th>
                      <th className="py-3 px-3 w-24">總籤數</th>
                      <th className="py-3 px-3 w-24">已抽數</th>
                      <th className="py-3 px-3 w-36">剩餘籤數 / 進度</th>
                      <th className="py-3 px-3 w-32">大獎在籤率</th>
                      <th className="py-3 px-3 w-24 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {overviewBags.map((bag) => {
                      const isExpanded = expandedBagIds.has(bag.id);
                      const isVoided = bag.status === 'VOIDED';

                      return (
                        <React.Fragment key={bag.id}>
                          {/* ── Master Row: 大套資訊 ── */}
                          <tr
                            className={`transition hover:bg-slate-800/60 ${
                              isExpanded ? 'bg-purple-950/20' : ''
                            } ${isVoided ? 'opacity-60 bg-rose-950/10' : ''}`}
                          >
                            {/* 展開箭頭 */}
                            <td className="py-3 px-3 text-center">
                              <button
                                onClick={() => toggleExpand(bag.id)}
                                className="p-1 rounded hover:bg-slate-700/60 text-slate-400 hover:text-white transition"
                                title={isExpanded ? '收合獎項明細' : '展開獎項明細'}
                              >
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-purple-400" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-slate-400" />
                                )}
                              </button>
                            </td>

                            {/* 門市 */}
                            <td className="py-3 px-3">
                              <InlineCell
                                value={bag.storeId}
                                type="select"
                                options={[
                                  { label: '竹北', value: 'chupei' },
                                  { label: '金山', value: 'jinshan' },
                                ]}
                                onSave={(newVal) => handleUpdateBox(bag.id, 'storeId', newVal)}
                                className={`text-[11px] font-semibold rounded px-2 py-0.5 inline-block ${
                                  bag.storeId === 'jinshan'
                                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                    : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                                }`}
                              />
                            </td>

                            {/* 套號 */}
                            <td className="py-3 px-3 font-mono font-bold text-slate-300">
                              #{bag.id}
                            </td>

                            {/* 套名 (行內文字編輯) */}
                            <td className="py-3 px-3">
                              <InlineCell
                                value={bag.name}
                                type="text"
                                isBold
                                onSave={(newVal) => handleUpdateBox(bag.id, 'name', newVal)}
                              />
                            </td>

                            {/* 單抽價格 (行內數字編輯) */}
                            <td className="py-3 px-3 font-mono">
                              <InlineCell
                                value={bag.unitPrice}
                                type="number"
                                prefix="$"
                                onSave={(newVal) => handleUpdateBox(bag.id, 'unitPrice', newVal)}
                              />
                            </td>

                            {/* 總籤數 */}
                            <td className="py-3 px-3 font-mono text-slate-300">
                              <InlineCell
                                value={bag.totalDraws}
                                type="number"
                                suffix=" 抽"
                                onSave={(newVal) => handleUpdateBox(bag.id, 'totalDraws', newVal)}
                              />
                            </td>

                            {/* 已抽數 */}
                            <td className="py-3 px-3 font-mono text-slate-300">
                              <InlineCell
                                value={bag.drawnCount}
                                type="number"
                                suffix=" 抽"
                                onSave={(newVal) => handleUpdateBox(bag.id, 'drawnCount', newVal)}
                              />
                            </td>

                            {/* 剩餘籤數 / 進度條 */}
                            <td className="py-3 px-3">
                              <div className="flex items-center justify-between text-[11px] mb-1">
                                <span className="font-mono font-semibold text-slate-200">
                                  剩 {bag.remainingDraws} 抽
                                </span>
                                <span className="text-slate-400">{bag.progressPercent}%</span>
                              </div>
                              <div className="w-full bg-slate-700/60 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className={`h-full transition-all duration-300 ${
                                    bag.progressPercent >= 80
                                      ? 'bg-emerald-500'
                                      : bag.progressPercent >= 40
                                      ? 'bg-purple-500'
                                      : 'bg-blue-500'
                                  }`}
                                  style={{ width: `${Math.min(100, bag.progressPercent)}%` }}
                                />
                              </div>
                            </td>

                            {/* 大獎在籤率 */}
                            <td className="py-3 px-3">
                              {bag.isMajorAllDrawn ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                  🛑 大獎全出 (0/{bag.majorTotal})
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                  🎯 剩 {bag.majorRemaining}/{bag.majorTotal} 大獎
                                </span>
                              )}
                            </td>

                            {/* 操作 */}
                            <td className="py-3 px-3 text-right">
                              {isVoided ? (
                                <span className="text-[11px] text-rose-400 font-semibold">已廢套</span>
                              ) : (
                                <button
                                  onClick={() => setVoidTarget(bag)}
                                  className="text-[11px] px-2.5 py-1 rounded-md bg-rose-950/40 text-rose-300 border border-rose-800/50 hover:bg-rose-900/50 transition"
                                >
                                  廢套下架
                                </button>
                              )}
                            </td>
                          </tr>

                          {/* ── Detail Row: 展開的獎項明細表 ── */}
                          {isExpanded && (
                            <tr className="bg-slate-900/60 border-b border-purple-900/20">
                              <td colSpan={10} className="p-4 pl-12">
                                <div className="bg-slate-950/80 rounded-xl p-4 border border-purple-800/30 space-y-3">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <Sparkles className="w-4 h-4 text-purple-400" />
                                      <span className="font-semibold text-slate-200 text-xs">
                                        【#{bag.id} {bag.name}】獎項清單明細 (共 {bag.prizes.length} 項)
                                      </span>
                                    </div>
                                    <span className="text-[11px] text-slate-400">
                                      點擊品名、貨號、點數或抽數直接編輯
                                    </span>
                                  </div>

                                  {/* 獎項表格 */}
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs">
                                      <thead>
                                        <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                                          <th className="py-2 px-2 w-16">代碼</th>
                                          <th className="py-2 px-2 w-24">實體貨號</th>
                                          <th className="py-2 px-2 min-w-[200px]">獎項品名</th>
                                          <th className="py-2 px-2 w-20">點數</th>
                                          <th className="py-2 px-2 w-20">總抽數</th>
                                          <th className="py-2 px-2 w-20">已抽數</th>
                                          <th className="py-2 px-2 w-28">殘賞狀態</th>
                                          <th className="py-2 px-2 w-32 text-right">快捷操作</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-800/40">
                                        {bag.prizes.map((p: any) => (
                                          <tr
                                            key={p.id}
                                            className={`hover:bg-slate-900/50 transition ${
                                              p.isDrawn ? 'opacity-60 bg-slate-900/20' : ''
                                            }`}
                                          >
                                            {/* 獎項代碼 */}
                                            <td className="py-2 px-2 font-mono">
                                              <InlineCell
                                                value={p.prizeCode || p.prizeGrade}
                                                type="text"
                                                onSave={(newVal) =>
                                                  handleUpdatePrize(p.id, bag.id, 'prizeCode', newVal)
                                                }
                                              />
                                            </td>

                                            {/* 實體貨號 */}
                                            <td className="py-2 px-2 font-mono text-slate-300">
                                              <InlineCell
                                                value={p.itemNo || p.productId || ''}
                                                type="text"
                                                onSave={(newVal) =>
                                                  handleUpdatePrize(p.id, bag.id, 'productId', newVal)
                                                }
                                              />
                                            </td>

                                            {/* 獎項品名 */}
                                            <td className="py-2 px-2">
                                              <InlineCell
                                                value={p.prizeName}
                                                type="text"
                                                isBold={p.isMajor}
                                                onSave={(newVal) =>
                                                  handleUpdatePrize(p.id, bag.id, 'prizeName', newVal)
                                                }
                                              />
                                            </td>

                                            {/* 點數 */}
                                            <td className="py-2 px-2 font-mono">
                                              <InlineCell
                                                value={p.points}
                                                type="number"
                                                suffix=" pt"
                                                onSave={(newVal) =>
                                                  handleUpdatePrize(p.id, bag.id, 'points', newVal)
                                                }
                                              />
                                            </td>

                                            {/* 總抽數 */}
                                            <td className="py-2 px-2 font-mono">
                                              <InlineCell
                                                value={p.draws}
                                                type="number"
                                                onSave={(newVal) =>
                                                  handleUpdatePrize(p.id, bag.id, 'draws', newVal)
                                                }
                                              />
                                            </td>

                                            {/* 已抽數 */}
                                            <td className="py-2 px-2 font-mono">
                                              <InlineCell
                                                value={p.drawnCount}
                                                type="number"
                                                onSave={(newVal) =>
                                                  handleUpdatePrize(p.id, bag.id, 'drawnCount', newVal)
                                                }
                                              />
                                            </td>

                                            {/* 殘賞狀態徽章 */}
                                            <td className="py-2 px-2">
                                              {p.isDrawn ? (
                                                <span className="px-2 py-0.5 rounded text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                                  ❌ 已開出
                                                </span>
                                              ) : (
                                                <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                                  🎯 剩 {p.remaining} 抽
                                                </span>
                                              )}
                                            </td>

                                            {/* 快捷操作 */}
                                            <td className="py-2 px-2 text-right">
                                              <div className="flex items-center justify-end gap-1.5">
                                                <button
                                                  onClick={() => handleTogglePrize(p.id)}
                                                  className={`px-2 py-0.5 rounded text-[10px] transition font-medium ${
                                                    p.isDrawn
                                                      ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                                      : 'bg-purple-600/30 text-purple-200 border border-purple-500/30 hover:bg-purple-600/50'
                                                  }`}
                                                >
                                                  {p.isDrawn ? '復原在籤' : '標記開出'}
                                                </button>
                                                <button
                                                  onClick={() => handleDeletePrize(p.id)}
                                                  className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition"
                                                  title="刪除獎項"
                                                >
                                                  <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                              </div>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>

                                  {/* 快速新增大獎列 */}
                                  <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-2">
                                    <span className="text-[11px] text-purple-300 font-semibold flex items-center gap-1">
                                      <Plus className="w-3.5 h-3.5" /> 新增獎項：
                                    </span>
                                    <input
                                      type="text"
                                      placeholder="代號 (如 1/A)"
                                      value={newPrizeForms[bag.id]?.code ?? '大獎'}
                                      onChange={(e) =>
                                        setNewPrizeForms((prev) => ({
                                          ...prev,
                                          [bag.id]: { ...(prev[bag.id] || { code: '大獎', name: '', itemNo: '', points: 100, draws: 1 }), code: e.target.value },
                                        }))
                                      }
                                      className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs w-20 text-slate-200"
                                    />
                                    <input
                                      type="text"
                                      placeholder="品名 (如 景品公仔)"
                                      value={newPrizeForms[bag.id]?.name ?? ''}
                                      onChange={(e) =>
                                        setNewPrizeForms((prev) => ({
                                          ...prev,
                                          [bag.id]: { ...(prev[bag.id] || { code: '大獎', name: '', itemNo: '', points: 100, draws: 1 }), name: e.target.value },
                                        }))
                                      }
                                      className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs w-48 text-slate-200"
                                    />
                                    <input
                                      type="text"
                                      placeholder="貨號 (如 2852)"
                                      value={newPrizeForms[bag.id]?.itemNo ?? ''}
                                      onChange={(e) =>
                                        setNewPrizeForms((prev) => ({
                                          ...prev,
                                          [bag.id]: { ...(prev[bag.id] || { code: '大獎', name: '', itemNo: '', points: 100, draws: 1 }), itemNo: e.target.value },
                                        }))
                                      }
                                      className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs w-24 text-slate-200"
                                    />
                                    <input
                                      type="number"
                                      placeholder="點數"
                                      value={newPrizeForms[bag.id]?.points ?? 100}
                                      onChange={(e) =>
                                        setNewPrizeForms((prev) => ({
                                          ...prev,
                                          [bag.id]: { ...(prev[bag.id] || { code: '大獎', name: '', itemNo: '', points: 100, draws: 1 }), points: Number(e.target.value) || 0 },
                                        }))
                                      }
                                      className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs w-16 text-slate-200"
                                    />
                                    <input
                                      type="number"
                                      placeholder="籤數"
                                      value={newPrizeForms[bag.id]?.draws ?? 1}
                                      onChange={(e) =>
                                        setNewPrizeForms((prev) => ({
                                          ...prev,
                                          [bag.id]: { ...(prev[bag.id] || { code: '大獎', name: '', itemNo: '', points: 100, draws: 1 }), draws: Number(e.target.value) || 1 },
                                        }))
                                      }
                                      className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs w-14 text-slate-200"
                                    />
                                    <button
                                      onClick={() => handleAddPrize(bag.id)}
                                      className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-xs font-medium transition flex items-center gap-1 shadow"
                                    >
                                      <Plus className="w-3.5 h-3.5" /> 加入獎項
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 頁籤 2：利潤損平試算器 (Simulator) ── */}
      {activeTab === 'simulator' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4 bg-slate-800/40 p-5 rounded-2xl border border-slate-700/60">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Calculator className="w-5 h-5 text-purple-400" />
              開套獎項與成本規劃 (試算輸入)
            </h2>

            <div>
              <label className="text-xs text-slate-300 block mb-1">單抽預計定價 (NT$)</label>
              <input
                type="number"
                value={simUnitPrice}
                onChange={(e) => setSimUnitPrice(Number(e.target.value) || 0)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white font-mono focus:ring-1 focus:ring-purple-400"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs text-slate-400">
                <span>獎項清單配置</span>
                <button
                  type="button"
                  onClick={() =>
                    setSimPrizes([
                      ...simPrizes,
                      { grade: 'D', name: '新增獎項', cost: 300, draws: 1 },
                    ])
                  }
                  className="text-purple-400 hover:text-purple-300 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> 增加賞項
                </button>
              </div>

              {simPrizes.map((p, idx) => (
                <div key={idx} className="flex gap-2 items-center bg-slate-900/60 p-2.5 rounded-lg border border-slate-700/50">
                  <input
                    type="text"
                    value={p.grade}
                    placeholder="賞級"
                    onChange={(e) => {
                      const next = [...simPrizes];
                      next[idx].grade = e.target.value;
                      setSimPrizes(next);
                    }}
                    className="w-16 bg-slate-800 border border-slate-700 rounded p-1.5 text-xs text-white uppercase text-center font-bold"
                  />
                  <input
                    type="text"
                    value={p.name}
                    placeholder="獎品名稱"
                    onChange={(e) => {
                      const next = [...simPrizes];
                      next[idx].name = e.target.value;
                      setSimPrizes(next);
                    }}
                    className="flex-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-xs text-white"
                  />
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-500">進價$</span>
                    <input
                      type="number"
                      value={p.cost}
                      onChange={(e) => {
                        const next = [...simPrizes];
                        next[idx].cost = Number(e.target.value) || 0;
                        setSimPrizes(next);
                      }}
                      className="w-20 bg-slate-800 border border-slate-700 rounded p-1.5 text-xs text-white font-mono"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-500">籤數</span>
                    <input
                      type="number"
                      value={p.draws}
                      onChange={(e) => {
                        const next = [...simPrizes];
                        next[idx].draws = Number(e.target.value) || 0;
                        setSimPrizes(next);
                      }}
                      className="w-16 bg-slate-800 border border-slate-700 rounded p-1.5 text-xs text-white font-mono"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setSimPrizes(simPrizes.filter((_, i) => i !== idx))}
                    className="text-slate-500 hover:text-rose-400 p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={handleSimulate}
              disabled={simLoading}
              className="w-full bg-purple-600 hover:bg-purple-500 text-white font-semibold py-2.5 rounded-xl transition text-xs shadow-lg"
            >
              {simLoading ? '試算中...' : '即時執行損平與利潤試算'}
            </button>
          </div>

          {/* 試算結果面板 */}
          <div className="space-y-4">
            {simResult ? (
              <div className="bg-slate-800/40 p-5 rounded-2xl border border-slate-700/60 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  試算結果與財務防線指標
                </h3>

                <div className={`p-3 rounded-xl border text-xs font-semibold ${
                  simResult.canOpenSet
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}>
                  {simResult.validationMessage}
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                    <div className="text-slate-400 mb-0.5">預估毛利率</div>
                    <div className="text-xl font-bold font-mono text-purple-400">{simResult.marginRate}%</div>
                  </div>
                  <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                    <div className="text-slate-400 mb-0.5">保本抽數 (損平點)</div>
                    <div className="text-xl font-bold font-mono text-amber-400">{simResult.breakevenDraws} <span className="text-xs font-normal">/ {simResult.totalDraws} 抽</span></div>
                  </div>
                  <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                    <div className="text-slate-400 mb-0.5">總成本支出</div>
                    <div className="text-base font-bold font-mono text-slate-200">${simResult.totalCost.toLocaleString()}</div>
                  </div>
                  <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                    <div className="text-slate-400 mb-0.5">完售毛利預估</div>
                    <div className="text-base font-bold font-mono text-emerald-400">${simResult.grossProfit.toLocaleString()}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-800/40 p-8 rounded-2xl border border-slate-700/60 text-center text-slate-400 text-xs">
                點擊「即時執行損平與利潤試算」查看財務風險評估
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 頁籤 3：開新套上架精靈 (Create Set) ── */}
      {activeTab === 'create' && (
        <div className="max-w-2xl mx-auto bg-slate-800/40 p-6 rounded-2xl border border-slate-700/60 space-y-5">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Gift className="w-5 h-5 text-purple-400" />
              開套上架精靈 (新福袋建置)
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              支援單品快速開套（自動配置非GK安慰獎）或多賞一番賞開套。
            </p>
          </div>

          <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
            {createError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 font-semibold">
                {createError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-300 block mb-1">上架門市</label>
                <select
                  value={storeId}
                  onChange={(e) => setStoreId(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white"
                >
                  <option value="chupei">竹北旗艦店</option>
                  <option value="jinshan">金山概念店</option>
                </select>
              </div>
              <div>
                <label className="text-slate-300 block mb-1">開套模式</label>
                <select
                  value={openMode}
                  onChange={(e) => setOpenMode(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white"
                >
                  <option value="SINGLE">單品快速開套 (單大獎 + 非GK)</option>
                  <option value="MULTI">多賞一番賞開套</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-slate-300 block mb-1">套組/商品名稱</label>
              <input
                type="text"
                value={singleItemName}
                onChange={(e) => setSingleItemName(e.target.value)}
                placeholder="例如：神隱卡西法1.0(紅)"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-300 block mb-1">商品貨號 (條碼)</label>
                <input
                  type="text"
                  value={singleItemNo}
                  onChange={(e) => setSingleItemNo(e.target.value)}
                  placeholder="例如：2852"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white"
                />
              </div>
              <div>
                <label className="text-slate-300 block mb-1">總籤數 (抽數)</label>
                <input
                  type="number"
                  value={singleTotalDraws}
                  onChange={(e) => setSingleTotalDraws(Number(e.target.value) || 0)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-300 block mb-1">建議單抽售價 (NT$)</label>
                <input
                  type="number"
                  value={singleSuggestedPrice}
                  onChange={(e) => setSingleSuggestedPrice(Number(e.target.value) || 0)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-mono"
                />
              </div>
              <div>
                <label className="text-slate-300 block mb-1">實際單抽定價 (NT$)</label>
                <input
                  type="number"
                  value={singleActualPrice}
                  onChange={(e) => setSingleActualPrice(Number(e.target.value) || 0)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={createLoading}
              className="w-full bg-purple-600 hover:bg-purple-500 text-white font-semibold py-3 rounded-xl transition text-xs shadow-lg mt-2"
            >
              {createLoading ? '上架中...' : '確認開套並上架至在線看板'}
            </button>
          </form>
        </div>
      )}

      {/* ── 中途廢套防呆 Modal ── */}
      {voidTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2 text-rose-400">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="font-bold text-white text-base">中途廢套與庫存回流確認</h3>
              </div>
              <button onClick={() => setVoidTarget(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-300 space-y-2 bg-slate-800/40 p-3.5 rounded-xl border border-slate-700/60">
              <div><span className="text-slate-500">套組編號：</span>#{voidTarget.id}</div>
              <div><span className="text-slate-500">套組名稱：</span>{voidTarget.name}</div>
              <div><span className="text-slate-500">門市：</span>{voidTarget.storeId === 'jinshan' ? '金山概念店' : '竹北旗艦店'}</div>
              <div>
                <span className="text-slate-500">抽況：</span>
                已抽 {voidTarget.drawnCount} / {voidTarget.totalDraws} 抽 (殘賞 {voidTarget.remainingDraws} 抽)
              </div>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-[11px] text-amber-200">
              ⚠️ 廢套後，尚未抽出的實體大獎將依編號順序「自動退回一般商品庫存」，並寫入會計作廢紀錄與防死鎖審計日誌。
            </div>

            <form onSubmit={handleVoidSubmit} className="space-y-3">
              <div>
                <label className="text-xs text-slate-300 block mb-1">廢套原因備註</label>
                <input
                  type="text"
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="例如：檔期結束撤套、大獎提早出清"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-white"
                  required
                />
              </div>

              {voidError && (
                <div className="p-2.5 rounded bg-rose-500/20 text-rose-300 text-xs">{voidError}</div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setVoidTarget(null)}
                  className="px-4 py-2 rounded-xl text-xs bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={voidLoading}
                  className="px-4 py-2 rounded-xl text-xs bg-rose-600 hover:bg-rose-500 text-white font-semibold transition"
                >
                  {voidLoading ? '處理中...' : '確認執行廢套下架'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
