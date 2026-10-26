import type { LotteryItem, MerchItem, PrizeEntry, StockEntry, BlindBoxEntry } from '../types';
import { CHECKOUT_SUGGESTION_LIMIT } from '../config';
import { MSG } from '../constants/messages';

// 16 大真實 GK IP 白名單 (向下相容 category 欄位)
export const GK_IP_SET = new Set([
  '海賊王', '寶可夢', '火影', '宮崎駿', '綜合', '遊戲王', '潮玩',
  '安妮雅', '七龍珠', '鏈鋸咒術', '國漫', '灌籃高手', '獵人', '小新', '數碼寶貝', '阿拉雷'
]);

export function isGkItem(entry: any): boolean {
  if (!entry) return false;
  if (entry.mainCategory === 'GK') return true;
  if (entry.mainCategory === 'BLIND_BOX') return false;
  const cat = (entry.category || '').toLowerCase();
  if (cat.includes('gk')) return true;
  if (cat.includes('blind')) return false;
  return GK_IP_SET.has(entry.category);
}

// ── Factory helpers ──
export const emptyLottery = (): LotteryItem => ({
  id: '', prize: '', draws: 1, type: '帶走', setName: '', unitPrice: 0,
  prizeId: '', prizeName: '', unitPoints: 0, totalPoints: 0, amount: 0, pointsCost: 0, remark: '',
});

export const emptyMerch = (): MerchItem => ({
  id: '', quantity: 1, paymentType: '現金', unitAmount: 0, name: '',
  suggestedPoints: 0, actualAmount: 0, totalPoints: 0, remark: '',
});

// ── Summary calculation ──
export function calcSummary(lotteries: LotteryItem[], merchandises: MerchItem[]) {
  let due = 0, pts = 0;
  lotteries.forEach(it => {
    due += it.amount;
    pts += it.totalPoints - (it.pointsCost || 0);
  });
  merchandises.forEach(it => {
    if (it.paymentType === '現金') due += it.actualAmount;
    else if (it.paymentType !== '贈送') pts -= it.totalPoints;
    if (it.id === '88888') pts += it.quantity;
    if (it.id === '99999') pts -= it.quantity;
  });
  return { dueAmount: due, pointsChange: pts };
}

// ── Lottery auto-fill from prize lookup ──
export function applyLotteryUpdate(
  item: LotteryItem,
  field: keyof LotteryItem,
  value: unknown,
  prizes: PrizeEntry[],
): LotteryItem {
  const updated = { ...item, [field]: value } as LotteryItem;

  if (field === 'id') {
    const setEntry = prizes.find(p => p.setId === String(value));
    if (setEntry) {
      updated.setName = setEntry.setName;
      updated.unitPrice = setEntry.unitPrice;
      if (setEntry.isPointsSet) {
        updated.type = '帶走';
        updated.amount = 0;
        updated.remark = '點數套';
      } else {
        // 切到正常套時清掉點數套狀態
        if (item.remark === '點數套') { updated.remark = ''; updated.pointsCost = 0; updated.type = '帶走'; }
      }
    }
    else { updated.setName = ''; updated.unitPrice = 0; updated.prize = ''; updated.prizeId = ''; updated.prizeName = ''; updated.unitPoints = 0; updated.draws = 0; updated.amount = 0; updated.totalPoints = 0; updated.pointsCost = 0; }
  }
  if (field === 'prize') {
    const wasPointsSet = item.remark === '點數套';
    const normalizedPrize = String(value).trim().toLowerCase();
    const prizeEntry = prizes.find(p => p.setId === updated.id && String(p.prize).trim().toLowerCase() === normalizedPrize);
    if (prizeEntry) { updated.prizeId = prizeEntry.prizeId; updated.prizeName = prizeEntry.prizeName; updated.unitPoints = prizeEntry.points; }
    else { updated.prizeId = ''; updated.prizeName = ''; updated.unitPoints = 0; updated.draws = 0; updated.amount = 0; updated.totalPoints = 0; }
    if (!wasPointsSet) {
      if (value === '88888') updated.remark = '送1點';
      else if (value === '99999') updated.remark = '扣1點';
      else if (normalizedPrize === 'x') updated.remark = '盲盒';
      else if (normalizedPrize === 'z') { updated.remark = ''; updated.prizeName = updated.prizeName || '非GK'; }
    }
  }
  // 抽數防呆：不可超過該獎項的總抽數
  if (field === 'draws') {
    const prizeEntry = prizes.find(p => p.setId === updated.id && String(p.prize).trim().toLowerCase() === String(updated.prize).trim().toLowerCase());
    if (prizeEntry && Number(value) > prizeEntry.draws) {
      updated.draws = prizeEntry.draws;
    }
  }
  if (field === 'type' && value === '點數') {
    const normalizedPrize = String(updated.prize || '').trim().toLowerCase();
    if (normalizedPrize === 'x' && (!updated.unitPoints || updated.unitPoints === 0)) updated.unitPoints = 10;
    if (normalizedPrize === 'z' && (!updated.unitPoints || updated.unitPoints === 0)) updated.unitPoints = 1;
  }
  const isPointsSet = updated.remark === '點數套';
  if (field !== 'amount' && field !== 'remark' && field !== 'pointsCost') {
    if (isPointsSet) {
      updated.amount = 0;
      // 預設扣抵點數 = 單抽價 / 20 * 抽數
      updated.pointsCost = Math.floor((updated.unitPrice || 0) / 20) * updated.draws;
    } else {
      if (field !== 'type') updated.amount = updated.draws * (updated.unitPrice || 0);
    }
    const normalizedPrize = String(updated.prize || '').trim().toLowerCase();
    const fallbackPoints = normalizedPrize === 'x' ? 10 : normalizedPrize === 'z' ? 1 : 0;
    const effectivePoints = updated.unitPoints !== undefined && updated.unitPoints !== 0 ? updated.unitPoints : fallbackPoints;
    updated.totalPoints = updated.type === '點數' ? (updated.draws * effectivePoints) : 0;
  }
  return updated;
}

