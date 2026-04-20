import { useState, useCallback, useRef } from 'react';
import type { MemberEntry, MemberSalesRecord } from '../types';
import { gasPost } from '../services/api';
import type { BannerState } from './useBanner';
import { MSG } from '../constants/messages';

interface UseMembersDeps {
  showBanner: (msg: string, type: BannerState['type'], autoDismiss?: boolean) => void;
}

export function useMembers({ showBanner }: UseMembersDeps) {
  const [members, setMembers] = useState<MemberEntry[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const retryRef = useRef(0);

  const fetchMembers = useCallback((isRetry = false) => {
    setLoadingMembers(true);
    gasPost('getAllMembers')
      .then(res => {
        if (res.success && res.data?.length) {
          setMembers(res.data);
          retryRef.current = 0; // 成功 → 歸零
        } else if (!isRetry && retryRef.current < 2) {
          // API 回傳但無資料 → 自動重試一次
          retryRef.current++;
          setTimeout(() => fetchMembers(true), 2000);
          return; // 先不 setLoadingMembers(false)
        }
      })
      .catch(e => {
        console.error('[useMembers] fetchMembers failed:', e);
        if (!isRetry && retryRef.current < 2) {
          retryRef.current++;
          showBanner(MSG.member.loadRetrying, 'err');
          setTimeout(() => fetchMembers(true), 2000);
          return;
        }
        showBanner(MSG.member.loadFailed, 'err');
      })
      .finally(() => setLoadingMembers(false));
  }, [showBanner]);

  return { members, setMembers, loadingMembers, fetchMembers };
}

export function useMemberHistory({ showBanner }: UseMembersDeps) {
  const [historySearchPhone, setHistorySearchPhone] = useState('');
  const [historyMember, setHistoryMember] = useState<MemberEntry | null>(null);
  const [historyRecords, setHistoryRecords] = useState<MemberSalesRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchMemberHistory = useCallback(async () => {
    if (!historySearchPhone) {
      showBanner(MSG.member.enterPhone, 'err');
      return;
    }
    setLoadingHistory(true);
    try {
      // ★ 並行呼叫，省掉一次 round trip 延遲
      const [memRes, histRes] = await Promise.all([
        gasPost('getMember', { phone: historySearchPhone }),
        gasPost('getMemberSalesRecords', { phone: historySearchPhone }),
      ]);

      if (memRes.success) { setHistoryMember(memRes.data as MemberEntry); }
      else { setHistoryMember(null); showBanner(MSG.member.notFound(memRes.message), 'err'); }

      if (histRes.success) { setHistoryRecords(histRes.data); }
      else { setHistoryRecords([]); }
    } catch (e) {
      console.error('[useMemberHistory] fetchMemberHistory failed:', e);
      showBanner(MSG.member.historyFailed, 'err');
    } finally {
      setLoadingHistory(false);
    }
  }, [historySearchPhone, showBanner]);

  return { historySearchPhone, setHistorySearchPhone, historyMember, historyRecords, loadingHistory, fetchMemberHistory };
}
