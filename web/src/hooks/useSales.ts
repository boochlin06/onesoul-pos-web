import { useState, useEffect, useCallback } from 'react';
import type { Branch, SalesEntry, DailySalesEntry, SalesRecordEntry } from '../types';
import { gasPost } from '../services/api';
import { SALES_RECORDS_LIMIT } from '../config';
import type { BannerState } from './useBanner';
import { MSG } from '../constants/messages';

interface UseDailySalesDeps {
  branch: Branch;
  showBanner: (msg: string, type: BannerState['type'], autoDismiss?: boolean) => void;
  fetchMembers: () => void;
}

export function useDailySales({ branch, showBanner, fetchMembers }: UseDailySalesDeps) {
  const [dailySales, setDailySales] = useState<DailySalesEntry[]>([]);
  const [loadingDaily, setLoadingDaily] = useState(false);

  const fetchDailySales = useCallback(() => {
    setLoadingDaily(true);
    gasPost('getDailySales', { branch })
      .then(res => {
        if (res.success && res.data) {
          const cleaned = (res.data as SalesEntry[]).filter(r => {
            const uid = r.checkoutUID?.toString().trim().toLowerCase() || '';
            const phone = r.phone?.toString().trim() || '';
            return uid && uid !== 'id' && uid !== 'checkoutuid' && phone !== '電話';
          });
          setDailySales(cleaned);
        } else {
          showBanner(MSG.sales.fetchFail(res.message), 'err');
        }
      })
      .catch(e => { console.error('[useDailySales] fetch failed:', e); showBanner(MSG.sales.fetchNetworkFail, 'err'); })
      .finally(() => setLoadingDaily(false));
  }, [branch, showBanner]);

  const handleDeleteDaily = useCallback((checkoutUID: string) => {
    showBanner(MSG.sales.voiding, 'loading', false);
    gasPost('deleteDailySales', { branch, checkoutUID })
      .then(res => {
        if (res.success) {
          showBanner(MSG.sales.voidSuccess(res.message), 'ok');
          fetchDailySales();
          fetchMembers();
        } else {
          showBanner(MSG.sales.voidFail(res.message), 'err');
        }
      })
      .catch(e => { console.error('[useDailySales] delete failed:', e); showBanner(MSG.sales.voidNetworkFail, 'err'); });
  }, [branch, showBanner, fetchDailySales, fetchMembers]);

  // ── Opening Cash ──
  const [openingCash, setOpeningCash] = useState<number | null>(null);
  const [isClosingModalOpen, setIsClosingModalOpen] = useState(false);

  useEffect(() => {
    gasPost('getOpeningCash', { branch })
      .then(res => { if (res.success && res.amount != null) setOpeningCash(res.amount); else setOpeningCash(null); })
      .catch(e => console.error('[useDailySales] getOpeningCash failed:', e));
  }, [branch]);

  const handleSetOpeningCash = useCallback(async (amt: number) => {
    showBanner(MSG.sales.openingCashSetting, 'loading', false);
    const res = await gasPost('setOpeningCash', { branch, amount: amt }).catch(() => null);
    if (res?.success) { setOpeningCash(amt); showBanner(MSG.sales.openingCashSuccess, 'ok'); }
    else showBanner(MSG.sales.openingCashFail, 'err');
  }, [branch, showBanner]);

  const handleConfirmCloseDay = useCallback(async (data: {
    actualCash: number; actualCreditCard: number; actualRemittance: number; note: string;
  }) => {
    const expectedCash = (openingCash || 0) + dailySales.reduce((sum, r) => sum + r.cash, 0);
    const diffCash = data.actualCash - expectedCash;
    setIsClosingModalOpen(false);
    showBanner(MSG.sales.closingDay, 'loading', false);
    try {
      const res = await gasPost('closeDay', {
        branch, openingCash: openingCash || 0, expectedCash,
        actualCash: data.actualCash, discrepancy: diffCash, note: data.note,
      });
      if (res.success) { showBanner(`✓ ${res.message}`, 'ok'); setOpeningCash(null); fetchDailySales(); }
      else { showBanner(MSG.sales.closeDayFail(res.message), 'err'); }
    } catch (e) { console.error('[useDailySales] closeDay failed:', e); showBanner(MSG.checkout.networkErrorShort, 'err'); }
  }, [branch, openingCash, dailySales, showBanner, fetchDailySales]);

  return {
    dailySales, loadingDaily, fetchDailySales, handleDeleteDaily,
    openingCash, isClosingModalOpen, setIsClosingModalOpen,
    handleSetOpeningCash, handleConfirmCloseDay,
  };
}

interface UseSalesRecordsDeps {
  showBanner: (msg: string, type: BannerState['type'], autoDismiss?: boolean) => void;
}

export function useSalesRecords({ showBanner }: UseSalesRecordsDeps) {
  const [salesRecords, setSalesRecords] = useState<SalesRecordEntry[]>([]);
  const [loadingSales, setLoadingSales] = useState(false);
  const [lastCacheTime, setLastCacheTime] = useState('');

  const fetchSalesRecords = useCallback(async (forceRefresh = false) => {
    setLoadingSales(true);
    const CACHE_KEY = 'salesRecordsCache_v2';
    const CACHE_TIME_KEY = 'salesRecordsCacheTime_v2';

    if (!forceRefresh) {
      const cached = localStorage.getItem(CACHE_KEY);
      const cachedTime = localStorage.getItem(CACHE_TIME_KEY);
      if (cached && cachedTime) {
        setSalesRecords(JSON.parse(cached));
        setLastCacheTime(cachedTime);
        setLoadingSales(false);
        showBanner(MSG.salesRecords.cached, 'ok');
        return;
      }
    }

    try {
      showBanner(MSG.salesRecords.fetching, 'loading', false);
      const res = await gasPost('getSalesRecords', { limit: SALES_RECORDS_LIMIT, offset: 0 });
      if (res.success && res.data) {
        setSalesRecords(res.data);
        const timeStr = new Date().toLocaleTimeString('zh-TW', { hour12: false });
        setLastCacheTime(timeStr);
        localStorage.setItem(CACHE_KEY, JSON.stringify(res.data));
        localStorage.setItem(CACHE_TIME_KEY, timeStr);
        showBanner(MSG.salesRecords.updated, 'ok');
      } else {
        showBanner(MSG.salesRecords.fetchFail(res.message), 'err');
      }
    } catch (e) {
      console.error('[useSalesRecords] fetch failed:', e);
      showBanner(MSG.salesRecords.fetchNetworkFail, 'err');
    } finally {
      setLoadingSales(false);
    }
  }, [showBanner]);

  const clearSalesCache = useCallback(() => {
    localStorage.removeItem('salesRecordsCache_v2');
    localStorage.removeItem('salesRecordsCacheTime_v2');
    setSalesRecords([]);
    setLastCacheTime('');
    showBanner(MSG.salesRecords.cacheCleared, 'ok');
  }, [showBanner]);

  const resetSalesRecords = useCallback(() => setSalesRecords([]), []);

  return { salesRecords, loadingSales, lastCacheTime, fetchSalesRecords, clearSalesCache, resetSalesRecords };
}
