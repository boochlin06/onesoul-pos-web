import { useState, useEffect, useCallback } from 'react';
import { allocationApi, settingsApi } from '../../../api/client';
import { LiveStockItem, StoreOption, StockMainType } from '../types';

interface UseLiveStockOptions {
  onBrandPointsLoaded?: (value: number) => void;
}

export function useLiveStock(options?: UseLiveStockOptions) {
  const { onBrandPointsLoaded } = options || {};

  // ── 門市清單 ──
  const [stores, setStores] = useState<StoreOption[]>([
    { id: 'chupei', name: '竹北旗艦店' },
    { id: 'jinshan', name: '金山概念店' },
  ]);

  // ── 側邊門市現貨看板狀態 ──
  const [stockStoreFilter, setStockStoreFilter] = useState<string>('ALL');
  const [stockMainTypeFilter, setStockMainTypeFilter] = useState<StockMainType>('GK'); // 預設僅篩選 GK 雕像
  const [stockCategoryFilter, setStockCategoryFilter] = useState<string>('ALL');
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [stockSearchInput, setStockSearchInput] = useState<string>('');
  const [stockSearch, setStockSearch] = useState<string>('');
  const [liveStockItems, setLiveStockItems] = useState<LiveStockItem[]>([]);
  const [stockLoading, setStockLoading] = useState<boolean>(false);

  // 搜尋防抖 (200ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setStockSearch(stockSearchInput.trim());
    }, 200);
    return () => clearTimeout(timer);
  }, [stockSearchInput]);

  // 載入門市現貨
  const loadLiveStock = useCallback(async () => {
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
        if (res.stores && Array.isArray(res.stores)) setStores(res.stores);
        if (res.categories && Array.isArray(res.categories)) setAvailableCategories(res.categories);
      }
    } catch (err) {
      console.error('Failed to load live stock:', err);
    } finally {
      setStockLoading(false);
    }
  }, [stockStoreFilter, stockMainTypeFilter, stockCategoryFilter, stockSearch]);

  // 載入店家品牌設定 (如 X 賞盲盒等價點數)
  const loadBrandConfig = useCallback(async () => {
    try {
      const res = await settingsApi.getBrand();
      if (res.success && res.data?.blindBoxPointsValue) {
        const val = Number(res.data.blindBoxPointsValue) || 10;
        if (onBrandPointsLoaded) {
          onBrandPointsLoaded(val);
        }
      }
    } catch (err) {
      console.error('Failed to load brand config:', err);
    }
  }, [onBrandPointsLoaded]);

  useEffect(() => {
    loadLiveStock();
  }, [loadLiveStock]);

  useEffect(() => {
    loadBrandConfig();
  }, [loadBrandConfig]);

  return {
    stores,
    liveStockItems,
    stockLoading,
    availableCategories,
    stockStoreFilter,
    setStockStoreFilter,
    stockMainTypeFilter,
    setStockMainTypeFilter,
    stockCategoryFilter,
    setStockCategoryFilter,
    stockSearchInput,
    setStockSearchInput,
    stockSearch,
    loadLiveStock,
    loadBrandConfig,
  };
}
