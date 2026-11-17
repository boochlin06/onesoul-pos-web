import { eq, and, sql, asc } from 'drizzle-orm';
import type { OneSoulD1Database } from '@onesoul/db';
import { luckyBags, luckyBagPrizes, prizeAllocationPlans } from '@onesoul/db/schema';
import type { LuckyBagRepository } from '../../core/ports/LuckyBagRepository';
import {
  LuckyBag,
  LuckyBagPrize,
  PrizeAllocationPlan,
} from '../../core/entities/LuckyBag';
import { OverdrawError } from '@onesoul/shared';

export class D1LuckyBagRepository implements LuckyBagRepository {
  constructor(private readonly db: OneSoulD1Database) {}

  private getExecutor(tx?: any): any {
    return tx ?? this.db;
  }

  async findById(id: string, tx?: any): Promise<LuckyBag | null> {
    const executor = this.getExecutor(tx);
    const [row] = await executor
      .select()
      .from(luckyBags)
      .where(eq(luckyBags.id, id))
      .limit(1);

    return row ? this.mapLuckyBag(row) : null;
  }

  async findPrize(
    bagId: string,
    prizeGrade: string,
    tx?: any
  ): Promise<LuckyBagPrize | null> {
    const executor = this.getExecutor(tx);
    const [row] = await executor
      .select()
      .from(luckyBagPrizes)
      .where(
        and(
          eq(luckyBagPrizes.bagId, bagId),
          eq(luckyBagPrizes.prizeGrade, prizeGrade.toUpperCase())
        )
      )
      .limit(1);

    return row ? this.mapPrize(row) : null;
  }

  async findPrizeById(prizeId: string, tx?: any): Promise<LuckyBagPrize | null> {
    const executor = this.getExecutor(tx);
    const [row] = await executor
      .select()
      .from(luckyBagPrizes)
      .where(eq(luckyBagPrizes.id, prizeId))
      .limit(1);

    return row ? this.mapPrize(row) : null;
  }

  async findPrizesByBagId(bagId: string, tx?: any): Promise<LuckyBagPrize[]> {
    const executor = this.getExecutor(tx);
    const rows = await executor
      .select()
      .from(luckyBagPrizes)
      .where(eq(luckyBagPrizes.bagId, bagId))
      .orderBy(asc(luckyBagPrizes.prizeGrade));

    return rows.map((r: any) => this.mapPrize(r));
  }

