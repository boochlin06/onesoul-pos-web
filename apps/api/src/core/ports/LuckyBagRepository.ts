import type { LuckyBag, LuckyBagPrize, PrizeAllocationPlan } from '../entities/LuckyBag';

export interface LuckyBagRepository {
  findById(id: string, tx?: any): Promise<LuckyBag | null>;
  findPrize(bagId: string, prizeGrade: string, tx?: any): Promise<LuckyBagPrize | null>;
  findPrizeById(prizeId: string, tx?: any): Promise<LuckyBagPrize | null>;
  findPrizesByBagId(bagId: string, tx?: any): Promise<LuckyBagPrize[]>;
  incrementDrawnCount(bagId: string, prizeGrade: string, count: number, tx?: any): Promise<void>;
  decrementDrawnCount(bagId: string, prizeGrade: string, count: number, tx?: any): Promise<void>;
  saveBagWithPrizes(bag: LuckyBag, prizes: LuckyBagPrize[], tx?: any): Promise<void>;
  findActiveBagsByStore(storeId: string, tx?: any): Promise<LuckyBag[]>;
  savePlan(plan: PrizeAllocationPlan, tx?: any): Promise<void>;
  findPlanById(id: string, tx?: any): Promise<PrizeAllocationPlan | null>;
  findPlansByStore(storeId: string, tx?: any): Promise<PrizeAllocationPlan[]>;
  deletePlan(id: string, tx?: any): Promise<void>;
}
