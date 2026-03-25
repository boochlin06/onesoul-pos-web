import { GAS_URL, API_KEY } from '../constants';
import { getIdToken } from '../hooks/useAuth';
import type {
  MemberEntry, PrizeEntry, StockEntry, BlindBoxEntry,
  SalesEntry, Branch,
} from '../types';

// ── Low-level fetch ────────────────────────────────────
export async function gasPost(action: string, payload?: object) {
  const res = await fetch(GAS_URL, {
    method: 'POST',
    body: JSON.stringify({
      action,
      payload: payload ?? {},
      apiKey: API_KEY,
      idToken: getIdToken(),
    }),
  });
  return res.json();
}

// ── Members ────────────────────────────────────────────
export async function apiGetAllMembers(): Promise<MemberEntry[]> {
  const res = await gasPost('getAllMembers');
  return res.success && res.data?.length ? res.data : [];
}

export async function apiGetMember(phone: string) {
  return gasPost('getMember', { phone });
}

// ── Prize Library ──────────────────────────────────────
export async function apiGetPrizeLibrary(): Promise<PrizeEntry[]> {
  const res = await gasPost('getPrizeLibrary');
  return res.success && res.data?.length ? res.data : [];
}

export async function apiDeletePrizeLibrary(branch: Branch, setId: string) {
  return gasPost('deletePrizeLibrary', { branch, setId });
}

// ── Stock ──────────────────────────────────────────────
export async function apiGetStockList(branch: Branch): Promise<StockEntry[]> {
  const res = await gasPost('getStockList', { branch });
  return res.success && res.data ? res.data : [];
}

// ── Blind Box ──────────────────────────────────────────
export async function apiGetBlindBoxList(): Promise<BlindBoxEntry[]> {
  const res = await gasPost('getBlindBoxList');
  return res.success && res.data ? res.data : [];
}

// ── Daily Sales ────────────────────────────────────────
export async function apiGetDailySales(branch: Branch): Promise<{ success: boolean; data?: SalesEntry[]; message?: string }> {
  return gasPost('getDailySales', { branch });
}

export async function apiDeleteDailySales(branch: Branch, checkoutUID: string) {
  return gasPost('deleteDailySales', { branch, checkoutUID });
}

// ── Sales Records ──────────────────────────────────────
export async function apiGetSalesRecords(limit: number, offset: number) {
  return gasPost('getSalesRecords', { limit, offset });
}

// ── Member History ─────────────────────────────────────
export async function apiGetMemberSalesRecords(phone: string) {
  return gasPost('getMemberSalesRecords', { phone });
}

// ── Checkout ───────────────────────────────────────────
export async function apiCheckout(payload: object) {
  return gasPost('checkout', payload);
}

// ── Opening Cash ───────────────────────────────────────
export async function apiGetOpeningCash(branch: Branch) {
  return gasPost('getOpeningCash', { branch });
}

export async function apiSetOpeningCash(branch: Branch, amount: number) {
  return gasPost('setOpeningCash', { branch, amount });
}

// ── Close Day ──────────────────────────────────────────
export async function apiCloseDay(payload: object) {
  return gasPost('closeDay', payload);
}
