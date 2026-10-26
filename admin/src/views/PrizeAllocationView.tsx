import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { allocationApi, inventoryApi, settingsApi } from '../api/client';
import { 
  Gift, 
  Calculator, 
  Plus, 
  Trash2, 
  AlertTriangle, 
  CheckCircle2, 
  X, 
  Store, 
  Layers, 
  Save, 
  Rocket, 
  ArrowRight, 
  Clock, 
  FileSpreadsheet, 
  Coins, 
  Percent, 
  Copy, 
  Boxes, 
  Search, 
  RotateCw, 
  ShieldAlert, 
  Sparkles,
  HelpCircle,
  Hash,
  Pause,
  Play,
  BookmarkCheck,
  Check,
  Info
} from 'lucide-react';

export interface AllocationPrizeItem {
  id: string;
  prizeGrade: string; // '1', '2', 'A', 'B', 'X', 'Z', 'LAST' 等
  prizeName: string;
  productId: string;
  draws: number;
  costPrice: number;
  points: number;
  isNonGk?: boolean;
  isPrizeNameCustomized?: boolean; // 店長是否手動自訂過品名（若已自訂，自動帶入時不抹除備註）
}

export interface SetPlan {
  id: string;
  name: string;
  isNameCustomized?: boolean; // 老闆是否手動自訂過套名（若否，更換大獎時自動更新）
  storeId: string;
  totalDraws: number;
  price1: number;
  price3: number;
  price5: number;
  price10: number;
  isTenPlusOne: boolean;
  targetMargin: number;
  batchCount: number; // 一次開 N 套
  blindBoxPointsValue?: number; // X 賞盲盒等價點數 (預設 10 點)
  isPointsSet?: boolean; // 是否為限定點數套 (只能扣點數抽)
  items: AllocationPrizeItem[];
  isParked?: boolean; // 臨時有事先放著 (掛單暫存狀態)
  lastSavedAt?: string;
}

/** 乾淨剝離商品名稱中的賞級前綴 (不用加入1號賞、A賞等前綴，只保留純商品名稱) */
export function cleanPrizeName(rawName: string): string {
  const name = (rawName || '').trim();
  if (!name) return '';
  return name
    .replace(/^([0-9０-９]+號賞|[0-9０-９]+賞|[A-Za-z]+賞|SP賞|特賞|最後賞|LAST賞|W賞|Z賞|X賞)\s*/i, '')
    .trim() || name;
}

// 向下相容 formatPrizeNameWithGrade：現在一律輸出純商品名稱，不疊加賞級前綴
export function formatPrizeNameWithGrade(_grade: string, prodName: string): string {
  return cleanPrizeName(prodName);
}

/** 尋找套組內排在第 1 個的實體大獎 (1號賞或A賞) 的商品名稱 */
function getTopPrizeName(items: AllocationPrizeItem[]): string | null {
  const topPrize = items.find(
    (it) => !it.isNonGk && it.productId && it.productId !== '0p' && it.prizeName
  );
  if (!topPrize) return null;
  // 去除賞位編號前綴如 "1號賞 "、"A賞 "、"特賞 "、"LAST賞 " 等，直接提取商品本名
  const clean = topPrize.prizeName.replace(/^([0-9]+號賞|[A-Z]賞|特賞|最後賞|LAST賞|SP賞|\b[0-9]+\b|\b[A-Z]\b)\s*/i, '').trim();
  return clean || topPrize.prizeName.trim();
}

/** 貨號即時自動搜尋與 Autocomplete 浮層輸入元件 */
interface ProductAutocompleteInputProps {
  itemId: string;
  prizeGrade: string;
  value: string;
  storeId: string;
  onSelectProduct: (product: any) => void;
  onChangeValue: (val: string) => void;
  onBlur?: () => void;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// 封裝具備 TTL (預設 60 秒) 與 LRU 淘汰機制之安全快取容器，避免過期成本污染
class SafeTtlCache<K, V> {
  private map = new Map<K, CacheEntry<V>>();
  private maxEntries: number;
  private ttlMs: number;

  constructor(maxEntries = 200, ttlMs = 60000) {
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMs;
  }

  get(key: K): V | null {
    const entry = this.map.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.map.delete(key);
      return null;
    }
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.data;
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.maxEntries) {
      const oldestKey = this.map.keys().next().value;
      if (oldestKey) this.map.delete(oldestKey);
    }
    this.map.set(key, { data: value, timestamp: Date.now() });
  }

  clear(): void {
    this.map.clear();
  }
}

export const autocompleteCache = new SafeTtlCache<string, any[]>(200, 60000);

