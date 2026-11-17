import { InsufficientStockError } from '@onesoul/shared';
import type {
  ProductCategory,
  ProductCondition,
  InventoryChangeType,
} from '@onesoul/shared';

export interface ProductProps {
  id: string;
  name: string;
  category?: ProductCategory;
  condition?: ProductCondition;
  costPrice?: number;
  sellingPrice?: number;
  suggestedPoints?: number;
  version?: number;
  isSpecial?: boolean;
  barcode?: string | null;
  remark?: string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export class Product {
  public readonly id: string;
  public name: string;
  public category: ProductCategory;
  public condition: ProductCondition;
  public costPrice: number;
  public sellingPrice: number;
  public suggestedPoints: number;
  public version: number;
  public isSpecial: boolean;
  public barcode?: string | null;
  public remark?: string | null;
  public readonly createdAt: Date;
  public updatedAt: Date;

  constructor(props: ProductProps) {
    this.id = props.id;
    this.name = props.name;
    this.category = props.category ?? 'GENERAL';
    this.condition = props.condition ?? 'NEW';
    this.costPrice = props.costPrice ?? 0;
    this.sellingPrice = props.sellingPrice ?? 0;
    this.suggestedPoints =
      props.suggestedPoints !== undefined
        ? props.suggestedPoints
        : Math.round(this.sellingPrice * 0.05);
    this.version = props.version ?? 1;
    this.isSpecial = !!props.isSpecial;
    this.barcode = props.barcode ?? null;
    this.remark = props.remark ?? null;
    this.createdAt = props.createdAt ? new Date(props.createdAt) : new Date();
    this.updatedAt = props.updatedAt ? new Date(props.updatedAt) : new Date();
  }

  isVirtual(): boolean {
    return this.id === '88888' || this.id === '99999' || this.isSpecial;
  }
}

export interface StoreInventoryProps {
  id: string;
  storeId: string;
  productId: string;
  quantity: number;
  safetyStock?: number;
  version?: number;
  updatedAt?: Date | string;
}

export class StoreInventory {
  public readonly id: string;
  public readonly storeId: string;
  public readonly productId: string;
  public quantity: number;
  public safetyStock: number;
  public version: number;
  public updatedAt: Date;

  constructor(props: StoreInventoryProps) {
    this.id = props.id;
    this.storeId = props.storeId;
    this.productId = props.productId;
    this.quantity = props.quantity;
    this.safetyStock = props.safetyStock ?? 0;
    this.version = props.version ?? 1;
    this.updatedAt = props.updatedAt ? new Date(props.updatedAt) : new Date();

    if (this.quantity < 0) {
      throw new InsufficientStockError(
        `庫存不可小於 0 (store: ${this.storeId}, product: ${this.productId}, qty: ${this.quantity})`
      );
    }
  }

  deduct(amount: number): void {
    if (amount <= 0) return;
    if (this.quantity - amount < 0) {
      throw new InsufficientStockError(
        `門市庫存不足: 商品 [${this.productId}] 現有庫存 ${this.quantity}，欲扣除 ${amount}`
      );
    }
    this.quantity -= amount;
    this.version += 1;
    this.updatedAt = new Date();
  }

  add(amount: number): void {
    if (amount <= 0) return;
    this.quantity += amount;
    this.version += 1;
    this.updatedAt = new Date();
  }
}

export interface InventoryLogProps {
  id: string;
  storeId: string;
  productId: string;
  changeType: InventoryChangeType;
  delta: number;
  balance: number;
  orderId?: string | null;
  stocktakeId?: string | null;
  operator?: string | null;
  reason?: string | null;
  createdAt?: Date | string;
}

export class InventoryLog {
  public readonly id: string;
  public readonly storeId: string;
  public readonly productId: string;
  public readonly changeType: InventoryChangeType;
  public readonly delta: number;
  public readonly balance: number;
  public readonly orderId?: string | null;
  public readonly stocktakeId?: string | null;
  public readonly operator?: string | null;
  public readonly reason?: string | null;
  public readonly createdAt: Date;

  constructor(props: InventoryLogProps) {
    this.id = props.id;
    this.storeId = props.storeId;
    this.productId = props.productId;
    this.changeType = props.changeType;
    this.delta = props.delta;
    this.balance = props.balance;
    this.orderId = props.orderId ?? null;
    this.stocktakeId = props.stocktakeId ?? null;
    this.operator = props.operator ?? null;
    this.reason = props.reason ?? null;
    this.createdAt = props.createdAt ? new Date(props.createdAt) : new Date();
  }
}
