import { eq, and, sql, desc, asc } from 'drizzle-orm';
import type { OneSoulD1Database } from '@onesoul/db';
import { storeInventories, inventoryLogs, products } from '@onesoul/db/schema';
import type { InventoryRepository } from '../../core/ports/InventoryRepository';
import { StoreInventory, InventoryLog, Product } from '../../core/entities/Product';
import { InsufficientStockError } from '@onesoul/shared';

export class D1InventoryRepository implements InventoryRepository {
  constructor(private readonly db: OneSoulD1Database) {}

  private getExecutor(tx?: any): any {
    return tx ?? this.db;
  }

  async findByStoreAndProduct(
    storeId: string,
    productId: string,
    tx?: any
  ): Promise<StoreInventory | null> {
    const executor = this.getExecutor(tx);
    const [row] = await executor
      .select()
      .from(storeInventories)
      .where(
        and(
          eq(storeInventories.storeId, storeId),
          eq(storeInventories.productId, productId)
        )
      )
      .limit(1);

    return row ? this.mapInventory(row) : null;
  }

  async findAllByStore(storeId: string, tx?: any): Promise<StoreInventory[]> {
    const executor = this.getExecutor(tx);
    const rows = await executor
      .select()
      .from(storeInventories)
      .where(eq(storeInventories.storeId, storeId));

    return rows.map((r: any) => this.mapInventory(r));
  }

  async save(inventory: StoreInventory, tx?: any): Promise<void> {
    const executor = this.getExecutor(tx);
    const [existing] = await executor
      .select()
      .from(storeInventories)
      .where(
        and(
          eq(storeInventories.storeId, inventory.storeId),
          eq(storeInventories.productId, inventory.productId)
        )
      )
      .limit(1);

    if (existing) {
      await executor
        .update(storeInventories)
        .set({
          quantity: inventory.quantity,
          safetyStock: inventory.safetyStock,
          version: inventory.version,
          updatedAt:
            inventory.updatedAt instanceof Date
              ? inventory.updatedAt.toISOString()
              : String(inventory.updatedAt),
        })
        .where(
          and(
            eq(storeInventories.storeId, inventory.storeId),
            eq(storeInventories.productId, inventory.productId)
          )
        );
    } else {
      await executor.insert(storeInventories).values({
        id: inventory.id,
        storeId: inventory.storeId,
        productId: inventory.productId,
        quantity: inventory.quantity,
        safetyStock: inventory.safetyStock,
        version: inventory.version,
        updatedAt:
          inventory.updatedAt instanceof Date
            ? inventory.updatedAt.toISOString()
            : String(inventory.updatedAt),
      });
    }
  }

  /**
   * 按照 Invariant #3 強制字典序排序 (localeCompare) 扣除門市現貨，
   * 並於 SQLite CHECK 約束觸發時轉換為 InsufficientStockError
   */
  async deductQuantities(
    storeId: string,
    deductions: { productId: string; quantity: number }[],
    tx?: any
  ): Promise<void> {
    const executor = this.getExecutor(tx);
    const sorted = [...deductions].sort((a, b) => a.productId.localeCompare(b.productId));

    try {
      for (const item of sorted) {
        if (item.quantity <= 0) continue;

        const [inv] = await executor
          .select()
          .from(storeInventories)
          .where(
            and(
              eq(storeInventories.storeId, storeId),
              eq(storeInventories.productId, item.productId)
            )
          )
          .limit(1);

        if (!inv) {
          throw new InsufficientStockError(
            `門市現貨不存在: 門市 [${storeId}] 查無商品 [${item.productId}]`
          );
        }

        await executor
          .update(storeInventories)
          .set({
            quantity: sql`${storeInventories.quantity} - ${item.quantity}`,
            version: sql`${storeInventories.version} + 1`,
            updatedAt: new Date().toISOString(),
          })
          .where(
            and(
              eq(storeInventories.storeId, storeId),
              eq(storeInventories.productId, item.productId)
            )
          );
      }
    } catch (error: any) {
      if (error instanceof InsufficientStockError) {
        throw error;
      }
      if (
        error.message?.includes('store_inventories_quantity_check') ||
        error.message?.includes('CHECK constraint failed')
      ) {
        throw new InsufficientStockError('門市現貨不足，資料庫 CHECK 約束觸發回滾');
      }
      throw error;
    }
  }

