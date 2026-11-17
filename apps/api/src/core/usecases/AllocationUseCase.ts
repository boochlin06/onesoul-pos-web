import {
  Result,
  ok,
  err,
  AppError,
  ValidationError,
  NotFoundError,
} from '@onesoul/shared';
import { LuckyBag, LuckyBagPrize, PrizeAllocationPlan } from '../entities/LuckyBag';
import {
  validateLuckyBagPublish,
  resolveSmallPrizePoints,
} from '../invariants/invariants';

import type { LuckyBagRepository } from '../ports/LuckyBagRepository';
import type { InventoryRepository } from '../ports/InventoryRepository';
import type { TransactionManager } from '../ports/TransactionManager';

export interface LiveStockRadarItem {
  id: string;
  name: string;
  category: string;
  costPrice: number;
  sellingPrice: number;
  suggestedPoints: number;
  stock: number;
  allocatedCount: number;
  availableStock: number;
  isOverAllocated: boolean;
}

export interface LiveStockQuery {
  category?: string;
  q?: string;
  minQty?: number;
}

export interface PublishPlanCommand {
  storeId: string;
  planId?: string;
  name: string;
  totalDraws: number;
  unitPrice: number;
  isPointsSet?: boolean;
  batchCount?: number;
  blindBoxPoints?: number;
  items: Array<{
    grade: string;
    name: string;
    productId?: string | null;
    draws: number;
    points?: number;
    cost?: number;
    isNonGk?: boolean;
  }>;
}

export interface PublishPlanResult {
  success: boolean;
  publishedCount: number;
  bagIds: string[];
  message: string;
}

export interface PlanFinancialSummary {
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  marginRate: number;
  breakevenDraws: number;
  isHealthy: boolean;
}

export class AllocationUseCase {
  constructor(
    private readonly luckyBagRepo: LuckyBagRepository,
    private readonly inventoryRepo: InventoryRepository,
    private readonly txManager: TransactionManager
  ) {}

  /**
   * 配賞現貨雷達動態試算
   * 遵守 Invariant #2: availableStock = max(0, stock - allocatedCount)
   */
  async calculateLiveStockRadar(
    storeId: string,
    query?: LiveStockQuery
  ): Promise<Result<LiveStockRadarItem[], AppError>> {
    try {
      const products = await this.inventoryRepo.findAllProducts();
      const activeBags = await this.luckyBagRepo.findActiveBagsByStore(storeId);

      // 累加在場套組中各商品的已配占用量 (allocatedCount)
      const allocatedMap = new Map<string, number>();
      for (const bag of activeBags) {
        const prizes = await this.luckyBagRepo.findPrizesByBagId(bag.id);
        for (const prize of prizes) {
          if (prize.productId) {
            const currentAlloc = allocatedMap.get(prize.productId) || 0;
            // 已配占用量計算未被抽走之剩餘抽數
            allocatedMap.set(prize.productId, currentAlloc + prize.remainingDraws);
          }
        }
      }

      const radarItems: LiveStockRadarItem[] = [];

      for (const prod of products) {
        // 排除虛擬條目
        if (prod.isVirtual()) continue;

        const inv = await this.inventoryRepo.findByStoreAndProduct(storeId, prod.id);
        const currentStock = inv?.quantity ?? 0;
        const allocated = allocatedMap.get(prod.id) ?? 0;
        const availableStock = Math.max(0, currentStock - allocated);
        const isOverAllocated = allocated > currentStock;

        // 篩選條件
        if (query?.minQty !== undefined && currentStock < query.minQty) {
          continue;
        }

        if (query?.category && prod.category !== query.category) {
          continue;
        }

        if (query?.q) {
          const search = query.q.trim().toLowerCase();
          const matchName = prod.name.toLowerCase().includes(search);
          const matchId = prod.id.toLowerCase().includes(search);
          if (!matchName && !matchId) continue;
        }

        radarItems.push({
          id: prod.id,
          name: prod.name,
          category: prod.category,
          costPrice: prod.costPrice,
          sellingPrice: prod.sellingPrice,
          suggestedPoints: prod.suggestedPoints,
          stock: currentStock,
          allocatedCount: allocated,
          availableStock,
          isOverAllocated,
        });
      }

      return ok(radarItems);
    } catch (error) {
      return err(new AppError('LIVE_RADAR_FAILED', (error as Error).message));
    }
  }

