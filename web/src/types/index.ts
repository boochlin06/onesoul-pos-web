// ── Types ──────────────────────────────────────────────
export interface PrizeEntry {
  setId: string;
  setName: string;
  unitPrice: number;
  prize: string;
  prizeId: string;
  prizeName: string;
  points: number;
  draws: number;
  date: string;
  branch: string;
  isPointsSet?: boolean;
  drawnCount?: number;
}

export interface MemberEntry {
  timestamp: string;
  name: string;
  phone: string;
  gender: string;
  birthday: string;
  store: string;
  points: number;
  note: string;
  duplicate: string;
}

export interface SalesEntry {
  phone: string;
  lotteryId: string;
  prize: string;
  draws: number;
  type: string;
  setName: string;
  name?: string; // 回向相容舊版後端
  unitPrice: number;
  prizeId: string;
  prizeName: string;
  unitPoints: number;
  points: number;
  amount: number;
  remark: string;
  date: string;
  checkoutUID: string;
  // 支付資訊 (子列才有，其餘為 0)
  receivedAmount: number;
  remittance: number;
  creditCard: number;
  cash: number;
  pointsUsed: number;
  channel: string;
  pointDelta: number;
  branch: string;
}

export type SalesRecordEntry = SalesEntry;
export type DailySalesEntry = SalesEntry;

export interface LotteryItem {
  id: string;        // 福袋編號
  prize: string;     // 獎項代號
  draws: number;
  type: '點數' | '帶走';
  setName: string;
  unitPrice: number;
  prizeId: string;
  prizeName: string;
  unitPoints: number;
  totalPoints: number;
  amount: number;
  pointsCost: number;
  remark: string;
}

export interface MerchItem {
  id: string;
  quantity: number;
  paymentType: '點數' | '現金' | '贈送';
  unitAmount: number;
  name: string;
  suggestedPoints: number;
  totalPoints: number;
  actualAmount: number;
  remark: string;
  isGk?: boolean;
}

export interface StockEntry {
  id: string;
  name: string;
  points: number;
  category: string;
  quantity: number;
  remark: string;
  branch: string;
}

export interface BlindBoxEntry {
  id: string;              // 貨號
  name: string;            // 名稱
  points: number;          // 販售點數
  manualPrice: number;     // 手動售價
  autoSuggestPrice: number;// 自動建議售價
  cost: number;            // 成本
  prizePoints: number;     // 獎品轉換點數
  inventory: number;       // 庫存
  category: string;        // 類別
  configuring: number;     // 配置中
  shipped: number;         // 已出貨
  remaining: number;       // 剩餘數量
  remark: string;          // 備註
}

export type Tab = 'checkout' | 'daily' | 'members' | 'sales' | 'library' | 'stock' | 'blindbox' | 'member_history' | 'master' | 'monitor' | 'inventory_check';
export type Branch = '竹北' | '金山';

export interface BannerState {
  msg: string;
  type: 'ok' | 'err' | 'loading';
}

export interface InventoryCheckItem {
  id: string;
  name: string;
  category: string;
  systemQty: number;
  actualQty: number;
  branch: string;
  isNew?: boolean;
}
