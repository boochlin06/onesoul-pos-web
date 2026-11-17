import { InvariantViolationError } from '@onesoul/shared';
import type { OrderStatus, OrderItemType, DrawPickType } from '@onesoul/shared';
import { PhoneNumber } from './PhoneNumber';

export interface PaymentStrategy {
  readonly method: 'CASH' | 'LINE_PAY' | 'CREDIT_CARD' | 'REMITTANCE' | 'POINTS';
  process(amount: number): { success: boolean; method: string; amount: number };
}

export class CashPaymentStrategy implements PaymentStrategy {
  readonly method = 'CASH';
  process(amount: number) {
    return { success: true, method: this.method, amount };
  }
}

export class LinePayPaymentStrategy implements PaymentStrategy {
  readonly method = 'LINE_PAY';
  process(amount: number) {
    return { success: true, method: this.method, amount };
  }
}

export class CreditCardPaymentStrategy implements PaymentStrategy {
  readonly method = 'CREDIT_CARD';
  process(amount: number) {
    return { success: true, method: this.method, amount };
  }
}

export class PointsPaymentStrategy implements PaymentStrategy {
  readonly method = 'POINTS';
  process(amount: number) {
    return { success: true, method: this.method, amount };
  }
}

export interface OrderPayment {
  cash: number;
  creditCard: number;
  linePay: number;
  remittance: number;
  pointsUsed: number;
}

export interface OrderItemProps {
  id: string;
  orderId: string;
  itemType: OrderItemType;
  bagId?: string | null;
  prizeGrade?: string | null;
  prizeName?: string | null;
  pickType?: DrawPickType | null;
  draws?: number | null;
  productId?: string | null;
  quantity: number;
  unitPrice: number;
  amount: number;
  pointsImpact: number;
  remark?: string | null;
}

export class OrderItem {
  public readonly id: string;
  public readonly orderId: string;
  public readonly itemType: OrderItemType;
  public readonly bagId?: string | null;
  public readonly prizeGrade?: string | null;
  public readonly prizeName?: string | null;
  public readonly pickType?: DrawPickType | null;
  public readonly draws?: number | null;
  public readonly productId?: string | null;
  public readonly quantity: number;
  public readonly unitPrice: number;
  public readonly amount: number;
  public readonly pointsImpact: number;
  public readonly remark?: string | null;

  constructor(props: OrderItemProps) {
    this.id = props.id;
    this.orderId = props.orderId;
    this.itemType = props.itemType;
    this.bagId = props.bagId ?? null;
    this.prizeGrade = props.prizeGrade ?? null;
    this.prizeName = props.prizeName ?? null;
    this.pickType = props.pickType ?? null;
    this.draws = props.draws ?? null;
    this.productId = props.productId ?? null;
    this.quantity = props.quantity;
    this.unitPrice = props.unitPrice;
    this.amount = props.amount;
    this.pointsImpact = props.pointsImpact;
    this.remark = props.remark ?? null;
  }
}

