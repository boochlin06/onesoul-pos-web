import { describe, it, expect } from 'vitest';
import {
  emptyLottery, emptyMerch,
  calcSummary,
  applyLotteryUpdate, applyMerchUpdate,
  filterMembers, validateCheckout,
} from '../logic/checkout';
import type { PrizeEntry, StockEntry, BlindBoxEntry } from '../types';

// ── Test fixtures ──
const makePrize = (setId: string, prize: string, overrides = {}): PrizeEntry => ({
  setId, setName: `套${setId}`, unitPrice: 700, prize,
  prizeId: `PID_${prize}`, prizeName: `獎${prize}`, points: 10, draws: 1,
  date: '', branch: '竹北', ...overrides,
});

const makeStock = (id: string, overrides = {}): StockEntry => ({
  id, name: `商品${id}`, points: 5, category: 'card',
  quantity: 10, remark: '', branch: '竹北', ...overrides,
});

const makeBb = (id: string, overrides = {}): BlindBoxEntry => ({
  id, name: `盲盒${id}`, points: 3, manualPrice: 200,
  autoSuggestPrice: 180, cost: 100, prizePoints: 5,
  inventory: 50, category: '盲盒', configuring: 0,
  shipped: 0, remaining: 50, remark: '', ...overrides,
});

const prizes = [makePrize('S1', 'A'), makePrize('S1', 'B', { points: 20, draws: 2 })];
const stocks = [makeStock('100065'), makeStock('GK001', { category: 'GK限定' })];
const blindBoxes = [makeBb('BB001')];

// ═══════════════════════════════════════════════════
// calcSummary
// ═══════════════════════════════════════════════════
describe('calcSummary', () => {
  it('空清單回傳 0', () => {
    expect(calcSummary([], [])).toEqual({ dueAmount: 0, pointsChange: 0 });
  });

  it('lottery.amount 加總到 dueAmount', () => {
    const lots = [
      { ...emptyLottery(), amount: 700 },
      { ...emptyLottery(), amount: 1400 },
    ];
    expect(calcSummary(lots, [])).toEqual({ dueAmount: 2100, pointsChange: 0 });
  });

  it('lottery totalPoints 加總到 pointsChange', () => {
    const lots = [{ ...emptyLottery(), totalPoints: 10 }];
    expect(calcSummary(lots, [])).toEqual({ dueAmount: 0, pointsChange: 10 });
  });

  it('merch 現金加到 dueAmount', () => {
    const merch = [{ ...emptyMerch(), paymentType: '現金' as const, actualAmount: 500 }];
    expect(calcSummary([], merch)).toEqual({ dueAmount: 500, pointsChange: 0 });
  });

  it('merch 點數扣 pointsChange', () => {
    const merch = [{ ...emptyMerch(), paymentType: '點數' as const, totalPoints: 15 }];
    expect(calcSummary([], merch)).toEqual({ dueAmount: 0, pointsChange: -15 });
  });

  it('88888 手動加點', () => {
    const merch = [{ ...emptyMerch(), id: '88888', quantity: 3, paymentType: '贈送' as const }];
    expect(calcSummary([], merch).pointsChange).toBe(3);
  });

  it('99999 手動扣點', () => {
    const merch = [{ ...emptyMerch(), id: '99999', quantity: 2, paymentType: '贈送' as const }];
    expect(calcSummary([], merch).pointsChange).toBe(-2);
  });

  it('混合計算 lottery + merch', () => {
    const lots = [{ ...emptyLottery(), amount: 1000, totalPoints: 5 }];
    const merch = [{ ...emptyMerch(), paymentType: '現金' as const, actualAmount: 300 }];
    const result = calcSummary(lots, merch);
    expect(result.dueAmount).toBe(1300);
    expect(result.pointsChange).toBe(5);
  });
});

