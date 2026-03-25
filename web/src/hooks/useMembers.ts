import { useState, useCallback } from 'react';
import type { MemberEntry } from '../types';
import { gasPost } from '../services/api';
import type { BannerState } from './useBanner';

interface UseMembersDeps {
  showBanner: (msg: string, type: BannerState['type'], autoDismiss?: boolean) => void;
}

export function useMembers({ showBanner }: UseMembersDeps) {
  const [members, setMembers] = useState<MemberEntry[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);

  const fetchMembers = useCallback(() => {
    setLoadingMembers(true);
    gasPost('getAllMembers')
      .then(res => { if (res.success && res.data?.length) setMembers(res.data); })
      .catch(e => console.error('[useMembers] fetchMembers failed:', e))
      .finally(() => setLoadingMembers(false));
  }, []);

  return { members, setMembers, loadingMembers, fetchMembers };
}

export function useMemberHistory({ showBanner }: UseMembersDeps) {
  const [historySearchPhone, setHistorySearchPhone] = useState('');
  const [historyMember, setHistoryMember] = useState<MemberEntry | null>(null);
  const [historyRecords, setHistoryRecords] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchMemberHistory = useCallback(async () => {
    if (!historySearchPhone) {
      showBanner('請輸入會員電話', 'err');
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
      else { setHistoryMember(null); showBanner(memRes.message || '找不到此會員', 'err'); }

      if (histRes.success) { setHistoryRecords(histRes.data); }
      else { setHistoryRecords([]); }
    } catch (e) {
      console.error('[useMemberHistory] fetchMemberHistory failed:', e);
      showBanner('查詢紀錄失敗', 'err');
    } finally {
      setLoadingHistory(false);
    }
  }, [historySearchPhone, showBanner]);

  return { historySearchPhone, setHistorySearchPhone, historyMember, historyRecords, loadingHistory, fetchMemberHistory };
}