const ProductAutocompleteInput: React.FC<ProductAutocompleteInputProps> = ({
  prizeGrade,
  value,
  storeId,
  onSelectProduct,
  onChangeValue,
  onBlur,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<any>(null);
  const searchRequestIdRef = useRef<number>(0);
  const latestValueRef = useRef<string>(value);

  // 同步最新外部 value，供非同步回調進行防篡改防線校驗
  latestValueRef.current = value;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchProducts = async (q: string) => {
    const trimmed = (q || '').trim();
    const lower = trimmed.toLowerCase();
    if (!trimmed || lower === '0p' || lower === '1p' || lower === 'x') {
      setResults([]);
      setIsOpen(false);
      return;
    }

    // 產生唯一序號，防止非同步競態條件 (Race Condition)
    const requestId = ++searchRequestIdRef.current;

    // 1. 命中前端快取直接讀取 (TTL 60s 安全校驗)
    const cacheKey = `${storeId}_${trimmed.toLowerCase()}`;
    const cached = autocompleteCache.get(cacheKey);
    if (cached) {
      setResults(cached);
      setIsOpen(cached.length > 0);
      const exact = cached.find((p: any) => p.id.toLowerCase() === trimmed.toLowerCase() || p.barcode === trimmed);
      // 關鍵防線：嚴格校驗此時輸入框的即時值是否仍與搜尋目標完全相符
      if (exact && latestValueRef.current.trim().toLowerCase() === trimmed.toLowerCase()) {
        onSelectProduct(exact);
      }
      return;
    }

    setSearching(true);
    try {
      // 2. 呼叫後端專用輕量早停 suggest API (非全量 summary)，< 2ms 回應
      const res = await inventoryApi.suggest({ q: trimmed, storeId, limit: 8 });

      // 關鍵防線：若當前返回的請求已非最新發起的請求，直接拋棄，防止舊資料覆蓋新畫面
      if (requestId !== searchRequestIdRef.current) {
        return;
      }

      if (res.success && Array.isArray(res.data)) {
        autocompleteCache.set(cacheKey, res.data);
        setResults(res.data);
        setIsOpen(res.data.length > 0);

        // 如果精準全匹配貨號或條碼，且當前輸入框值未被使用者篡改，才自動帶入
        const exact = res.data.find((p: any) => p.id.toLowerCase() === trimmed.toLowerCase() || p.barcode === trimmed);
        if (exact && latestValueRef.current.trim().toLowerCase() === trimmed.toLowerCase()) {
          onSelectProduct(exact);
        }
      } else {
        setResults([]);
      }
    } catch (err) {
      if (requestId === searchRequestIdRef.current) {
        console.error('Failed to search product', err);
        setResults([]);
      }
    } finally {
      if (requestId === searchRequestIdRef.current) {
        setSearching(false);
      }
    }
  };

  const handleInputChange = (newVal: string) => {
    onChangeValue(newVal);
    latestValueRef.current = newVal;
    if (timerRef.current) clearTimeout(timerRef.current);
    const lowerVal = newVal.trim().toLowerCase();
    if (!newVal.trim() || lowerVal === '0p' || lowerVal === '1p' || lowerVal === 'x') {
      setIsOpen(false);
      return;
    }
    timerRef.current = setTimeout(() => {
      searchProducts(newVal);
    }, 250);
  };

  const handleSelect = (prod: any) => {
    onSelectProduct(prod);
    setIsOpen(false);
  };

  return (
    <div 
      className={`relative w-full ${isOpen ? 'z-[1000]' : 'z-10'}`} 
      ref={containerRef}
      style={{ zIndex: isOpen ? 1000 : 1 }}
    >
      <div className="relative flex items-center">
        <input
          type="text"
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            if (value.trim() && value.trim().toLowerCase() !== '0p' && results.length > 0) {
              setIsOpen(true);
            }
          }}
          onBlur={onBlur}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setIsOpen(false);
            if (e.key === 'Enter' && results.length > 0) {
              handleSelect(results[0]);
              e.preventDefault();
            }
          }}
          className="w-full bg-slate-800 text-white px-2 py-1 rounded border border-slate-700 outline-none focus:border-amber-500 font-mono text-xs"
          placeholder="如 2905 / 0p"
        />
        {searching && (
          <span className="absolute right-2 text-slate-400 animate-spin text-[10px]">⌛</span>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute z-[100] left-0 top-full mt-1.5 w-96 bg-slate-950 border-2 border-amber-500/80 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] p-2 max-h-64 overflow-y-auto backdrop-blur-2xl">
          <div className="text-[10px] text-slate-300 px-2 py-1 border-b border-slate-800 flex justify-between font-bold">
            <span>找到 {results.length} 款商品 (點擊秒填品名與成本)</span>
            <span className="text-amber-400">Esc 關閉</span>
          </div>
          {results.map((prod) => {
            const storeStock = prod.storeStocks?.[storeId] ?? prod.stock ?? 0;
            const hasStock = storeStock > 0;
            return (
              <button
                key={prod.id}
                type="button"
                onClick={() => handleSelect(prod)}
                className="w-full text-left p-2 hover:bg-slate-800 rounded-lg flex items-center justify-between gap-2 transition group border-b border-slate-800/50 last:border-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs font-bold text-amber-400 bg-amber-500/10 px-1 py-0.5 rounded">
                      #{prod.id}
                    </span>
                    <span className="text-xs font-medium text-white truncate group-hover:text-amber-300">
                      {prod.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                    <span>成本: ${prod.costPrice || 0}</span>
                    <span>•</span>
                    <span>售價: ${prod.sellingPrice || 0}</span>
                    <span>•</span>
                    <span className="text-indigo-400">點數: {prod.suggestedPoints || Math.round((prod.sellingPrice || 0) * 0.05)}pt</span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  {hasStock ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-medium">
                      現貨 {storeStock}
                    </span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 font-medium">
                      現貨 0
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const PrizeAllocationView: React.FC = () => {
  // ── 標籤頁狀態: 'canvas' (配賞畫布) | 'templates' (常用範本庫) | 'drafts' (草稿箱) ──
  const [activeTab, setActiveTab] = useState<'canvas' | 'templates' | 'drafts'>('canvas');

  // ── 門市清單 ──
  const [stores, setStores] = useState<Array<{ id: string; name: string }>>([
    { id: 'chupei', name: '竹北旗艦店' },
    { id: 'jinshan', name: '金山概念店' },
  ]);

  // ── 賞位命名模式: 'number' (1, 2, 3...) | 'letter' (A, B, C...) ──
  const [namingMode, setNamingMode] = useState<'number' | 'letter'>('number');

  // ── 預設配賞方案 ──
  const defaultInitialPlan: SetPlan = {
    id: 'plan-1',
    name: '海賊王 魯夫 MASTERLISE',
    isNameCustomized: false,
    storeId: 'chupei',
    totalDraws: 100, // 預設 100 抽
    price1: 350,
    price3: 1020, // 97折
    price5: 1660, // 95折
    price10: 3150, // 90折
    isTenPlusOne: false,
    targetMargin: 45,
    batchCount: 1,
    blindBoxPointsValue: 10,
    isPointsSet: false,
    items: [
      { id: 'it-1', prizeGrade: '1', prizeName: 'PG奇犽2.0 頂級公仔', productId: '926', draws: 1, costPrice: 4800, points: 150 },
      { id: 'it-2', prizeGrade: '2', prizeName: '航海王 索隆 經典景品', productId: '3234', draws: 2, costPrice: 1200, points: 50 },
      { id: 'it-3', prizeGrade: 'X', prizeName: '任選盲盒一個', productId: 'X', draws: 5, costPrice: 200, points: 10 },
      { id: 'it-4', prizeGrade: 'Z', prizeName: '非GK保底小賞 (1P)', productId: '0p', draws: 92, costPrice: 0, points: 1, isNonGk: true },
    ],
  };

  // ── 多套配賞方案狀態 (Multi-Set Batch Plans) ──
  const [plans, setPlans] = useState<SetPlan[]>([defaultInitialPlan]);
  const [activePlanIdx, setActivePlanIdx] = useState<number>(0);
  const currentPlan = plans[activePlanIdx] || plans[0] || defaultInitialPlan;

  // ── 自動防呆暫存與還原通知 ──
  const [lastAutoSavedTime, setLastAutoSavedTime] = useState<string | null>(null);
  const [restoredNotice, setRestoredNotice] = useState<string | null>(null);
  const isInitialMount = useRef(true);

  // ── 側邊門市現貨看板狀態 ──
  const [stockStoreFilter, setStockStoreFilter] = useState('ALL');
  const [stockMainTypeFilter, setStockMainTypeFilter] = useState<'ALL' | 'GK' | 'BLIND_BOX'>('GK'); // ★ 預設僅篩選 GK 雕像
  const [stockCategoryFilter, setStockCategoryFilter] = useState('ALL');
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [stockSearchInput, setStockSearchInput] = useState('');
  const [stockSearch, setStockSearch] = useState('');
  const [liveStockItems, setLiveStockItems] = useState<any[]>([]);
  const [stockLoading, setStockLoading] = useState(false);

  // ── 工作台所有方案即時配賞佔用統計 (包含當前套組與其他未發布切換中的套組) ──
  const workbenchAllocMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const plan of plans) {
      const count = plan.batchCount || 1;
      for (const it of plan.items) {
        if (!it.productId || ['0p', '1p', 'x', 'X', 'BLIND_BOX'].includes(it.productId) || it.isNonGk) {
          continue;
        }
        const qty = (Number(it.draws) || 0) * count;
        map.set(it.productId, (map.get(it.productId) || 0) + qty);
      }
    }
    return map;
  }, [plans]);

  // ── 範本與草稿資料 ──
  const [templates, setTemplates] = useState<any[]>([]);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishMessage, setPublishMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ── 1. 頁面加載時自動還原上次配到一半的進度 (Auto-Restore) ──
  useEffect(() => {
    try {
      const cached = localStorage.getItem('onesoul_allocation_workspace');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed.plans) && parsed.plans.length > 0) {
          // 清洗舊草稿中的「1號賞/A賞」前綴，只保留乾淨純品名
          const cleanedPlans = parsed.plans.map((p: any) => ({
            ...p,
            items: (p.items || []).map((it: any) => ({
              ...it,
              prizeName: cleanPrizeName(it.prizeName),
            })),
          }));
          setPlans(cleanedPlans);
          if (typeof parsed.activePlanIdx === 'number' && parsed.activePlanIdx < parsed.plans.length) {
            setActivePlanIdx(parsed.activePlanIdx);
          }
          const timeStr = parsed.savedAt ? new Date(parsed.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
          setRestoredNotice(`已為您自動還原上次配到一半的進度${timeStr ? ` (保存於 ${timeStr})` : ''}，可繼續編輯！`);
          setTimeout(() => setRestoredNotice(null), 6000);
        }
      }
    } catch (e) {
      console.warn('Auto restore draft failed:', e);
    }
  }, []);

  // ── 2. 即時自動保存至 LocalStorage (Auto-Save on every keystroke/change) ──
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const timer = setTimeout(() => {
      try {
        const now = new Date();
        localStorage.setItem('onesoul_allocation_workspace', JSON.stringify({
          plans,
          activePlanIdx,
          savedAt: now.toISOString(),
        }));
        setLastAutoSavedTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      } catch (e) {
        // ignore
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [plans, activePlanIdx]);

  // 搜尋防抖
  useEffect(() => {
    const timer = setTimeout(() => {
      setStockSearch(stockSearchInput.trim());
    }, 200);
    return () => clearTimeout(timer);
  }, [stockSearchInput]);

  // 載入側欄現貨與範本及店家品牌設定
  useEffect(() => {
    loadLiveStock();
    loadPlans();
    loadBrandConfig();
  }, [stockStoreFilter, stockMainTypeFilter, stockCategoryFilter, stockSearch]);

  const loadBrandConfig = async () => {
    try {
      const res = await settingsApi.getBrand();
      if (res.success && res.data?.blindBoxPointsValue) {
        const val = Number(res.data.blindBoxPointsValue) || 10;
        setPlans((prev) =>
          prev.map((p) => ({
            ...p,
            blindBoxPointsValue: p.blindBoxPointsValue === 10 ? val : (p.blindBoxPointsValue || val),
          }))
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadLiveStock = async () => {
    setStockLoading(true);
    try {
      const res = await allocationApi.getLiveStock({
        storeId: stockStoreFilter !== 'ALL' ? stockStoreFilter : undefined,
        mainCategory: stockMainTypeFilter !== 'ALL' ? stockMainTypeFilter : undefined,
        category: stockCategoryFilter !== 'ALL' ? stockCategoryFilter : undefined,
        q: stockSearch || undefined,
        minQty: 1,
      });
      if (res.success) {
        setLiveStockItems(res.data || []);
        if (res.stores) setStores(res.stores);
        if (res.categories) setAvailableCategories(res.categories);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setStockLoading(false);
    }
  };

  const loadPlans = async () => {
    try {
      const res = await allocationApi.getPlans();
      if (res.success) {
        setTemplates(res.templates || []);
        setDrafts(res.drafts || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // ── 更新當前套組方案的欄位 ──
  const updateCurrentPlan = (field: keyof SetPlan, val: any) => {
    setPlans((prev) =>
      prev.map((p, idx) => (idx === activePlanIdx ? { ...p, [field]: val } : p))
    );
  };

  // ── 新增配賞套組 ──
  const handleAddNewPlan = () => {
    const nextNum = plans.length + 1;
    const newPlan: SetPlan = {
      id: `plan-${Date.now()}`,
      name: `全新配賞套組【第${nextNum}套】`,
      storeId: currentPlan.storeId || 'chupei',
      totalDraws: 100,
      price1: 350,
      price3: 1020,
      price5: 1660,
      price10: 3150,
      isTenPlusOne: false,
      targetMargin: 45,
      batchCount: 1,
      blindBoxPointsValue: currentPlan.blindBoxPointsValue || 10,
      isPointsSet: false,
      items: [
        { id: `it-${Date.now()}-1`, prizeGrade: '1', prizeName: '1號賞 精選GK公仔大獎', productId: '', draws: 1, costPrice: 8000, points: 150 },
        { id: `it-${Date.now()}-2`, prizeGrade: 'X', prizeName: 'X賞 任選盲盒一個', productId: 'X', draws: 5, costPrice: 200, points: currentPlan.blindBoxPointsValue || 10 },
        { id: `it-${Date.now()}-3`, prizeGrade: 'Z', prizeName: 'Z賞 非GK保底小賞 (1P)', productId: '0p', draws: 94, costPrice: 0, points: 1, isNonGk: true },
      ],
    };
    setPlans([...plans, newPlan]);
    setActivePlanIdx(plans.length);
  };

  // ── 複製當前套組 ──
  const handleDuplicateCurrentPlan = () => {
    const nextNum = plans.length + 1;
    const duplicated: SetPlan = {
      ...currentPlan,
      id: `plan-${Date.now()}`,
      name: `${currentPlan.name} (複製第${nextNum}套)`,
      items: currentPlan.items.map((it, idx) => ({
        ...it,
        id: `it-copy-${Date.now()}-${idx}`,
      })),
    };
    setPlans([...plans, duplicated]);
    setActivePlanIdx(plans.length);
  };

  // ── 移除指定套組 ──
  const handleRemovePlan = (idxToRemove: number) => {
    if (plans.length <= 1) {
      alert('至少需保留一個配賞套組方案');
      return;
    }
    const updated = plans.filter((_, idx) => idx !== idxToRemove);
    setPlans(updated);
    setActivePlanIdx(Math.max(0, idxToRemove - 1));
  };

  // ── 階梯折扣與整十元取整 ──
  const handleRecalculatePricing = useCallback((basePrice: number, tenPlusOne: boolean) => {
    const p1 = Math.max(0, Number(basePrice) || 0);
    const p3 = Math.round((3 * p1 * 0.97) / 10) * 10;
    const p5 = Math.round((5 * p1 * 0.95) / 10) * 10;
    const p10 = tenPlusOne ? 10 * p1 : Math.round((10 * p1 * 0.90) / 10) * 10;

    setPlans((prev) =>
      prev.map((p, idx) =>
        idx === activePlanIdx
          ? { ...p, price1: p1, price3: p3, price5: p5, price10: p10, isTenPlusOne: tenPlusOne }
          : p
      )
    );
  }, [activePlanIdx]);

  // 單抽價改變
  const handlePrice1Change = (newP1: number) => {
    handleRecalculatePricing(newP1, currentPlan.isTenPlusOne);
  };

  // 10送1切換
  const handleTenPlusOneToggle = () => {
    const nextVal = !currentPlan.isTenPlusOne;
    handleRecalculatePricing(currentPlan.price1, nextVal);
  };

  // ── 財務指標與平帳計算 ──
  const financialSummary = useMemo(() => {
    const { totalDraws, price1, price3, price5, price10, items } = currentPlan;
    // 1. 已配總抽數
    const allocatedDraws = items.reduce((sum, it) => sum + (Number(it.draws) || 0), 0);
    // 2. 總成本
    const totalCost = items.reduce((sum, it) => sum + ((Number(it.draws) || 0) * (Number(it.costPrice) || 0)), 0);
    // 3. 點數總負債 (pt)
    const totalPoints = items.reduce((sum, it) => sum + ((Number(it.draws) || 0) * (Number(it.points) || 0)), 0);
    const maxPointLiability = totalPoints * 20; // 1pt = $20

    // 4. 加權單抽價 (期望值)
    const p1 = price1 || 0;
    const p3 = price3 || 0;
    const p5 = price5 || 0;
    const p10 = price10 || 0;
    const effectivePerDraw = (0.35 * p1) + (0.20 * (p3 / 3)) + (0.25 * (p5 / 5)) + (0.20 * (p10 / 10));

    // 5. 總營收 (單套)
    const expectedRevenue = totalDraws * effectivePerDraw;
    // 6. 現金毛利率
    const cashMargin = expectedRevenue > 0 ? ((expectedRevenue - totalCost) / expectedRevenue) * 100 : 0;
    // 7. 8:2 轉點期望毛利率
    const hybridCost = (totalCost * 0.8) + (maxPointLiability * 0.2);
    const hybridMargin = expectedRevenue > 0 ? ((expectedRevenue - hybridCost) / expectedRevenue) * 100 : 0;

    return {
      allocatedDraws,
      drawsDiff: totalDraws - allocatedDraws,
      isBalanced: totalDraws === allocatedDraws,
      totalCost,
      totalPoints,
      maxPointLiability,
      effectivePerDraw: Math.round(effectivePerDraw),
      expectedRevenue: Math.round(expectedRevenue),
      cashMargin: Math.round(cashMargin * 10) / 10,
      hybridMargin: Math.round(hybridMargin * 10) / 10,
    };
  }, [currentPlan]);

  // ── 目標毛利率逆向反推單抽價 ──
  const handleReversePriceFromMargin = () => {
    const { totalDraws, targetMargin } = currentPlan;
    if (totalDraws <= 0 || targetMargin >= 100) return;
    const marginRatio = targetMargin / 100;
    const targetRevenue = financialSummary.totalCost / (1 - marginRatio);
    // 加權係數: 0.35 + 0.20*0.97 + 0.25*0.95 + 0.20*0.90 = 0.9615
    const suggestedP1 = (targetRevenue / totalDraws) / 0.9615;
    const roundedP1 = Math.round(suggestedP1 / 10) * 10;
    handleRecalculatePricing(roundedP1, currentPlan.isTenPlusOne);
  };

  // ── 獎項新增 (依命名風格帶入數字或字母) ──
  const handleAddBigPrize = (type: 'number' | 'letter' = namingMode) => {
    const { items } = currentPlan;
    const existingPrizes = items.filter(it => it.prizeGrade.toUpperCase() !== 'X' && it.prizeGrade.toUpperCase() !== 'Z' && !it.isNonGk);
    
    let nextGrade = '1';
    if (type === 'number') {
      const numList = existingPrizes
        .map(it => parseInt(it.prizeGrade, 10))
        .filter(n => !isNaN(n));
      const maxNum = numList.length > 0 ? Math.max(...numList) : 0;
      nextGrade = String(maxNum + 1);
    } else {
      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      nextGrade = letters[Math.min(existingPrizes.length, letters.length - 1)];
    }

    const newItem: AllocationPrizeItem = {
      id: `it-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      prizeGrade: nextGrade,
      prizeName: `${nextGrade}號賞 精選公仔大獎`,
      productId: '',
      draws: 1,
      costPrice: 0,
      points: 0,
    };

    // 若最後一項為 Z 小賞，插入在 Z 之前
    const lastItem = items[items.length - 1];
    if (lastItem && (lastItem.prizeGrade.toUpperCase() === 'Z' || lastItem.isNonGk || lastItem.productId === '0p')) {
      const copy = [...items];
      copy.splice(copy.length - 1, 0, newItem);
      updateCurrentPlan('items', copy);
    } else {
      updateCurrentPlan('items', [...items, newItem]);
    }
  };

  // ── 快捷新增 X 盲盒賞 (任選盲盒一個) ──
  const handleAddBlindBoxPrize = () => {
    const newItem: AllocationPrizeItem = {
      id: `it-x-${Date.now()}`,
      prizeGrade: 'X',
      prizeName: '任選盲盒一個',
      productId: 'X',
      draws: 5,
      costPrice: 200,
      points: currentPlan.blindBoxPointsValue || 10,
    };
    const { items } = currentPlan;
    const lastItem = items[items.length - 1];
    if (lastItem && (lastItem.prizeGrade.toUpperCase() === 'Z' || lastItem.isNonGk)) {
      const copy = [...items];
      copy.splice(copy.length - 1, 0, newItem);
      updateCurrentPlan('items', copy);
    } else {
      updateCurrentPlan('items', [...items, newItem]);
    }
  };

  // ── 快捷新增 Z 小賞 (保底 1P 小賞) ──
  const handleAddSmallPrize = (type: '1p' | '0p' = '1p') => {
    const isOne = type === '1p';
    const newItem: AllocationPrizeItem = {
      id: `it-z-${Date.now()}`,
      prizeGrade: 'Z',
      prizeName: isOne ? '非GK保底小賞 (1P)' : '非GK保底小賞 (0P)',
      productId: type,
      draws: 10,
      costPrice: isOne ? 1 : 0,
      points: isOne ? 1 : 0,
      isNonGk: true,
    };
    updateCurrentPlan('items', [...currentPlan.items, newItem]);
  };

  // ── 快捷新增 LAST 最後賞 ──
  const handleAddLastPrize = () => {
    const newItem: AllocationPrizeItem = {
      id: `it-last-${Date.now()}`,
      prizeGrade: 'LAST',
      prizeName: '最後賞 特別限定版雕像',
      productId: '',
      draws: 1,
      costPrice: 3500,
      points: 150,
    };
    const { items } = currentPlan;
    const lastItem = items[items.length - 1];
    if (lastItem && (lastItem.prizeGrade.toUpperCase() === 'Z' || lastItem.isNonGk)) {
      const copy = [...items];
      copy.splice(copy.length - 1, 0, newItem);
      updateCurrentPlan('items', copy);
    } else {
      updateCurrentPlan('items', [...items, newItem]);
    }
  };

  // ── 一鍵補平 Z 小賞抽數 (自動平帳，支援 0P / 1P) ──
  const handleAutoFillSmallPrizeZ = (type: '0p' | '1p' = '0p') => {
    const { totalDraws, items } = currentPlan;
    const isZero = type === '0p';
    const targetName = isZero ? '非GK保底小賞 (0P)' : '非GK保底小賞 (1P)';
    const targetCost = isZero ? 0 : 1;
    const targetPoints = isZero ? 0 : 1;

    // 找出 Z 小賞 (代碼為 Z 或 isNonGk 或 0p/1p)
    const zItem = items.find(it => it.prizeGrade.toUpperCase() === 'Z' || it.isNonGk || it.productId === '0p' || it.productId === '1p');
    // 計算除了 Z 之外其他所有賞的抽數總和
    const otherDraws = items.filter(it => it !== zItem).reduce((sum, it) => sum + (Number(it.draws) || 0), 0);
    const remainingDraws = Math.max(0, totalDraws - otherDraws);

    if (zItem) {
      const updated = items.map(it => it.id === zItem.id ? { 
        ...it, 
        prizeGrade: 'Z',
        productId: type,
        prizeName: targetName,
        costPrice: targetCost,
        points: targetPoints,
        draws: remainingDraws,
        isNonGk: true,
      } : it);
      updateCurrentPlan('items', updated);
    } else {
      const newZ: AllocationPrizeItem = {
        id: `it-z-${Date.now()}`,
        prizeGrade: 'Z',
        prizeName: targetName,
        productId: type,
        draws: remainingDraws,
        costPrice: targetCost,
        points: targetPoints,
        isNonGk: true,
      };
      updateCurrentPlan('items', [...items, newZ]);
    }
  };

  // 從 Autocomplete 選中商品時智慧帶入品名、成本與建議點數 (純品名，不加前綴)
  const handleSelectProductForItem = (itemId: string, product: any) => {
    const updated = currentPlan.items.map((it) => {
      if (it.id !== itemId) return it;
      return {
        ...it,
        productId: product.id,
        // 關鍵防線：若店長手動修改過品名，保留自訂品名不被抹除；否則帶入純品名
        prizeName: it.isPrizeNameCustomized ? it.prizeName : cleanPrizeName(product.name),
        costPrice: product.costPrice || 0,
        points: product.suggestedPoints || Math.round((product.sellingPrice || 0) * 0.05),
        isNonGk: false,
      };
    });

    const topName = getTopPrizeName(updated);
    const newName = (!currentPlan.isNameCustomized && topName) ? topName : currentPlan.name;
    setPlans(prev => prev.map((p, idx) => idx === activePlanIdx ? { ...p, name: newName, items: updated } : p));
  };

  // 更新項目
  const handleUpdateItem = (id: string, field: keyof AllocationPrizeItem, val: any) => {
    const updated = currentPlan.items.map((it) => {
      if (it.id !== id) return it;
      const itemUpdated = { ...it, [field]: val };
      if (field === 'prizeName') {
        itemUpdated.isPrizeNameCustomized = true; // 標記為店長自訂品名
      }
      if (field === 'productId') {
        const trimmed = String(val || '').trim();
        const lower = trimmed.toLowerCase();
        if (lower === '0p') {
          itemUpdated.prizeGrade = 'Z';
          itemUpdated.prizeName = '非GK保底小賞 (0P)';
          itemUpdated.costPrice = 0;
          itemUpdated.points = 0;
          itemUpdated.isNonGk = true;
          itemUpdated.isPrizeNameCustomized = false;
        } else if (lower === '1p') {
          itemUpdated.prizeGrade = 'Z';
          itemUpdated.prizeName = '非GK保底小賞 (1P)';
          itemUpdated.costPrice = 1;
          itemUpdated.points = 1;
          itemUpdated.isNonGk = true;
          itemUpdated.isPrizeNameCustomized = false;
        } else if (lower === 'x') {
          itemUpdated.prizeGrade = 'X';
          itemUpdated.prizeName = '任選盲盒一個';
          itemUpdated.costPrice = 200;
          itemUpdated.points = 10;
          itemUpdated.isNonGk = false;
          itemUpdated.isPrizeNameCustomized = false;
        } else {
          const matched = liveStockItems.find((p) => p.id === trimmed || p.barcode === trimmed);
          if (matched) {
            // 關鍵防線：若店長已自訂過品名，微調貨號時不覆蓋自訂品名
            if (!it.isPrizeNameCustomized) {
              itemUpdated.prizeName = cleanPrizeName(matched.name);
            }
            itemUpdated.costPrice = matched.costPrice || 0;
            itemUpdated.points = matched.suggestedPoints || Math.round((matched.sellingPrice || 0) * 0.05);
            itemUpdated.isNonGk = false;
          }
        }
      }
      return itemUpdated;
    });

    const topName = getTopPrizeName(updated);
    const newName = (!currentPlan.isNameCustomized && topName) ? topName : currentPlan.name;
    setPlans(prev => prev.map((p, idx) => idx === activePlanIdx ? { ...p, name: newName, items: updated } : p));
  };

  // 刪除項目
  const handleDeleteItem = (id: string) => {
    const updated = currentPlan.items.filter((it) => it.id !== id);
    const topName = getTopPrizeName(updated);
    const newName = (!currentPlan.isNameCustomized && topName) ? topName : currentPlan.name;
    setPlans(prev => prev.map((p, idx) => idx === activePlanIdx ? { ...p, name: newName, items: updated } : p));
  };

  // 從右側現貨看板配入 (智慧帶入：優先填入空白賞位，若滿則新增一列，並自動預設最大獎套名)
  const handlePickStockItem = (stockItem: any) => {
    const { items } = currentPlan;

    // 1. 優先尋找尚未填寫商品 (productId 為空或無貨號) 的實體大獎列 (非 X 盲盒、非 Z 小賞)
    const emptyIndex = items.findIndex(
      (it) => !it.isNonGk && it.prizeGrade.toUpperCase() !== 'X' && it.prizeGrade.toUpperCase() !== 'Z' && !it.productId
    );

    let updatedItems: AllocationPrizeItem[];

    if (emptyIndex >= 0) {
      // 自動帶入現有空白賞位
      updatedItems = items.map((it, idx) => {
        if (idx !== emptyIndex) return it;
        return {
          ...it,
          productId: stockItem.id,
          prizeName: formatPrizeNameWithGrade(it.prizeGrade, stockItem.name),
          costPrice: stockItem.costPrice || 0,
          points: stockItem.suggestedPoints || Math.round((stockItem.sellingPrice || 0) * 0.05),
        };
      });
    } else {
      // 2. 所有現有大賞皆已填滿，自動指派下一個編號/字母在大賞尾端 (Z 保底小賞前) 新增一列
      const existingPrizes = items.filter(it => it.prizeGrade.toUpperCase() !== 'X' && it.prizeGrade.toUpperCase() !== 'Z' && !it.isNonGk);
      
      let nextGrade = '1';
      if (namingMode === 'number') {
        const numList = existingPrizes
          .map(it => parseInt(it.prizeGrade, 10))
          .filter(n => !isNaN(n));
        const maxNum = numList.length > 0 ? Math.max(...numList) : 0;
        nextGrade = String(maxNum + 1);
      } else {
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        nextGrade = letters[Math.min(existingPrizes.length, letters.length - 1)];
      }

      const newItem: AllocationPrizeItem = {
        id: `it-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        prizeGrade: nextGrade,
        prizeName: formatPrizeNameWithGrade(nextGrade, stockItem.name),
        productId: stockItem.id,
        draws: 1,
        costPrice: stockItem.costPrice || 0,
        points: stockItem.suggestedPoints || Math.round((stockItem.sellingPrice || 0) * 0.05),
      };

      const lastItem = items[items.length - 1];
      if (lastItem && (lastItem.prizeGrade.toUpperCase() === 'Z' || lastItem.isNonGk || lastItem.productId === '0p')) {
        const copy = [...items];
        copy.splice(copy.length - 1, 0, newItem);
        updatedItems = copy;
      } else {
        updatedItems = [...items, newItem];
      }
    }

    // 3. 套名自動預設：若未手動自訂過，以第 1 個實體大獎 (1號賞或A賞) 的商品名作為套名
    const topName = getTopPrizeName(updatedItems);
    const newName = (!currentPlan.isNameCustomized && topName) ? topName : currentPlan.name;

    setPlans(prev => prev.map((p, idx) => idx === activePlanIdx ? { ...p, name: newName, items: updatedItems } : p));
  };

  // ── 臨時有事先放著 (掛單暫存) ──
  const handleParkCurrentPlan = () => {
    setPlans(prev => prev.map((p, idx) => idx === activePlanIdx ? { ...p, isParked: true } : p));
    setPublishMessage({
      type: 'success',
      text: `已為您將「${currentPlan.name}」暫存掛單！隨時可開新方案或點擊上方標籤切回繼續配。`,
    });
    setTimeout(() => setPublishMessage(null), 4000);
  };

  // ── 解除掛單繼續配 ──
  const handleResumeParkedPlan = (idx: number) => {
    setPlans(prev => prev.map((p, i) => i === idx ? { ...p, isParked: false } : p));
    setActivePlanIdx(idx);
  };

  // 載入預設範本
  const handleLoadTemplate = (tpl: any) => {
    if (!window.confirm(`確定要載入範本「${tpl.name}」套用至當前套組嗎？`)) return;
    const cleanItems = (tpl.items || []).map((it: any, idx: number) => ({
      ...it,
      id: `tpl-it-${Date.now()}-${idx}`,
    }));

    setPlans((prev) =>
      prev.map((p, idx) =>
        idx === activePlanIdx
          ? {
              ...p,
              name: tpl.name.replace(/【.*?】/, '').trim(),
              storeId: tpl.storeId || 'chupei',
              totalDraws: tpl.totalDraws || 100,
              price1: tpl.price1 || 350,
              price3: tpl.price3 || 1020,
              price5: tpl.price5 || 1660,
              price10: tpl.price10 || 3150,
              isTenPlusOne: !!tpl.isTenPlusOne,
              targetMargin: tpl.targetMargin || 45,
              items: cleanItems,
            }
          : p
      )
    );
    setActiveTab('canvas');
  };

  // 儲存草稿
  const handleSaveDraft = async () => {
    setIsSavingDraft(true);
    try {
      const payload = {
        name: currentPlan.name,
        storeId: currentPlan.storeId,
        totalDraws: currentPlan.totalDraws,
        price1: currentPlan.price1,
        price3: currentPlan.price3,
        price5: currentPlan.price5,
        price10: currentPlan.price10,
        isTenPlusOne: currentPlan.isTenPlusOne,
        targetMargin: currentPlan.targetMargin,
        blindBoxPointsValue: currentPlan.blindBoxPointsValue || 10,
        isPointsSet: !!currentPlan.isPointsSet,
        items: currentPlan.items,
      };
      const res = await allocationApi.savePlan(payload);
      if (res.success) {
        autocompleteCache.clear();
        setPublishMessage({ type: 'success', text: `✅ 配賞方案草稿 [${currentPlan.name}] 已儲存！` });
        loadPlans();
        setTimeout(() => setPublishMessage(null), 3000);
      }
    } catch (err: any) {
      setPublishMessage({ type: 'error', text: err.message || '儲存草稿失敗' });
    } finally {
      setIsSavingDraft(false);
    }
  };

  // 發布當前套組至門市 POS
  const handlePublishCurrentPlan = async () => {
    if (!financialSummary.isBalanced) {
      alert(`無法發布：抽數未平帳！已配置 ${financialSummary.allocatedDraws} 抽，總抽數 ${currentPlan.totalDraws} 抽 (差距 ${financialSummary.drawsDiff} 抽)。請先點擊「⚡ 補平 Z 小賞抽數」。`);
      return;
    }

    if (financialSummary.cashMargin < 15) {
      if (!window.confirm(`⚠️ 風險警告：當前現金毛利率僅 ${financialSummary.cashMargin}% (低於 15% 風險警示線)！確定仍要發布嗎？`)) {
        return;
      }
    }

    const storeName = stores.find((s) => s.id === currentPlan.storeId)?.name || currentPlan.storeId;
    const count = currentPlan.batchCount || 1;
    if (!window.confirm(`確定要將「${currentPlan.name}」發布至【${storeName}】開套嗎？\n預計開套數量：${count} 套 (每套 ${currentPlan.totalDraws} 抽)\n發布後將自動建立門市 POS 套組並鎖定對應公仔現貨！`)) {
      return;
    }

    setIsPublishing(true);
    setPublishMessage(null);
    try {
      const payload = {
        name: currentPlan.name,
        storeId: currentPlan.storeId,
        totalDraws: currentPlan.totalDraws,
        price1: currentPlan.price1,
        batchCount: count,
        blindBoxPointsValue: currentPlan.blindBoxPointsValue || 10,
        isPointsSet: !!currentPlan.isPointsSet,
        items: currentPlan.items,
      };
      const res = await allocationApi.publishPlan(payload);
      if (res.success) {
        autocompleteCache.clear();
        setPublishMessage({ type: 'success', text: res.message || `🎉 開套成功！已成功上架 ${count} 套至門市 POS！` });
        loadPlans();
        loadLiveStock();
      }
    } catch (err: any) {
      setPublishMessage({ type: 'error', text: err.message || '發布開套失敗' });
    } finally {
      setIsPublishing(false);
    }
  };

  // 一鍵發布所有套組方案 (All Plans Batch Publish)
  const handlePublishAllPlans = async () => {
    // 檢查平帳
    for (const p of plans) {
      const sum = p.items.reduce((acc, it) => acc + (Number(it.draws) || 0), 0);
      if (sum !== p.totalDraws) {
        alert(`無法批次發布：套組 [${p.name}] 抽數未平帳 (已配 ${sum} / 總抽數 ${p.totalDraws})。請先修正！`);
        return;
      }
    }

    const totalSets = plans.reduce((acc, p) => acc + (p.batchCount || 1), 0);
    if (!window.confirm(`確定要一次發布工作台中所有 ${plans.length} 個配賞方案 (共 ${totalSets} 套一番賞) 至門市 POS 開抽嗎？`)) {
      return;
    }

    setIsPublishing(true);
    setPublishMessage(null);
    try {
      const payload = {
        plans: plans.map(p => ({
          name: p.name,
          storeId: p.storeId,
          totalDraws: p.totalDraws,
          price1: p.price1,
          batchCount: p.batchCount || 1,
          blindBoxPointsValue: p.blindBoxPointsValue || 10,
          isPointsSet: !!p.isPointsSet,
          items: p.items,
        })),
      };
      const res = await allocationApi.publishPlan(payload);
      if (res.success) {
        autocompleteCache.clear();
        setPublishMessage({ type: 'success', text: res.message || `🎉 批次開套成功！全套組已同步至門市 POS！` });
        loadPlans();
        loadLiveStock();
      }
    } catch (err: any) {
      setPublishMessage({ type: 'error', text: err.message || '批次發布失敗' });
    } finally {
      setIsPublishing(false);
    }
  };

  // 快捷選擇總抽數 (支援 3000 抽)
  const quickDrawChips = [50, 80, 100, 120, 300, 500, 1000, 3000];

  return (
    <div className="space-y-4">
      {/* ── 頂部導航與標籤列 ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-800/80 p-4 rounded-2xl border border-slate-700/80 shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-amber-400" />
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              一番賞配賞工作台
              <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Sheet 對齊版 · 支援3000抽
              </span>
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            歷史 Sheet 欄位對齊 (數字大賞/X盲盒/Z小賞)、無上限自由抽數 (最高 3000 抽)、多套並行配置與一鍵門市開抽。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* 主標籤頁切換 */}
          <div className="flex items-center bg-slate-900 p-0.5 rounded-xl border border-slate-700 text-xs">
            <button
              onClick={() => setActiveTab('canvas')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                activeTab === 'canvas' ? 'bg-amber-600 text-white font-bold shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Calculator className="w-3.5 h-3.5" />
              配賞工作台
            </button>
            <button
              onClick={() => setActiveTab('templates')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                activeTab === 'templates' ? 'bg-amber-600 text-white font-bold shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              常用範本庫 ({templates.length})
            </button>
            <button
              onClick={() => setActiveTab('drafts')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                activeTab === 'drafts' ? 'bg-amber-600 text-white font-bold shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              草稿箱 ({drafts.length})
            </button>
          </div>

          <button
            onClick={handleSaveDraft}
            disabled={isSavingDraft}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold rounded-xl border border-slate-600 transition disabled:opacity-50"
          >
            <Save className="w-4 h-4 text-amber-400" />
            {isSavingDraft ? '儲存中...' : '儲存草稿'}
          </button>

          <button
            onClick={handlePublishCurrentPlan}
            disabled={isPublishing || !financialSummary.isBalanced}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Rocket className="w-4 h-4" />
            {isPublishing ? '發布中...' : `發布此套開抽 (${currentPlan.batchCount || 1}套)`}
          </button>

          {plans.length > 1 && (
            <button
              onClick={handlePublishAllPlans}
              disabled={isPublishing}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg transition disabled:opacity-50"
              title="一次發布工作台中所有套組方案"
            >
              <Boxes className="w-4 h-4" />
              全部批次發布 ({plans.length}套)
            </button>
          )}
        </div>
      </div>

      {/* 訊息反饋通知 */}
      {publishMessage && (
        <div
          className={`p-3 rounded-xl text-xs flex items-center justify-between ${
            publishMessage.type === 'success'
              ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
              : 'bg-rose-500/20 border border-rose-500/40 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {publishMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
            <span>{publishMessage.text}</span>
          </div>
          <button onClick={() => setPublishMessage(null)}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── 標籤頁 2: 常用配置範本庫 ── */}
      {activeTab === 'templates' && (
        <div className="bg-slate-800/60 p-4 rounded-2xl border border-slate-700/60 space-y-4">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-indigo-400" />
              Google Sheet 歷史常用開套配置範本庫
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              對齊歷史 Sheet：數字賞位（1, 2, 3...）、X 盲盒賞、Z 小賞保底；支援 100 抽預設、300 抽進階、1000 抽與 3000 抽巨型套組。
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((tpl) => (
              <div
                key={tpl.id}
                className="bg-slate-900 border border-slate-700 hover:border-amber-500/50 p-4 rounded-xl flex flex-col justify-between transition group shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-amber-300 px-2 py-0.5 bg-amber-950/60 rounded border border-amber-500/30">
                      {tpl.totalDraws} 抽
                    </span>
                    <span className="text-xs font-mono text-emerald-400">
                      建議單抽 ${tpl.price1}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-white mt-2 group-hover:text-amber-300 transition">
                    {tpl.name}
                  </h3>
                  <div className="mt-3 text-xs text-slate-400 space-y-1 font-mono">
                    <div>3抽: ${tpl.price3} | 5抽: ${tpl.price5} | 10抽: ${tpl.price10}</div>
                    <div>目標毛利: {tpl.targetMargin}%</div>
                    <div className="text-[11px] text-slate-500 mt-2">
                      賞位編排: {tpl.items.map((i: any) => i.prizeGrade).join(', ')}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleLoadTemplate(tpl)}
                  className="mt-4 w-full flex items-center justify-center gap-1.5 py-1.5 bg-slate-800 hover:bg-amber-600 text-slate-200 hover:text-white text-xs font-semibold rounded-lg border border-slate-700 transition"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  載入此範本配賞
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 標籤頁 3: 草稿箱 ── */}
      {activeTab === 'drafts' && (
        <div className="bg-slate-800/60 p-4 rounded-2xl border border-slate-700/60 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              未發布配賞草稿箱
            </h2>
          </div>

          {drafts.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              目前暫無儲存的配賞草稿。在試算畫布點擊「儲存草稿」即可暫存未完成方案。
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {drafts.map((d) => (
                <div key={d.id} className="bg-slate-900 border border-slate-700 p-4 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">{d.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {d.storeId === 'chupei' ? '竹北旗艦店' : '金山概念店'}
                    </span>
                  </div>
                  <div className="text-xs font-mono text-slate-400">
                    <div>總抽數: {d.totalDraws} 抽 | 單抽: ${d.price1}</div>
                    <div>包含獎品: {d.items?.length || 0} 項</div>
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                    <button
                      onClick={() => handleLoadTemplate(d)}
                      className="flex-1 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg transition"
                    >
                      載入編輯
                    </button>
                    <button
                      onClick={async () => {
                        if (window.confirm('確定要刪除此草稿嗎？')) {
                          await allocationApi.deletePlan(d.id);
                          loadPlans();
                        }
                      }}
                      className="p-1.5 hover:bg-slate-800 text-slate-500 hover:text-rose-400 rounded transition"
                      title="刪除草稿"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 標籤頁 1: 核心配賞試算主畫布 (雙欄佈局) ── */}
      {activeTab === 'canvas' && (
        <div className="space-y-4">
          
          {/* ── 自動還原通知橫幅 ── */}
          {restoredNotice && (
            <div className="p-3 bg-emerald-500/15 border border-emerald-500/40 rounded-xl flex items-center justify-between text-xs text-emerald-300 shadow">
              <div className="flex items-center gap-2">
                <BookmarkCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{restoredNotice}</span>
              </div>
              <button onClick={() => setRestoredNotice(null)} className="text-emerald-400 hover:text-white cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* ── 多套配賞分頁標籤列 (Multi-Set Batch Tabs) ── */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900 p-2.5 rounded-2xl border border-slate-700/80 shadow-md">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-slate-400 px-2 flex items-center gap-1">
                <Boxes className="w-3.5 h-3.5 text-amber-400" />
                多套工作台:
              </span>

              {plans.map((p, idx) => {
                const isActive = idx === activePlanIdx;
                return (
                  <div
                    key={p.id}
                    onClick={() => setActivePlanIdx(idx)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition select-none ${
                      isActive
                        ? 'bg-amber-500 text-slate-950 shadow-md ring-2 ring-amber-400/50'
                        : p.isParked
                          ? 'bg-slate-800/80 text-amber-300 border border-amber-500/40'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700'
                    }`}
                  >
                    {p.isParked && (
                      <span className="flex items-center text-[10px] text-amber-400 font-normal" title="已暫存掛單先放著">
                        <Pause className="w-3 h-3 fill-amber-400 mr-0.5" />
                        (暫存)
                      </span>
                    )}
                    <span>{p.name || `套組 #${idx + 1}`}</span>
                    <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                      isActive ? 'bg-slate-950/20 text-slate-900' : 'bg-slate-900 text-amber-400'
                    }`}>
                      {p.totalDraws}抽
                    </span>

                    {p.batchCount > 1 && (
                      <span className={`text-[9px] font-mono px-1 rounded ${
                        isActive ? 'bg-amber-800 text-white' : 'bg-amber-500/20 text-amber-300'
                      }`}>
                        x{p.batchCount}套
                      </span>
                    )}

                    {plans.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemovePlan(idx);
                        }}
                        className={`hover:opacity-75 p-0.5 rounded ${isActive ? 'text-slate-950' : 'text-slate-400'}`}
                        title="關閉此套組"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}

              <button
                onClick={handleAddNewPlan}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 hover:border-amber-400/50 rounded-xl text-xs font-bold transition cursor-pointer"
                title="新增另一個套組方案並行配置"
              >
                <Plus className="w-3.5 h-3.5" />
                新增套組
              </button>
            </div>

            <div className="flex items-center gap-2">
              {/* 自動即時防呆暫存時間 */}
              {lastAutoSavedTime && (
                <span className="text-[10px] text-emerald-400 font-mono hidden md:flex items-center gap-1 px-2 py-1 rounded bg-emerald-950/50 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  已即時暫存 ({lastAutoSavedTime})
                </span>
              )}

              {/* 臨時有事抽出去先放著 (掛單暫存) */}
              <button
                onClick={handleParkCurrentPlan}
                className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
                title="配到一半臨時有事離開，將此套掛單先放著，隨時可切換其他套組或稍後繼續配"
              >
                <Pause className="w-3.5 h-3.5" />
                暫存先放著 (掛單)
              </button>

              <button
                onClick={handleDuplicateCurrentPlan}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
                title="複製當前套組配置為新分頁"
              >
                <Copy className="w-3 h-3 text-indigo-400" />
                複製當前套組
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
            {/* ── 左側主配置畫布 (8 欄) ── */}
            <div className="xl:col-span-8 space-y-4">
              
              {/* 套組基本設定列 (名稱、門市、開套數量、總抽數) */}
              <div className="bg-slate-800/60 p-4 rounded-2xl border border-slate-700/60 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-5">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        套組名稱
                      </label>
                      {!currentPlan.isNameCustomized && getTopPrizeName(currentPlan.items) && (
                        <span className="text-[10px] text-amber-400 flex items-center gap-1 font-mono">
                          <Sparkles className="w-3 h-3" />
                          已預設最大獎名稱
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      value={currentPlan.name}
                      onChange={(e) => {
                        const val = e.target.value;
                        const isCustom = val.trim().length > 0;
                        updateCurrentPlan('isNameCustomized', isCustom);
                        if (!isCustom) {
                          const top = getTopPrizeName(currentPlan.items);
                          updateCurrentPlan('name', top || '');
                        } else {
                          updateCurrentPlan('name', val);
                        }
                      }}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500 font-bold"
                      placeholder={getTopPrizeName(currentPlan.items) || "例如: WAWA飛翔坊寶寶A款 或 自訂套組名稱..."}
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      開套門市
                    </label>
                    <select
                      value={currentPlan.storeId}
                      onChange={(e) => updateCurrentPlan('storeId', e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500 font-medium"
                    >
                      {stores.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      開套數量
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={currentPlan.batchCount || 1}
                        onChange={(e) => updateCurrentPlan('batchCount', Math.max(1, parseInt(e.target.value, 10) || 1))}
                        className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white text-center font-mono font-bold focus:outline-none focus:border-amber-500"
                        title="這套配置要一次開幾套 (如開 3 套)"
                      />
                      <span className="text-[11px] text-slate-400 font-mono">套</span>
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      賞位風格
                    </label>
                    <div className="flex items-center bg-slate-900 p-0.5 rounded-xl border border-slate-700 text-xs">
                      <button
                        onClick={() => setNamingMode('number')}
                        className={`flex-1 py-1 rounded-lg text-[10px] font-bold transition ${
                          namingMode === 'number' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
                        }`}
                        title="過去 Sheet 格式: 1, 2, 3..."
                      >
                        1, 2, 3
                      </button>
                      <button
                        onClick={() => setNamingMode('letter')}
                        className={`flex-1 py-1 rounded-lg text-[10px] font-bold transition ${
                          namingMode === 'letter' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
                        }`}
                        title="字母格式: A, B, C..."
                      >
                        A, B, C
                      </button>
                    </div>
                  </div>
                </div>

                {/* 總抽數自訂輸入與快速 Chip (最高可達 3000 抽) */}
                <div className="pt-2 border-t border-slate-700/60 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      總抽數 (Total Draws):
                    </span>
                    <input
                      type="number"
                      min="1"
                      max="10000"
                      value={currentPlan.totalDraws}
                      onChange={(e) => updateCurrentPlan('totalDraws', Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-24 px-2.5 py-1 bg-slate-900 border border-slate-700 rounded-xl text-xs text-amber-300 focus:outline-none focus:border-amber-500 font-mono font-bold text-center"
                    />
                    <span className="text-xs text-slate-400 font-mono">抽 (最高可達 3000 抽)</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1">
                    {quickDrawChips.map((d) => (
                      <button
                        key={d}
                        onClick={() => updateCurrentPlan('totalDraws', d)}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono transition ${
                          currentPlan.totalDraws === d
                            ? 'bg-amber-500 text-slate-950 font-bold'
                            : 'bg-slate-700 text-slate-300 hover:text-white'
                        }`}
                      >
                        {d}抽{d === 100 ? ' (預設)' : ''}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 階梯折扣定價與損益儀表卡片 (Financial Engine) */}
              <div className="bg-slate-900 p-4 rounded-2xl border border-slate-700/80 shadow-xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Coins className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-white">
                      階梯抽價計算與折扣比例
                    </span>
                    <span className="text-[10px] text-slate-400">
                      (單抽 / 3抽97折 / 5抽95折 / 10抽90折或10送1 · 整十元四捨五入)
                    </span>
                  </div>

                  {/* 逆向反推毛利工具 */}
                  <div className="flex items-center gap-1.5 bg-slate-800/80 px-2 py-1 rounded-xl border border-slate-700">
                    <Percent className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-[11px] text-slate-300">目標毛利:</span>
                    <input
                      type="number"
                      value={currentPlan.targetMargin}
                      onChange={(e) => updateCurrentPlan('targetMargin', Number(e.target.value))}
                      className="w-12 bg-slate-900 text-center font-mono text-xs text-white px-1 py-0.5 rounded border border-slate-600 outline-none"
                    />
                    <span className="text-[11px] text-slate-300">%</span>
                    <button
                      onClick={handleReversePriceFromMargin}
                      className="ml-1 px-2 py-0.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold rounded shadow transition"
                      title="依據當前獎品總成本與目標毛利率，自動逆推建議單抽價"
                    >
                      反推單抽價
                    </button>
                  </div>
                </div>

                {/* 四個階梯檔位輸入格 */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {/* 單抽 */}
                  <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/80">
                    <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                      單抽基準 (1 Draw)
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-xs text-slate-400 font-mono">$</span>
                      <input
                        type="number"
                        value={currentPlan.price1}
                        onChange={(e) => handlePrice1Change(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-sm font-bold text-white font-mono outline-none focus:border-amber-400"
                      />
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1 font-mono">100% 基準價</div>
                  </div>

                  {/* 3抽 */}
                  <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/80">
                    <div className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider">
                      3 抽打包價 (97折)
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-xs text-slate-400 font-mono">$</span>
                      <input
                        type="number"
                        value={currentPlan.price3}
                        onChange={(e) => updateCurrentPlan('price3', Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-sm font-bold text-indigo-200 font-mono outline-none focus:border-indigo-400"
                      />
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1 font-mono">
                      均 ${currentPlan.price3 ? Math.round(currentPlan.price3 / 3) : 0}/抽
                    </div>
                  </div>

                  {/* 5抽 */}
                  <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/80">
                    <div className="text-[10px] font-bold text-blue-300 uppercase tracking-wider">
                      5 抽打包價 (95折)
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-xs text-slate-400 font-mono">$</span>
                      <input
                        type="number"
                        value={currentPlan.price5}
                        onChange={(e) => updateCurrentPlan('price5', Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-sm font-bold text-blue-200 font-mono outline-none focus:border-blue-400"
                      />
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1 font-mono">
                      均 ${currentPlan.price5 ? Math.round(currentPlan.price5 / 5) : 0}/抽
                    </div>
                  </div>

                  {/* 10抽 */}
                  <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/80">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">
                        10 抽大連抽
                      </span>
                      <button
                        onClick={handleTenPlusOneToggle}
                        className={`text-[9px] px-1.5 py-0.2 rounded font-bold transition ${
                          currentPlan.isTenPlusOne ? 'bg-emerald-500 text-slate-950' : 'bg-slate-700 text-slate-300'
                        }`}
                        title="切換買10送1模式 (抽11抽，付10抽原價)"
                      >
                        {currentPlan.isTenPlusOne ? '10送1開' : '9折優惠'}
                      </button>
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-xs text-slate-400 font-mono">$</span>
                      <input
                        type="number"
                        value={currentPlan.price10}
                        onChange={(e) => updateCurrentPlan('price10', Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-sm font-bold text-emerald-200 font-mono outline-none focus:border-emerald-400"
                      />
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1 font-mono">
                      均 ${currentPlan.price10 ? Math.round(currentPlan.price10 / 10) : 0}/抽
                    </div>
                  </div>
                </div>

                {/* 即時毛利與損益指標列 */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800 font-mono text-xs">
                  <div className="p-2 bg-slate-800/40 rounded-lg">
                    <div className="text-slate-400 text-[10px]">單套獎品總成本 (Cost)</div>
                    <div className="text-sm font-bold text-rose-300 mt-0.5">
                      ${financialSummary.totalCost.toLocaleString()}
                    </div>
                  </div>

                  <div className="p-2 bg-slate-800/40 rounded-lg">
                    <div className="text-slate-400 text-[10px]">預期總營收 (Revenue)</div>
                    <div className="text-sm font-bold text-emerald-300 mt-0.5">
                      ${financialSummary.expectedRevenue.toLocaleString()}
                    </div>
                  </div>

                  <div className="p-2 bg-slate-800/40 rounded-lg">
                    <div className="text-slate-400 text-[10px]">預估現金毛利率 (Margin)</div>
                    <div className={`text-sm font-bold mt-0.5 flex items-center gap-1 ${
                      financialSummary.cashMargin >= 35 ? 'text-emerald-400' : financialSummary.cashMargin >= 20 ? 'text-amber-400' : 'text-rose-400'
                    }`}>
                      {financialSummary.cashMargin}%
                      {financialSummary.cashMargin < 20 && <ShieldAlert className="w-3.5 h-3.5" />}
                    </div>
                  </div>

                  <div className="p-2 bg-slate-800/40 rounded-lg" title="若80%帶走、20%轉為會員點數時的動態毛利率">
                    <div className="text-slate-400 text-[10px]">8:2 轉點期望毛利</div>
                    <div className="text-sm font-bold text-indigo-300 mt-0.5">
                      {financialSummary.hybridMargin}%
                    </div>
                  </div>
                </div>

                {/* 抽數平帳提示橫條 */}
                <div className={`px-3 py-1.5 rounded-xl text-xs flex items-center justify-between ${
                  financialSummary.isBalanced ? 'bg-emerald-950/40 border border-emerald-500/30 text-emerald-300' : 'bg-amber-950/40 border border-amber-500/30 text-amber-300'
                }`}>
                  <div className="flex items-center gap-2">
                    {financialSummary.isBalanced ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-amber-400" />}
                    <span>
                      已配置 <strong className="text-white font-mono">{financialSummary.allocatedDraws}</strong> / {currentPlan.totalDraws} 抽
                      {!financialSummary.isBalanced && (
                        <span className="ml-1 text-rose-300 font-bold">
                          (尚缺 {financialSummary.drawsDiff} 抽未配)
                        </span>
                      )}
                    </span>
                  </div>
                  {!financialSummary.isBalanced && (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleAutoFillSmallPrizeZ('0p')}
                        className="px-2.5 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold rounded-lg transition shadow"
                        title="補平剩餘抽數為 0P 保底小賞 (成本 0 / 點數 0)"
                      >
                        ⚡ 補平 0P
                      </button>
                      <button
                        onClick={() => handleAutoFillSmallPrizeZ('1p')}
                        className="px-2.5 py-0.5 bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-bold rounded-lg transition shadow"
                        title="補平剩餘抽數為 1P 保底小賞 (成本 1 / 點數 1)"
                      >
                        ⚡ 補平 1P
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* 點數套與小賞換點規則 (X 賞盲盒等價點數 / Z 賞 1P / 限定點數套) */}
              <div className="bg-slate-850 p-3 rounded-2xl border border-slate-700/80 flex flex-wrap items-center justify-between gap-3 text-xs shadow-md">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={!!currentPlan.isPointsSet}
                      onChange={(e) => updateCurrentPlan('isPointsSet', e.target.checked)}
                      className="w-4 h-4 rounded text-violet-600 bg-slate-900 border-slate-700 focus:ring-0 cursor-pointer"
                    />
                    <span className={`font-bold ${currentPlan.isPointsSet ? 'text-violet-300' : 'text-slate-300'}`}>
                      🎟️ 限定點數套 (限定只能扣點數抽)
                    </span>
                  </label>

                  {currentPlan.isPointsSet && (
                    <span className="text-[11px] text-violet-400 font-mono bg-violet-950/80 px-2.5 py-0.5 rounded-lg border border-violet-800/60 font-bold">
                      每抽扣除 {Math.max(1, Math.floor(currentPlan.price1 / 20))} pts (單抽價 ${currentPlan.price1} ÷ 20)
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-700">
                  <span className="text-[11px] text-amber-300 font-bold flex items-center gap-1">
                    🎁 X 賞盲盒等價點數:
                  </span>
                  <input
                    type="number"
                    min="1"
                    value={currentPlan.blindBoxPointsValue || 10}
                    onChange={(e) => {
                      const val = Math.max(1, Number(e.target.value) || 10);
                      updateCurrentPlan('blindBoxPointsValue', val);
                      // 同步更新當前所有 X 賞項目的 points
                      const updated = currentPlan.items.map((it) =>
                        it.prizeGrade.toUpperCase() === 'X' ? { ...it, points: val } : it
                      );
                      updateCurrentPlan('items', updated);
                    }}
                    className="w-14 bg-slate-800 text-center font-mono text-xs font-bold text-amber-400 px-1 py-0.5 rounded border border-slate-600 outline-none focus:border-amber-400"
                  />
                  <span className="text-[11px] text-slate-400 font-mono">pts (可微調)</span>
                </div>
              </div>

              {/* 獎項配置表格 (Prize Grid) */}
              <div className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl relative">
                <div className="p-3 bg-slate-850 border-b border-slate-700 flex flex-wrap items-center justify-between gap-2 rounded-t-2xl">
                  <div className="flex items-center gap-2 text-xs font-bold text-white">
                    <Layers className="w-4 h-4 text-amber-400" />
                    <span>獎項配置清單 ({currentPlan.items.length} 賞)</span>
                  </div>

                  {/* 快捷增賞工具列 (對齊 Sheet: 數字大賞, X 盲盒, Z 小賞, LAST) */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      onClick={() => handleAddBigPrize('number')}
                      className="flex items-center gap-1 px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold rounded-lg shadow transition"
                      title="新增數字大賞 (1, 2, 3...)"
                    >
                      <Hash className="w-3 h-3" />
                      + 數字大賞
                    </button>

                    <button
                      onClick={() => handleAddBigPrize('letter')}
                      className="flex items-center gap-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-[11px] font-bold rounded-lg transition"
                      title="新增字母大賞 (A, B, C...)"
                    >
                      + 字母大賞
                    </button>

                    <button
                      onClick={handleAddBlindBoxPrize}
                      className="flex items-center gap-1 px-2 py-1 bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold rounded-lg shadow transition"
                      title="快捷加入 X 賞 (任選盲盒一個，成本 200)"
                    >
                      🎁 + X 盲盒
                    </button>

                    <button
                      onClick={() => handleAddSmallPrize('0p')}
                      className="flex items-center gap-1 px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold rounded-lg shadow transition"
                      title="快捷加入 0P 保底小賞 (成本 0 / 點數 0)"
                    >
                      ⭐ + Z(0P)
                    </button>

                    <button
                      onClick={() => handleAddSmallPrize('1p')}
                      className="flex items-center gap-1 px-2 py-1 bg-emerald-700 hover:bg-emerald-600 text-white text-[11px] font-bold rounded-lg shadow transition"
                      title="快捷加入 1P 保底小賞 (成本 1 / 點數 1)"
                    >
                      ⭐ + Z(1P)
                    </button>

                    <button
                      onClick={() => handleAutoFillSmallPrizeZ('0p')}
                      className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-extrabold rounded-lg shadow transition"
                      title="自動計算剩餘抽數並補入 0P 保底小賞"
                    >
                      ⚡ 補平 0P
                    </button>

                    <button
                      onClick={() => handleAutoFillSmallPrizeZ('1p')}
                      className="px-2 py-1 bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-extrabold rounded-lg shadow transition"
                      title="自動計算剩餘抽數並補入 1P 保底小賞"
                    >
                      ⚡ 補平 1P
                    </button>
                  </div>
                </div>

                <div className="overflow-visible pb-16">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="sticky top-0 bg-slate-900 border-b border-slate-700 text-slate-400 select-none font-semibold z-10">
                      <tr>
                        <th className="px-3 py-2 w-28 text-center">賞位代號</th>
                        <th className="px-3 py-2 w-32">貨號/條碼</th>
                        <th className="px-3 py-2">獎品名稱</th>
                        <th className="px-3 py-2 w-20 text-center">抽數</th>
                        <th className="px-3 py-2 w-24 text-right">成本 (NT$)</th>
                        <th className="px-3 py-2 w-20 text-right">點數</th>
                        <th className="px-3 py-2 w-24 text-right">小計成本</th>
                        <th className="px-2 py-2 w-12 text-center">操作</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-800 text-slate-200 font-mono">
                      {currentPlan.items.map((it) => {
                        const grade = (it.prizeGrade || '').trim().toUpperCase();
                        const isBlindBox = grade === 'X';
                        const isSmallPrize = grade === 'Z' || it.isNonGk || it.productId === '0p';
                        const isLastPrize = grade === 'LAST' || grade === 'LS';

                        return (
                          <tr
                            key={it.id}
                            className={`hover:bg-slate-800/40 transition ${
                              isSmallPrize ? 'bg-emerald-950/20' : isBlindBox ? 'bg-purple-950/20' : ''
                            }`}
                          >
                            {/* 賞位代碼 (自由輸入 + 智能標籤徽章) */}
                            <td className="px-2 py-1.5">
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  value={it.prizeGrade}
                                  onChange={(e) => handleUpdateItem(it.id, 'prizeGrade', e.target.value)}
                                  className={`w-14 text-center font-bold px-1 py-1 rounded border outline-none ${
                                    isSmallPrize
                                      ? 'bg-emerald-950 text-emerald-300 border-emerald-500/50'
                                      : isBlindBox
                                      ? 'bg-purple-950 text-purple-300 border-purple-500/50'
                                      : isLastPrize
                                      ? 'bg-amber-950 text-amber-300 border-amber-500/50'
                                      : 'bg-slate-800 text-amber-300 border-slate-700'
                                  }`}
                                  placeholder="如 1, X, Z"
                                />
                                <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${
                                  isSmallPrize
                                    ? 'bg-emerald-500/20 text-emerald-400'
                                    : isBlindBox
                                    ? 'bg-purple-500/20 text-purple-400'
                                    : isLastPrize
                                    ? 'bg-amber-500/20 text-amber-400'
                                    : 'bg-indigo-500/20 text-indigo-300'
                                }`}>
                                  {isSmallPrize ? 'Z小賞' : isBlindBox ? 'X盲盒' : isLastPrize ? '最後賞' : '大賞'}
                                </span>
                              </div>
                            </td>

                            {/* 貨號代碼 (即時搜尋全店商品與自動帶入品名/成本/點數) */}
                            <td className="px-2 py-1.5 min-w-[140px] relative">
                              <ProductAutocompleteInput
                                itemId={it.id}
                                prizeGrade={it.prizeGrade}
                                value={it.productId}
                                storeId={currentPlan.storeId}
                                onSelectProduct={(prod) => handleSelectProductForItem(it.id, prod)}
                                onChangeValue={(val) => handleUpdateItem(it.id, 'productId', val)}
                              />
                            </td>

                            {/* 獎品名稱 */}
                            <td className="px-2 py-1.5 font-sans">
                              <input
                                type="text"
                                value={it.prizeName}
                                onChange={(e) => handleUpdateItem(it.id, 'prizeName', e.target.value)}
                                className="w-full bg-slate-800 text-white px-2 py-1 rounded border border-slate-700 outline-none font-medium"
                                placeholder="輸入品名或保底名稱"
                              />
                            </td>

                            {/* 抽數 */}
                            <td className="px-2 py-1.5 text-center">
                              <input
                                type="number"
                                min="1"
                                value={it.draws}
                                onChange={(e) => handleUpdateItem(it.id, 'draws', Math.max(1, parseInt(e.target.value, 10) || 1))}
                                className="w-16 bg-slate-800 text-white text-center px-1 py-1 rounded border border-slate-700 outline-none font-bold"
                              />
                            </td>

                            {/* 單件成本 */}
                            <td className="px-2 py-1.5 text-right">
                              <input
                                type="number"
                                value={it.costPrice}
                                onChange={(e) => handleUpdateItem(it.id, 'costPrice', Number(e.target.value))}
                                className="w-20 bg-slate-800 text-slate-300 text-right px-1.5 py-1 rounded border border-slate-700 outline-none"
                              />
                            </td>

                            {/* 可轉點數 */}
                            <td className="px-2 py-1.5 text-right">
                              <input
                                type="number"
                                value={it.points}
                                onChange={(e) => handleUpdateItem(it.id, 'points', Number(e.target.value))}
                                className="w-16 bg-slate-800 text-indigo-300 text-right px-1.5 py-1 rounded border border-slate-700 outline-none"
                              />
                            </td>

                            {/* 小計成本 */}
                            <td className="px-3 py-1.5 text-right font-bold text-rose-300">
                              ${((it.draws || 0) * (it.costPrice || 0)).toLocaleString()}
                            </td>

                            {/* 刪除 */}
                            <td className="px-2 py-1.5 text-center">
                              <button
                                onClick={() => handleDeleteItem(it.id)}
                                className="p-1 hover:bg-slate-800 text-slate-500 hover:text-rose-400 rounded transition"
                                title="移除此賞位"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* ── 右側門市即時現貨參考看板 (4 欄 · 浮動跟隨 · 緊湊多列 · 跨套組正在配防重複) ── */}
            <div className="xl:col-span-4 sticky top-4 max-h-[calc(100vh-2rem)] flex flex-col bg-slate-900 border border-slate-700/80 rounded-2xl p-3 shadow-2xl z-20">
              {/* 看板頂部標題 */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-800 shrink-0">
                <div className="flex items-center gap-1.5">
                  <Store className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-bold text-white">門市現貨參考看板</h3>
                  <span className="text-[10px] text-slate-400 font-mono">
                    (共 {liveStockItems.length} 款)
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20" title="包含工作台所有方案正在配且未發布的即時累加總量">
                    正在配防撞
                  </span>
                </div>
              </div>

              {/* 門市、大項分類與搜尋篩選器 */}
              <div className="space-y-1.5 py-2 border-b border-slate-800 shrink-0">
                {/* 大項切換：預設 GK 雕像，不拿盲盒配賞 */}
                <div className="flex items-center gap-1 p-0.5 bg-slate-900 border border-slate-700/80 rounded-lg text-[10px]">
                  <button
                    type="button"
                    onClick={() => { setStockMainTypeFilter('GK'); setStockCategoryFilter('ALL'); }}
                    className={`flex-1 py-1 rounded text-center font-bold transition ${
                      stockMainTypeFilter === 'GK'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    👑 GK 雕像 (預設)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setStockMainTypeFilter('ALL'); setStockCategoryFilter('ALL'); }}
                    className={`flex-1 py-1 rounded text-center transition ${
                      stockMainTypeFilter === 'ALL'
                        ? 'bg-slate-700 text-white font-bold shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    全部商品
                  </button>
                  <button
                    type="button"
                    onClick={() => { setStockMainTypeFilter('BLIND_BOX'); setStockCategoryFilter('ALL'); }}
                    className={`flex-1 py-1 rounded text-center transition ${
                      stockMainTypeFilter === 'BLIND_BOX'
                        ? 'bg-pink-600 text-white font-bold shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    🎁 盒玩盲盒
                  </button>
                </div>

                <div className="flex gap-1.5 text-xs">
                  <select
                    value={stockStoreFilter}
                    onChange={(e) => setStockStoreFilter(e.target.value)}
                    className="flex-1 px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 outline-none text-[11px]"
                  >
                    <option value="ALL">全店門市現貨</option>
                    {stores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={stockCategoryFilter}
                    onChange={(e) => setStockCategoryFilter(e.target.value)}
                    className="flex-1 px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 outline-none text-[11px]"
                  >
                    <option value="ALL">全部類別</option>
                    {availableCategories.length > 0 ? (
                      availableCategories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="GK">GK 雕像</option>
                        <option value="海賊王">海賊王</option>
                        <option value="GENERAL">一般周邊</option>
                        <option value="BLIND_BOX">盲盒</option>
                      </>
                    )}
                  </select>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                  <input
                    type="text"
                    value={stockSearchInput}
                    onChange={(e) => setStockSearchInput(e.target.value)}
                    placeholder="搜尋品名/貨號..."
                    className="w-full pl-8 pr-3 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 outline-none"
                  />
                </div>
              </div>

              {/* 欄位小表頭 */}
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 px-2 py-1 shrink-0 border-b border-slate-800/80">
                <span>貨號 · 品名</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-11 text-right">成本</span>
                  <span className="text-center w-[96px]">現貨 ┆ 沙盤狀態</span>
                  <span className="w-5 text-center">配</span>
                </div>
              </div>

              {/* 現貨清單滾動容器 (沙盤推演雙聯儀表流) */}
              <div className="flex-1 overflow-y-auto pr-1 py-1 space-y-1">
                {stockLoading ? (
                  <div className="py-8 text-center text-slate-500 text-xs">
                    <RotateCw className="w-4 h-4 animate-spin mx-auto text-amber-400 mb-1" />
                    載入店內現貨與在場抽況中...
                  </div>
                ) : liveStockItems.length === 0 ? (
                  <div className="py-8 text-center text-slate-500 text-xs">
                    目前無符合條件之現貨 (店內庫存 &gt; 0)
                  </div>
                ) : (
                  liveStockItems.map((prod) => {
                    const sStock = stockStoreFilter === 'ALL'
                      ? (prod.totalStock ?? prod.stock ?? 0)
                      : ((prod.storeStocks && prod.storeStocks[stockStoreFilter]) ?? prod.stock ?? 0);
                    const sAlloc = stockStoreFilter === 'ALL'
                      ? (prod.totalAllocated ?? prod.allocatedCount ?? 0)
                      : ((prod.storeAllocated && prod.storeAllocated[stockStoreFilter]) ?? prod.allocatedCount ?? 0);

                    // 1. 統計沙盤推演各維度用量
                    const workbenchAlloc = workbenchAllocMap.get(prod.id) || 0;
                    // 當前編輯中的這套方案配入的數量
                    const thisPlanQty = currentPlan.items
                      .filter((it) => it.productId === prod.id)
                      .reduce((s, it) => s + (Number(it.draws) || 0), 0);
                    // 其他草稿方案配入的數量
                    const otherPlanAlloc = Math.max(0, workbenchAlloc - thisPlanQty);

                    // 跨套沙盤參與的總方案數 (判斷是否有 2 套以上正在「想想看」同個商品)
                    const plansInvolvedCount = plans.filter((p) =>
                      p.items.some((it) => it.productId === prod.id && (Number(it.draws) || 0) > 0)
                    ).length;

                    // 物理與推演衝突判斷
                    const totalDemand = sAlloc + workbenchAlloc;
                    const isOverPhysical = totalDemand > sStock; // 總需求大於實體庫存
                    const isMultiPlanCollision = sStock <= 1 && plansInvolvedCount > 1; // 獨一無二GK被多套同時試配 (沙盤撞車)

                    // 深度 Tooltip 說明 (讓老闆隨時懸停查看沙盤試算盤面)
                    const tooltipText = `【${prod.name}】\n` +
                      `• 門市實體現貨: ${sStock} 尊\n` +
                      `• 在場機台已開抽: ${sAlloc} 尊\n` +
                      `────────────────────────\n` +
                      `• 當前方案試配: ${thisPlanQty} 尊\n` +
                      `• 其他草稿方案試配: ${otherPlanAlloc} 尊 (共 ${plansInvolvedCount} 個方案試用中)\n` +
                      `────────────────────────\n` +
                      (isMultiPlanCollision ? `⚠️ 提醒：此品項為極少現貨，多個方案正在沙盤試配中，正式發布前需擇一保留。\n` : '') +
                      (isOverPhysical ? `🚨 警告：總試配量 (${totalDemand}) 超出實體現貨 (${sStock})！` : `▸ 扣除目前所有試配後淨餘: ${sStock - totalDemand}`);

                    return (
                      <div
                        key={prod.id}
                        className={`h-[34px] px-2 flex items-center justify-between gap-1.5 rounded-lg border text-xs transition group ${
                          isOverPhysical
                            ? 'bg-rose-950/25 border-rose-500/50 hover:bg-rose-950/40'
                            : isMultiPlanCollision
                            ? 'bg-amber-950/20 border-amber-500/40 hover:bg-amber-950/35'
                            : thisPlanQty > 0
                            ? 'bg-indigo-950/25 border-indigo-500/40 hover:bg-indigo-950/40'
                            : 'bg-slate-850/80 border-slate-750/70 hover:bg-slate-800 hover:border-slate-600'
                        }`}
                        title={tooltipText}
                      >
                        {/* 左側：貨號 + 純品名 + 當前方案配入量標記 */}
                        <div className="min-w-0 flex-1 flex items-center gap-1.5 overflow-hidden">
                          <span className="font-mono text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1 py-0.5 rounded shrink-0">
                            #{prod.id}
                          </span>
                          <span
                            className="text-xs font-medium text-slate-200 truncate group-hover:text-amber-300 transition cursor-default"
                            title={prod.name}
                          >
                            {cleanPrizeName(prod.name)}
                          </span>
                          {thisPlanQty > 0 && (
                            <span
                              className="text-[9px] font-mono font-bold text-indigo-300 bg-indigo-500/20 px-1 py-0.2 rounded shrink-0 border border-indigo-500/30"
                              title={`當前方案正在試配 ${thisPlanQty} 件`}
                            >
                              本套x{thisPlanQty}
                            </span>
                          )}
                        </div>

                        {/* 右側：成本 + 【實體 vs 沙盤雙聯徽章】 + 快速試配按鈕 */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* 成本 */}
                          <span className="font-mono text-xs font-bold text-rose-300 w-11 text-right">
                            ${Number(prod.costPrice || 0).toLocaleString()}
                          </span>

                          {/* 雙聯微型狀態徽章 (固定寬度 96px，左邊實體現貨，右邊沙盤動態) */}
                          <div className="w-[96px] inline-flex rounded overflow-hidden border border-slate-700/80 text-[10px] font-mono shrink-0 select-none shadow-sm">
                            {/* 左半部：始終清晰可見的實體現貨真理 */}
                            <div className="bg-slate-800 text-slate-300 px-1.5 py-0.5 font-bold border-r border-slate-700/60 shrink-0">
                              現{sStock}
                            </div>

                            {/* 右半部：動態沙盤推演語意 */}
                            <div
                              className={`flex-1 px-1 py-0.5 font-bold text-center truncate ${
                                isOverPhysical
                                  ? 'bg-rose-500/25 text-rose-300 animate-pulse'
                                  : isMultiPlanCollision
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : sAlloc > 0 && sStock <= sAlloc
                                  ? 'bg-slate-800 text-slate-400'
                                  : thisPlanQty > 0
                                  ? 'bg-indigo-500/20 text-indigo-300'
                                  : otherPlanAlloc > 0
                                  ? 'bg-purple-500/15 text-purple-300'
                                  : 'bg-emerald-500/15 text-emerald-300'
                              }`}
                            >
                              {isOverPhysical
                                ? `超配${Math.abs(sStock - totalDemand)}`
                                : isMultiPlanCollision
                                ? `${plansInvolvedCount}套共用`
                                : sAlloc > 0 && sStock <= sAlloc
                                ? `機台抽中`
                                : thisPlanQty > 0
                                ? `本套試配`
                                : otherPlanAlloc > 0
                                ? `他套試算`
                                : `可試配`}
                            </div>
                          </div>

                          {/* 快速試配小按鈕 (永不 disabled！允許老闆樂觀探索試算，撞車時視覺溫和提醒) */}
                          <button
                            onClick={() => handlePickStockItem(prod)}
                            className={`w-5 h-5 flex items-center justify-center rounded transition shadow shrink-0 cursor-pointer ${
                              isOverPhysical || isMultiPlanCollision
                                ? 'bg-amber-500/80 hover:bg-amber-400 text-slate-950 active:scale-95 border border-amber-300/40'
                                : 'bg-amber-500 hover:bg-amber-400 text-slate-950 hover:scale-105 active:scale-95 shadow-amber-500/20'
                            }`}
                            title={
                              isMultiPlanCollision
                                ? '加入當前方案試算（注意：此品項已有其他方案試配中，發布前需擇一）'
                                : '帶入賞位試算'
                            }
                          >
                            <Plus className="w-3.5 h-3.5 stroke-[3]" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