  /**
   * 🚨 Invariant #2: 一番賞發布開套
   * 嚴禁預扣 StoreInventory，僅建立 LuckyBag 與 LuckyBagPrize 籤位。
   * X賞等價點數注入 (預設 10P)、Z賞保底 1P。
   */
  async publishPlan(
    command: PublishPlanCommand
  ): Promise<Result<PublishPlanResult, AppError>> {
    try {
      // 1. 驗證全套抽數與大賞規格
      validateLuckyBagPublish({
        totalDraws: command.totalDraws,
        items: command.items.map((it) => ({
          grade: it.grade,
          draws: it.draws,
          productId: it.productId,
          isNonGk: it.isNonGk,
        })),
      });

      const batchCount = Math.max(1, command.batchCount || 1);
      const bagIds: string[] = [];

      return await this.txManager.runInTransaction(async (tx) => {
        for (let b = 0; b < batchCount; b++) {
          const bagId = `LB-${Date.now().toString().slice(-6)}${Math.floor(
            Math.random() * 90 + 10
          )}-${b + 1}`;
          const bagName =
            batchCount > 1 ? `${command.name} #${b + 1}` : command.name;

          const bag = new LuckyBag({
            id: bagId,
            storeId: command.storeId,
            name: bagName,
            unitPrice: command.unitPrice,
            isPointsSet: !!command.isPointsSet,
            status: 'ACTIVE',
          });

          const prizes: LuckyBagPrize[] = [];
          for (let i = 0; i < command.items.length; i++) {
            const item = command.items[i];
            const prizePoints = resolveSmallPrizePoints(
              item.grade,
              item.points,
              command.blindBoxPoints || 10,
              item.isNonGk
            );

            const prize = new LuckyBagPrize({
              id: `prz-${bagId}-${item.grade}-${i + 1}`,
              bagId,
              prizeGrade: item.grade,
              prizeName: item.name,
              productId: item.productId ?? null,
              points: prizePoints,
              draws: item.draws,
              drawnCount: 0,
            });
            prizes.push(prize);
          }

          // 儲存套組與籤位 (嚴禁異動 StoreInventory)
          await this.luckyBagRepo.saveBagWithPrizes(bag, prizes, tx);
          bagIds.push(bagId);
        }

        return ok({
          success: true,
          publishedCount: bagIds.length,
          bagIds,
          message: `成功發布 ${bagIds.length} 套一番賞套組 (未預扣門市實體庫存)`,
        });
      });
    } catch (error) {
      if (error instanceof AppError) {
        return err(error);
      }
      return err(new AppError('PUBLISH_FAILED', (error as Error).message));
    }
  }

  async savePlanDraft(
    plan: PrizeAllocationPlan
  ): Promise<Result<void, AppError>> {
    try {
      await this.luckyBagRepo.savePlan(plan);
      return ok(undefined);
    } catch (error) {
      return err(new AppError('SAVE_PLAN_FAILED', (error as Error).message));
    }
  }

  async deletePlanDraft(planId: string): Promise<Result<void, AppError>> {
    try {
      const plan = await this.luckyBagRepo.findPlanById(planId);
      if (!plan) {
        return err(new NotFoundError('配賞草稿方案', planId));
      }
      await this.luckyBagRepo.deletePlan(planId);
      return ok(undefined);
    } catch (error) {
      return err(new AppError('DELETE_PLAN_FAILED', (error as Error).message));
    }
  }

  calculateFinancials(
    totalDraws: number,
    unitPrice: number,
    items: Array<{ costPrice?: number; draws: number }>
  ): Result<PlanFinancialSummary, AppError> {
    if (totalDraws <= 0 || unitPrice < 0) {
      return err(new ValidationError('總抽數必須大於 0 且單抽價不可小於 0'));
    }

    const revenue = totalDraws * unitPrice;
    const totalCost = items.reduce(
      (sum, it) => sum + (it.costPrice || 0) * (it.draws || 0),
      0
    );
    const grossProfit = revenue - totalCost;
    const marginRate =
      revenue > 0 ? Math.round((grossProfit / revenue) * 10000) / 100 : 0;
    const breakevenDraws =
      unitPrice > 0 ? Math.ceil(totalCost / unitPrice) : 0;
    const isHealthy = marginRate >= 35 && breakevenDraws <= totalDraws;

    return ok({
      totalRevenue: revenue,
      totalCost,
      grossProfit,
      marginRate,
      breakevenDraws,
      isHealthy,
    });
  }
}
