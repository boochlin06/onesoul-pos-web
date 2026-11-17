import { InvariantViolationError } from '@onesoul/shared';
import type { SessionStatus } from '@onesoul/shared';

export interface CashRegisterSessionProps {
  id: string;
  storeId: string;
  openedAt?: Date | string;
  closedAt?: Date | string | null;
  openedBy: string;
  closedBy?: string | null;
  openingCash: number;
  expectedCash?: number | null;
  actualCash?: number | null;
  discrepancy?: number | null;
  totalRevenue?: number | null;
  cashRevenue?: number | null;
  cardRevenue?: number | null;
  linePayRevenue?: number | null;
  remitRevenue?: number | null;
  pointsIssued?: number | null;
  pointsRedeemed?: number | null;
  txCount?: number | null;
  voidCount?: number | null;
  voidAmount?: number | null;
  note?: string | null;
  status?: SessionStatus;
}

export interface CloseSessionParams {
  closedBy: string;
  actualCash: number;
  orders: Array<{
    status: string;
    totalDue: number;
    payment: {
      cash: number;
      creditCard: number;
      linePay: number;
      remittance: number;
      pointsUsed: number;
    };
    netPointsDelta: number;
  }>;
  note?: string | null;
  closedAt?: Date | string;
}

export interface ZReport {
  sessionId: string;
  storeId: string;
  openedAt: Date;
  closedAt: Date;
  openedBy: string;
  closedBy: string;
  openingCash: number;
  cashRevenue: number;
  expectedCash: number;
  actualCash: number;
  discrepancy: number;
  totalRevenue: number;
  cardRevenue: number;
  linePayRevenue: number;
  remitRevenue: number;
  pointsIssued: number;
  pointsRedeemed: number;
  txCount: number;
  voidCount: number;
  voidAmount: number;
  note?: string | null;
}

export class CashRegisterSession {
  public readonly id: string;
  public readonly storeId: string;
  public readonly openedAt: Date;
  public closedAt?: Date | null;
  public readonly openedBy: string;
  public closedBy?: string | null;
  public readonly openingCash: number;
  public expectedCash?: number | null;
  public actualCash?: number | null;
  public discrepancy?: number | null;
  public totalRevenue?: number | null;
  public cashRevenue?: number | null;
  public cardRevenue?: number | null;
  public linePayRevenue?: number | null;
  public remitRevenue?: number | null;
  public pointsIssued?: number | null;
  public pointsRedeemed?: number | null;
  public txCount?: number | null;
  public voidCount?: number | null;
  public voidAmount?: number | null;
  public note?: string | null;
  public status: SessionStatus;

  constructor(props: CashRegisterSessionProps) {
    this.id = props.id;
    this.storeId = props.storeId;
    this.openedAt = props.openedAt ? new Date(props.openedAt) : new Date();
    this.closedAt = props.closedAt ? new Date(props.closedAt) : null;
    this.openedBy = props.openedBy;
    this.closedBy = props.closedBy ?? null;
    this.openingCash = props.openingCash;
    this.expectedCash = props.expectedCash ?? null;
    this.actualCash = props.actualCash ?? null;
    this.discrepancy = props.discrepancy ?? null;
    this.totalRevenue = props.totalRevenue ?? null;
    this.cashRevenue = props.cashRevenue ?? null;
    this.cardRevenue = props.cardRevenue ?? null;
    this.linePayRevenue = props.linePayRevenue ?? null;
    this.remitRevenue = props.remitRevenue ?? null;
    this.pointsIssued = props.pointsIssued ?? null;
    this.pointsRedeemed = props.pointsRedeemed ?? null;
    this.txCount = props.txCount ?? null;
    this.voidCount = props.voidCount ?? null;
    this.voidAmount = props.voidAmount ?? null;
    this.note = props.note ?? null;
    this.status = props.status ?? 'OPEN';
  }

  get isOpen(): boolean {
    return this.status === 'OPEN';
  }

  close(params: CloseSessionParams): ZReport {
    if (!this.isOpen) {
      throw new InvariantViolationError(`收銀班次 [${this.id}] 已經關閉，不可重複關帳。`);
    }

    let cashRev = 0;
    let cardRev = 0;
    let lineRev = 0;
    let remitRev = 0;
    let totalRev = 0;
    let ptsIssued = 0;
    let ptsRedeemed = 0;
    let validTx = 0;
    let voidedTx = 0;
    let voidedAmt = 0;

    for (const order of params.orders) {
      if (order.status === 'CANCELLED') {
        voidedTx += 1;
        voidedAmt += order.totalDue;
        continue;
      }
      validTx += 1;
      cashRev += order.payment.cash;
      cardRev += order.payment.creditCard;
      lineRev += order.payment.linePay;
      remitRev += order.payment.remittance;
      totalRev += order.totalDue;
      ptsRedeemed += order.payment.pointsUsed;
      if (order.netPointsDelta > 0) {
        ptsIssued += order.netPointsDelta;
      }
    }

    const expCash = this.openingCash + cashRev;
    const disc = params.actualCash - expCash;
    const closedDate = params.closedAt ? new Date(params.closedAt) : new Date();

    this.status = 'CLOSED';
    this.closedAt = closedDate;
    this.closedBy = params.closedBy;
    this.actualCash = params.actualCash;
    this.cashRevenue = cashRev;
    this.cardRevenue = cardRev;
    this.linePayRevenue = lineRev;
    this.remitRevenue = remitRev;
    this.totalRevenue = totalRev;
    this.expectedCash = expCash;
    this.discrepancy = disc;
    this.pointsIssued = ptsIssued;
    this.pointsRedeemed = ptsRedeemed;
    this.txCount = validTx;
    this.voidCount = voidedTx;
    this.voidAmount = voidedAmt;
    this.note = params.note ?? this.note;

    return {
      sessionId: this.id,
      storeId: this.storeId,
      openedAt: this.openedAt,
      closedAt: closedDate,
      openedBy: this.openedBy,
      closedBy: this.closedBy,
      openingCash: this.openingCash,
      cashRevenue: cashRev,
      expectedCash: expCash,
      actualCash: params.actualCash,
      discrepancy: disc,
      totalRevenue: totalRev,
      cardRevenue: cardRev,
      linePayRevenue: lineRev,
      remitRevenue: remitRev,
      pointsIssued: ptsIssued,
      pointsRedeemed: ptsRedeemed,
      txCount: validTx,
      voidCount: voidedTx,
      voidAmount: voidedAmt,
      note: this.note,
    };
  }
}
