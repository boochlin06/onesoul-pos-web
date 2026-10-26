import React, { useEffect, useState } from 'react';
import { settingsApi, storesApi } from '../api/client';
import { OneClickMigrationPanel } from '../components/OneClickMigrationPanel';
import { useTheme, BRAND_COLORS, BrandColor } from '../context/ThemeContext';
import { 
  Settings, 
  Store, 
  Plus, 
  Trash2, 
  Edit3, 
  Save, 
  CheckCircle2, 
  AlertTriangle,
  Building2,
  Clock,
  MessageSquare,
  Trello,
  Radio,
  X,
  Sparkles,
  Sun,
  Moon,
  Palette,
  Check,
  Coins
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { theme, setTheme, brandColor, setBrandColor } = useTheme();

  // ── 店家品牌設定 ──
  const [brandName, setBrandName] = useState('OneSoul 模型一番賞');
  const [brandSubtitle, setBrandSubtitle] = useState('門市管理與營運系統');
  const [logoText, setLogoText] = useState('OS');
  const [supportPhone, setSupportPhone] = useState('0912-345-678');
  const [brandSaving, setBrandSaving] = useState(false);
  const [brandSaved, setBrandSaved] = useState(false);
  const [blindBoxPointsValue, setBlindBoxPointsValue] = useState<number>(10);
  const [pointRateTwd, setPointRateTwd] = useState<number>(20);
  const [smallPrizePointsValue, setSmallPrizePointsValue] = useState<number>(1);

  // ── 門市擴增管理 (上限 5 間) ──
  const [stores, setStores] = useState<any[]>([]);
  const [storesLoading, setStoresLoading] = useState(false);
  const [editingStore, setEditingStore] = useState<any | null>(null);
  const [newStoreModalOpen, setNewStoreModalOpen] = useState(false);
  const [newStoreName, setNewStoreName] = useState('');
  const [newStoreCode, setNewStoreCode] = useState('');
  const [newStoreOpenTime, setNewStoreOpenTime] = useState('14:00');
  const [newStoreCreating, setNewStoreCreating] = useState(false);
  const [storeFeedback, setStoreFeedback] = useState<string | null>(null);

  // ── LINE 設定 ──
  const [lineToken, setLineToken] = useState('');
  const [lineAdminId, setLineAdminId] = useState('');
  const [lineSaving, setLineSaving] = useState(false);
  const [lineSaved, setLineSaved] = useState(false);

  // ── Trello 設定 ──
  const [trelloKey, setTrelloKey] = useState('');
  const [trelloToken, setTrelloToken] = useState('');
  const [trelloListId, setTrelloListId] = useState('');
  const [trelloSaving, setTrelloSaving] = useState(false);
  const [trelloSaved, setTrelloSaved] = useState(false);

  // ── 緊急公告 ──
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeContent, setNoticeContent] = useState('');
  const [noticeLevel, setNoticeLevel] = useState<'INFO' | 'WARNING' | 'CRITICAL'>('WARNING');
  const [publishing, setPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [activeNotices, setActiveNotices] = useState<any[]>([]);

  useEffect(() => {
    loadAllSettings();
  }, []);

  const loadAllSettings = async () => {
    setStoresLoading(true);
    try {
      const [brandRes, storesRes, cfgRes, noticesRes] = await Promise.all([
        settingsApi.getBrand(),
        storesApi.list(),
        settingsApi.getIntegrations(),
        settingsApi.getNotices(),
      ]);

      if (brandRes.success && brandRes.data) {
        setBrandName(brandRes.data.brandName || 'OneSoul 模型一番賞');
        setBrandSubtitle(brandRes.data.brandSubtitle || '門市管理與營運系統');
        setLogoText(brandRes.data.logoText || 'OS');
        setSupportPhone(brandRes.data.supportPhone || '0912-345-678');
        if (brandRes.data.primaryColor && brandRes.data.primaryColor in BRAND_COLORS) {
          setBrandColor(brandRes.data.primaryColor as BrandColor);
        }
        setBlindBoxPointsValue(brandRes.data.blindBoxPointsValue || 10);
        setPointRateTwd(brandRes.data.pointRateTwd || 20);
        setSmallPrizePointsValue(brandRes.data.smallPrizePointsValue || 1);
      }

      if (storesRes.success) {
        setStores(storesRes.data || []);
      }

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
    } finally {
      setStoresLoading(false);
    }
  };

  const showStoreMessage = (msg: string) => {
    setStoreFeedback(msg);
    setTimeout(() => setStoreFeedback(null), 3000);
  };

  // 儲存店家品牌資訊
  const handleSaveBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    setBrandSaving(true);
    setBrandSaved(false);
    try {
      const res = await settingsApi.updateBrand({
        brandName,
        brandSubtitle,
        logoText,
        supportPhone,
        primaryColor: brandColor,
        blindBoxPointsValue: Number(blindBoxPointsValue) || 10,
        pointRateTwd: Number(pointRateTwd) || 20,
        smallPrizePointsValue: Number(smallPrizePointsValue) || 1,
      });
      if (res.success) {
        setBrandSaved(true);
        setTimeout(() => setBrandSaved(false), 3000);
      }
    } catch (err: any) {
      alert(`儲存品牌資訊失敗: ${err.message || '未知錯誤'}`);
    } finally {
      setBrandSaving(false);
    }
  };

  // 新增門市分店 (嚴格上限 5 間)
  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (stores.length >= 5) {
      alert('⚠️ 已達門市擴增上限 (最多 5 間分店)！');
      return;
    }
    if (!newStoreName.trim()) {
      alert('請輸入門市名稱');
      return;
    }

    setNewStoreCreating(true);
    try {
      const res = await storesApi.create({
        name: newStoreName.trim(),
        code: newStoreCode.trim() || undefined,
        openTime: newStoreOpenTime,
      });
      if (res.success) {
        showStoreMessage(`🎉 ${res.message || '門市新增成功'}`);
        setNewStoreModalOpen(false);
        setNewStoreName('');
        setNewStoreCode('');
        loadAllSettings();
      }
    } catch (err: any) {
      alert(`新增門市失敗: ${err.message || '未知錯誤'}`);
    } finally {
      setNewStoreCreating(false);
    }
  };

  // 編輯門市主檔
  const handleUpdateStore = async (storeId: string, updatedData: any) => {
    try {
      const res = await storesApi.update(storeId, updatedData);
      if (res.success) {
        showStoreMessage(`✅ 門市「${res.data?.name || storeId}」資料已更新`);
        setEditingStore(null);
        loadAllSettings();
      }
    } catch (err: any) {
      alert(`更新門市失敗: ${err.message || '未知錯誤'}`);
    }
  };

  // 刪除門市 (至少保留 1 間)
  const handleDeleteStore = async (store: any) => {
    if (stores.length <= 1) {
      alert('⚠️ 無法刪除：系統中必須至少保留 1 間門市！');
      return;
    }
    if (!window.confirm(`確定要刪除/關閉門市「${store.name}」嗎？\n此操作將在審計日誌中留存記錄。`)) {
      return;
    }

    try {
      const res = await storesApi.delete(store.id);
      if (res.success) {
        showStoreMessage(`門市「${store.name}」已成功移除`);
        loadAllSettings();
      }
    } catch (err: any) {
      alert(`刪除門市失敗: ${err.message || '未知錯誤'}`);
    }
  };

  // 儲存 LINE
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

  // 儲存 Trello
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

  return (
    <div className="space-y-6">
      {/* ── 頂部標題 ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-amber-400" />
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              店家品牌與門市管理
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                按需輕量架構 · 支援1至5店
              </span>
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            預設單一門市模式，支援客製化品牌店名與一鍵擴增至最多 5 間分店，無背景常駐連線消耗。
          </p>
        </div>

        {storeFeedback && (
          <div className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            <span>{storeFeedback}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* ── 左側：門市管理 (8 欄 · 預設單店，最多擴增至 5 間) ── */}
        <div className="lg:col-span-7 space-y-6">
          
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Store className="w-4 h-4 text-emerald-400" />
                  門市清單與分店擴增 ({stores.length}/5 間)
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {stores.length <= 1
                    ? '當前為「單一門市模式」，全站介面簡約直觀，隱藏多餘跨店欄位。'
                    : `已啟用連鎖多店模式 (共 ${stores.length} 間門市，上限 5 間)。`}
                </p>
              </div>

              <button
                onClick={() => setNewStoreModalOpen(true)}
                disabled={stores.length >= 5}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow transition disabled:opacity-40 disabled:cursor-not-allowed"
                title={stores.length >= 5 ? '已達 5 間門市上限' : '新增分店門市'}
              >
                <Plus className="w-3.5 h-3.5" />
                新增門市分店
              </button>
            </div>

            {/* 門市卡片清單 */}
            <div className="space-y-2.5">
              {stores.map((s, idx) => (
                <div
                  key={s.id}
                  className="bg-slate-800/60 hover:bg-slate-800 border border-slate-700/80 p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-900 text-amber-400 font-bold border border-slate-700">
                        分店 #{idx + 1}
                      </span>
                      <span className="text-xs font-bold text-white">{s.name}</span>
                      <span className="text-[11px] font-mono text-slate-400">({s.code || s.id})</span>
                      {stores.length === 1 && (
                        <span className="text-[9px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/30">
                          主要門市
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 flex items-center gap-3">
                      <span>營業開門: {s.openTime || '14:00'}</span>
                      <span>標準工時: {s.standardHours || 8}h</span>
                      <span>遲到寬限: {s.lateGraceMinutes || 15}m</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:shrink-0">
                    <button
                      onClick={() => setEditingStore(s)}
                      className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium rounded-lg transition"
                    >
                      修改
                    </button>
                    {stores.length > 1 && (
                      <button
                        onClick={() => handleDeleteStore(s)}
                        className="p-1.5 hover:bg-rose-950/40 text-slate-500 hover:text-rose-400 rounded-lg transition"
                        title="移除此分店"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 外部整合 (LINE / Trello) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <MessageSquare className="w-4 h-4 text-emerald-400" />
              外部推播與看板連動 (按需觸發)
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* LINE Notify */}
              <form onSubmit={handleSaveLine} className="bg-slate-800/40 p-3.5 rounded-xl border border-slate-700/60 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">LINE Notify 群組推播</span>
                  {lineSaved && <span className="text-[10px] text-emerald-400">已儲存</span>}
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Notify Token</label>
                  <input
                    type="password"
                    value={lineToken}
                    onChange={(e) => setLineToken(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">群組 ID (Admin Target ID)</label>
                  <input
                    type="text"
                    value={lineAdminId}
                    onChange={(e) => setLineAdminId(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-white outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={lineSaving}
                  className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition"
                >
                  {lineSaving ? '儲存中...' : '儲存 LINE 設定'}
                </button>
              </form>

              {/* Trello 連動 */}
              <form onSubmit={handleSaveTrello} className="bg-slate-800/40 p-3.5 rounded-xl border border-slate-700/60 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Trello GK 卡片連動</span>
                  {trelloSaved && <span className="text-[10px] text-blue-400">已儲存</span>}
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">API Key</label>
                  <input
                    type="password"
                    value={trelloKey}
                    onChange={(e) => setTrelloKey(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">List ID</label>
                  <input
                    type="text"
                    value={trelloListId}
                    onChange={(e) => setTrelloListId(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-white outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={trelloSaving}
                  className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition"
                >
                  {trelloSaving ? '儲存中...' : '儲存 Trello 設定'}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* ── 右側：系統主題與店家品牌 (5 欄) ── */}
        <div className="lg:col-span-5 space-y-6">

          {/* 系統色系與外觀主題 */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Palette className="w-4 h-4 text-indigo-400" />
                系統色系與顯示模式
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                提供「白天明亮」與「夜晚深色」雙色系即時切換，全站元件無縫自適應。
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* 白天明亮模式 */}
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between gap-3 cursor-pointer ${
                  theme === 'light'
                    ? 'bg-amber-500/10 border-amber-500/60 ring-2 ring-amber-500/40 shadow-sm'
                    : 'bg-slate-800/40 border-slate-700/60 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Sun className={`w-5 h-5 ${theme === 'light' ? 'text-amber-500' : 'text-slate-400'}`} />
                  {theme === 'light' && (
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm" />
                  )}
                </div>
                <div>
                  <div className="text-xs font-bold text-white mb-0.5">☀️ 白天明亮模式</div>
                  <div className="text-[10px] text-slate-400 leading-relaxed">
                    高對比清晰白底，適合日間採光與試算表密集輸入。
                  </div>
                </div>
              </button>

              {/* 夜晚深色模式 */}
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between gap-3 cursor-pointer ${
                  theme === 'dark'
                    ? 'bg-indigo-500/15 border-indigo-500/60 ring-2 ring-indigo-500/40 shadow-sm'
                    : 'bg-slate-800/40 border-slate-700/60 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Moon className={`w-5 h-5 ${theme === 'dark' ? 'text-indigo-400' : 'text-slate-400'}`} />
                  {theme === 'dark' && (
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 shadow-sm" />
                  )}
                </div>
                <div>
                  <div className="text-xs font-bold text-white mb-0.5">🌙 夜晚深色模式</div>
                  <div className="text-[10px] text-slate-400 leading-relaxed">
                    經典深邃黑底，弱光夜間護眼，低功耗沉浸式體驗。
                  </div>
                </div>
              </button>
            </div>

            {/* 品牌識別主色 Token (Accent Color) */}
            <div className="pt-3 border-t border-slate-800">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-brand-500" />
                  品牌識別主色 (Theme Accent Token)
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  當前：{BRAND_COLORS[brandColor]?.label}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mb-2 leading-relaxed">
                全站按鈕、重點數值、選中光暈與徽章皆即時動態套用，亦可儲存至店家主檔。
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {Object.values(BRAND_COLORS).map((c) => {
                  const isSelected = brandColor === c.key;
                  return (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => setBrandColor(c.key)}
                      className={`p-2 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer relative ${
                        isSelected
                          ? 'border-white/80 ring-2 ring-brand-500 bg-slate-800 shadow-md scale-105'
                          : 'border-slate-800 bg-slate-800/40 hover:border-slate-700'
                      }`}
                      title={`${c.label} (${c.subLabel})`}
                    >
                      <span
                        className="w-5 h-5 rounded-full shadow-inner flex items-center justify-center transition-transform"
                        style={{ backgroundColor: c.hex }}
                      >
                        {isSelected && <Check className="w-3 h-3 text-white stroke-[3]" />}
                      </span>
                      <span className="text-[10px] font-bold text-slate-200 truncate w-full text-center">
                        {c.label.slice(0, 4)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                店家品牌與白標客製
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                支援快速推給其他店家，更換店名與 Logo 縮寫，開箱即用。
              </p>
            </div>

            <form onSubmit={handleSaveBrand} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  店家品牌名稱
                </label>
                <input
                  type="text"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white font-bold outline-none focus:border-amber-400"
                  placeholder="例如: 西門町極限玩具一番賞"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  系統副標題 / 標語
                </label>
                <input
                  type="text"
                  value={brandSubtitle}
                  onChange={(e) => setBrandSubtitle(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-amber-400"
                  placeholder="例如: 門市管理與營運系統"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Logo 縮寫 (2~3字)
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    value={logoText}
                    onChange={(e) => setLogoText(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs font-mono font-bold text-center text-amber-300 outline-none"
                    placeholder="如 XM / OS"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    客服/統編電話
                  </label>
                  <input
                    type="text"
                    value={supportPhone}
                    onChange={(e) => setSupportPhone(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs font-mono text-white outline-none"
                    placeholder="0912-345-678"
                  />
                </div>
              </div>

              {/* 一番賞小賞兌點規則與點數匯率 */}
              <div className="pt-3 border-t border-slate-800">
                <div className="flex items-center gap-1.5 mb-2">
                  <Coins className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-xs font-bold text-white">一番賞小賞兌點規則與點數匯率</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      X 賞盲盒等價點數 (pts)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={blindBoxPointsValue}
                      onChange={(e) => setBlindBoxPointsValue(Number(e.target.value))}
                      className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs font-mono font-bold text-amber-400 outline-none focus:border-amber-400"
                      placeholder="10"
                    />
                    <span className="text-[10px] text-slate-500 mt-0.5 block">抽中 X 賞若不帶走，換得點數</span>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      點數現金匯率 (元/點)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={pointRateTwd}
                      onChange={(e) => setPointRateTwd(Number(e.target.value))}
                      className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs font-mono font-bold text-emerald-400 outline-none focus:border-amber-400"
                      placeholder="20"
                    />
                    <span className="text-[10px] text-slate-500 mt-0.5 block">目前 1 點 = NT$ 20 元</span>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      Z 賞小賞等價點數 (pts)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={smallPrizePointsValue}
                      onChange={(e) => setSmallPrizePointsValue(Number(e.target.value))}
                      className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-300 outline-none focus:border-amber-400"
                      placeholder="1"
                    />
                    <span className="text-[10px] text-slate-500 mt-0.5 block">抽中 Z 賞若不帶走，換得 1 點</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                {brandSaved && (
                  <span className="text-xs text-emerald-400 flex items-center gap-1 font-semibold">
                    <CheckCircle2 className="w-4 h-4" /> 品牌資訊已更新！
                  </span>
                )}
                <button
                  type="submit"
                  disabled={brandSaving}
                  className="ml-auto px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl shadow transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  {brandSaving ? '儲存中...' : '儲存店家品牌'}
                </button>
              </div>
            </form>
          </div>

          {/* 舊資料全量遷移面板 */}
          <OneClickMigrationPanel />
        </div>
      </div>

      {/* ── 新增門市 Modal ── */}
      {newStoreModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Store className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">新增門市分店 ({stores.length + 1}/5 間)</h3>
              </div>
              <button onClick={() => setNewStoreModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateStore} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  門市名稱 *
                </label>
                <input
                  type="text"
                  required
                  value={newStoreName}
                  onChange={(e) => setNewStoreName(e.target.value)}
                  placeholder="例如: 台北西門店、中壢站前店..."
                  className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white font-bold outline-none focus:border-emerald-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  門市代碼 (英數)
                </label>
                <input
                  type="text"
                  value={newStoreCode}
                  onChange={(e) => setNewStoreCode(e.target.value)}
                  placeholder="例如: XIMEN、JL..."
                  className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs font-mono text-white outline-none focus:border-emerald-400 uppercase"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  每日營業開始時間
                </label>
                <input
                  type="time"
                  value={newStoreOpenTime}
                  onChange={(e) => setNewStoreOpenTime(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs font-mono text-white outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setNewStoreModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={newStoreCreating}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow transition disabled:opacity-50"
                >
                  {newStoreCreating ? '建立中...' : '確認新增'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 編輯門市 Modal ── */}
      {editingStore && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Store className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">修改門市資料 · {editingStore.name}</h3>
              </div>
              <button onClick={() => setEditingStore(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  門市名稱
                </label>
                <input
                  type="text"
                  value={editingStore.name}
                  onChange={(e) => setEditingStore({ ...editingStore, name: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white font-bold outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  營業時間
                </label>
                <input
                  type="time"
                  value={editingStore.openTime || '14:00'}
                  onChange={(e) => setEditingStore({ ...editingStore, openTime: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs font-mono text-white outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingStore(null)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateStore(editingStore.id, {
                    name: editingStore.name,
                    openTime: editingStore.openTime,
                  })}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow transition"
                >
                  儲存修改
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
