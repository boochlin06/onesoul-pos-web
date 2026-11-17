import { InsufficientPointsError } from '@onesoul/shared';
import type { PointLogType } from '@onesoul/shared';

export interface MemberProps {
  id: string;
  phone: string;
  name: string;
  tier?: string;
  points?: number;
  version?: number;
  totalSpent?: number;
  orderCount?: number;
  lastPurchaseAt?: Date | string | null;
  isActive?: boolean;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export class Member {
  public readonly id: string;
  public readonly phone: string;
  public name: string;
  public tier: string;
  public points: number;
  public version: number;
  public totalSpent: number;
  public orderCount: number;
  public lastPurchaseAt?: Date | null;
  public isActive: boolean;
  public readonly createdAt: Date;
  public updatedAt: Date;

  constructor(props: MemberProps) {
    this.id = props.id;
    this.phone = props.phone;
    this.name = props.name;
    this.tier = props.tier ?? 'NORMAL';
    this.points = props.points ?? 0;
    this.version = props.version ?? 1;
    this.totalSpent = props.totalSpent ?? 0;
    this.orderCount = props.orderCount ?? 0;
    this.lastPurchaseAt = props.lastPurchaseAt ? new Date(props.lastPurchaseAt) : null;
    this.isActive = props.isActive !== undefined ? props.isActive : true;
    this.createdAt = props.createdAt ? new Date(props.createdAt) : new Date();
    this.updatedAt = props.updatedAt ? new Date(props.updatedAt) : new Date();

    if (this.points < 0) {
      throw new InsufficientPointsError(`會員初始點數不可小於 0: ${this.points}`);
    }
  }

  adjustPoints(delta: number): void {
    if (this.points + delta < 0) {
      throw new InsufficientPointsError(
        `會員 [${this.phone}] 點數不足: 目前持有 ${this.points} 點，欲折抵 ${Math.abs(delta)} 點。`
      );
    }
    this.points += delta;
    this.version += 1;
    this.updatedAt = new Date();
  }

  recordPurchase(amount: number): void {
    this.totalSpent += Math.max(0, amount);
    this.orderCount += 1;
    this.lastPurchaseAt = new Date();
    this.updatedAt = new Date();
  }

  revertPurchase(amount: number): void {
    this.totalSpent = Math.max(0, this.totalSpent - Math.max(0, amount));
    this.orderCount = Math.max(0, this.orderCount - 1);
    this.updatedAt = new Date();
  }
}

export interface PointLogProps {
  id: string;
  memberId: string;
  type: PointLogType;
  delta: number;
  balance: number;
  orderId?: string | null;
  reason?: string | null;
  operator?: string | null;
  createdAt?: Date | string;
}

export class PointLog {
  public readonly id: string;
  public readonly memberId: string;
  public readonly type: PointLogType;
  public readonly delta: number;
  public readonly balance: number;
  public readonly orderId?: string | null;
  public readonly reason?: string | null;
  public readonly operator?: string | null;
  public readonly createdAt: Date;

  constructor(props: PointLogProps) {
    this.id = props.id;
    this.memberId = props.memberId;
    this.type = props.type;
    this.delta = props.delta;
    this.balance = props.balance;
    this.orderId = props.orderId ?? null;
    this.reason = props.reason ?? null;
    this.operator = props.operator ?? null;
    this.createdAt = props.createdAt ? new Date(props.createdAt) : new Date();
  }
}
