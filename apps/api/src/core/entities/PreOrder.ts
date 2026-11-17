import { InvariantViolationError } from '@onesoul/shared';
import type { PreOrderStatus } from '@onesoul/shared';

export interface PreOrderProps {
  id: string;
  name: string;
  version?: string | null;
  quantity: number;
  deposit?: number;
  finalPayment?: number;
  shippingFee?: number;
  totalCost?: number;
  supplier?: string | null;
  targetStoreId?: string | null;
  productId?: string | null;
  status?: PreOrderStatus;
  arrivedAt?: Date | string | null;
  note?: string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export class PreOrder {
  public readonly id: string;
  public name: string;
  public version?: string | null;
  public quantity: number;
  public deposit: number;
  public finalPayment: number;
  public shippingFee: number;
  public totalCost: number;
  public supplier?: string | null;
  public targetStoreId?: string | null;
  public productId?: string | null;
  public status: PreOrderStatus;
  public arrivedAt?: Date | null;
  public note?: string | null;
  public readonly createdAt: Date;
  public updatedAt: Date;

  constructor(props: PreOrderProps) {
    if (props.quantity <= 0) {
      throw new InvariantViolationError('預購數量必須大於 0。');
    }
    this.id = props.id;
    this.name = props.name;
    this.version = props.version ?? null;
    this.quantity = props.quantity;
    this.deposit = props.deposit ?? 0;
    this.finalPayment = props.finalPayment ?? 0;
    this.shippingFee = props.shippingFee ?? 0;
    this.totalCost =
      props.totalCost !== undefined
        ? props.totalCost
        : this.deposit + this.finalPayment + this.shippingFee;
    this.supplier = props.supplier ?? null;
    this.targetStoreId = props.targetStoreId ?? null;
    this.productId = props.productId ?? null;
    this.status = props.status ?? 'PENDING';
    this.arrivedAt = props.arrivedAt ? new Date(props.arrivedAt) : null;
    this.note = props.note ?? null;
    this.createdAt = props.createdAt ? new Date(props.createdAt) : new Date();
    this.updatedAt = props.updatedAt ? new Date(props.updatedAt) : new Date();
  }

  receive(params: {
    productId: string;
    finalPayment?: number;
    shippingFee?: number;
    arrivedAt?: Date | string;
  }): { unitCost: number; totalCost: number } {
    if (this.status !== 'PENDING') {
      throw new InvariantViolationError(
        `預購單 [${this.id}] 狀態為 ${this.status}，僅 PENDING 狀態可驗收入庫。`
      );
    }
    if (params.finalPayment !== undefined) {
      this.finalPayment = Math.max(0, params.finalPayment);
    }
    if (params.shippingFee !== undefined) {
      this.shippingFee = Math.max(0, params.shippingFee);
    }

    this.totalCost = this.deposit + this.finalPayment + this.shippingFee;
    const unitCost = Math.ceil(this.totalCost / this.quantity);

    this.productId = params.productId;
    this.status = 'COMPLETED';
    this.arrivedAt = params.arrivedAt ? new Date(params.arrivedAt) : new Date();
    this.updatedAt = new Date();

    return { unitCost, totalCost: this.totalCost };
  }

  cancel(reason?: string): void {
    if (this.status !== 'PENDING') {
      throw new InvariantViolationError(
        `預購單 [${this.id}] 狀態為 ${this.status}，僅 PENDING 狀態可取消。`
      );
    }
    this.status = 'CANCELLED';
    if (reason) {
      this.note = this.note ? `${this.note} | 取消原因: ${reason}` : `取消原因: ${reason}`;
    }
    this.updatedAt = new Date();
  }
}
