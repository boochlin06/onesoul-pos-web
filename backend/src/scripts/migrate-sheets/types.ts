export interface RawMemberRow {
  timestamp?: string;
  name?: string;
  phone?: string;
  gender?: string;
  birthday?: string;
  store?: string;
  points?: string | number;
  note?: string;
}

export interface RawProductRow {
  id: string;
  name: string;
  points?: string | number;
  category?: string;
  quantity?: string | number;
  branch?: string;
  cost?: string | number;
  price?: string | number;
}

export interface RawBlindBoxRow {
  id: string;
  name: string;
  points?: string | number;
  manualPrice?: string | number;
  autoSuggestPrice?: string | number;
  cost?: string | number;
  prizePoints?: string | number;
  quantity?: string | number;
  remaining?: string | number;
}

export interface RawLuckyBagRow {
  bagId: string;
  name: string;
  price?: string | number;
  store?: string;
  isPointsSet?: boolean | string;
  status?: string;
  prizes?: RawLuckyBagPrizeRow[];
}

export interface RawLuckyBagPrizeRow {
  bagId: string;
  prizeGrade: string;
  prizeName: string;
  productId?: string;
  points?: string | number;
  draws?: string | number;
  drawnCount?: string | number;
}

export interface RawSalesRecordRow {
  phone?: string;
  orderId?: string;
  createdAt?: string;
  store?: string;
  itemCode?: string;
  itemName?: string;
  itemType?: 'LOTTERY' | 'MERCHANDISE' | 'SPECIAL';
  prizeGrade?: string;
  pickMethod?: string;
  unitPrice?: string | number;
  receivedAmount?: string | number;
  cash?: string | number;
  creditCard?: string | number;
  remittance?: string | number;
  pointsDelta?: string | number;
  cashier?: string;
  note?: string;
}

export interface RawSessionRow {
  store: string;
  openedAt?: string;
  closedAt?: string;
  openingCash?: string | number;
  actualCash?: string | number;
  openedBy?: string;
  closedBy?: string;
  note?: string;
}

export interface MigrationAuditReport {
  summary: {
    totalExtracted: number;
    totalImported: number;
    totalConflicts: number;
    dryRun: boolean;
    executedAt: string;
  };
  details: {
    members: { extracted: number; imported: number; conflicts: number };
    products: { extracted: number; imported: number };
    inventories: { importedChupei: number; importedJinshan: number };
    luckyBags: { importedBags: number; importedPrizes: number };
    sessions: { imported: number };
    orders: { imported: number; itemsImported: number };
  };
  conflicts: Array<{
    type: 'MEMBER_PHONE_DUPLICATE' | 'UNKNOWN_PRODUCT_REFERENCE' | 'INVALID_DATE' | 'PARSING_ERROR';
    identifier: string;
    description: string;
    raw: any;
    resolution: string;
  }>;
}