// ═══════════════════════════════════════════════════
// applyLotteryUpdate
// ═══════════════════════════════════════════════════
describe('applyLotteryUpdate', () => {
  it('field=id 命中 prize → 帶入 setName + unitPrice', () => {
    const result = applyLotteryUpdate(emptyLottery(), 'id', 'S1', prizes);
    expect(result.setName).toBe('套S1');
    expect(result.unitPrice).toBe(700);
  });

  it('field=id 未命中 → 清空所有欄位', () => {
    const result = applyLotteryUpdate(emptyLottery(), 'id', 'NOTEXIST', prizes);
    expect(result.setName).toBe('');
    expect(result.unitPrice).toBe(0);
    expect(result.prizeName).toBe('');
  });

  it('field=prize 命中 → 帶入 prizeName + unitPoints（不帶入 draws）', () => {
    const item = { ...emptyLottery(), id: 'S1' };
    const result = applyLotteryUpdate(item, 'prize', 'B', prizes);
    expect(result.prizeName).toBe('獎B');
    expect(result.unitPoints).toBe(20);
    // draws 不自動帶入，維持初始值 1
    expect(result.draws).toBe(1);
  });

  it('field=prize 為 z → 非GK 標記', () => {
    const item = { ...emptyLottery(), id: 'S1' };
    const result = applyLotteryUpdate(item, 'prize', 'z', prizes);
    expect(result.prizeName).toBe('非GK');
    expect(result.unitPoints).toBe(1);
  });

  it('type=點數 時 totalPoints = draws * unitPoints', () => {
    let item = { ...emptyLottery(), id: 'S1' };
    item = applyLotteryUpdate(item, 'id', 'S1', prizes);
    item = applyLotteryUpdate(item, 'prize', 'B', prizes);
    item = applyLotteryUpdate(item, 'draws', 2, prizes); // 手動設 draws
    item = applyLotteryUpdate(item, 'type', '點數', prizes);
    // B has draws=2, points=20 → totalPoints = 2*20 = 40
    expect(item.totalPoints).toBe(40);
  });

  it('type=帶走 時 totalPoints = 0', () => {
    let item = applyLotteryUpdate(emptyLottery(), 'id', 'S1', prizes);
    item = applyLotteryUpdate(item, 'prize', 'A', prizes);
    // default type is '帶走'
    expect(item.totalPoints).toBe(0);
  });

  it('amount = draws * unitPrice (自動計算)', () => {
    let item = applyLotteryUpdate(emptyLottery(), 'id', 'S1', prizes);
    item = applyLotteryUpdate(item, 'prize', 'B', prizes);
    item = applyLotteryUpdate(item, 'draws', 2, prizes); // 手動設 draws=2, unitPrice=700
    expect(item.amount).toBe(1400);
  });

  it('field=amount 時不覆蓋使用者輸入的 amount', () => {
    let item = applyLotteryUpdate(emptyLottery(), 'id', 'S1', prizes);
    item = applyLotteryUpdate(item, 'amount', 999, prizes);
    expect(item.amount).toBe(999);
  });

  // ── 點數套相關測試 (covers L47-49, L79-81) ──
  it('field=id 命中點數套 → type=點數, amount=0, remark=點數套', () => {
    const pointsPrizes = [makePrize('PS1', 'A', { isPointsSet: true, unitPrice: 400 })];
    const result = applyLotteryUpdate(emptyLottery(), 'id', 'PS1', pointsPrizes);
    expect(result.type).toBe('點數');
    expect(result.amount).toBe(0);
    expect(result.remark).toBe('點數套');
    expect(result.setName).toBe('套PS1');
    expect(result.unitPrice).toBe(400);
  });

  it('點數套 pointsCost 預設 = unitPrice/20 * draws', () => {
    const pointsPrizes = [makePrize('PS1', 'A', { isPointsSet: true, unitPrice: 400, points: 5, draws: 5 })];
    let item = applyLotteryUpdate(emptyLottery(), 'id', 'PS1', pointsPrizes);
    // 步驟1後確認是點數套
    expect(item.remark).toBe('點數套');
    expect(item.amount).toBe(0);
    // 設 draws=1 → pointsCost = floor(400/20)*1 = 20
    item = applyLotteryUpdate(item, 'prize', 'A', pointsPrizes);
    expect(item.pointsCost).toBe(20);
    // 手動建立已設定完成的 item，直接測 draws 改變後的計算
    const itemWithDraws3 = { ...item, draws: 3 };
    const result = applyLotteryUpdate(itemWithDraws3, 'prize', 'A', pointsPrizes);
    expect(result.pointsCost).toBe(60); // floor(400/20) * 3 = 60
    expect(result.amount).toBe(0);
    expect(result.totalPoints).toBe(15); // 3 * 5
  });

  it('從點數套切到正常套 → 清除 remark/pointsCost/type', () => {
    const pointsPrizes = [
      makePrize('PS1', 'A', { isPointsSet: true, unitPrice: 400 }),
      makePrize('S1', 'A', { unitPrice: 700 }),
    ];
    let item = applyLotteryUpdate(emptyLottery(), 'id', 'PS1', pointsPrizes);
    expect(item.remark).toBe('點數套');
    // 切到正常套
    item = applyLotteryUpdate(item, 'id', 'S1', pointsPrizes);
    expect(item.remark).toBe('');
    expect(item.pointsCost).toBe(0);
    expect(item.type).toBe('帶走');
  });

  it('點數套 field=pointsCost 不被覆蓋', () => {
    const pointsPrizes = [makePrize('PS1', 'A', { isPointsSet: true, unitPrice: 400 })];
    let item = applyLotteryUpdate(emptyLottery(), 'id', 'PS1', pointsPrizes);
    item = applyLotteryUpdate(item, 'pointsCost', 100, pointsPrizes);
    expect(item.pointsCost).toBe(100); // 手動輸入不被覆蓋
  });

  it('點數套 field=prize 不覆蓋 remark=點數套', () => {
    const pointsPrizes = [makePrize('PS1', 'z', { isPointsSet: true, unitPrice: 400 })];
    let item = applyLotteryUpdate(emptyLottery(), 'id', 'PS1', pointsPrizes);
    // prize=z 正常會設 remark='' 但點數套應保留 '點數套'
    item = applyLotteryUpdate(item, 'prize', 'z', pointsPrizes);
    expect(item.remark).toBe('點數套');
  });

  // ── 抽數防呆 (covers L73) ──
  it('draws 超過總抽數時 cap 到最大值', () => {
    let item = applyLotteryUpdate(emptyLottery(), 'id', 'S1', prizes);
    item = applyLotteryUpdate(item, 'prize', 'B', prizes); // B has draws=2
    item = applyLotteryUpdate(item, 'draws', 999, prizes);
    expect(item.draws).toBe(2); // capped to prize max
  });

  it('draws 未超過時正常設定', () => {
    let item = applyLotteryUpdate(emptyLottery(), 'id', 'S1', prizes);
    item = applyLotteryUpdate(item, 'prize', 'B', prizes); // B has draws=2
    item = applyLotteryUpdate(item, 'draws', 1, prizes);
    expect(item.draws).toBe(1);
  });

  // ── prize 特殊代碼 remark ──
  it('field=prize 為 88888 → remark=送1點', () => {
    const item = { ...emptyLottery(), id: 'S1' };
    const result = applyLotteryUpdate(item, 'prize', '88888', prizes);
    expect(result.remark).toBe('送1點');
  });

  it('field=prize 為 99999 → remark=扣1點', () => {
    const item = { ...emptyLottery(), id: 'S1' };
    const result = applyLotteryUpdate(item, 'prize', '99999', prizes);
    expect(result.remark).toBe('扣1點');
  });

  it('field=prize 為 x → remark=盲盒', () => {
    const item = { ...emptyLottery(), id: 'S1' };
    const result = applyLotteryUpdate(item, 'prize', 'x', prizes);
    expect(result.remark).toBe('盲盒');
  });
});

