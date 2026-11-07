import { useState, useEffect, useRef, useCallback } from 'react';
import { inventoryApi, storesApi } from '../../../api/client';
import type { InventoryItem, StoreItem } from '../types.js';

export function useInventoryData() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMainType, setSelectedMainType] = useState<'ALL' | 'GK' | 'BLIND_BOX'>('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedStoreId, setSelectedStoreId] = useState('all');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const lastReqIdRef = useRef(0);

  // 門市自適應擴展狀態
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [visibleStoreIds, setVisibleStoreIds] = useState<string[]>([]);
  const isSingleStore = stores.length <= 1;

  // 排序狀態 (預設: 最新建立優先 createdAt DESC)
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // 伺服器端分頁與統計狀態
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [metaInfo, setMetaInfo] = useState<{ totalProducts: number; lowStockCount: number }>({
    totalProducts: 0,
    lowStockCount: 0,
  });

  // 系統所有商品分類清單
  const [categories, setCategories] = useState<string[]>([
    '海賊王', '火影忍者', '寶可夢', '七龍珠', '咒術迴戰', '獵人',
    '鬼滅之刃', '灌籃高手', '宮崎駿', '蠟筆小新', '數碼寶貝', '遊戲王',
    '間諜家家酒', '潮玩盲盒', '國漫', '阿拉雷', '綜合其他',
    '火影', '小新', '安妮雅', '鏈鋸咒術', '潮玩', '綜合', 'GK', 'BLIND_BOX', 'GENERAL', 'FIGURE'
  ]);

  const registerNewCategory = useCallback((newCat: string) => {
    const trimmed = newCat.trim();
    if (!trimmed) return;
    setCategories((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
  }, []);

  // 250ms 搜尋輸入防抖
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // 載入門市主檔與商品分類清單
  useEffect(() => {
    storesApi.list().then((res) => {
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        setStores(res.data);
        setVisibleStoreIds(res.data.map((s: any) => s.id));
      }
    }).catch(() => {});

    inventoryApi.getCategories().then((res: any) => {
      if (res?.success && Array.isArray(res.data) && res.data.length > 0) {
        setCategories((prev) => {
          const set = new Set([...prev, ...res.data]);
          return Array.from(set);
        });
      }
    }).catch(() => {});
  }, []);

  // 搜尋或過濾重設頁碼
  useEffect(() => {
    setPage(1);
  }, [searchTerm, selectedMainType, selectedCategory, selectedStoreId, lowStockOnly, pageSize, sortBy, sortOrder]);

  const loadInventory = useCallback(async () => {
    const curReqId = ++lastReqIdRef.current;
    setLoading(true);
    try {
      const res = await inventoryApi.summary({
        q: searchTerm || undefined,
        mainCategory: selectedMainType !== 'ALL' ? selectedMainType : undefined,
        category: selectedCategory !== 'ALL' ? selectedCategory : undefined,
        storeId: selectedStoreId !== 'all' ? selectedStoreId : undefined,
        lowStockOnly,
        page,
        pageSize,
        sortBy,
        sortOrder,
      });

      if (curReqId !== lastReqIdRef.current) return;

      if (res.success) {
        setItems(res.data);
        if (res.stores && Array.isArray(res.stores) && res.stores.length > 0) {
          setStores(res.stores);
          setVisibleStoreIds((prev) => {
            if (prev.length === 0) return res.stores.map((s: any) => s.id);
            const existingIds = new Set(prev);
            const valid = res.stores.filter((s: any) => existingIds.has(s.id)).map((s: any) => s.id);
            return valid.length > 0 ? valid : res.stores.map((s: any) => s.id);
          });
        }
        if (res.pagination) {
          setTotalItems(res.pagination.total);
          setTotalPages(res.pagination.totalPages || 1);
        } else {
          setTotalItems(res.data.length);
          setTotalPages(1);
        }
        if (res.meta) {
          setMetaInfo({
            totalProducts: res.meta.totalProducts || 0,
            lowStockCount: res.meta.lowStockCount || 0,
          });
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, selectedMainType, selectedCategory, selectedStoreId, lowStockOnly, page, pageSize, sortBy, sortOrder]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  const handleSortToggle = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const toggleStoreVisibility = (storeId: string) => {
    if (visibleStoreIds.includes(storeId)) {
      if (visibleStoreIds.length === 1) return;
      setVisibleStoreIds(visibleStoreIds.filter((id) => id !== storeId));
    } else {
      setVisibleStoreIds([...visibleStoreIds, storeId]);
    }
  };

  return {
    items,
    setItems,
    loading,
    searchInput,
    setSearchInput,
    searchTerm,
    setSearchTerm,
    selectedMainType,
    setSelectedMainType,
    selectedCategory,
    setSelectedCategory,
    selectedStoreId,
    setSelectedStoreId,
    lowStockOnly,
    setLowStockOnly,
    stores,
    isSingleStore,
    visibleStoreIds,
    toggleStoreVisibility,
    sortBy,
    sortOrder,
    handleSortToggle,
    page,
    setPage,
    pageSize,
    setPageSize,
    totalItems,
    totalPages,
    metaInfo,
    categories,
    registerNewCategory,
    loadInventory,
  };
}
