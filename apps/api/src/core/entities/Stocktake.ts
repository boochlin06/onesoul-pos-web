import { InvariantViolationError } from '@onesoul/shared';
import type { StocktakeStatus } from '@onesoul/shared';

export interface StocktakeItemProps {
  id: string;
  stocktakeId: string;
  productId: string;
  systemQty: number;
  actualQty: number;
  variance?: number;
  itemRemark?: string | null;
}

export class StocktakeItem {
  public readonly id: string;
  public readonly stocktakeId: string;
  public readonly productId: string;
  public readonly systemQty: number;
  public actualQty: number;
  public variance: number;
  public itemRemark?: string | null;

  constructor(props: StocktakeItemProps) {
    this.id = props.id;
    this.stocktakeId = props.stocktakeId;
    this.productId = props.productId;
    this.systemQty = props.systemQty;
    this.actualQty = props.actualQty;
    this.variance =
      props.variance !== undefined
        ? props.variance
        : this.actualQty - this.systemQty;
    this.itemRemark = props.itemRemark ?? null;
  }

  updateActualQty(qty: number): void {
    this.actualQty = qty;
    this.variance = this.actualQty - this.systemQty;
  }
}

export interface StocktakeProps {
  id: string;
  storeId: string;
  status?: StocktakeStatus;
  countedBy: string;
  postedBy?: string | null;
  postedAt?: Date | string | null;
  note?: string | null;
  items?: StocktakeItem[];
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export class Stocktake {
  public readonly id: string;
  public readonly storeId: string;
  public status: StocktakeStatus;
  public readonly countedBy: string;
  public postedBy?: string | null;
  public postedAt?: Date | null;
  public note?: string | null;
  public items: StocktakeItem[];
  public readonly createdAt: Date;
  public updatedAt: Date;

  constructor(props: StocktakeProps) {
    this.id = props.id;
    this.storeId = props.storeId;
    this.status = props.status ?? 'DRAFT';
    this.countedBy = props.countedBy;
    this.postedBy = props.postedBy ?? null;
    this.postedAt = props.postedAt ? new Date(props.postedAt) : null;
    this.note = props.note ?? null;
    this.items = props.items ?? [];
    this.createdAt = props.createdAt ? new Date(props.createdAt) : new Date();
    this.updatedAt = props.updatedAt ? new Date(props.updatedAt) : new Date();
  }

  post(operator: string): void {
    if (this.status !== 'DRAFT') {
      throw new InvariantViolationError(
        `門市實盤 [${this.id}] 狀態為 ${this.status}，僅 DRAFT 狀態可過帳生效。`
      );
    }
    this.status = 'POSTED';
    this.postedBy = operator;
    this.postedAt = new Date();
    this.updatedAt = new Date();
  }

  cancel(): void {
    if (this.status !== 'DRAFT') {
      throw new InvariantViolationError(
        `門市實盤 [${this.id}] 狀態為 ${this.status}，僅 DRAFT 狀態可作廢取消。`
      );
    }
    this.status = 'CANCELLED';
    this.updatedAt = new Date();
  }
}