// ═══════════════════════════════════════════════════
// applyMerchUpdate
// ═══════════════════════════════════════════════════
describe('applyMerchUpdate', () => {
  it('id 命中 stock → 帶入名稱 + points', () => {
    const result = applyMerchUpdate(emptyMerch(), 'id', '100065', stocks, blindBoxes);
    expect(result.name).toBe('商品100065');
    expect(result.suggestedPoints).toBe(5);
  });

  it('GK 類商品自動切 paymentType=點數', () => {
    const result = applyMerchUpdate(emptyMerch(), 'id', 'GK001', stocks, blindBoxes);
    expect(result.isGk).toBe(true);
    expect(result.paymentType).toBe('點數');
  });

  it('id 命中 blindBox → 帶入名稱 + manualPrice', () => {
    const result = applyMerchUpdate(emptyMerch(), 'id', 'BB001', stocks, blindBoxes);
    expect(result.name).toBe('盲盒BB001');
    expect(result.unitAmount).toBe(200);
  });

  it('88888 手動加點', () => {
    const result = applyMerchUpdate(emptyMerch(), 'id', '88888', stocks, blindBoxes);
    expect(result.name).toBe('手動加點 (隨便加)');
    expect(result.paymentType).toBe('贈送');
    expect(result.remark).toBe('補點');
  });

  it('99999 手動扣點', () => {
    const result = applyMerchUpdate(emptyMerch(), 'id', '99999', stocks, blindBoxes);
    expect(result.name).toBe('手動扣點 (隨便扣)');
    expect(result.paymentType).toBe('贈送');
  });

  it('paymentType=現金 → actualAmount = quantity * unitAmount', () => {
    let item = applyMerchUpdate(emptyMerch(), 'id', 'BB001', stocks, blindBoxes);
    item = applyMerchUpdate(item, 'quantity', 3, stocks, blindBoxes);
    item = applyMerchUpdate(item, 'paymentType', '現金', stocks, blindBoxes);
    expect(item.actualAmount).toBe(600); // 3 * 200
  });

  it('paymentType=點數 → totalPoints = quantity * suggestedPoints', () => {
    let item = applyMerchUpdate(emptyMerch(), 'id', '100065', stocks, blindBoxes);
    item = applyMerchUpdate(item, 'quantity', 2, stocks, blindBoxes);
    item = applyMerchUpdate(item, 'paymentType', '點數', stocks, blindBoxes);
    expect(item.totalPoints).toBe(10); // 2 * 5
    expect(item.actualAmount).toBe(0);
  });

  it('paymentType=贈送 → 全部歸零', () => {
    let item = applyMerchUpdate(emptyMerch(), 'id', '100065', stocks, blindBoxes);
    item = applyMerchUpdate(item, 'paymentType', '贈送', stocks, blindBoxes);
    expect(item.actualAmount).toBe(0);
    expect(item.totalPoints).toBe(0);
  });
});

