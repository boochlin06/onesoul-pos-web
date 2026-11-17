import { eq, desc } from 'drizzle-orm';
import type { OneSoulD1Database } from '@onesoul/db';
import { stocktakes, stocktakeItems } from '@onesoul/db/schema';
import type { StocktakeRepository } from '../../core/ports/StocktakeRepository';
import { Stocktake, StocktakeItem } from '../../core/entities/Stocktake';
import type { StocktakeStatus } from '@onesoul/shared';

export class D1StocktakeRepository implements StocktakeRepository {
  constructor(private readonly db: OneSoulD1Database) {}

  private getExecutor(tx?: any): any {
    return tx ?? this.db;
  }

  async findById(id: string, tx?: any): Promise<Stocktake | null> {
    const executor = this.getExecutor(tx);
    const [row] = await executor
      .select()
      .from(stocktakes)
      .where(eq(stocktakes.id, id))
      .limit(1);

    if (!row) return null;
    const items = await this.findItemsByStocktakeId(row.id, tx);
    return this.mapStocktake(row, items);
  }

  async createStocktake(
    stocktake: Stocktake,
    items: StocktakeItem[],
    tx?: any
  ): Promise<void> {
    const executor = this.getExecutor(tx);

    await executor.insert(stocktakes).values({
      id: stocktake.id,
      storeId: stocktake.storeId,
      status: stocktake.status,
      countedBy: stocktake.countedBy,
      postedBy: stocktake.postedBy ?? null,
      postedAt: stocktake.postedAt
        ? stocktake.postedAt instanceof Date
          ? stocktake.postedAt.toISOString()
          : String(stocktake.postedAt)
        : null,
      note: stocktake.note ?? null,
      createdAt:
        stocktake.createdAt instanceof Date
          ? stocktake.createdAt.toISOString()
          : String(stocktake.createdAt),
      updatedAt:
        stocktake.updatedAt instanceof Date
          ? stocktake.updatedAt.toISOString()
          : String(stocktake.updatedAt),
    });

    for (const item of items) {
      await executor.insert(stocktakeItems).values({
        id: item.id,
        stocktakeId: stocktake.id,
        productId: item.productId,
        systemQty: item.systemQty,
        actualQty: item.actualQty,
        variance: item.variance,
        itemRemark: item.itemRemark ?? null,
      });
    }
  }

  async updateStatus(
    id: string,
    status: StocktakeStatus,
    postedBy?: string,
    postedAt?: Date,
    tx?: any
  ): Promise<void> {
    const executor = this.getExecutor(tx);
    const updatePayload: any = {
      status,
      updatedAt: new Date().toISOString(),
    };
    if (postedBy) {
      updatePayload.postedBy = postedBy;
    }
    if (postedAt) {
      updatePayload.postedAt =
        postedAt instanceof Date ? postedAt.toISOString() : String(postedAt);
    }
    await executor
      .update(stocktakes)
      .set(updatePayload)
      .where(eq(stocktakes.id, id));
  }

  async save(stocktake: Stocktake, tx?: any): Promise<void> {
    const executor = this.getExecutor(tx);
    const [existing] = await executor
      .select({ id: stocktakes.id })
      .from(stocktakes)
      .where(eq(stocktakes.id, stocktake.id))
      .limit(1);

    if (existing) {
      await executor
        .update(stocktakes)
        .set({
          status: stocktake.status,
          countedBy: stocktake.countedBy,
          postedBy: stocktake.postedBy ?? null,
          postedAt: stocktake.postedAt
            ? stocktake.postedAt instanceof Date
              ? stocktake.postedAt.toISOString()
              : String(stocktake.postedAt)
            : null,
          note: stocktake.note ?? null,
          updatedAt:
            stocktake.updatedAt instanceof Date
              ? stocktake.updatedAt.toISOString()
              : String(stocktake.updatedAt),
        })
        .where(eq(stocktakes.id, stocktake.id));
    } else {
      await executor.insert(stocktakes).values({
        id: stocktake.id,
        storeId: stocktake.storeId,
        status: stocktake.status,
        countedBy: stocktake.countedBy,
        postedBy: stocktake.postedBy ?? null,
        postedAt: stocktake.postedAt
          ? stocktake.postedAt instanceof Date
            ? stocktake.postedAt.toISOString()
            : String(stocktake.postedAt)
          : null,
        note: stocktake.note ?? null,
        createdAt:
          stocktake.createdAt instanceof Date
            ? stocktake.createdAt.toISOString()
            : String(stocktake.createdAt),
        updatedAt:
          stocktake.updatedAt instanceof Date
            ? stocktake.updatedAt.toISOString()
            : String(stocktake.updatedAt),
      });
    }

    if (stocktake.items && stocktake.items.length > 0) {
      for (const item of stocktake.items) {
        const [existingItem] = await executor
          .select({ id: stocktakeItems.id })
          .from(stocktakeItems)
          .where(eq(stocktakeItems.id, item.id))
          .limit(1);

        if (existingItem) {
          await executor
            .update(stocktakeItems)
            .set({
              systemQty: item.systemQty,
              actualQty: item.actualQty,
              variance: item.variance,
              itemRemark: item.itemRemark ?? null,
            })
            .where(eq(stocktakeItems.id, item.id));
        } else {
          await executor.insert(stocktakeItems).values({
            id: item.id,
            stocktakeId: stocktake.id,
            productId: item.productId,
            systemQty: item.systemQty,
            actualQty: item.actualQty,
            variance: item.variance,
            itemRemark: item.itemRemark ?? null,
          });
        }
      }
    }
  }

  async findItemsByStocktakeId(
    stocktakeId: string,
    tx?: any
  ): Promise<StocktakeItem[]> {
    const executor = this.getExecutor(tx);
    const rows = await executor
      .select()
      .from(stocktakeItems)
      .where(eq(stocktakeItems.stocktakeId, stocktakeId));

    return rows.map((r: any) => this.mapItem(r));
  }

  async listByStore(storeId: string, tx?: any): Promise<Stocktake[]> {
    const executor = this.getExecutor(tx);
    const rows = await executor
      .select()
      .from(stocktakes)
      .where(eq(stocktakes.storeId, storeId))
      .orderBy(desc(stocktakes.createdAt));

    const result: Stocktake[] = [];
    for (const row of rows) {
      const items = await this.findItemsByStocktakeId(row.id, tx);
      result.push(this.mapStocktake(row, items));
    }
    return result;
  }

  private mapStocktake(row: any, items: StocktakeItem[]): Stocktake {
    return new Stocktake({
      id: row.id,
      storeId: row.storeId,
      status: row.status,
      countedBy: row.countedBy,
      postedBy: row.postedBy,
      postedAt: row.postedAt,
      note: row.note,
      items,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  private mapItem(row: any): StocktakeItem {
    return new StocktakeItem({
      id: row.id,
      stocktakeId: row.stocktakeId,
      productId: row.productId,
      systemQty: row.systemQty,
      actualQty: row.actualQty,
      variance: row.variance,
      itemRemark: row.itemRemark,
    });
  }
}
