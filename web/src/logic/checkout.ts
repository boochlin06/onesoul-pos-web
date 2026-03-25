import type { LotteryItem, MerchItem, PrizeEntry, StockEntry, BlindBoxEntry } from '../types';

// ── Factory helpers ──
export const emptyLottery = (): LotteryItem => ({
  id: '', prize: '', draws: 1, type: '帶走', setName: '', unitPrice: 0,
  prizeId: '', prizeName: '', unitPoints: 0, totalPoints: 0, amount: 0, remark: '',
});

export const emptyMerch = (): MerchItem => ({
  id: '', quantity: 1, paymentType: '現金', unitAmount: 0, name: '',
  suggestedPoints: 0, actualAmount: 0, totalPoints: 0, remark: '',
});

// ── Summary calculation ──
export function calcSummary(lotteries: LotteryItem[], merchandises: MerchItem[]) {
  let due = 0, pts = 0;
  lotteries.forEach(it => { due += it.amount; pts += it.totalPoints; });
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
    if (setEntry) { updated.setName = setEntry.setName; updated.unitPrice = setEntry.unitPrice; }
    else { updated.setName = ''; updated.unitPrice = 0; updated.prize = ''; updated.prizeId = ''; updated.prizeName = ''; updated.unitPoints = 0; updated.draws = 0; updated.amount = 0; updated.totalPoints = 0; }
  }
  if (field === 'prize') {
    const prizeEntry = prizes.find(p => p.setId === updated.id && p.prize === String(value));
    if (prizeEntry) { updated.prizeId = prizeEntry.prizeId; updated.prizeName = prizeEntry.prizeName; updated.unitPoints = prizeEntry.points; updated.draws = prizeEntry.draws; }
    else { updated.prizeId = ''; updated.prizeName = ''; updated.unitPoints = 0; updated.draws = 0; updated.amount = 0; updated.totalPoints = 0; }
    if (value === '88888') updated.remark = '送1點';
    else if (value === '99999') updated.remark = '扣1點';
    else if (value === 'x') updated.remark = '盲盒';
    else if (value === 'z' || value === 'Z') { updated.remark = ''; updated.prizeName = '非GK'; updated.unitPoints = 1; }
  }
  if (field !== 'amount' && field !== 'remark') {
    if (field !== 'type') updated.amount = updated.draws * (updated.unitPrice || 0);
    updated.totalPoints = updated.type === '點數' ? (updated.draws * (updated.unitPoints || 0)) : 0;
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
        updated.isGk = stockEntry.category.toLowerCase().includes('gk');
        if (updated.isGk && updated.paymentType === '現金') updated.paymentType = '點數';
      } else {
        const bb = blindBoxes.find(b => b.id === String(value));
        if (bb) { updated.name = bb.name; updated.suggestedPoints = bb.points; updated.unitAmount = bb.manualPrice; updated.remark = bb.remark; updated.isGk = false; }
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
export function filterMembers(
  phoneName: string,
  members: { phone: string | number; name: string }[],
  limit = 8,
) {
  const pn = String(phoneName || '');
  if (pn.length < 2) return [];
  const q = pn.toLowerCase();
  return members.filter(m =>
    String(m.phone || '').includes(q) ||
    String(m.name || '').toLowerCase().includes(q)
  ).slice(0, limit);
}

// ── Checkout validation ──
export interface ValidationInput {
  lotteries: LotteryItem[];
  merchandises: MerchItem[];
  customer: { phoneName: string; name: string; currentPoints: number };
  payment: { cash: number; remittance: number; creditCard: number; pointsUsed: number };
  summary: { dueAmount: number; pointsChange: number };
}

export function validateCheckout(input: ValidationInput): string | null {
  const { lotteries, merchandises, customer, payment, summary } = input;
  const filteredLotteries = lotteries.filter(l => l.id || l.prize || l.setName || l.amount > 0);
  const filteredMerch = merchandises.filter(m => m.id || m.name || m.quantity > 1);

  if (filteredLotteries.length === 0 && filteredMerch.length === 0) return '無法結帳：請至少輸入一項福袋或商品';
  if (!customer.phoneName) return '請輸入客戶電話號碼';
  if (!customer.name) return '請先按下 Enter 完成會員查詢，確認會員身份與最新點數後再結帳';

  for (let i = 0; i < filteredLotteries.length; i++) {
    const l = filteredLotteries[i];
    if (!l.id || !l.prize || !l.setName || !l.prizeName || l.draws < 1 || !Number.isInteger(l.draws)) {
      return `無法結帳：福袋區第 ${i + 1} 項資料有誤（請確認單號與獎項正確，且套名與獎項名稱皆已帶出）`;
    }
  }
  for (let i = 0; i < filteredMerch.length; i++) {
    const m = filteredMerch[i];
    if (!m.id || !m.name || m.quantity < 1 || !Number.isInteger(m.quantity)) {
      return `無法結帳：直購商品區第 ${i + 1} 項資料不完整（請確認貨號與商品名稱皆已帶出，且數量必須為大於 0 的整數）`;
    }
  }

  const isNeg = payment.cash < 0 || payment.remittance < 0 || payment.creditCard < 0 || payment.pointsUsed < 0;
  const isNegPrice = filteredLotteries.some(l => l.amount < 0) || filteredMerch.some(m => m.actualAmount < 0);
  if (isNeg || isNegPrice || summary.dueAmount < 0) return '無法結帳：輸入的收款明細、系統應收總額，以及單項商品金額均不能為負數';

  const totalReceived = payment.cash + payment.remittance + payment.creditCard;
  if (totalReceived !== summary.dueAmount) return `無法結帳：實收總額 (${totalReceived}) 與系統應付總額 (${summary.dueAmount}) 不符`;

  const itemPtsCost = summary.pointsChange < 0 ? Math.abs(summary.pointsChange) : 0;
  const totalPtsCost = itemPtsCost + (payment.pointsUsed || 0);
  if (totalPtsCost > customer.currentPoints) {
    return `無法結帳：點數餘額不足！本單需扣除：${totalPtsCost} 點，會員目前僅有：${customer.currentPoints} 點`;
  }

  return null; // validation passed
}
