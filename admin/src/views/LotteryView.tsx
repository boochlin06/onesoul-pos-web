import React, { useEffect, useState, useMemo } from 'react';
import { lotteryApi, storesApi } from '../api/client';
import { 
  Gift, 
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
  Flame,
  Snowflake,
  Clock,
  Skull,
  Calendar,
  Settings2,
  SlidersHorizontal,
  ExternalLink
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
          className="bg-slate-900 border border-amber-500 text-amber-200 text-xs rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-amber-400"
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
      <div className="flex items-center gap-1">
        {prefix && <span className="text-slate-400 font-mono text-xs">{prefix}</span>}
        <input
          autoFocus
          type={type}
          value={currentVal}
          onChange={(e) => setCurrentVal(e.target.value)}
          onBlur={handleCommit}
          onKeyDown={handleKeyDown}
          disabled={isSaving}
          className="bg-slate-900 border border-amber-500 text-white text-xs rounded px-1.5 py-0.5 outline-none font-mono focus:ring-1 focus:ring-amber-400 w-24"
        />
        {suffix && <span className="text-slate-400 font-mono text-xs">{suffix}</span>}
      </div>
    );
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      className={`group/cell cursor-pointer flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-800 border border-transparent hover:border-slate-700 transition ${className}`}
      title="點擊直接修改數值"
    >
      <span className={isBold ? 'font-bold' : ''}>
        {prefix}{value}{suffix}
      </span>
      <Edit2 className="w-2.5 h-2.5 text-slate-500 opacity-0 group-hover/cell:opacity-100 transition shrink-0" />
    </div>
  );
};