// ── Merch auto-fill from stock/blindbox lookup ──
export function applyMerchUpdate(
  item: MerchItem,
  field: keyof MerchItem,
  value: unknown,
  stocks: StockEntry[],
  blindBoxes: BlindBoxEntry[],
  allStocks: StockEntry[] = [],
  branch: string = '',
): MerchItem {
  const updated = { ...item, [field]: value } as MerchItem;

  if (field === 'id') {
    if (value === '88888') {
      Object.assign(updated, { name: '手動加點 (隨便加)', suggestedPoints: 0, unitAmount: 0, paymentType: '贈送', remark: '補點', isGk: false });
    } else if (value === '99999') {
      Object.assign(updated, { name: '手動扣點 (隨便扣)', suggestedPoints: 0, unitAmount: 0, paymentType: '贈送', remark: '扣點', isGk: false });
    } else {
      const stockEntry = stocks.find(s => s.id === String(value));
      if (stockEntry) {
        updated.name = stockEntry.name; updated.suggestedPoints = stockEntry.points;
        updated.remark = stockEntry.remark; updated.unitAmount = 0;
        updated.isGk = isGkItem(stockEntry);
        if (updated.isGk && updated.paymentType === '現金') updated.paymentType = '點數';
      } else {
        // ★ 跨店 fallback：查全門市貨品
        const crossEntry = allStocks.find(s => s.id === String(value));
        if (crossEntry) {
          updated.name = crossEntry.name; updated.suggestedPoints = crossEntry.points;
          updated.unitAmount = 0;
          updated.isGk = isGkItem(crossEntry);
          if (updated.isGk && updated.paymentType === '現金') updated.paymentType = '點數';
          // 備註標注所在門市
          const otherBranch = crossEntry.branch || '';
          updated.remark = otherBranch && otherBranch !== branch ? `在${otherBranch}店` : crossEntry.remark;
        } else {
          const bb = blindBoxes.find(b => b.id === String(value));
          if (bb) { updated.name = bb.name; updated.suggestedPoints = bb.points; updated.unitAmount = bb.manualPrice; updated.remark = bb.remark; updated.isGk = false; }
        }
      }
    }
  }

  if (field !== 'actualAmount' && field !== 'remark') {
    if (updated.id === '88888' || updated.id === '99999') { updated.actualAmount = 0; updated.totalPoints = updated.quantity; }
    else if (updated.paymentType === '贈送') { updated.actualAmount = 0; updated.totalPoints = 0; }
    else if (updated.paymentType === '點數') { updated.actualAmount = 0; updated.totalPoints = updated.quantity * updated.suggestedPoints; }
    else { updated.actualAmount = updated.quantity * updated.unitAmount; updated.totalPoints = 0; }
  }
  return updated;
}

// ── Member filter ──
export function filterMembers<T extends { phone: string | number; name: string }>(
  phoneName: string,
  members: T[],
  limit = CHECKOUT_SUGGESTION_LIMIT,
): T[] {
  const pn = String(phoneName || '');
  if (pn.length < 2) return [];
  const q = pn.toLowerCase();
  return members.filter(m =>
    String(m.phone || '').includes(q) ||
    String(m.name || '').toLowerCase().includes(q)
  ).slice(0, limit);
}

