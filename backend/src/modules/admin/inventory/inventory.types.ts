export interface SuggestQuery {
  q?: string;
  storeId?: string;
  limit?: string | number;
}

export interface InventorySummaryQuery {
  q?: string;
  category?: string;
  mainCategory?: string;
  subCategory?: string;
  storeId?: string;
  lowStockOnly?: string | boolean;
  page?: string | number;
  pageSize?: string | number;
  sortBy?: string;
  sortOrder?: 'desc' | 'asc';
}

export interface DecisionAnalyticsQuery {
  days?: string | number;
  storeId?: string;
}

export interface CreateProductDto {
  id?: string;
  name: string;
  category?: string;
  mainCategory?: string;
  subCategory?: string;
  costPrice?: number;
  sellingPrice?: number;
  suggestedPoints?: number;
  barcode?: string | null;
  initialStocks?: Record<string, number>;
  safetyStock?: number;
}

export interface UpdateProductDto {
  name?: string;
  category?: string;
  mainCategory?: string;
  subCategory?: string;
  costPrice?: number;
  sellingPrice?: number;
  suggestedPoints?: number;
  barcode?: string | null;
  version?: number;
}

export interface AdjustStockDto {
  storeId: string;
  productId: string;
  delta?: number;
  newQuantity?: number;
  reason?: string;
}

export interface BatchProductUpdate {
  id: string;
  name?: string;
  category?: string;
  mainCategory?: string;
  subCategory?: string;
  sellingPrice?: number;
  costPrice?: number;
  suggestedPoints?: number;
  barcode?: string | null;
}

export interface BatchStockAdjustment {
  storeId: string;
  productId: string;
  newQuantity?: number;
  delta?: number;
  reason?: string;
}

export interface BatchUpdateDto {
  productUpdates?: BatchProductUpdate[];
  stockAdjustments?: BatchStockAdjustment[];
}

export interface BulkImportItem {
  id: string;
  name: string;
  category?: string;
  costPrice?: number;
  sellingPrice?: number;
  suggestedPoints?: number;
  barcode?: string;
  quantity?: number;
  safetyStock?: number;
}

export interface BulkImportDto {
  items: BulkImportItem[];
  defaultStoreId?: string;
}

export type StoreBalanceStatus = 'BALANCED' | 'CHUPEI_DEFICIT' | 'JINSHAN_DEFICIT' | 'LOW_STOCK' | 'OUT_OF_STOCK';

export interface SuggestedTransfer {
  fromStoreId: string;
  fromStoreName: string;
  toStoreId: string;
  toStoreName: string;
  quantity: number;
}

export interface StoreBalanceResult {
  status: StoreBalanceStatus;
  statusLabel: string;
  statusColor: string;
  rebalanceSuggestion: string;
  suggestTransfer: SuggestedTransfer | null;
}
