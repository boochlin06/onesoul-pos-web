import { OverdrawError } from '@onesoul/shared';
import type { LuckyBagStatus } from '@onesoul/shared';

export interface LuckyBagProps {
  id: string;
  storeId: string;
  name: string;
  unitPrice: number;
  isPointsSet?: boolean;
  status?: LuckyBagStatus;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export class LuckyBag {
  public readonly id: string;
  public readonly storeId: string;
  public name: string;
  public readonly unitPrice: number;
  public readonly isPointsSet: boolean;
  public status: LuckyBagStatus;
  public readonly createdAt: Date;
  public updatedAt: Date;

  constructor(props: LuckyBagProps) {
    this.id = props.id;
    this.storeId = props.storeId;
    this.name = props.name;
    this.unitPrice = props.unitPrice;
    this.isPointsSet = !!props.isPointsSet;
    this.status = props.status ?? 'ACTIVE';
    this.createdAt = props.createdAt ? new Date(props.createdAt) : new Date();
    this.updatedAt = props.updatedAt ? new Date(props.updatedAt) : new Date();
  }

  /**
   * Invariant #2: 限定點數套每抽扣點公式: floor(unitPrice / 20) * draws
   */
  calculatePointsCost(draws: number): number {
    if (!this.isPointsSet) return 0;
    return Math.floor(this.unitPrice / 20) * draws;
  }

  deplete(): void {
    this.status = 'DEPLETED';
    this.updatedAt = new Date();
  }

  void(): void {
    this.status = 'VOIDED';
    this.updatedAt = new Date();
  }
}

export interface LuckyBagPrizeProps {
  id: string;
  bagId: string;
  prizeGrade: string;
  prizeName: string;
  productId?: string | null;
  points?: number;
  draws: number;
  drawnCount?: number;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export class LuckyBagPrize {
  public readonly id: string;
  public readonly bagId: string;
  public readonly prizeGrade: string;
  public prizeName: string;
  public productId?: string | null;
  public points: number;
  public readonly draws: number;
  public drawnCount: number;
  public readonly createdAt: Date;
  public updatedAt: Date;

  constructor(props: LuckyBagPrizeProps) {
    this.id = props.id;
    this.bagId = props.bagId;
    this.prizeGrade = props.prizeGrade.toUpperCase();
    this.prizeName = props.prizeName;
    this.productId = props.productId ?? null;
    this.points = props.points ?? 0;
    this.draws = props.draws;
    this.drawnCount = props.drawnCount ?? 0;
    this.createdAt = props.createdAt ? new Date(props.createdAt) : new Date();
    this.updatedAt = props.updatedAt ? new Date(props.updatedAt) : new Date();
  }

  get remainingDraws(): number {
    return Math.max(0, this.draws - this.drawnCount);
  }

  incrementDrawnCount(count: number): void {
    if (this.drawnCount + count > this.draws) {
      throw new OverdrawError(
        `賞項 [${this.prizeGrade}] 剩餘抽數不足: 剩餘 ${this.remainingDraws} 抽，欲抽取 ${count} 抽。`
      );
    }
    this.drawnCount += count;
    this.updatedAt = new Date();
  }

  decrementDrawnCount(count: number): void {
    this.drawnCount = Math.max(0, this.drawnCount - count);
    this.updatedAt = new Date();
  }

  isGrandPrize(): boolean {
    const grade = this.prizeGrade.toUpperCase();
    const pid = (this.productId || '').trim().toLowerCase();
    const isAbstract = ['0p', '1p', 'x', 'z', 'blind_box'].includes(pid) || grade === 'X' || grade === 'Z';
    return !isAbstract && !!this.productId;
  }
}

export interface PrizeAllocationPlanItem {
  grade: string;
  name: string;
  productId?: string | null;
  draws: number;
  points: number;
  cost: number;
  isNonGk?: boolean;
}

export interface PrizeAllocationPlanProps {
  id: string;
  storeId: string;
  name: string;
  status?: string;
  totalDraws: number;
  unitPrice: number;
  targetMargin?: number;
  items: PrizeAllocationPlanItem[];
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export class PrizeAllocationPlan {
  public readonly id: string;
  public readonly storeId: string;
  public name: string;
  public status: string;
  public readonly totalDraws: number;
  public readonly unitPrice: number;
  public readonly targetMargin: number;
  public items: PrizeAllocationPlanItem[];
  public readonly createdAt: Date;
  public updatedAt: Date;

  constructor(props: PrizeAllocationPlanProps) {
    this.id = props.id;
    this.storeId = props.storeId;
    this.name = props.name;
    this.status = props.status ?? 'DRAFT';
    this.totalDraws = props.totalDraws;
    this.unitPrice = props.unitPrice;
    this.targetMargin = props.targetMargin ?? 0.35;
    this.items = props.items;
    this.createdAt = props.createdAt ? new Date(props.createdAt) : new Date();
    this.updatedAt = props.updatedAt ? new Date(props.updatedAt) : new Date();
  }
}
