import { InvariantViolationError } from '@onesoul/shared';
import type { TransferStatus } from '@onesoul/shared';

export interface TransferOrderItemProps {
  id: string;
  transferId: string;
  productId: string;
  requestedQty: number;
  shippedQty?: number;
  receivedQty?: number;
  remark?: string | null;
}

export class TransferOrderItem {
  public readonly id: string;
  public readonly transferId: string;
  public readonly productId: string;
  public readonly requestedQty: number;
  public shippedQty: number;
  public receivedQty: number;
  public readonly remark?: string | null;

  constructor(props: TransferOrderItemProps) {
    this.id = props.id;
    this.transferId = props.transferId;
    this.productId = props.productId;
    this.requestedQty = props.requestedQty;
    this.shippedQty = props.shippedQty ?? props.requestedQty;
    this.receivedQty = props.receivedQty ?? 0;
    this.remark = props.remark ?? null;
  }
}

export interface TransferOrderProps {
  id: string;
  transferNo: string;
  sourceStoreId: string;
  targetStoreId: string;
  status?: TransferStatus;
  dispatchedAt?: Date | string | null;
  receivedAt?: Date | string | null;
  dispatchedBy?: string | null;
  receivedBy?: string | null;
  note?: string | null;
  items?: TransferOrderItem[];
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export class TransferOrder {
  public readonly id: string;
  public readonly transferNo: string;
  public readonly sourceStoreId: string;
  public readonly targetStoreId: string;
  public status: TransferStatus;
  public dispatchedAt?: Date | null;
  public receivedAt?: Date | null;
  public dispatchedBy?: string | null;
  public receivedBy?: string | null;
  public note?: string | null;
  public items: TransferOrderItem[];
  public readonly createdAt: Date;
  public updatedAt: Date;

  constructor(props: TransferOrderProps) {
    if (props.sourceStoreId === props.targetStoreId) {
      throw new InvariantViolationError('來源門市與目的門市不可相同。');
    }
    this.id = props.id;
    this.transferNo = props.transferNo;
    this.sourceStoreId = props.sourceStoreId;
    this.targetStoreId = props.targetStoreId;
    this.status = props.status ?? 'DRAFT';
    this.dispatchedAt = props.dispatchedAt ? new Date(props.dispatchedAt) : null;
    this.receivedAt = props.receivedAt ? new Date(props.receivedAt) : null;
    this.dispatchedBy = props.dispatchedBy ?? null;
    this.receivedBy = props.receivedBy ?? null;
    this.note = props.note ?? null;
    this.items = props.items ?? [];
    this.createdAt = props.createdAt ? new Date(props.createdAt) : new Date();
    this.updatedAt = props.updatedAt ? new Date(props.updatedAt) : new Date();
  }

  dispatch(operator: string): void {
    if (this.status !== 'DRAFT') {
      throw new InvariantViolationError(
        `調撥單 [${this.transferNo}] 狀態為 ${this.status}，僅 DRAFT 狀態可出庫發貨。`
      );
    }
    this.status = 'DISPATCHED';
    this.dispatchedBy = operator;
    this.dispatchedAt = new Date();
    this.updatedAt = new Date();
  }

  receive(operator: string): void {
    if (this.status !== 'DISPATCHED') {
      throw new InvariantViolationError(
        `調撥單 [${this.transferNo}] 狀態為 ${this.status}，僅 DISPATCHED 狀態可確認入庫。`
      );
    }
    this.status = 'RECEIVED';
    this.receivedBy = operator;
    this.receivedAt = new Date();
    this.updatedAt = new Date();
  }

  cancel(_operator?: string, note?: string): void {
    if (this.status === 'RECEIVED' || this.status === 'CANCELLED') {
      throw new InvariantViolationError(
        `調撥單 [${this.transferNo}] 已於 ${this.status} 狀態，不可取消。`
      );
    }
    this.status = 'CANCELLED';
    if (note) {
      this.note = this.note ? `${this.note} | 取消原因: ${note}` : `取消原因: ${note}`;
    }
    this.updatedAt = new Date();
  }
}
