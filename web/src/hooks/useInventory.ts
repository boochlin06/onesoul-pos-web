import { useState, useCallback, useEffect } from 'react';
import type { StockEntry, BlindBoxEntry, Branch } from '../types';
import { gasPost } from '../services/api';
import { getLocalCache, setLocalCache } from '../services/localDb';

export function useStocks(branch: Branch) {
  const [stocks, setStocks] = useState<StockEntry[]>([]);
  const [loadingStocks, setLoadingStocks] = useState(false);

  const fetchStocks = useCallback(() => {
    setLoadingStocks(true);
    gasPost('getStockList', { branch })
      .then(res => { if (res.success && res.data) setStocks(res.data); })
      .catch(e => console.error('[useStocks] fetch failed:', e))
      .finally(() => setLoadingStocks(false));
  }, [branch]);

  // 切換門市時自動重新載入
  useEffect(() => { fetchStocks(); }, [fetchStocks]);

  return { stocks, loadingStocks, fetchStocks };
}

export function useAllStocks() {
  const [allStocks, setAllStocks] = useState<StockEntry[]>([]);
  const [loadingAllStocks, setLoadingAllStocks] = useState(false);

  const fetchAllStocks = useCallback(() => {
    setLoadingAllStocks(true);
    gasPost('getStockList', { branch: '全部' })
      .then(res => { if (res.success && res.data) setAllStocks(res.data); })
      .catch(e => console.error('[useAllStocks] fetch failed:', e))
      .finally(() => setLoadingAllStocks(false));
  }, []);

  useEffect(() => {
    fetchAllStocks();
  }, [fetchAllStocks]);

  return { allStocks, loadingAllStocks, fetchAllStocks };
}

export function useBlindBoxes() {
  const [blindBoxes, setBlindBoxes] = useState<BlindBoxEntry[]>([]);
  const [loadingBlindBox, setLoadingBlindBox] = useState(false);

  // ⚡ 開機 0ms 從 IndexedDB 本地快取秒開，讓商品條碼掃碼帶入即刻就緒
  useEffect(() => {
    getLocalCache<BlindBoxEntry[]>('blindBoxes').then(cached => {
      if (cached && cached.length > 0) {
        setBlindBoxes(cached);
      }
    });
  }, []);

  const fetchBlindBoxes = useCallback(() => {
    setLoadingBlindBox(true);
    gasPost('getBlindBoxList')
      .then(res => {
        if (res.success && res.data) {
          setBlindBoxes(res.data);
          setLocalCache('blindBoxes', res.data);
        }
      })
      .catch(e => console.error('[useBlindBoxes] fetch failed:', e))
      .finally(() => setLoadingBlindBox(false));
  }, []);

  return { blindBoxes, loadingBlindBox, fetchBlindBoxes };
}
