import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { Branch, LotteryItem, MerchItem, MemberEntry, PrizeEntry, StockEntry, BlindBoxEntry } from '../types';
import { useStickyState } from './useStickyState';
import { gasPost, apiSaveDraft, apiClearDraft } from '../services/api';
import type { BannerState } from './useBanner';
import { MSG } from '../constants/messages';
import {
  emptyLottery, emptyMerch,
  calcSummary, applyLotteryUpdate, applyMerchUpdate,
  filterMembers, validateCheckout,
} from '../logic/checkout';

interface UseCheckoutDeps {
  branch: Branch;
  prizes: PrizeEntry[];
  stocks: StockEntry[];
  allStocks: StockEntry[];
  blindBoxes: BlindBoxEntry[];
  members: MemberEntry[];
  setMembers: React.Dispatch<React.SetStateAction<MemberEntry[]>>;
  fetchMembers: () => void;
  showBanner: (msg: string, type: BannerState['type'], autoDismiss?: boolean) => void;
  email?: string;
}

export function useCheckout({
  branch, prizes, stocks, allStocks, blindBoxes, members, setMembers, fetchMembers, showBanner, email,
}: UseCheckoutDeps) {
  // ── Draft monitoring ──
  const sessionIdRef = useRef(Date.now().toString(36) + Math.random().toString(36).slice(2));
  const lastDraftRef = useRef('');
  const [customer, setCustomer] = useStickyState(
    { phoneName: '', name: '', gender: '', birthday: '', currentPoints: 0 },
    'os_checkout_customer',
  );
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [payment, setPayment] = useStickyState(
    { receivedAmount: 0, remittance: 0, creditCard: 0, cash: 0, pointsUsed: 0 },
    'os_checkout_payment',
  );
  const [lotteries, setLotteries] = useStickyState<LotteryItem[]>(
    () => Array(5).fill(null).map(emptyLottery), 'os_checkout_lotteries',
  );
  const [merchandises, setMerchandises] = useStickyState<MerchItem[]>(
    () => Array(2).fill(null).map(emptyMerch), 'os_checkout_merchandises',
  );
  const [summary, setSummary] = useStickyState({ pointsChange: 0, dueAmount: 0 }, 'os_checkout_summary');
  const [orderNote, setOrderNote] = useStickyState('', 'os_checkout_ordernote');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Auto-calculate summary (delegated to pure function) ──
  useEffect(() => {
    setSummary(calcSummary(lotteries, merchandises));
  }, [lotteries, merchandises]);

  // ── Draft monitoring: debounce 3s, only send on change ──
  useEffect(() => {
    const snapshot = JSON.stringify({ customer, lotteries, merchandises, payment, summary, orderNote });
    const timer = setTimeout(() => {
      if (snapshot !== lastDraftRef.current && email) {
        lastDraftRef.current = snapshot;
        apiSaveDraft(branch, sessionIdRef.current, email, { customer, lotteries, merchandises, payment, summary, orderNote }).catch(() => {});
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [customer, lotteries, merchandises, payment, summary, orderNote, branch, email]);

  // ── Clear draft on tab close ──
  useEffect(() => {
    const handleUnload = () => {
      if (email) {
        // navigator.sendBeacon not available for POST JSON, use sync fetch
        try { apiClearDraft(sessionIdRef.current, branch).catch(() => {}); } catch {}
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [branch, email]);

  // ── Member autocomplete (delegated to pure function) ──
  const filteredCacheMembers = useMemo(
    () => filterMembers(customer.phoneName, members),
    [customer.phoneName, members],
  );

  const selectCacheMember = useCallback((m: { phone: string | number; name: string; gender?: string; birthday?: string; points?: number | string }) => {
    setCustomer(p => ({
      ...p,
      phoneName: String(m.phone || ''),
      name: String(m.name || ''),
      gender: String(m.gender || ''),
      birthday: String(m.birthday || ''),
      currentPoints: Number(m.points || 0),
    }));
    setShowMemberDropdown(false);
    showBanner(MSG.checkout.memberLoaded(m.name || m.phone), 'ok');
  }, [showBanner]);

  // ── Lottery CRUD (delegated to pure function) ──
  const addLotteryRow = () => setLotteries(p => [...p, emptyLottery()]);
  const removeLotteryRow = (i: number) => setLotteries(p => p.filter((_, idx) => idx !== i));
  const updateLottery = useCallback((index: number, field: keyof LotteryItem, value: unknown) => {
    setLotteries(prev => {
      const list = [...prev];
      list[index] = applyLotteryUpdate(list[index], field, value, prizes);
      return list;
    });
  }, [prizes]);

  // ── Merch CRUD (delegated to pure function) ──
  const addMerchRow = () => setMerchandises(p => [...p, emptyMerch()]);
  const removeMerchRow = (i: number) => setMerchandises(p => p.filter((_, idx) => idx !== i));
  const updateMerch = useCallback((index: number, field: keyof MerchItem, value: unknown) => {
    setMerchandises(prev => {
      const list = [...prev];
      list[index] = applyMerchUpdate(list[index], field, value, stocks, blindBoxes, allStocks, branch);
      return list;
    });
  }, [stocks, blindBoxes, allStocks, branch]);

  // ── Phone Lookup ──
  const handlePhoneKeyDown = useCallback(async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    showBanner(MSG.checkout.memberSearching, 'loading', false);
    try {
      const res = await gasPost('getMember', { phone: customer.phoneName });
      if (res.success && res.data) {
        setCustomer(prev => ({ ...prev, name: res.data.name, gender: res.data.gender, birthday: res.data.birthday, currentPoints: res.data.points }));
        showBanner(MSG.checkout.memberFound(res.data.name, res.data.points), 'ok');
      } else { showBanner(MSG.checkout.memberNotFound(res.message), 'err'); }
    } catch { showBanner(MSG.checkout.networkErrorShort, 'err'); }
  }, [customer.phoneName, showBanner]);

  // ── Reset ──
  const handleResetCheckout = useCallback(() => {
    setCustomer({ phoneName: '', name: '', gender: '', birthday: '', currentPoints: 0 });
    setPayment({ receivedAmount: 0, remittance: 0, creditCard: 0, cash: 0, pointsUsed: 0 });
    setLotteries(Array(5).fill(null).map(emptyLottery));
    setMerchandises(Array(2).fill(null).map(emptyMerch));
    setOrderNote('');
    showBanner(MSG.checkout.cleared, 'ok');
  }, [showBanner]);

  // ── Submit Checkout ──
  const handleCheckout = useCallback(async () => {
    const filteredLotteries = lotteries.filter(l => l.id || l.prize || l.setName || l.amount > 0);
    const filteredMerch = merchandises.filter(m => m.id || m.name || m.quantity > 1);

    const error = validateCheckout({ lotteries, merchandises, customer, payment, summary, orderNote });
    if (error) { showBanner(error, 'err'); return; }

    if (isSubmitting) return;
    setIsSubmitting(true);
    showBanner(MSG.checkout.sending, 'loading', false);
    try {
      const totalReceived = payment.cash + payment.remittance + payment.creditCard;
      const payloadPayment = { ...payment, receivedAmount: totalReceived };
      const { currentPoints: _unused, ...customerPayload } = customer;
      const res = await gasPost('checkout', { branch, customer: customerPayload, payment: payloadPayment, summary, lotteries: filteredLotteries, merchandises: filteredMerch, orderNote });
      if (res.success) {
        showBanner(MSG.checkout.success(res.newPoints), 'ok');
        if (typeof res.newPoints !== 'undefined') {
          const rawPhone = customer.phoneName.split(/[- ]/)[0];
          setMembers(prev => prev.map(m => String(m.phone).trim() === rawPhone ? { ...m, points: res.newPoints } : m));
        }
        fetchMembers();
        setCustomer({ phoneName: '', name: '', gender: '', birthday: '', currentPoints: 0 });
        setPayment({ receivedAmount: 0, remittance: 0, creditCard: 0, cash: 0, pointsUsed: 0 });
        setLotteries(Array(5).fill(null).map(emptyLottery));
        setMerchandises(Array(2).fill(null).map(emptyMerch));
        setOrderNote('');
        // 清除監控草稿
        lastDraftRef.current = '';
        apiClearDraft(sessionIdRef.current, branch).catch(() => {});
      } else { showBanner(MSG.checkout.fail(res.message), 'err'); }
    } catch { showBanner(MSG.checkout.networkError, 'err'); }
    finally { setIsSubmitting(false); }
  }, [branch, customer, payment, lotteries, merchandises, summary, orderNote, isSubmitting, showBanner, setMembers, fetchMembers]);

  return {
    customer, setCustomer,
    showMemberDropdown, setShowMemberDropdown,
    filteredCacheMembers, selectCacheMember,
    payment, setPayment,
    lotteries, setLotteries, addLotteryRow, removeLotteryRow, updateLottery,
    merchandises, setMerchandises, addMerchRow, removeMerchRow, updateMerch,
    summary, orderNote, setOrderNote,
    isSubmitting,
    handlePhoneKeyDown, handleResetCheckout, handleCheckout,
  };
}
