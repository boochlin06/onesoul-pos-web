export interface LiveStockQuery {
  storeId?: string;
  category?: string;
  mainCategory?: string;
  q?: string;
  minQty?: string | number;
}

export interface LiveStockItem {
  id: string;
  name: string;
  mainCategory: string;
  subCategory: string;
  category: string;
  costPrice: number;
  sellingPrice: number;
  suggestedPoints: number;
  storeStocks: Record<string, number>;
  totalStock: number;
  storeAllocated: Record<string, number>;
  totalAllocated: number;
  stock: number;
  allocatedCount: number;
  isOverAllocated: boolean;
  availableStock?: number; // Invariant #2: 可配現貨量 = max(0, stock - allocatedCount)
}

export interface AllocationPrizeItemInput {
  id?: string;
  prizeGrade: string;
  prizeName: string;
  productId?: string | null;
  draws: number | string;
  costPrice?: number | string;
  points?: number | string;
  isNonGk?: boolean;
}

export interface AllocationPlanInput {
  id?: string;
  name: string;
  storeId?: string;
  totalDraws: number | string;
  price1: number | string;
  price3?: number | string;
  price5?: number | string;
  price10?: number | string;
  isTenPlusOne?: boolean;
  targetMargin?: number;
  batchCount?: number | string;
  blindBoxPointsValue?: number | string;
  isPointsSet?: boolean;
  items?: AllocationPrizeItemInput[];
  isParked?: boolean;
  status?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface PublishPlansRequest {
  plans?: AllocationPlanInput[];
  id?: string;
  name?: string;
  storeId?: string;
  totalDraws?: number | string;
  price1?: number | string;
  price3?: number | string;
  price5?: number | string;
  price10?: number | string;
  isTenPlusOne?: boolean;
  targetMargin?: number;
  batchCount?: number | string;
  blindBoxPointsValue?: number | string;
  isPointsSet?: boolean;
  items?: AllocationPrizeItemInput[];
}

export interface NormalizedPrizeItem {
  prizeGrade: string;
  prizeName: string;
  productId: string | null;
  points: number;
  draws: number;
  isNonGk: boolean;
  costPrice: number;
}

export interface CreatedBagResult {
  bagId: string;
  name: string;
  storeId: string;
  totalDraws: number;
  unitPrice: number;
}

export interface PlanFinancialSummary {
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  marginRate: number;
  breakevenDraws: number;
  isHealthy: boolean;
}

export interface PlanValidationResult {
  isValid: boolean;
  errorMessage?: string;
  validated?: {
    numDraws: number;
    unitPrice: number;
    batchCount: number;
  };
}

export interface AllocationPresetTemplate {
  id: string;
  name: string;
  storeId: string;
  status: string;
  totalDraws: number;
  price1: number;
  price3: number;
  price5: number;
  price10: number;
  isTenPlusOne: boolean;
  targetMargin: number;
  items: Array<{
    prizeGrade: string;
    prizeName: string;
    productId: string;
    draws: number;
    costPrice: number;
    points: number;
    isNonGk?: boolean;
  }>;
}
