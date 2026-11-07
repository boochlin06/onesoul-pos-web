export interface PendingCellChange {
  type: 'product' | 'stock';
  productId: string;
  storeId?: string;
  field: string;
  originalValue: any;
  currentValue: any;
}

export interface ActiveCell {
  rowId: string;
  colId: string;
}

export interface EditingCell {
  rowId: string;
  colId: string;
  value: any;
}

export interface CellFeedback {
  status: 'saving' | 'saved' | 'error';
  message?: string;
}

export interface StoreItem {
  id: string;
  name: string;
  code?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  barcode?: string;
  category: string;
  mainCategory?: string;
  subCategory?: string;
  costPrice: number;
  sellingPrice: number;
  suggestedPoints: number;
  stock: number;
  totalStock: number;
  allocatingStock?: number;
  totalAllocatingStock?: number;
  inboundDate?: string | null;
  version?: number;
  storeStocks?: Record<string, number>;
  allocatingStocks?: Record<string, number>;
  safetyStocks?: Record<string, number>;
  safetyStock?: number;
  chupeiStock?: number;
  jinshanStock?: number;
  isLowStock?: boolean;
  [key: string]: any;
}

export interface DecisionTotals {
  totalProducts: number;
  totalStock: number;
  chupeiTotalStock: number;
  jinshanTotalStock: number;
  totalSales30d: number;
  balancedIpCount: number;
  rebalanceNeededCount: number;
  lowStockIpCount: number;
}

export interface IpSummaryItem {
  ip: string;
  productCount: number;
  totalStock: number;
  chupeiStock: number;
  jinshanStock: number;
  storeStocks: Record<string, number>;
  stockShareChupei: number;
  stockShareJinshan: number;
  status: 'BALANCED' | 'CHUPEI_DEFICIT' | 'JINSHAN_DEFICIT' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  statusLabel: string;
  statusColor: string;
  rebalanceSuggestion: string;
  suggestTransfer: {
    fromStoreId: string;
    fromStoreName: string;
    toStoreId: string;
    toStoreName: string;
    quantity: number;
  } | null;
  sales30d: number;
  turnoverDays: number;
}

export interface DecisionAnalyticsData {
  stores: StoreItem[];
  ipSummary: IpSummaryItem[];
  topSelling: any[];
  slowMoving: any[];
  salesTrend: {
    totalSales: number;
    byIP: Array<{ ip: string; sales: number; percentage: number }>;
    weeklyTrend: Array<{ weekLabel: string; totalSales: number; ipBreakdown: Record<string, number> }>;
  };
  totals: DecisionTotals;
}
