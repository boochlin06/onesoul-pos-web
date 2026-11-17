import type { LuckyBagRepository } from '../../core/ports/LuckyBagRepository';
import { LuckyBag, LuckyBagPrize, PrizeAllocationPlan } from '../../core/entities/LuckyBag';
import { NotFoundError } from '@onesoul/shared';
import type { TransactionalMemoryRepo } from './InMemoryTransactionManager';

export class InMemoryLuckyBagRepository implements LuckyBagRepository, TransactionalMemoryRepo {
  private bags: Map<string, LuckyBag> = new Map();
  private prizes: Map<string, LuckyBagPrize[]> = new Map(); // key: bagId
  private plans: Map<string, PrizeAllocationPlan> = new Map();

  private snapshotBags: Map<string, LuckyBag> | null = null;
  private snapshotPrizes: Map<string, LuckyBagPrize[]> | null = null;
  private snapshotPlans: Map<string, PrizeAllocationPlan> | null = null;

  beginTx(): void {
    this.snapshotBags = new Map();
    for (const [id, bag] of this.bags.entries()) {
      this.snapshotBags.set(
        id,
        new LuckyBag({
          id: bag.id,
          storeId: bag.storeId,
          name: bag.name,
          unitPrice: bag.unitPrice,
          isPointsSet: bag.isPointsSet,
          status: bag.status,
          createdAt: bag.createdAt,
          updatedAt: bag.updatedAt,
        })
      );
    }
    this.snapshotPrizes = new Map();
    for (const [bagId, prizeList] of this.prizes.entries()) {
      this.snapshotPrizes.set(
        bagId,
        prizeList.map(
          (p) =>
            new LuckyBagPrize({
              id: p.id,
              bagId: p.bagId,
              prizeGrade: p.prizeGrade,
              prizeName: p.prizeName,
              productId: p.productId,
              points: p.points,
              draws: p.draws,
              drawnCount: p.drawnCount,
              createdAt: p.createdAt,
              updatedAt: p.updatedAt,
            })
        )
      );
    }
    this.snapshotPlans = new Map();
    for (const [id, plan] of this.plans.entries()) {
      this.snapshotPlans.set(
        id,
        new PrizeAllocationPlan({
          id: plan.id,
          storeId: plan.storeId,
          name: plan.name,
          status: plan.status,
          totalDraws: plan.totalDraws,
          unitPrice: plan.unitPrice,
          targetMargin: plan.targetMargin,
          items: plan.items.map((it) => ({ ...it })),
          createdAt: plan.createdAt,
          updatedAt: plan.updatedAt,
        })
      );
    }
  }

  commitTx(): void {
    this.snapshotBags = null;
    this.snapshotPrizes = null;
    this.snapshotPlans = null;
  }

  rollbackTx(): void {
    if (this.snapshotBags) {
      this.bags = this.snapshotBags;
      this.snapshotBags = null;
    }
    if (this.snapshotPrizes) {
      this.prizes = this.snapshotPrizes;
      this.snapshotPrizes = null;
    }
    if (this.snapshotPlans) {
      this.plans = this.snapshotPlans;
      this.snapshotPlans = null;
    }
  }

  async findById(id: string): Promise<LuckyBag | null> {
    return this.bags.get(id) ?? null;
  }

  async findPrize(bagId: string, prizeGrade: string): Promise<LuckyBagPrize | null> {
    const list = this.prizes.get(bagId) ?? [];
    const upper = prizeGrade.trim().toUpperCase();
    return list.find((p) => p.prizeGrade.toUpperCase() === upper) ?? null;
  }

  async findPrizeById(prizeId: string): Promise<LuckyBagPrize | null> {
    for (const list of this.prizes.values()) {
      const found = list.find((p) => p.id === prizeId);
      if (found) return found;
    }
    return null;
  }

  async findPrizesByBagId(bagId: string): Promise<LuckyBagPrize[]> {
    return this.prizes.get(bagId) ?? [];
  }

  async incrementDrawnCount(
    bagId: string,
    prizeGrade: string,
    count: number
  ): Promise<void> {
    const prize = await this.findPrize(bagId, prizeGrade);
    if (!prize) {
      throw new NotFoundError(`福袋 [${bagId}] 之獎項 [${prizeGrade}]`);
    }
    prize.incrementDrawnCount(count);

    // If all prizes are drawn out, mark bag as DEPLETED
    const allPrizes = await this.findPrizesByBagId(bagId);
    const totalRemaining = allPrizes.reduce((sum, p) => sum + p.remainingDraws, 0);
    if (totalRemaining === 0) {
      const bag = await this.findById(bagId);
      if (bag && bag.status === 'ACTIVE') {
        bag.deplete();
      }
    }
  }

  async decrementDrawnCount(
    bagId: string,
    prizeGrade: string,
    count: number
  ): Promise<void> {
    const prize = await this.findPrize(bagId, prizeGrade);
    if (!prize) {
      throw new NotFoundError(`福袋 [${bagId}] 之獎項 [${prizeGrade}]`);
    }
    prize.decrementDrawnCount(count);

    // If bag was depleted and now has draws, set back to ACTIVE
    const bag = await this.findById(bagId);
    if (bag && bag.status === 'DEPLETED') {
      const allPrizes = await this.findPrizesByBagId(bagId);
      const totalRemaining = allPrizes.reduce((sum, p) => sum + p.remainingDraws, 0);
      if (totalRemaining > 0) {
        bag.status = 'ACTIVE';
        bag.updatedAt = new Date();
      }
    }
  }

  async saveBagWithPrizes(bag: LuckyBag, prizes: LuckyBagPrize[]): Promise<void> {
    this.bags.set(bag.id, bag);
    this.prizes.set(bag.id, prizes);
  }

  async findActiveBagsByStore(storeId: string): Promise<LuckyBag[]> {
    const result: LuckyBag[] = [];
    for (const bag of this.bags.values()) {
      if (bag.storeId === storeId && bag.status === 'ACTIVE') {
        result.push(bag);
      }
    }
    return result;
  }

  async savePlan(plan: PrizeAllocationPlan): Promise<void> {
    this.plans.set(plan.id, plan);
  }

  async findPlanById(id: string): Promise<PrizeAllocationPlan | null> {
    return this.plans.get(id) ?? null;
  }

  async findPlansByStore(storeId: string): Promise<PrizeAllocationPlan[]> {
    const result: PrizeAllocationPlan[] = [];
    for (const plan of this.plans.values()) {
      if (plan.storeId === storeId) {
        result.push(plan);
      }
    }
    return result;
  }

  async deletePlan(id: string): Promise<void> {
    this.plans.delete(id);
  }
}
