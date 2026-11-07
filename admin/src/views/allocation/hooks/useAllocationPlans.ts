import { useState, useEffect, useRef, useCallback } from 'react';
import { SetPlan, AllocationPrizeItem, NamingMode, LiveStockItem } from '../types';
import { cleanPrizeName, formatPrizeNameWithGrade, getTopPrizeName, computeNextGrade } from '../utils/calculations';

export const defaultInitialPlan: SetPlan = {
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

interface UseAllocationPlansOptions {
  onNotify?: (msg: { type: 'success' | 'error'; text: string }) => void;
}

export function useAllocationPlans(options?: UseAllocationPlansOptions) {
  const { onNotify } = options || {};

  // ── 賞位命名模式: 'number' (1, 2, 3...) | 'letter' (A, B, C...) ──
  const [namingMode, setNamingMode] = useState<NamingMode>('number');

  // ── 多套配賞方案狀態 (Multi-Set Batch Plans) ──
  const [plans, setPlans] = useState<SetPlan[]>([defaultInitialPlan]);
  const [activePlanIdx, setActivePlanIdx] = useState<number>(0);
  const currentPlan = plans[activePlanIdx] || plans[0] || defaultInitialPlan;

  // ── 自動防呆暫存與還原通知 ──
  const [lastAutoSavedTime, setLastAutoSavedTime] = useState<string | null>(null);
  const [restoredNotice, setRestoredNotice] = useState<string | null>(null);
  const isInitialMount = useRef(true);

  // ── 1. 頁面加載時自動還原上次配到一半的進度 (Auto-Restore) ──
  useEffect(() => {
    try {
      const cached = localStorage.getItem('onesoul_allocation_workspace');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed.plans) && parsed.plans.length > 0) {
          // 清洗舊草稿中的「1號賞/A賞」前綴，只保留乾淨純品名
          const cleanedPlans: SetPlan[] = parsed.plans.map((p: any) => ({
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
          const timeStr = parsed.savedAt
            ? new Date(parsed.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : '';
          setRestoredNotice(`已為您自動還原上次配到一半的進度${timeStr ? ` (保存於 ${timeStr})` : ''}，可繼續編輯！`);
          setTimeout(() => setRestoredNotice(null), 6000);
        }
      }
    } catch (e) {
      console.warn('Auto restore draft failed:', e);
    }
  }, []);

  // ── 2. 即時自動保存至 LocalStorage (Auto-Save on every change) ──
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const timer = setTimeout(() => {
      try {
        const now = new Date();
        localStorage.setItem(
          'onesoul_allocation_workspace',
          JSON.stringify({
            plans,
            activePlanIdx,
            savedAt: now.toISOString(),
          })
        );
        setLastAutoSavedTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      } catch (e) {
        // ignore
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [plans, activePlanIdx]);

  // ── 更新當前套組方案的欄位 ──
  const updateCurrentPlan = useCallback((field: keyof SetPlan, val: any) => {
    setPlans((prev) =>
      prev.map((p, idx) => (idx === activePlanIdx ? { ...p, [field]: val } : p))
    );
  }, [activePlanIdx]);

  // ── 新增配賞套組 ──
  const handleAddNewPlan = useCallback(() => {
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
    setPlans((prev) => [...prev, newPlan]);
    setActivePlanIdx(plans.length);
  }, [plans.length, currentPlan.storeId, currentPlan.blindBoxPointsValue]);

  // ── 複製當前套組 ──
  const handleDuplicateCurrentPlan = useCallback(() => {
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
    setPlans((prev) => [...prev, duplicated]);
    setActivePlanIdx(plans.length);
  }, [plans.length, currentPlan]);

  // ── 移除指定套組 ──
  const handleRemovePlan = useCallback((idxToRemove: number) => {
    if (plans.length <= 1) {
      alert('至少需保留一個配賞套組方案');
      return;
    }
    const updated = plans.filter((_, idx) => idx !== idxToRemove);
    setPlans(updated);
    setActivePlanIdx(Math.max(0, idxToRemove - 1));
  }, [plans]);

  // ── 臨時有事先放著 (掛單暫存) ──
  const handleParkCurrentPlan = useCallback(() => {
    setPlans((prev) => prev.map((p, idx) => (idx === activePlanIdx ? { ...p, isParked: true } : p)));
    if (onNotify) {
      onNotify({
        type: 'success',
        text: `已為您將「${currentPlan.name}」暫存掛單！隨時可開新方案或點擊上方標籤切回繼續配。`,
      });
    }
  }, [activePlanIdx, currentPlan.name, onNotify]);

  // ── 解除掛單繼續配 ──
  const handleResumeParkedPlan = useCallback((idx: number) => {
    setPlans((prev) => prev.map((p, i) => (i === idx ? { ...p, isParked: false } : p)));
    setActivePlanIdx(idx);
  }, []);

  // ── 獎項新增 (依命名風格帶入數字或字母) ──
  const handleAddBigPrize = useCallback((type: NamingMode = namingMode) => {
    const nextGrade = computeNextGrade(currentPlan.items, type);

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
    const items = currentPlan.items;
    const lastItem = items[items.length - 1];
    if (lastItem && (lastItem.prizeGrade.toUpperCase() === 'Z' || lastItem.isNonGk || lastItem.productId === '0p')) {
      const copy = [...items];
      copy.splice(copy.length - 1, 0, newItem);
      updateCurrentPlan('items', copy);
    } else {
      updateCurrentPlan('items', [...items, newItem]);
    }
  }, [currentPlan.items, namingMode, updateCurrentPlan]);

  // ── 快捷新增 X 盲盒賞 ──
  const handleAddBlindBoxPrize = useCallback(() => {
    const newItem: AllocationPrizeItem = {
      id: `it-x-${Date.now()}`,
      prizeGrade: 'X',
      prizeName: '任選盲盒一個',
      productId: 'X',
      draws: 5,
      costPrice: 200,
      points: currentPlan.blindBoxPointsValue || 10,
    };
    const items = currentPlan.items;
    const lastItem = items[items.length - 1];
    if (lastItem && (lastItem.prizeGrade.toUpperCase() === 'Z' || lastItem.isNonGk)) {
      const copy = [...items];
      copy.splice(copy.length - 1, 0, newItem);
      updateCurrentPlan('items', copy);
    } else {
      updateCurrentPlan('items', [...items, newItem]);
    }
  }, [currentPlan.items, currentPlan.blindBoxPointsValue, updateCurrentPlan]);

  // ── 快捷新增 Z 小賞 ──
  const handleAddSmallPrize = useCallback((type: '1p' | '0p' = '1p') => {
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
  }, [currentPlan.items, updateCurrentPlan]);

  // ── 快捷新增 LAST 最後賞 ──
  const handleAddLastPrize = useCallback(() => {
    const newItem: AllocationPrizeItem = {
      id: `it-last-${Date.now()}`,
      prizeGrade: 'LAST',
      prizeName: '最後賞 特別限定版雕像',
      productId: '',
      draws: 1,
      costPrice: 3500,
      points: 150,
    };
    const items = currentPlan.items;
    const lastItem = items[items.length - 1];
    if (lastItem && (lastItem.prizeGrade.toUpperCase() === 'Z' || lastItem.isNonGk)) {
      const copy = [...items];
      copy.splice(copy.length - 1, 0, newItem);
      updateCurrentPlan('items', copy);
    } else {
      updateCurrentPlan('items', [...items, newItem]);
    }
  }, [currentPlan.items, updateCurrentPlan]);

  // ── 一鍵補平 Z 小賞抽數 (自動平帳) ──
  const handleAutoFillSmallPrizeZ = useCallback((type: '0p' | '1p' = '0p') => {
    const { totalDraws, items } = currentPlan;
    const isZero = type === '0p';
    const targetName = isZero ? '非GK保底小賞 (0P)' : '非GK保底小賞 (1P)';
    const targetCost = isZero ? 0 : 1;
    const targetPoints = isZero ? 0 : 1;

    // 找出 Z 小賞 (代碼為 Z 或 isNonGk 或 0p/1p)
    const zItem = items.find(
      (it) => it.prizeGrade.toUpperCase() === 'Z' || it.isNonGk || it.productId === '0p' || it.productId === '1p'
    );
    // 計算除了 Z 之外其他所有賞的抽數總和
    const otherDraws = items.filter((it) => it !== zItem).reduce((sum, it) => sum + (Number(it.draws) || 0), 0);
    const remainingDraws = Math.max(0, totalDraws - otherDraws);

    if (zItem) {
      const updated = items.map((it) =>
        it.id === zItem.id
          ? {
              ...it,
              prizeGrade: 'Z',
              productId: type,
              prizeName: targetName,
              costPrice: targetCost,
              points: targetPoints,
              draws: remainingDraws,
              isNonGk: true,
            }
          : it
      );
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
  }, [currentPlan, updateCurrentPlan]);

  // ── 從 Autocomplete 選中商品時智慧帶入 ──
  const handleSelectProductForItem = useCallback((itemId: string, product: any) => {
    const updated = currentPlan.items.map((it) => {
      if (it.id !== itemId) return it;
      return {
        ...it,
        productId: product.id,
        prizeName: it.isPrizeNameCustomized ? it.prizeName : cleanPrizeName(product.name),
        costPrice: product.costPrice || 0,
        points: product.suggestedPoints || Math.round((product.sellingPrice || 0) * 0.05),
        isNonGk: false,
      };
    });

    const topName = getTopPrizeName(updated);
    const newName = !currentPlan.isNameCustomized && topName ? topName : currentPlan.name;
    setPlans((prev) =>
      prev.map((p, idx) => (idx === activePlanIdx ? { ...p, name: newName, items: updated } : p))
    );
  }, [currentPlan, activePlanIdx]);

  // ── 更新賞位項目 ──
  const handleUpdateItem = useCallback((
    id: string,
    field: keyof AllocationPrizeItem,
    val: any,
    liveStockItems?: LiveStockItem[]
  ) => {
    const updated = currentPlan.items.map((it) => {
      if (it.id !== id) return it;
      const itemUpdated = { ...it, [field]: val };
      if (field === 'prizeName') {
        itemUpdated.isPrizeNameCustomized = true;
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
          itemUpdated.points = currentPlan.blindBoxPointsValue || 10;
          itemUpdated.isNonGk = false;
          itemUpdated.isPrizeNameCustomized = false;
        } else if (liveStockItems) {
          const matched = liveStockItems.find((p) => p.id === trimmed || p.barcode === trimmed);
          if (matched) {
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
    const newName = !currentPlan.isNameCustomized && topName ? topName : currentPlan.name;
    setPlans((prev) =>
      prev.map((p, idx) => (idx === activePlanIdx ? { ...p, name: newName, items: updated } : p))
    );
  }, [currentPlan, activePlanIdx]);

  // ── 刪除賞位項目 ──
  const handleDeleteItem = useCallback((id: string) => {
    const updated = currentPlan.items.filter((it) => it.id !== id);
    const topName = getTopPrizeName(updated);
    const newName = !currentPlan.isNameCustomized && topName ? topName : currentPlan.name;
    setPlans((prev) =>
      prev.map((p, idx) => (idx === activePlanIdx ? { ...p, name: newName, items: updated } : p))
    );
  }, [currentPlan, activePlanIdx]);

  // ── 從現貨看板快速配入 ──
  const handlePickStockItem = useCallback((stockItem: LiveStockItem) => {
    const { items } = currentPlan;

    // 1. 優先尋找尚未填寫商品的實體大獎列
    const emptyIndex = items.findIndex(
      (it) => !it.isNonGk && it.prizeGrade.toUpperCase() !== 'X' && it.prizeGrade.toUpperCase() !== 'Z' && !it.productId
    );

    let updatedItems: AllocationPrizeItem[];

    if (emptyIndex >= 0) {
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
      const nextGrade = computeNextGrade(items, namingMode);
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

    const topName = getTopPrizeName(updatedItems);
    const newName = !currentPlan.isNameCustomized && topName ? topName : currentPlan.name;

    setPlans((prev) =>
      prev.map((p, idx) => (idx === activePlanIdx ? { ...p, name: newName, items: updatedItems } : p))
    );
  }, [currentPlan, namingMode, activePlanIdx]);

  return {
    plans,
    activePlanIdx,
    currentPlan,
    namingMode,
    setNamingMode,
    setActivePlanIdx,
    lastAutoSavedTime,
    restoredNotice,
    clearRestoredNotice: () => setRestoredNotice(null),
    updateCurrentPlan,
    handleAddNewPlan,
    handleDuplicateCurrentPlan,
    handleRemovePlan,
    handleParkCurrentPlan,
    handleResumeParkedPlan,
    handleAddBigPrize,
    handleAddBlindBoxPrize,
    handleAddSmallPrize,
    handleAddLastPrize,
    handleAutoFillSmallPrizeZ,
    handleSelectProductForItem,
    handleUpdateItem,
    handleDeleteItem,
    handlePickStockItem,
    setPlans,
  };
}
