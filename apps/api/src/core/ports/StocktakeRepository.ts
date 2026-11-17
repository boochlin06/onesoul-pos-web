import type { Stocktake, StocktakeItem } from '../entities/Stocktake';
import type { StocktakeStatus } from '@onesoul/shared';

export interface StocktakeRepository {
  findById(id: string, tx?: any): Promise<Stocktake | null>;
  createStocktake(stocktake: Stocktake, items: StocktakeItem[], tx?: any): Promise<void>;
  updateStatus(id: string, status: StocktakeStatus, postedBy?: string, postedAt?: Date, tx?: any): Promise<void>;
  save(stocktake: Stocktake, tx?: any): Promise<void>;
  findItemsByStocktakeId(stocktakeId: string, tx?: any): Promise<StocktakeItem[]>;
  listByStore(storeId: string, tx?: any): Promise<Stocktake[]>;
}