  async incrementDrawnCount(
    bagId: string,
    prizeGrade: string,
    count: number,
    tx?: any
  ): Promise<void> {
    const executor = this.getExecutor(tx);
    try {
      await executor
        .update(luckyBagPrizes)
        .set({
          drawnCount: sql`${luckyBagPrizes.drawnCount} + ${count}`,
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(
            eq(luckyBagPrizes.bagId, bagId),
            eq(luckyBagPrizes.prizeGrade, prizeGrade.toUpperCase())
          )
        );
    } catch (error: any) {
      if (
        error.message?.includes('lucky_bag_prizes_drawn_count_check') ||
        error.message?.includes('CHECK constraint failed')
      ) {
        throw new OverdrawError(
          `獎項 [${prizeGrade}] 抽數已達上限，資料庫 CHECK 約束觸發回滾`
        );
      }
      throw error;
    }
  }

  async decrementDrawnCount(
    bagId: string,
    prizeGrade: string,
    count: number,
    tx?: any
  ): Promise<void> {
    const executor = this.getExecutor(tx);
    await executor
      .update(luckyBagPrizes)
      .set({
        drawnCount: sql`MAX(0, ${luckyBagPrizes.drawnCount} - ${count})`,
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(luckyBagPrizes.bagId, bagId),
          eq(luckyBagPrizes.prizeGrade, prizeGrade.toUpperCase())
        )
      );
  }

  async saveBagWithPrizes(
    bag: LuckyBag,
    prizes: LuckyBagPrize[],
    tx?: any
  ): Promise<void> {
    const executor = this.getExecutor(tx);

    const [existingBag] = await executor
      .select({ id: luckyBags.id })
      .from(luckyBags)
      .where(eq(luckyBags.id, bag.id))
      .limit(1);

    if (existingBag) {
      await executor
        .update(luckyBags)
        .set({
          storeId: bag.storeId,
          name: bag.name,
          unitPrice: bag.unitPrice,
          isPointsSet: bag.isPointsSet,
          status: bag.status,
          updatedAt:
            bag.updatedAt instanceof Date
              ? bag.updatedAt.toISOString()
              : String(bag.updatedAt),
        })
        .where(eq(luckyBags.id, bag.id));
    } else {
      await executor.insert(luckyBags).values({
        id: bag.id,
        storeId: bag.storeId,
        name: bag.name,
        unitPrice: bag.unitPrice,
        isPointsSet: bag.isPointsSet,
        status: bag.status,
        createdAt:
          bag.createdAt instanceof Date
            ? bag.createdAt.toISOString()
            : String(bag.createdAt),
        updatedAt:
          bag.updatedAt instanceof Date
            ? bag.updatedAt.toISOString()
            : String(bag.updatedAt),
      });
    }

    for (const prize of prizes) {
      const [existingPrize] = await executor
        .select({ id: luckyBagPrizes.id })
        .from(luckyBagPrizes)
        .where(eq(luckyBagPrizes.id, prize.id))
        .limit(1);

      if (existingPrize) {
        await executor
          .update(luckyBagPrizes)
          .set({
            bagId: prize.bagId,
            prizeGrade: prize.prizeGrade,
            prizeName: prize.prizeName,
            productId: prize.productId ?? null,
            points: prize.points,
            draws: prize.draws,
            drawnCount: prize.drawnCount,
            updatedAt:
              prize.updatedAt instanceof Date
                ? prize.updatedAt.toISOString()
                : String(prize.updatedAt),
          })
          .where(eq(luckyBagPrizes.id, prize.id));
      } else {
        await executor.insert(luckyBagPrizes).values({
          id: prize.id,
          bagId: prize.bagId,
          prizeGrade: prize.prizeGrade,
          prizeName: prize.prizeName,
          productId: prize.productId ?? null,
          points: prize.points,
          draws: prize.draws,
          drawnCount: prize.drawnCount,
          createdAt:
            prize.createdAt instanceof Date
              ? prize.createdAt.toISOString()
              : String(prize.createdAt),
          updatedAt:
            prize.updatedAt instanceof Date
              ? prize.updatedAt.toISOString()
              : String(prize.updatedAt),
        });
      }
    }
  }

  async findActiveBagsByStore(storeId: string, tx?: any): Promise<LuckyBag[]> {
    const executor = this.getExecutor(tx);
    const rows = await executor
      .select()
      .from(luckyBags)
      .where(
        and(eq(luckyBags.storeId, storeId), eq(luckyBags.status, 'ACTIVE'))
      );

    return rows.map((r: any) => this.mapLuckyBag(r));
  }

  async savePlan(plan: PrizeAllocationPlan, tx?: any): Promise<void> {
    const executor = this.getExecutor(tx);
    const [existing] = await executor
      .select({ id: prizeAllocationPlans.id })
      .from(prizeAllocationPlans)
      .where(eq(prizeAllocationPlans.id, plan.id))
      .limit(1);

    if (existing) {
      await executor
        .update(prizeAllocationPlans)
        .set({
          storeId: plan.storeId,
          name: plan.name,
          status: plan.status,
          totalDraws: plan.totalDraws,
          price1: plan.unitPrice,
          targetMargin: plan.targetMargin,
          items: plan.items,
          updatedAt:
            plan.updatedAt instanceof Date
              ? plan.updatedAt.toISOString()
              : String(plan.updatedAt),
        })
        .where(eq(prizeAllocationPlans.id, plan.id));
    } else {
      await executor.insert(prizeAllocationPlans).values({
        id: plan.id,
        storeId: plan.storeId,
        name: plan.name,
        status: plan.status,
        totalDraws: plan.totalDraws,
        price1: plan.unitPrice,
        targetMargin: plan.targetMargin,
        items: plan.items,
        createdAt:
          plan.createdAt instanceof Date
            ? plan.createdAt.toISOString()
            : String(plan.createdAt),
        updatedAt:
          plan.updatedAt instanceof Date
            ? plan.updatedAt.toISOString()
            : String(plan.updatedAt),
      });
    }
  }

  async findPlanById(id: string, tx?: any): Promise<PrizeAllocationPlan | null> {
    const executor = this.getExecutor(tx);
    const [row] = await executor
      .select()
      .from(prizeAllocationPlans)
      .where(eq(prizeAllocationPlans.id, id))
      .limit(1);

    return row ? this.mapPlan(row) : null;
  }

  async findPlansByStore(storeId: string, tx?: any): Promise<PrizeAllocationPlan[]> {
    const executor = this.getExecutor(tx);
    const rows = await executor
      .select()
      .from(prizeAllocationPlans)
      .where(eq(prizeAllocationPlans.storeId, storeId));

    return rows.map((r: any) => this.mapPlan(r));
  }

  async deletePlan(id: string, tx?: any): Promise<void> {
    const executor = this.getExecutor(tx);
    await executor
      .delete(prizeAllocationPlans)
      .where(eq(prizeAllocationPlans.id, id));
  }

  private mapLuckyBag(row: any): LuckyBag {
    return new LuckyBag({
      id: row.id,
      storeId: row.storeId,
      name: row.name,
      unitPrice: row.unitPrice,
      isPointsSet: Boolean(row.isPointsSet),
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  private mapPrize(row: any): LuckyBagPrize {
    return new LuckyBagPrize({
      id: row.id,
      bagId: row.bagId,
      prizeGrade: row.prizeGrade,
      prizeName: row.prizeName,
      productId: row.productId,
      points: row.points ?? 0,
      draws: row.draws,
      drawnCount: row.drawnCount ?? 0,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  private mapPlan(row: any): PrizeAllocationPlan {
    const items = typeof row.items === 'string' ? JSON.parse(row.items) : row.items;
    return new PrizeAllocationPlan({
      id: row.id,
      storeId: row.storeId,
      name: row.name,
      status: row.status,
      totalDraws: row.totalDraws,
      unitPrice: row.price1 ?? 0,
      targetMargin: row.targetMargin ?? 0.35,
      items: items ?? [],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