export interface OrderProps {
  id: string;
  checkoutUID: string;
  storeId: string;
  sessionId: string;
  memberPhone: PhoneNumber | string;
  memberId?: string | null;
  totalDue: number;
  receivedAmount?: number;
  payment: OrderPayment;
  netPointsDelta: number;
  items: OrderItem[];
  status?: OrderStatus;
  cashierEmail: string;
  orderNote?: string | null;
  voidReason?: string | null;
  voidedAt?: Date | string | null;
  voidedBy?: string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export class Order {
  public readonly id: string;
  public readonly checkoutUID: string;
  public readonly storeId: string;
  public readonly sessionId: string;
  public readonly memberPhone: PhoneNumber;
  public readonly memberId?: string | null;
  public readonly totalDue: number;
  public readonly receivedAmount: number;
  public readonly payment: OrderPayment;
  public readonly netPointsDelta: number;
  public readonly items: OrderItem[];
  public status: OrderStatus;
  public readonly cashierEmail: string;
  public readonly orderNote?: string | null;
  public voidReason?: string | null;
  public voidedAt?: Date | null;
  public voidedBy?: string | null;
  public readonly createdAt: Date;
  public updatedAt: Date;

  constructor(props: OrderProps) {
    this.id = props.id;
    this.checkoutUID = props.checkoutUID;
    this.storeId = props.storeId;
    this.sessionId = props.sessionId;
    this.memberPhone =
      props.memberPhone instanceof PhoneNumber
        ? props.memberPhone
        : new PhoneNumber(props.memberPhone);
    this.memberId = props.memberId ?? null;
    this.totalDue = props.totalDue;
    this.payment = {
      cash: Math.max(0, props.payment.cash || 0),
      creditCard: Math.max(0, props.payment.creditCard || 0),
      linePay: Math.max(0, props.payment.linePay || 0),
      remittance: Math.max(0, props.payment.remittance || 0),
      pointsUsed: Math.max(0, props.payment.pointsUsed || 0),
    };
    this.receivedAmount =
      props.receivedAmount !== undefined
        ? props.receivedAmount
        : this.payment.cash +
          this.payment.creditCard +
          this.payment.linePay +
          this.payment.remittance;
    this.netPointsDelta = props.netPointsDelta;
    this.items = props.items;
    this.status = props.status ?? 'COMPLETED';
    this.cashierEmail = props.cashierEmail;
    this.orderNote = props.orderNote ?? null;
    this.voidReason = props.voidReason ?? null;
    this.voidedAt = props.voidedAt ? new Date(props.voidedAt) : null;
    this.voidedBy = props.voidedBy ?? null;
    this.createdAt = props.createdAt ? new Date(props.createdAt) : new Date();
    this.updatedAt = props.updatedAt ? new Date(props.updatedAt) : new Date();

    this.validateInvariants();
  }

  private validateInvariants(): void {
    // Invariant #1: 散客絕對禁止使用點數或產生淨點數扣除
    if (this.memberPhone.isWalkIn) {
      if (this.payment.pointsUsed > 0 || this.netPointsDelta < 0) {
        throw new InvariantViolationError(
          '散客無會員帳號，嚴禁使用點數扣抵或抽取點數套，請先為顧客建檔綁定會員手機號碼。'
        );
      }

      // Check if any item uses points or is lottery points redemption
      for (const item of this.items) {
        if (item.pickType === 'POINTS') {
          throw new InvariantViolationError('散客無會員帳號，不可將賞品折換點數。');
        }
        if (item.pointsImpact < 0) {
          throw new InvariantViolationError('散客無會員帳號，不可消耗點數。');
        }
      }
    }

    // 金額平帳檢驗: cash + creditCard + linePay + remittance 必須等於 totalDue
    const totalPaid =
      this.payment.cash +
      this.payment.creditCard +
      this.payment.linePay +
      this.payment.remittance;

    if (totalPaid !== this.totalDue) {
      throw new InvariantViolationError(
        `實付總額 ($${totalPaid}) 不等於應收金額 ($${this.totalDue})。`
      );
    }
  }

  canVoid(): boolean {
    return this.status === 'COMPLETED';
  }

  void(reason: string, operator: string): void {
    if (!this.canVoid()) {
      throw new InvariantViolationError('訂單已經作廢或狀態不可作廢。');
    }
    this.status = 'CANCELLED';
    this.voidReason = reason;
    this.voidedBy = operator;
    this.voidedAt = new Date();
    this.updatedAt = new Date();
  }

  clone(): Order {
    return new Order({
      id: this.id,
      checkoutUID: this.checkoutUID,
      storeId: this.storeId,
      sessionId: this.sessionId,
      memberPhone: this.memberPhone,
      memberId: this.memberId,
      totalDue: this.totalDue,
      receivedAmount: this.receivedAmount,
      payment: { ...this.payment },
      netPointsDelta: this.netPointsDelta,
      items: this.items.map(
        (it) =>
          new OrderItem({
            id: it.id,
            orderId: it.orderId,
            itemType: it.itemType,
            bagId: it.bagId,
            prizeGrade: it.prizeGrade,
            prizeName: it.prizeName,
            pickType: it.pickType,
            draws: it.draws,
            productId: it.productId,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            amount: it.amount,
            pointsImpact: it.pointsImpact,
            remark: it.remark,
          })
      ),
      status: this.status,
      cashierEmail: this.cashierEmail,
      orderNote: this.orderNote,
      voidReason: this.voidReason,
      voidedAt: this.voidedAt,
      voidedBy: this.voidedBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    });
  }
}
