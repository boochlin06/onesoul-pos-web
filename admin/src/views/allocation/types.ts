export interface AllocationPrizeItem {
  id: string;
  prizeGrade: string; // '1', '2', 'A', 'B', 'X', 'Z', 'LAST' 等
  prizeName: string;
  productId: string;
  draws: number;
  costPrice: number;
  points: number;
  isNonGk?: boolean;
  isPrizeNameCustomized?: boolean; // 店長是否手動自訂過品名（若已自訂，自動帶入時不抹除備註）
}

export interface SetPlan {
  id: string;
  name: string;
  isNameCustomized?: boolean; // 老闆是否手動自訂過套名（若否，更換大獎時自動更新）
  storeId: string;
  totalDraws: number;
  price1: number;
  price3: number;
  price5: number;
  price10: number;
  isTenPlusOne: boolean;
  targetMargin: number;
  batchCount: number; // 一次開 N 套
  blindBoxPointsValue?: number; // X 賞盲盒等價點數 (預設 10 點)
  isPointsSet?: boolean; // 是否為限定點數套 (只能扣點數抽)
  items: AllocationPrizeItem[];
  isParked?: boolean; // 臨時有事先放著 (掛單暫存狀態)
  lastSavedAt?: string;
}

export interface FinancialSummary {
  allocatedDraws: number;
  drawsDiff: number;
  isBalanced: boolean;
  totalCost: number;
  totalPoints: number;
  maxPointLiability: number;
  effectivePerDraw: number;
  expectedRevenue: number;
  cashMargin: number;
  hybridMargin: number;
}

export interface LiveStockItem {
  id: string;
  name: string;
  barcode?: string;
  category?: string;
  costPrice?: number;
  sellingPrice?: number;
  suggestedPoints?: number;
  stock?: number;
  totalStock?: number;
  allocatedCount?: number;
  totalAllocated?: number;
  storeStocks?: Record<string, number>;
  storeAllocated?: Record<string, number>;
}

export interface StoreOption {
  id: string;
  name: string;
}

export type AllocationTab = 'canvas' | 'templates' | 'drafts';
export type NamingMode = 'number' | 'letter';
export type StockMainType = 'ALL' | 'GK' | 'BLIND_BOX';

export interface PublishMessage {
  type: 'success' | 'error';
  text: string;
}

export interface AllocationTemplate {
  id: string;
  name: string;
  storeId?: string;
  totalDraws: number;
  price1: number;
  price3?: number;
  price5?: number;
  price10?: number;
  isTenPlusOne?: boolean;
  targetMargin?: number;
  items: AllocationPrizeItem[];
}

export interface AllocationDraft {
  id: string;
  name: string;
  storeId: string;
  totalDraws: number;
  price1: number;
  price3?: number;
  price5?: number;
  price10?: number;
  isTenPlusOne?: boolean;
  targetMargin?: number;
  blindBoxPointsValue?: number;
  isPointsSet?: boolean;
  items: AllocationPrizeItem[];
  savedAt?: string;
}