// ═══════════════════════════════════════════════════
// filterMembers
// ═══════════════════════════════════════════════════
describe('filterMembers', () => {
  const members = [
    { phone: '0912345678', name: '王小明' },
    { phone: '0987654321', name: '李大華' },
    { phone: '0955887766', name: '張美麗' },
  ];

  it('短於 2 字不觸發', () => {
    expect(filterMembers('0', members)).toEqual([]);
  });

  it('phone 匹配', () => {
    const result = filterMembers('0912', members);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('王小明');
  });

  it('name 匹配 (case insensitive)', () => {
    const result = filterMembers('大華', members);
    expect(result).toHaveLength(1);
    expect(result[0].phone).toBe('0987654321');
  });

  it('limit 限制結果數量', () => {
    const bigList = Array.from({ length: 20 }, (_, i) => ({ phone: `091${i}`, name: `人${i}` }));
    const result = filterMembers('091', bigList, 5);
    expect(result).toHaveLength(5);
  });

  it('無匹配回傳空陣列', () => {
    expect(filterMembers('ZZZZZ', members)).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════
// validateCheckout
// ═══════════════════════════════════════════════════
describe('validateCheckout', () => {
  const baseInput = () => ({
    lotteries: [] as ReturnType<typeof emptyLottery>[],
    merchandises: [] as ReturnType<typeof emptyMerch>[],
    customer: { phoneName: '0912345678', name: '王小明', currentPoints: 100 },
    payment: { cash: 0, remittance: 0, creditCard: 0, pointsUsed: 0 },
    summary: { dueAmount: 0, pointsChange: 0 },
  });

  it('空購物車被擋', () => {
    const result = validateCheckout(baseInput());
    expect(result).toContain('請至少輸入一項');
  });

  it('缺電話被擋', () => {
    const input = baseInput();
    input.merchandises = [{ ...emptyMerch(), id: '100065', name: '商品' }];
    input.customer.phoneName = '';
    expect(validateCheckout(input)).toContain('電話號碼');
  });

  it('缺會員名稱被擋', () => {
    const input = baseInput();
    input.merchandises = [{ ...emptyMerch(), id: '100065', name: '商品' }];
    input.customer.name = '';
    expect(validateCheckout(input)).toContain('Enter');
  });

  it('lottery 資料不全被擋', () => {
    const input = baseInput();
    input.lotteries = [{ ...emptyLottery(), id: 'S1', prize: 'A' }]; // missing setName + prizeName
    expect(validateCheckout(input)).toContain('福袋區第 1 項');
  });

  it('merch 資料不全被擋', () => {
    const input = baseInput();
    input.merchandises = [{ ...emptyMerch(), id: '100065' }]; // missing name
    expect(validateCheckout(input)).toContain('直購商品區第 1 項');
  });

  it('負數金額被擋', () => {
    const input = baseInput();
    input.merchandises = [{ ...emptyMerch(), id: '88888', name: '手動加點', paymentType: '贈送' }];
    input.payment.cash = -100;
    expect(validateCheckout(input)).toContain('負數');
  });

  it('實收金額不符被擋', () => {
    const input = baseInput();
    input.merchandises = [{ ...emptyMerch(), id: '88888', name: '手動加點', paymentType: '贈送' }];
    input.summary.dueAmount = 500;
    input.payment.cash = 300;
    expect(validateCheckout(input)).toContain('不符');
  });

  it('點數不足被擋', () => {
    const input = baseInput();
    input.merchandises = [{ ...emptyMerch(), id: '88888', name: '手動加點', paymentType: '贈送' }];
    input.customer.currentPoints = 0;
    input.summary.pointsChange = -10; // 扣 10 點
    expect(validateCheckout(input)).toContain('點數餘額不足');
  });

  it('合法輸入回傳 null', () => {
    const input = baseInput();
    input.merchandises = [{ ...emptyMerch(), id: '88888', name: '手動加點 (隨便加)', paymentType: '贈送', quantity: 1 }];
    expect(validateCheckout(input)).toBeNull();
  });
});
