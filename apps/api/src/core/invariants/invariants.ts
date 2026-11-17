import { InvariantViolationError } from '@onesoul/shared';
import type { PhoneNumber } from '../entities/PhoneNumber';
import type { OrderPayment } from '../entities/Order';

/**
 * 🚨 Invariant #1: 散客（Walk-In）點數穿透零容忍阻斷
 * 未綁定會員手機號碼之散客（WALKIN, 111111, 222222, 333333, 88888, 99999 等），
 * 嚴禁使用任何點數折抵、購買點數商品、或參與限定點數套。
 */
export function validateWalkInBlock(
  customerPhone: PhoneNumber,
  payment: OrderPayment,
  lotteries?: Array<{ type?: string; pointsCost?: number; isPointsSet?: boolean; pickType?: string }>,
  merchandises?: Array<{ paymentType?: string; totalPoints?: number }>
): void {
  if (!customerPhone.isWalkIn) return;

  if (payment.pointsUsed > 0) {
    throw new InvariantViolationError(
      '散客無會員帳號，嚴禁使用點數扣抵或抽取點數套，請先為顧客建檔綁定會員手機號碼。'
    );
  }

  if (lotteries && lotteries.length > 0) {
    for (const lot of lotteries) {
      if (
        lot.type === '點數' ||
        (lot.pointsCost && lot.pointsCost > 0) ||
        lot.isPointsSet ||
        lot.pickType === 'POINTS'
      ) {
        throw new InvariantViolationError(
          '散客無會員帳號，嚴禁使用點數扣抵或抽取點數套，請先為顧客建檔綁定會員手機號碼。'
        );
      }
    }
  }

  if (merchandises && merchandises.length > 0) {
    for (const merch of merchandises) {
      if (
        merch.paymentType === '點數' ||
        merch.paymentType === 'POINTS' ||
        (merch.totalPoints && merch.totalPoints > 0)
      ) {
        throw new InvariantViolationError(
          '散客無會員帳號，嚴禁使用點數兌換商品，請先為顧客建檔綁定會員手機號碼。'
        );
      }
    }
  }
}

/**
 * 🚨 Invariant #2: 一番賞開套不預扣庫存，提貨核銷不變量
 * 發布開套僅建立 LuckyBag 與 LuckyBagPrize 籤位，嚴禁預扣 StoreInventory。
 * 限定點數套金額歸零，每抽扣除 floor(unitPrice / 20) 點。
 * X 賞等價換 10 點、Z 賞保底換 1 點。
 */
export function validateLuckyBagPublish(plan: {
  totalDraws: number;
  items: Array<{
    grade?: string;
    draws: number;
    productId?: string | null;
    isNonGk?: boolean;
  }>;
}): void {
  const sumDraws = plan.items.reduce((sum, it) => sum + (it.draws || 0), 0);
  if (sumDraws !== plan.totalDraws) {
    throw new InvariantViolationError(
      `各賞抽數總和 (${sumDraws}) 不等於全套總抽數 (${plan.totalDraws})。`
    );
  }

  // 必須包含至少 1 款實體大賞 GK 雕像
  const hasGrandPrize = plan.items.some((it) => {
    if (it.isNonGk) return false;
    const grade = (it.grade || '').trim().toUpperCase();
    const pid = (it.productId || '').trim().toLowerCase();
    const isAbstract = ['0p', '1p', 'x', 'z', 'blind_box'].includes(pid) || grade === 'X' || grade === 'Z';
    return !isAbstract && !!it.productId;
  });

  if (!hasGrandPrize) {
    throw new InvariantViolationError('開套方案必須包含至少 1 款實體大賞 GK 雕像。');
  }
}

export function resolveSmallPrizePoints(
  grade: string,
  explicitPoints?: number | null,
  defaultBlindBoxPoints = 10,
  isNonGk?: boolean
): number {
  const upper = String(grade || '').trim().toUpperCase();
  if (explicitPoints !== undefined && explicitPoints !== null && !isNaN(explicitPoints)) {
    if (explicitPoints > 0) return explicitPoints;
    if (upper === 'X') return defaultBlindBoxPoints;
    if (upper === 'Z' || isNonGk) return 1;
    return explicitPoints;
  }

  if (upper === 'X') return defaultBlindBoxPoints;
  if (upper === 'Z' || isNonGk) return 1;
  return 0;
}

export function calculatePointsSetCost(unitPrice: number, draws: number): number {
  return Math.floor(unitPrice / 20) * draws;
}

export function validatePointsSetOrder(
  isPointsSet: boolean,
  unitPrice: number,
  draws: number,
  amount: number,
  pointsCost?: number
): void {
  if (!isPointsSet) return;

  if (amount !== 0) {
    throw new InvariantViolationError(
      `限定點數套應付金額必須為 $0 (當前: $${amount})。`
    );
  }

  const expectedCost = calculatePointsSetCost(unitPrice, draws);
  if (pointsCost !== undefined && pointsCost !== expectedCost) {
    throw new InvariantViolationError(
      `限定點數套扣點錯誤: 預期 ${expectedCost} 點，實際 ${pointsCost} 點。`
    );
  }
}

/**
 * 🚨 Invariant #3: 多商品出庫字典序排序防死鎖
 * 當結帳或調撥包含多項實體商品時，強制將商品 ID 依 localeCompare 字典序排序，
 * 確保任何並行交易以確定性順序競爭資料庫行級鎖，徹底杜絕 PostgreSQL 40P01 / SQLite 鎖爭用死鎖。
 */
export function sortProductIdsForLock(
  productIds: Array<string | null | undefined>
): string[] {
  const valid = productIds.filter(
    (id): id is string => typeof id === 'string' && id.trim().length > 0
  );
  return Array.from(new Set(valid)).sort((a, b) => a.localeCompare(b));
}
