import type { InventoryRepository } from '../../core/ports/InventoryRepository';
import { StoreInventory, Product, InventoryLog } from '../../core/entities/Product';
import { InsufficientStockError } from '@onesoul/shared';
import { sortProductIdsForLock } from '../../core/invariants/invariants';
import type { TransactionalMemoryRepo } from './InMemoryTransactionManager';

export class InMemoryInventoryRepository implements InventoryRepository, TransactionalMemoryRepo {
  private products: Map<string, Product> = new Map();
  private inventories: Map<string, StoreInventory> = new Map(); // key: `${storeId}:${productId}`
  private logs: InventoryLog[] = [];

  private snapshotProducts: Map<string, Product> | null = null;
  private snapshotInventories: Map<string, StoreInventory> | null = null;
  private snapshotLogs: InventoryLog[] | null = null;

  beginTx(): void {
    this.snapshotProducts = new Map(this.products);
    this.snapshotInventories = new Map();
    for (const [key, inv] of this.inventories.entries()) {
      this.snapshotInventories.set(
        key,
        new StoreInventory({
          id: inv.id,
          storeId: inv.storeId,
          productId: inv.productId,
          quantity: inv.quantity,
          safetyStock: inv.safetyStock,
          version: inv.version,
          updatedAt: inv.updatedAt,
        })
      );
    }
    this.snapshotLogs = [...this.logs];
  }

  commitTx(): void {
    this.snapshotProducts = null;
    this.snapshotInventories = null;
    this.snapshotLogs = null;
  }

  rollbackTx(): void {
    if (this.snapshotInventories) {
      this.inventories = this.snapshotInventories;
      this.snapshotInventories = null;
    }
    if (this.snapshotProducts) {
      this.products = this.snapshotProducts;
      this.snapshotProducts = null;
    }
    if (this.snapshotLogs) {
      this.logs = this.snapshotLogs;
      this.snapshotLogs = null;
    }
  }

  private makeKey(storeId: string, productId: string): string {
    return `${storeId}:${productId}`;
  }

  async findByStoreAndProduct(
    storeId: string,
    productId: string
  ): Promise<StoreInventory | null> {
    return this.inventories.get(this.makeKey(storeId, productId)) ?? null;
  }

  async findAllByStore(storeId: string): Promise<StoreInventory[]> {
    const list: StoreInventory[] = [];
    for (const inv of this.inventories.values()) {
      if (inv.storeId === storeId) {
        list.push(inv);
      }
    }
    return list;
  }

  async save(inventory: StoreInventory): Promise<void> {
    this.inventories.set(
      this.makeKey(inventory.storeId, inventory.productId),
      inventory
    );
  }

  async deductQuantities(
    storeId: string,
    deductions: { productId: string; quantity: number }[]
  ): Promise<void> {
    // Invariant #3: 字典序排序商品 ID 防死鎖
    const sortedIds = sortProductIdsForLock(deductions.map((d) => d.productId));
    const deductionMap = new Map(deductions.map((d) => [d.productId, d.quantity]));

    for (const pid of sortedIds) {
      const qty = deductionMap.get(pid) || 0;
      if (qty <= 0) continue;

      const inv = await this.findByStoreAndProduct(storeId, pid);
      if (!inv || inv.quantity < qty) {
        throw new InsufficientStockError(
          `門市庫存不足: 商品 [${pid}] 現有庫存 ${inv?.quantity ?? 0}，欲扣除 ${qty}`
        );
      }
      inv.deduct(qty);
    }
  }

  async addQuantities(
    storeId: string,
    additions: { productId: string; quantity: number }[]
  ): Promise<void> {
    for (const item of additions) {
      let inv = await this.findByStoreAndProduct(storeId, item.productId);
      if (!inv) {
        inv = new StoreInventory({
          id: `inv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          storeId,
          productId: item.productId,
          quantity: item.quantity,
          safetyStock: 0,
        });
        await this.save(inv);
      } else {
        inv.add(item.quantity);
      }
    }
  }

  async recordLog(log: InventoryLog): Promise<void> {
    this.logs.push(log);
  }

  async findLogsByStore(storeId: string, limit = 100): Promise<InventoryLog[]> {
    const storeLogs = this.logs.filter((l) => l.storeId === storeId);
    storeLogs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return storeLogs.slice(0, limit);
  }

  async findProductById(productId: string): Promise<Product | null> {
    return this.products.get(productId) ?? null;
  }

  async saveProduct(product: Product): Promise<void> {
    this.products.set(product.id, product);
  }

  async findAllProducts(): Promise<Product[]> {
    return Array.from(this.products.values());
  }
}