  async addQuantities(
    storeId: string,
    additions: { productId: string; quantity: number }[],
    tx?: any
  ): Promise<void> {
    const executor = this.getExecutor(tx);
    const sorted = [...additions].sort((a, b) => a.productId.localeCompare(b.productId));

    for (const item of sorted) {
      if (item.quantity <= 0) continue;

      const [existing] = await executor
        .select()
        .from(storeInventories)
        .where(
          and(
            eq(storeInventories.storeId, storeId),
            eq(storeInventories.productId, item.productId)
          )
        )
        .limit(1);

      if (existing) {
        await executor
          .update(storeInventories)
          .set({
            quantity: sql`${storeInventories.quantity} + ${item.quantity}`,
            version: sql`${storeInventories.version} + 1`,
            updatedAt: new Date().toISOString(),
          })
          .where(
            and(
              eq(storeInventories.storeId, storeId),
              eq(storeInventories.productId, item.productId)
            )
          );
      } else {
        await executor.insert(storeInventories).values({
          id: crypto.randomUUID(),
          storeId,
          productId: item.productId,
          quantity: item.quantity,
          safetyStock: 0,
          version: 1,
          updatedAt: new Date().toISOString(),
        });
      }
    }
  }

  async recordLog(log: InventoryLog, tx?: any): Promise<void> {
    const executor = this.getExecutor(tx);
    await executor.insert(inventoryLogs).values({
      id: log.id,
      storeId: log.storeId,
      productId: log.productId,
      changeType: log.changeType,
      delta: log.delta,
      balance: log.balance,
      orderId: log.orderId ?? null,
      stocktakeId: log.stocktakeId ?? null,
      operator: log.operator ?? null,
      reason: log.reason ?? null,
      createdAt:
        log.createdAt instanceof Date
          ? log.createdAt.toISOString()
          : String(log.createdAt),
    });
  }

  async findLogsByStore(storeId: string, limit = 100, tx?: any): Promise<InventoryLog[]> {
    const executor = this.getExecutor(tx);
    const rows = await executor
      .select()
      .from(inventoryLogs)
      .where(eq(inventoryLogs.storeId, storeId))
      .orderBy(desc(inventoryLogs.createdAt))
      .limit(limit);

    return rows.map((r: any) => this.mapLog(r));
  }

  async findProductById(productId: string, tx?: any): Promise<Product | null> {
    const executor = this.getExecutor(tx);
    const [row] = await executor
      .select()
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    return row ? this.mapProduct(row) : null;
  }

  async saveProduct(product: Product, tx?: any): Promise<void> {
    const executor = this.getExecutor(tx);
    const [existing] = await executor
      .select({ id: products.id })
      .from(products)
      .where(eq(products.id, product.id))
      .limit(1);

    if (existing) {
      await executor
        .update(products)
        .set({
          name: product.name,
          category: product.category,
          condition: product.condition,
          costPrice: product.costPrice,
          sellingPrice: product.sellingPrice,
          suggestedPoints: product.suggestedPoints,
          version: product.version,
          isSpecial: product.isSpecial,
          barcode: product.barcode ?? null,
          remark: product.remark ?? null,
          updatedAt:
            product.updatedAt instanceof Date
              ? product.updatedAt.toISOString()
              : String(product.updatedAt),
        })
        .where(eq(products.id, product.id));
    } else {
      await executor.insert(products).values({
        id: product.id,
        name: product.name,
        category: product.category,
        condition: product.condition,
        costPrice: product.costPrice,
        sellingPrice: product.sellingPrice,
        suggestedPoints: product.suggestedPoints,
        version: product.version,
        isSpecial: product.isSpecial,
        barcode: product.barcode ?? null,
        remark: product.remark ?? null,
        createdAt:
          product.createdAt instanceof Date
            ? product.createdAt.toISOString()
            : String(product.createdAt),
        updatedAt:
          product.updatedAt instanceof Date
            ? product.updatedAt.toISOString()
            : String(product.updatedAt),
      });
    }
  }

  async findAllProducts(tx?: any): Promise<Product[]> {
    const executor = this.getExecutor(tx);
    const rows = await executor.select().from(products).orderBy(asc(products.id));
    return rows.map((r: any) => this.mapProduct(r));
  }

  private mapInventory(row: any): StoreInventory {
    return new StoreInventory({
      id: row.id,
      storeId: row.storeId,
      productId: row.productId,
      quantity: row.quantity,
      safetyStock: row.safetyStock,
      version: row.version,
      updatedAt: row.updatedAt,
    });
  }

  private mapLog(row: any): InventoryLog {
    return new InventoryLog({
      id: row.id,
      storeId: row.storeId,
      productId: row.productId,
      changeType: row.changeType,
      delta: row.delta,
      balance: row.balance,
      orderId: row.orderId,
      stocktakeId: row.stocktakeId,
      operator: row.operator,
      reason: row.reason,
      createdAt: row.createdAt,
    });
  }

  private mapProduct(row: any): Product {
    return new Product({
      id: row.id,
      name: row.name,
      category: row.category,
      condition: row.condition,
      costPrice: row.costPrice,
      sellingPrice: row.sellingPrice,
      suggestedPoints: row.suggestedPoints,
      version: row.version,
      isSpecial: Boolean(row.isSpecial),
      barcode: row.barcode,
      remark: row.remark,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