export const WALK_IN_CODES = ['111111', '222222', '333333', '88888', '99999'];

export function isWalkInCustomer(phoneOrName: string | null | undefined): boolean {
  if (!phoneOrName) return true;
  const clean = String(phoneOrName).trim().toUpperCase();
  const raw = clean.split(/[- ]/)[0].trim();
  return (
    WALK_IN_CODES.includes(clean) ||
    WALK_IN_CODES.includes(raw) ||
    clean.includes('散客') ||
    clean.includes('WALKIN') ||
    clean.includes('WALK_IN') ||
    clean.includes('現場')
  );
}

// ── Checkout validation ──
export interface ValidationInput {
  lotteries: LotteryItem[];
  merchandises: MerchItem[];
  customer: { phoneName: string; name: string; currentPoints: number };
  payment: { cash: number; remittance: number; creditCard: number; pointsUsed: number };
  summary: { dueAmount: number; pointsChange: number };
  orderNote?: string;
}

export function validateCheckout(input: ValidationInput): string | null {
  const { lotteries, merchandises, customer, payment, summary } = input;
  const filteredLotteries = lotteries.filter(l => l.id || l.prize || l.setName || l.amount > 0);
  const filteredMerch = merchandises.filter(m => m.id || m.name || m.quantity > 1);

  if (filteredLotteries.length === 0 && filteredMerch.length === 0) return MSG.validation.emptyCart;
  if (!customer.phoneName) return MSG.validation.noPhone;
  if (!customer.name) return MSG.validation.noMemberLookup;

  // 88888 / 99999 必須填備註
  const rawPhone = customer.phoneName.split(/[- ]/)[0].trim();
  if ((rawPhone === '88888' || rawPhone === '99999') && !(input.orderNote?.trim())) {
    return `使用 ${rawPhone} 結帳時，必須在備註欄填寫原因`;
  }

  // ── 散客點數穿透阻斷防護 (Invariant #1) ──
  const isWalkIn = isWalkInCustomer(customer.phoneName) || isWalkInCustomer(customer.name);
  if (isWalkIn) {
    const hasPointsUsage = (payment?.pointsUsed || 0) > 0;
    const hasMerchPoints = filteredMerch.some(m => m.paymentType === '點數' || (m.totalPoints || 0) > 0);
    const hasLotteryPoints = filteredLotteries.some(l => l.type === '點數' || l.remark === '點數套' || (l.pointsCost || 0) > 0);
    const hasNetPointsDeduction = (summary?.pointsChange || 0) < 0 || (payment?.pointsUsed || 0) > 0;

    if (hasPointsUsage || hasMerchPoints || hasLotteryPoints || hasNetPointsDeduction) {
      return MSG.validation.walkInNoPoints;
    }
  }

  for (let i = 0; i < filteredLotteries.length; i++) {
    const l = filteredLotteries[i];
    if (!l.id || !l.prize || !l.setName || !l.prizeName || l.draws < 1 || !Number.isInteger(l.draws)) {
      return MSG.validation.lotteryIncomplete(i + 1);
    }
  }
  for (let i = 0; i < filteredMerch.length; i++) {
    const m = filteredMerch[i];
    if (!m.id || !m.name || m.quantity < 1 || !Number.isInteger(m.quantity)) {
      return MSG.validation.merchIncomplete(i + 1);
    }
  }

  const isNeg = payment.cash < 0 || payment.remittance < 0 || payment.creditCard < 0 || payment.pointsUsed < 0;
  const isNegPrice = filteredLotteries.some(l => l.amount < 0) || filteredMerch.some(m => m.actualAmount < 0);
  if (isNeg || isNegPrice || summary.dueAmount < 0) return MSG.validation.negativeValues;

  const totalReceived = payment.cash + payment.remittance + payment.creditCard;
  if (totalReceived !== summary.dueAmount) return MSG.validation.amountMismatch(totalReceived, summary.dueAmount);

  const itemPtsCost = summary.pointsChange < 0 ? Math.abs(summary.pointsChange) : 0;
  const totalPtsCost = itemPtsCost + (payment.pointsUsed || 0);
  const currentPts = customer.currentPoints ?? 0;
  if (totalPtsCost > currentPts) {
    return MSG.validation.insufficientPoints(totalPtsCost, currentPts);
  }

  return null; // validation passed
}