export const LotteryView: React.FC = () => {
  const [overviewBags, setOverviewBags] = useState<any[]>([]);
  const [metaStats, setMetaStats] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // 門市自適應 (預設單店模式，上限 5 間)
  const [stores, setStores] = useState<Array<{ id: string; name: string }>>([]);

  // ── 頂部精簡篩選器 ──
  const [storeFilter, setStoreFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL'); // 'ALL' | 'GK 雕像' | '海賊王' | '寶可夢' | '火影忍者' | '鬼滅之刃' | '動漫綜合'
  const [thermalFilter, setThermalFilter] = useState<string>('ALL'); // 'ALL' | 'HOT' | 'WARM' | 'FROZEN' | 'DEAD_SET'
  const [sortBy, setSortBy] = useState<string>('launchDate_desc'); // 'launchDate_desc' | 'idle_desc' | 'survival_desc' | 'major_desc' | 'remaining_asc'
  const [searchQuery, setSearchQuery] = useState('');

  // 摺疊/展開的套組 IDs (預設全部展開或首幾套展開)
  const [expandedBagIds, setExpandedBagIds] = useState<Set<string>>(new Set());

  // ── 獎項進階微調 Modal ──
  const [editingBag, setEditingBag] = useState<any | null>(null);
  const [editingPrizes, setEditingPrizes] = useState<any[]>([]);
  const [isSavingPrizes, setIsSavingPrizes] = useState(false);

  // ── 中途廢套 Modal ──
  const [voidTarget, setVoidTarget] = useState<any | null>(null);
  const [voidReason, setVoidReason] = useState('店鋪檔期結束撤套');
  const [voidLoading, setVoidLoading] = useState(false);

  useEffect(() => {
    storesApi.list().then((res) => {
      if (res.success && Array.isArray(res.data)) {
        setStores(res.data);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    loadOverview();
  }, [storeFilter, searchQuery]);

  const loadOverview = async () => {
    setLoading(true);
    try {
      const res = await lotteryApi.overview({
        storeId: storeFilter !== 'ALL' ? storeFilter : undefined,
        filter: 'all',
        search: searchQuery || undefined,
      });

      if (res.success) {
        setOverviewBags(res.data || []);
        if (res.meta) setMetaStats(res.meta);
        // 預設展開全部套組便於老闆一覽抽況
        const allIds = new Set<string>((res.data || []).map((b: any) => String(b.id)));
        setExpandedBagIds(allIds);
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

  // 行內更新套組基本欄位
  const handleUpdateBox = async (bagId: string, field: string, val: any) => {
    try {
      const res = await lotteryApi.updateBox(bagId, { [field]: val });
      if (res.success) {
        showFeedback(`✅ 已成功更新套組 #${bagId}`);
        setOverviewBags((prev) =>
          prev.map((b) => (b.id === bagId ? { ...b, [field]: val } : b))
        );
      }
    } catch (err: any) {
      alert(`更新失敗: ${err.message || '未知錯誤'}`);
    }
  };

  // 執行中途廢套
  const handleExecuteVoid = async () => {
    if (!voidTarget) return;
    setVoidLoading(true);
    try {
      const res = await lotteryApi.voidBox(voidTarget.id, voidReason);
      if (res.success) {
        showFeedback(`🎉 套組 #${voidTarget.id}「${voidTarget.name}」已作廢清台，未抽出之實體商品已全數加回門市庫存！`);
        setVoidTarget(null);
        loadOverview();
      }
    } catch (err: any) {
      alert(`廢套失敗: ${err.message || '未知錯誤'}`);
    } finally {
      setVoidLoading(false);
    }
  };

  // 開啟進階獎項編輯彈窗
  const handleOpenEditPrizesModal = (bag: any) => {
    setEditingBag(bag);
    setEditingPrizes(JSON.parse(JSON.stringify(bag.prizes || [])));
  };

  // 儲存進階獎項修改
  const handleSaveAllPrizes = async () => {
    if (!editingBag) return;
    setIsSavingPrizes(true);
    try {
      for (const p of editingPrizes) {
        await lotteryApi.updatePrize(p.id, {
          prizeGrade: p.prizeGrade,
          prizeCode: p.prizeCode || p.prizeGrade,
          prizeName: p.prizeName,
          draws: Number(p.draws) || 1,
          drawnCount: Number(p.drawnCount) || 0,
          points: Number(p.points) || 0,
          productId: p.productId || null,
        });
      }
      showFeedback(`✅ 套組 #${editingBag.id} 獎項抽況已更新！`);
      setEditingBag(null);
      loadOverview();
    } catch (err: any) {
      alert(`更新獎項失敗: ${err.message || '未知錯誤'}`);
    } finally {
      setIsSavingPrizes(false);
    }
  };

  // ── 客戶端多維度過濾與排序 ──
  const processedBags = useMemo(() => {
    let list = [...overviewBags];

    // 1. 類別過濾
    if (categoryFilter !== 'ALL') {
      list = list.filter((b) => b.category === categoryFilter);
    }

    // 2. 熱度/冰凍狀態快篩
    if (thermalFilter !== 'ALL') {
      list = list.filter((b) => b.thermalStatus === thermalFilter);
    }

    // 3. 排序 (預設: 發布日期)
    list.sort((a, b) => {
      if (sortBy === 'launchDate_desc') {
        const da = new Date(a.launchDate || a.createdAt || 0).getTime();
        const db = new Date(b.launchDate || b.createdAt || 0).getTime();
        return db - da; // 最新在前
      }
      if (sortBy === 'idle_desc') {
        return (b.idleDays || 0) - (a.idleDays || 0); // 冰凍最久在前
      }
      if (sortBy === 'survival_desc') {
        return (b.survivalDays || 0) - (a.survivalDays || 0); // 存活在場最久在前
      }
      if (sortBy === 'major_desc') {
        return (b.majorRemaining || 0) - (a.majorRemaining || 0); // 大獎剩最多在前
      }
      if (sortBy === 'remaining_asc') {
        return (a.remainingDraws || 0) - (b.remainingDraws || 0); // 剩餘最少在前
      }
      return 0;
    });

    return list;
  }, [overviewBags, categoryFilter, thermalFilter, sortBy]);

  // 全域指標統計
  const totalRemainingSum = useMemo(() => {
    return processedBags.reduce((acc, b) => acc + (b.remainingDraws || 0), 0);
  }, [processedBags]);

  return (
    <div className="space-y-4">
      {/* ── 頂部精簡篩選列與戰情工具列 (老闆模式 · 版面最大化) ── */}
      <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl shadow-xl space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          
          {/* 標題與核心戰情小膠囊 */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 mr-2">
              <Gift className="w-5 h-5 text-amber-400" />
              <h1 className="text-base font-bold text-white flex items-center gap-2">
                在場一番賞戰情看板
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  即時抽況監控
                </span>
              </h1>
            </div>

            {/* 戰情膠囊 Chips */}
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
              <span className="px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
                在場 <strong className="text-amber-400">{processedBags.length}</strong> 套
              </span>
              <span className="px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
                在場剩餘 <strong className="text-emerald-400">{totalRemainingSum}</strong> 抽
              </span>
              {metaStats.totalFrozen > 0 && (
                <span className="px-2 py-0.5 rounded-lg bg-blue-950/60 text-blue-300 border border-blue-500/40 flex items-center gap-1">
                  <Snowflake className="w-3 h-3 text-blue-400" />
                  冰凍 {metaStats.totalFrozen} 套
                </span>
              )}
              {metaStats.totalDead > 0 && (
                <span className="px-2 py-0.5 rounded-lg bg-rose-950/60 text-rose-300 border border-rose-500/40 flex items-center gap-1">
                  <Skull className="w-3 h-3 text-rose-400" />
                  死套待清 {metaStats.totalDead} 套
                </span>
              )}
              {metaStats.totalHot > 0 && (
                <span className="px-2 py-0.5 rounded-lg bg-emerald-950/60 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                  <Flame className="w-3 h-3 text-emerald-400" />
                  熱抽 {metaStats.totalHot} 套
                </span>
              )}
            </div>
          </div>

          {/* 搜尋與重新載入 */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜尋套名、公仔或編號..."
                className="pl-8 pr-3 py-1 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 outline-none w-48 sm:w-60 focus:border-amber-400 transition"
              />
            </div>

            <button
              onClick={loadOverview}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition"
              title="重新整理抽況"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* 篩選與排序控制列 (一字排開) */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            
            {/* 門市切換 (多店模式才展示，最多 5 間) */}
            {stores.length > 1 && (
              <div className="flex items-center gap-1 bg-slate-800/80 p-0.5 rounded-xl border border-slate-700">
                {[
                  { id: 'ALL', label: '全門市' },
                  ...stores.map((s) => ({ id: s.id, label: s.name })),
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setStoreFilter(s.id)}
                    className={`px-2.5 py-1 rounded-lg transition font-medium text-[11px] ${
                      storeFilter === s.id ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}

            {/* 題材分類篩選 */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-[11px] rounded-xl px-2.5 py-1 outline-none"
            >
              <option value="ALL">全部題材分類</option>
              <option value="GK 雕像">GK 雕像</option>
              <option value="海賊王">海賊王</option>
              <option value="寶可夢">寶可夢</option>
              <option value="火影忍者">火影忍者</option>
              <option value="鬼滅之刃">鬼滅之刃</option>
              <option value="動漫綜合">動漫綜合</option>
            </select>

            {/* 抽況熱度快篩 Chips */}
            <div className="flex flex-wrap items-center gap-1">
              {[
                { id: 'ALL', label: '全部抽況' },
                { id: 'HOT', label: '🔥 熱抽 (24H)', activeClass: 'bg-emerald-500 text-slate-950' },
                { id: 'WARM', label: '⏳ 平溫 (3~6天)', activeClass: 'bg-slate-700 text-white' },
                { id: 'FROZEN', label: '❄️ 冰凍 (≥7天)', activeClass: 'bg-blue-600 text-white' },
                { id: 'DEAD_SET', label: '☠️ 大賞已光', activeClass: 'bg-rose-600 text-white' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setThermalFilter(item.id)}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition border ${
                    thermalFilter === item.id
                      ? `${item.activeClass || 'bg-amber-500 text-slate-950'} border-transparent`
                      : 'bg-slate-800/60 text-slate-400 border-slate-700/80 hover:text-slate-200'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* 排序方式選單 (預設發布日期) */}
          <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-400">
            <span>排序:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-amber-300 text-[11px] font-bold rounded-xl px-2 py-1 outline-none"
            >
              <option value="launchDate_desc">📅 發布日期 (最新在前 · 預設)</option>
              <option value="idle_desc">❄️ 冰凍天數 (最久沒人抽)</option>
              <option value="survival_desc">⏳ 存活在場 (在場最久)</option>
              <option value="major_desc">🏆 大獎殘餘 (大獎剩最多)</option>
              <option value="remaining_asc">📉 剩餘抽數 (即將完售)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 反饋提示 */}
      {feedbackMsg && (
        <div className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-4 py-2 rounded-xl text-xs flex items-center justify-between shadow">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{feedbackMsg}</span>
          </div>
          <button onClick={() => setFeedbackMsg(null)}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── 在場套組清單 (版面最大化) ── */}
      {loading ? (
        <div className="py-24 text-center text-slate-500 text-xs">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-amber-400 mb-2" />
          載入在場一番賞抽況中...
        </div>
      ) : processedBags.length === 0 ? (
        <div className="py-20 text-center text-slate-500 text-xs bg-slate-900 border border-slate-800 rounded-2xl">
          目前無符合篩選條件之在場一番賞套組
        </div>
      ) : (
        <div className="space-y-3.5">
          {processedBags.map((bag) => {
            const isExpanded = expandedBagIds.has(String(bag.id));
            const isDead = bag.thermalStatus === 'DEAD_SET';
            const isFrozen = bag.thermalStatus === 'FROZEN';
            const isHot = bag.thermalStatus === 'HOT';

            return (
              <div
                key={bag.id}
                className={`bg-slate-900 border rounded-2xl overflow-hidden transition shadow-lg ${
                  isDead
                    ? 'border-rose-500/50 bg-rose-950/10'
                    : isFrozen
                    ? 'border-blue-500/40 hover:border-blue-400/60'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* 套組卡片頭部 (核心戰情報表) */}
                <div className="p-4 bg-slate-850/80 flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800/80">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* 展開/收合按鈕 */}
                      <button
                        onClick={() => toggleExpand(String(bag.id))}
                        className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition"
                      >
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>

                      {/* 門市徽章 (多店模式下展示) */}
                      {stores.length > 1 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full font-mono bg-blue-500/20 text-blue-300 border border-blue-500/30">
                          {stores.find((s) => s.id === bag.storeId)?.name || bag.branch || '門市'}
                        </span>
                      )}

                      {/* 題材分類徽章 */}
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                        {bag.category || '動漫綜合'}
                      </span>

                      {/* 套組編號 */}
                      <span className="text-xs font-mono font-bold text-slate-400">
                        #{bag.id}
                      </span>

                      {/* 套組名稱 (行內可編輯) */}
                      <InlineCell
                        value={bag.name}
                        onSave={(val) => handleUpdateBox(String(bag.id), 'name', val)}
                        className="text-sm font-bold text-white hover:text-amber-300"
                        isBold
                      />

                      {/* 發布日期 */}
                      <span className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        發布: {bag.launchDate || '2026/01/25'}
                      </span>
                    </div>

                    {/* 第二行：存活天數與三段式冰凍警示標籤 */}
                    <div className="flex flex-wrap items-center gap-2 pl-6 pt-1">
                      {/* 存活在場天數 */}
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-indigo-400" />
                        在場 <strong>{bag.survivalDays || 0}</strong> 天
                      </span>

                      {/* 多久沒人玩 (冰凍警示) */}
                      {isDead ? (
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-rose-950 text-rose-300 border border-rose-500/50 flex items-center gap-1 shadow-sm animate-pulse">
                          <Skull className="w-3.5 h-3.5 text-rose-400" />
                          ☠️ 死套/殘包 (大賞全出清 · 建請廢套清台)
                        </span>
                      ) : isFrozen ? (
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-blue-950 text-blue-300 border border-blue-500/50 flex items-center gap-1 shadow-sm">
                          <Snowflake className="w-3.5 h-3.5 text-blue-400" />
                          ❄️ 冰凍 {bag.idleDays} 天無人抽 (停滯滯銷)
                        </span>
                      ) : isHot ? (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-emerald-950 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                          <Flame className="w-3.5 h-3.5 text-emerald-400" />
                          🔥 24H 內熱抽中 (最後抽獎: {bag.idleDays === 0 ? '今日' : `${bag.idleDays}天前`})
                        </span>
                      ) : (
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded-lg bg-slate-800 text-slate-400 border border-slate-700">
                          ⏳ 平溫 (距上次抽 {bag.idleDays} 天)
                        </span>
                      )}

                      {/* 大獎殘留狀態 */}
                      <span className={`text-[11px] font-mono px-2 py-0.5 rounded-lg border ${
                        bag.majorRemaining > 0
                          ? 'bg-amber-950/40 text-amber-300 border-amber-500/30'
                          : 'bg-slate-800 text-slate-500 border-slate-700'
                      }`}>
                        大獎殘存: <strong className={bag.majorRemaining > 0 ? 'text-amber-400' : 'text-slate-500'}>{bag.majorRemaining}</strong> / {bag.majorTotal} 件
                      </span>
                    </div>
                  </div>

                  {/* 右側：單抽價格修改、去化進度與操作按鈕 */}
                  <div className="flex flex-wrap items-center gap-4 lg:shrink-0 pl-6 lg:pl-0">
                    
                    {/* 單抽價 (行內修改) */}
                    <div className="bg-slate-850 p-2 rounded-xl border border-slate-800 text-center">
                      <div className="text-[10px] text-slate-400 font-bold uppercase">單抽售價 (可改)</div>
                      <InlineCell
                        value={bag.unitPrice || 350}
                        type="number"
                        prefix="$"
                        onSave={(val) => handleUpdateBox(String(bag.id), 'unitPrice', val)}
                        className="text-sm font-bold text-amber-300 justify-center"
                        isBold
                      />
                    </div>

                    {/* 去化抽數進度條 */}
                    <div className="w-36 space-y-1">
                      <div className="flex justify-between text-[11px] font-mono">
                        <span className="text-slate-400">抽數去化</span>
                        <span className="text-white font-bold">{bag.drawnCount} / {bag.totalDraws}</span>
                      </div>
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                        <div
                          className={`h-full transition-all ${
                            bag.progressPercent >= 80 ? 'bg-emerald-500' : bag.progressPercent >= 40 ? 'bg-amber-500' : 'bg-indigo-500'
                          }`}
                          style={{ width: `${Math.min(100, bag.progressPercent)}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-right text-slate-400 font-mono">
                        剩餘 <strong className="text-emerald-400">{bag.remainingDraws}</strong> 抽 ({bag.progressPercent}%)
                      </div>
                    </div>

                    {/* 操作按鈕群 (調整獎項 / 廢套清台) */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenEditPrizesModal(bag)}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition"
                        title="開啟完整獎項與抽數調整彈窗"
                      >
                        <Settings2 className="w-3.5 h-3.5 text-indigo-400" />
                        調整獎項
                      </button>

                      <button
                        onClick={() => {
                          setVoidTarget(bag);
                          setVoidReason('店鋪檔期結束撤套');
                        }}
                        className="p-1.5 hover:bg-rose-950/40 text-slate-500 hover:text-rose-400 rounded-xl transition border border-transparent hover:border-rose-500/30"
                        title="中途廢套清台結案 (將剩餘公仔退回門市現貨)"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* 展開之獎項明細抽況九宮格 (Prize Status Grid) */}
                {isExpanded && (
                  <div className="p-4 bg-slate-950/60 border-t border-slate-800/80 space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="font-bold flex items-center gap-1.5 text-slate-300">
                        <Layers className="w-3.5 h-3.5 text-amber-400" />
                        獎項抽況即時明細 ({bag.prizes?.length || 0} 賞)
                      </span>
                      <span className="font-mono text-[11px]">
                        大賞抽況：{bag.majorRemaining > 0 ? `尚餘 ${bag.majorRemaining} 隻大獎` : '全部大賞已出清'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                      {(bag.prizes || []).map((prize: any) => {
                        const isDrawnOut = prize.remaining <= 0;
                        const isZ = prize.prizeGrade === 'Z' || prize.prizeName === '非GK';
                        const isX = prize.prizeGrade === 'X';

                        return (
                          <div
                            key={prize.id}
                            className={`p-2.5 rounded-xl border transition flex flex-col justify-between ${
                              isDrawnOut
                                ? 'bg-slate-900/40 border-slate-800/50 opacity-60'
                                : isZ
                                ? 'bg-emerald-950/20 border-emerald-500/30'
                                : isX
                                ? 'bg-purple-950/20 border-purple-500/30'
                                : 'bg-slate-900 border-slate-700/80 shadow'
                            }`}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded font-mono ${
                                  isZ
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                    : isX
                                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                    : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                }`}>
                                  {prize.prizeGrade || 'A'}賞
                                </span>

                                <span className="text-[10px] font-mono text-slate-400">
                                  {prize.points > 0 ? `${prize.points} pt` : '無點數'}
                                </span>
                              </div>

                              <div className="text-xs font-bold text-white truncate" title={prize.prizeName}>
                                <span className={isDrawnOut ? 'line-through text-slate-500' : ''}>
                                  {prize.prizeName}
                                </span>
                              </div>

                              {prize.productId && (
                                <div className="text-[10px] font-mono text-slate-400">
                                  貨號: {prize.productId}
                                </div>
                              )}
                            </div>

                            <div className="pt-2 mt-2 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono">
                              <span className="text-slate-400">
                                抽況: <strong>{prize.drawnCount || 0}</strong>/{prize.draws}
                              </span>
                              <span className={`font-bold ${isDrawnOut ? 'text-rose-400' : 'text-emerald-400'}`}>
                                {isDrawnOut ? '已全抽出' : `餘 ${prize.remaining} 抽`}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── 獎項進階微調 Modal (Drawer / Dialog) ── */}
      {editingBag && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-850">
              <div className="flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">
                    調整套組獎項與抽數 · #{editingBag.id} {editingBag.name}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    微調各賞代碼、總抽數、已抽數與商品關聯；修改後即時同步至門市資料庫。
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingBag(null)}
                className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="px-2 py-2 w-16 text-center">賞位</th>
                    <th className="px-3 py-2 w-28">商品貨號</th>
                    <th className="px-3 py-2">獎項名稱</th>
                    <th className="px-2 py-2 w-20 text-center">總抽數</th>
                    <th className="px-2 py-2 w-20 text-center">已抽數</th>
                    <th className="px-2 py-2 w-16 text-right">點數</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-200 font-mono">
                  {editingPrizes.map((p, idx) => (
                    <tr key={p.id || idx} className="hover:bg-slate-800/40">
                      <td className="px-2 py-1.5 text-center">
                        <input
                          type="text"
                          value={p.prizeGrade || ''}
                          onChange={(e) => {
                            const copy = [...editingPrizes];
                            copy[idx].prizeGrade = e.target.value;
                            setEditingPrizes(copy);
                          }}
                          className="w-12 text-center bg-slate-800 border border-slate-700 rounded px-1 py-1 font-bold text-amber-300"
                        />
                      </td>

                      <td className="px-2 py-1.5">
                        <input
                          type="text"
                          value={p.productId || ''}
                          onChange={(e) => {
                            const copy = [...editingPrizes];
                            copy[idx].productId = e.target.value;
                            setEditingPrizes(copy);
                          }}
                          placeholder="商品條碼"
                          className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white"
                        />
                      </td>

                      <td className="px-2 py-1.5 font-sans">
                        <input
                          type="text"
                          value={p.prizeName || ''}
                          onChange={(e) => {
                            const copy = [...editingPrizes];
                            copy[idx].prizeName = e.target.value;
                            setEditingPrizes(copy);
                          }}
                          className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white font-medium"
                        />
                      </td>

                      <td className="px-2 py-1.5 text-center">
                        <input
                          type="number"
                          min="1"
                          value={p.draws || 1}
                          onChange={(e) => {
                            const copy = [...editingPrizes];
                            copy[idx].draws = Number(e.target.value) || 1;
                            setEditingPrizes(copy);
                          }}
                          className="w-16 bg-slate-800 border border-slate-700 rounded px-1 py-1 text-center font-bold text-white"
                        />
                      </td>

                      <td className="px-2 py-1.5 text-center">
                        <input
                          type="number"
                          min="0"
                          value={p.drawnCount || 0}
                          onChange={(e) => {
                            const copy = [...editingPrizes];
                            copy[idx].drawnCount = Number(e.target.value) || 0;
                            setEditingPrizes(copy);
                          }}
                          className="w-16 bg-slate-800 border border-slate-700 rounded px-1 py-1 text-center font-bold text-emerald-300"
                        />
                      </td>

                      <td className="px-2 py-1.5 text-right">
                        <input
                          type="number"
                          value={p.points || 0}
                          onChange={(e) => {
                            const copy = [...editingPrizes];
                            copy[idx].points = Number(e.target.value) || 0;
                            setEditingPrizes(copy);
                          }}
                          className="w-14 bg-slate-800 border border-slate-700 rounded px-1 py-1 text-right text-indigo-300"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-900 flex items-center justify-end gap-2">
              <button
                onClick={() => setEditingBag(null)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition"
              >
                取消
              </button>
              <button
                onClick={handleSaveAllPrizes}
                disabled={isSavingPrizes}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow transition disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                {isSavingPrizes ? '儲存中...' : '儲存獎項設定'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 中途廢套清台 Modal ── */}
      {voidTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/50 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-rose-500/20 text-rose-400 rounded-xl">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">確定要作廢清台此套組？</h3>
                <p className="text-xs text-slate-400 mt-1">
                  套組 #{voidTarget.id}「{voidTarget.name}」
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-1 font-mono">
              <div>目前已抽：{voidTarget.drawnCount} / {voidTarget.totalDraws} 抽</div>
              <div>大賞剩餘：{voidTarget.majorRemaining} 件</div>
              <div className="text-amber-300 text-[11px] pt-1 border-t border-slate-800">
                ⚠️ 作廢後，套組內未抽出的實體大獎公仔將原子級加回門市庫存！
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                作廢原因 / 清台理由
              </label>
              <input
                type="text"
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-rose-400"
                placeholder="例如: 檔期結束撤套、死套重配..."
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setVoidTarget(null)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition"
              >
                取消
              </button>
              <button
                onClick={handleExecuteVoid}
                disabled={voidLoading}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow transition disabled:opacity-50"
              >
                {voidLoading ? '處理中...' : '確認作廢清台'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
