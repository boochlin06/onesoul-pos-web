import type { StoreInventory, InventoryLog, Product } from '../entities/Product';

export interface InventoryRepository {
  findByStoreAndProduct(storeId: string, productId: string, tx?: any): Promise<StoreInventory | null>;
  findAllByStore(storeId: string, tx?: any): Promise<StoreInventory[]>;
  save(inventory: StoreInventory, tx?: any): Promise<void>;
  deductQuantities(storeId: string, deductions: { productId: string; quantity: number }[], tx?: any): Promise<void>;
  addQuantities(storeId: string, additions: { productId: string; quantity: number }[], tx?: any): Promise<void>;
  recordLog(log: InventoryLog, tx?: any): Promise<void>;
  findLogsByStore(storeId: string, limit?: number, tx?: any): Promise<InventoryLog[]>;
  findProductById(productId: string, tx?: any): Promise<Product | null>;
  saveProduct(product: Product, tx?: any): Promise<void>;
  findAllProducts(tx?: any): Promise<Product[]>;
}
