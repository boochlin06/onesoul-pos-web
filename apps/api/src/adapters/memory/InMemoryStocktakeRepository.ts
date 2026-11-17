import type { StocktakeRepository } from '../../core/ports/StocktakeRepository';
import { Stocktake, StocktakeItem } from '../../core/entities/Stocktake';
import type { StocktakeStatus } from '@onesoul/shared';
import type { TransactionalMemoryRepo } from './InMemoryTransactionManager';

export class InMemoryStocktakeRepository implements StocktakeRepository, TransactionalMemoryRepo {
  private stocktakes: Map<string, Stocktake> = new Map();
  private items: Map<string, StocktakeItem[]> = new Map();

  private snapshotStocktakes: Map<string, Stocktake> | null = null;
  private snapshotItems: Map<string, StocktakeItem[]> | null = null;

  beginTx(): void {
    this.snapshotStocktakes = new Map();
    for (const [id, s] of this.stocktakes.entries()) {
      this.snapshotStocktakes.set(
        id,
        new Stocktake({
          id: s.id,
          storeId: s.storeId,
          status: s.status,
          countedBy: s.countedBy,
          postedBy: s.postedBy,
          postedAt: s.postedAt,
          note: s.note,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
        })
      );
    }
    this.snapshotItems = new Map();
    for (const [id, list] of this.items.entries()) {
      this.snapshotItems.set(
        id,
        list.map(
          (it) =>
            new StocktakeItem({
              id: it.id,
              stocktakeId: it.stocktakeId,
              productId: it.productId,
              systemQty: it.systemQty,
              actualQty: it.actualQty,
              variance: it.variance,
              itemRemark: it.itemRemark,
            })
        )
      );
    }
  }

  commitTx(): void {
    this.snapshotStocktakes = null;
    this.snapshotItems = null;
  }

  rollbackTx(): void {
    if (this.snapshotStocktakes) {
      this.stocktakes = this.snapshotStocktakes;
      this.snapshotStocktakes = null;
    }
    if (this.snapshotItems) {
      this.items = this.snapshotItems;
      this.snapshotItems = null;
    }
  }

  async findById(id: string): Promise<Stocktake | null> {
    const st = this.stocktakes.get(id);
    if (!st) return null;
    st.items = this.items.get(id) ?? [];
    return st;
  }

  async createStocktake(
    stocktake: Stocktake,
    items: StocktakeItem[]
  ): Promise<void> {
    stocktake.items = items;
    this.stocktakes.set(stocktake.id, stocktake);
    this.items.set(stocktake.id, items);
  }

  async updateStatus(
    id: string,
    status: StocktakeStatus,
    postedBy?: string,
    postedAt?: Date
  ): Promise<void> {
    const st = this.stocktakes.get(id);
    if (!st) return;

    if (st.status !== status) {
      if (status === 'POSTED') {
        st.post(postedBy || 'system');
        if (postedAt) st.postedAt = postedAt;
      } else if (status === 'CANCELLED') {
        st.cancel();
      } else {
        st.status = status;
      }
    }
    st.updatedAt = new Date();
  }

  async save(stocktake: Stocktake): Promise<void> {
    this.stocktakes.set(stocktake.id, stocktake);
    if (stocktake.items && stocktake.items.length > 0) {
      this.items.set(stocktake.id, stocktake.items);
    }
  }

  async findItemsByStocktakeId(stocktakeId: string): Promise<StocktakeItem[]> {
    return this.items.get(stocktakeId) ?? [];
  }

  async listByStore(storeId: string): Promise<Stocktake[]> {
    const result: Stocktake[] = [];
    for (const st of this.stocktakes.values()) {
      if (st.storeId === storeId) {
        st.items = this.items.get(st.id) ?? [];
        result.push(st);
      }
    }
    result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return result;
  }
}
