import type {
  StoreType,
  SessionStatus,
  TransferStatus,
  PointLogType,
  ProductCondition,
  ProductCategory,
  InventoryChangeType,
  StocktakeStatus,
  LuckyBagStatus,
  OrderStatus,
  OrderItemType,
  DrawPickType,
  Role,
  AttendanceStatus,
  OutboxTaskType,
  OutboxStatus,
  NoticeLevel,
  PurchaseOrderStatus,
  PreOrderStatus,
} from './enums';

// 1. Store
export interface StoreModel {
  id: string; // 'chupei' | 'jinshan' | 'warehouse-main'
  name: string;
  code: string;
  type: StoreType;
  address?: string | null;
  phone?: string | null;
  isActive: boolean;
  openTime?: string | null;
  standardHours: number;
  lateGraceMinutes: number;
  createdAt: string;
  updatedAt: string;
}

// 2. CashRegisterSession
export interface CashRegisterSessionModel {
  id: string;
  storeId: string;
  openedAt: string;
  closedAt?: string | null;
  openedBy: string;
  closedBy?: string | null;
  openingCash: number;
  expectedCash?: number | null;
  actualCash?: number | null;
  discrepancy?: number | null;
  totalRevenue?: number | null;
  cashRevenue?: number | null;
  cardRevenue?: number | null;
  remitRevenue?: number | null;
  pointsIssued?: number | null;
  pointsRedeemed?: number | null;
  txCount?: number | null;
  voidCount?: number | null;
  voidAmount?: number | null;
  note?: string | null;
  status: SessionStatus;
}

// 3. TransferOrder
export interface TransferOrderModel {
  id: string;
  transferNo: string;
  sourceStoreId: string;
  targetStoreId: string;
  status: TransferStatus;
  dispatchedAt?: string | null;
  receivedAt?: string | null;
  dispatchedBy?: string | null;
  receivedBy?: string | null;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
}

// 4. TransferOrderItem
export interface TransferOrderItemModel {
  id: string;
  transferId: string;
  productId: string;
  requestedQty: number;
  shippedQty: number;
  receivedQty: number;
  remark?: string | null;
}

// 5. Member
export interface MemberModel {
  id: string;
  phone: string;
  barcode?: string | null;
  lineUserId?: string | null;
  name: string;
  tier: string;
  gender?: string | null;
  birthday?: string | null;
  registeredAt: string;
  points: number;
  version: number;
  note?: string | null;
  isActive: boolean;
  totalSpent: number;
  orderCount: number;
  lastPurchaseAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// 6. PointLog
export interface PointLogModel {
  id: string;
  memberId: string;
  type: PointLogType;
  delta: number;
  balance: number;
  orderId?: string | null;
  reason?: string | null;
  operator?: string | null;
  createdAt: string;
}

// 7. Category
export interface CategoryModel {
  id: string;
  name: string;
  code?: string | null;
  parentId?: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// 8. Product
export interface ProductModel {
  id: string; // Barcode / 代碼
  barcode?: string | null;
  name: string;
  categoryId?: string | null;
  mainCategory: string;
  subCategory?: string | null;
  category: ProductCategory;
  brand?: string | null;
  series?: string | null;
  condition: ProductCondition;
  costPrice: number;
  allocationCost?: number | null;
  sellingPrice: number;
  suggestedPoints: number;
  version: number;
  isSpecial: boolean;
  remark?: string | null;
  parentId?: string | null;
  createdAt: string;
  updatedAt: string;
}

// 9. StoreInventory
export interface StoreInventoryModel {
  id: string;
  storeId: string;
  productId: string;
  quantity: number;
  safetyStock: number;
  version: number;
  updatedAt: string;
}

// 10. InventoryLog
export interface InventoryLogModel {
  id: string;
  storeId: string;
  productId: string;
  changeType: InventoryChangeType;
  delta: number;
  balance: number;
  orderId?: string | null;
  stocktakeId?: string | null;
  operator?: string | null;
  reason?: string | null;
  createdAt: string;
}

// 11. Stocktake
export interface StocktakeModel {
  id: string;
  storeId: string;
  status: StocktakeStatus;
  countedBy: string;
  postedBy?: string | null;
  postedAt?: string | null;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
}

// 12. StocktakeItem
export interface StocktakeItemModel {
  id: string;
  stocktakeId: string;
  productId: string;
  systemQty: number;
  actualQty: number;
  variance: number;
  itemRemark?: string | null;
}

// 13. LuckyBag
export interface LuckyBagModel {
  id: string;
  storeId: string;
  name: string;
  unitPrice: number;
  isPointsSet: boolean;
  status: LuckyBagStatus;
  createdAt: string;
  updatedAt: string;
}

// 14. LuckyBagPrize
export interface LuckyBagPrizeModel {
  id: string;
  bagId: string;
  prizeGrade: string;
  prizeName: string;
  productId?: string | null;
  points: number;
  draws: number;
  drawnCount: number;
  createdAt: string;
  updatedAt: string;
}

// Payment item in Order JSON
export interface PaymentRecord {
  method: string;
  amount: number;
  ref?: string;
}

// Discount item in Order JSON
export interface DiscountRecord {
  type: string;
  amount: number;
  note?: string;
}

// 15. Order
export interface OrderModel {
  id: string;
  checkoutUID: string;
  storeId: string;
  sessionId: string;
  memberId?: string | null;
  status: OrderStatus;
  totalDue: number;
  receivedAmount: number;
  payments?: PaymentRecord[] | null;
  discounts?: DiscountRecord[] | null;
  cash: number;
  creditCard: number;
  linePay: number;
  remittance: number;
  pointsUsed: number;
  netPointsDelta: number;
  cashierEmail: string;
  orderNote?: string | null;
  voidReason?: string | null;
  voidedAt?: string | null;
  voidedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

// 16. OrderItem
export interface OrderItemModel {
  id: string;
  orderId: string;
  itemType: OrderItemType;
  bagId?: string | null;
  prizeGrade?: string | null;
  prizeName?: string | null;
  pickType?: DrawPickType | null;
  draws?: number | null;
  productId?: string | null;
  quantity: number;
  unitPrice: number;
  amount: number;
  pointsImpact: number;
  remark?: string | null;
}

// 17. User
export interface UserModel {
  id: string;
  email: string;
  name: string;
  role: Role;
  assignedStoreId?: string | null;
  isActive: boolean;
  createdAt: string;
}

// 18. Schedule
export interface ScheduleModel {
  id: string;
  storeId: string;
  date: string; // YYYY-MM-DD
  staffName: string;
  isClosed: boolean;
}

// 19. ShiftSchedule
export interface ShiftScheduleModel {
  id: string;
  storeId: string;
  date: string;
  staffName: string;
  staffEmail?: string | null;
  shiftType: string;
  isClosed: boolean;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
}

// 20. Attendance
export interface AttendanceModel {
  id: string;
  storeId: string;
  userEmail: string;
  clockInAt: string;
  clockOutAt?: string | null;
  status: string;
}

// 21. AttendanceRecord
export interface AttendanceRecordModel {
  id: string;
  storeId: string;
  userEmail: string;
  userName?: string | null;
  clockInAt: string;
  clockOutAt?: string | null;
  status: AttendanceStatus;
  lateMinutes: number;
  ipAddress?: string | null;
  note?: string | null;
  createdAt: string;
}

// 22. IntegrationConfig
export interface IntegrationConfigModel {
  id: string;
  key: string;
  value: Record<string, unknown>;
  description?: string | null;
  isEnabled: boolean;
  updatedBy?: string | null;
  updatedAt: string;
}

// 23. OutboxTask
export interface OutboxTaskModel {
  id: string;
  taskType: OutboxTaskType;
  payload: Record<string, unknown>;
  status: OutboxStatus;
  retryCount: number;
  maxRetries: number;
  lastError?: string | null;
  nextRetryAt: string;
  createdAt: string;
  processedAt?: string | null;
}

// 24. EmergencyNotice
export interface EmergencyNoticeModel {
  id: string;
  title: string;
  content: string;
  level: NoticeLevel;
  targetStoreIds: string[];
  isActive: boolean;
  version: number;
  publisherEmail: string;
  publishedAt: string;
  expiresAt?: string | null;
}

// 25. VoidSetLog
export interface VoidSetLogModel {
  id: string;
  storeId: string;
  bagId: string;
  bagName: string;
  unitPrice: number;
  totalDraws: number;
  drawnCount: number;
  realizedIncome: number;
  totalCost: number;
  residualValue: number;
  netProfitLoss: number;
  restoredItems?: Record<string, unknown> | null;
  isPointsSet: boolean;
  details: string;
  operator: string;
  createdAt: string;
}

// 26. AuditLog
export interface AuditLogModel {
  id: string;
  operatorId: string;
  action: string;
  targetType: string;
  targetId: string;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  delta?: number | null;
  reason: string;
  ipAddress?: string | null;
  prevHash?: string | null;
  currentHash: string;
  createdAt: string;
}

// 27. PurchaseOrder
export interface PurchaseOrderModel {
  id: string;
  orderNo: string;
  title: string;
  supplier?: string | null;
  status: PurchaseOrderStatus;
  unitPrice: number;
  qtyChupei: number;
  qtyJinshan: number;
  totalQty: number;
  totalAmount: number;
  note?: string | null;
  rawQuote?: string | null;
  createdAt: string;
  updatedAt: string;
}

// 28. PreOrder
export interface PreOrderModel {
  id: string;
  name: string;
  version?: string | null;
  quantity: number;
  deposit: number;
  finalPayment: number;
  shippingFee: number;
  totalCost: number;
  supplier?: string | null;
  targetStoreId?: string | null;
  productId?: string | null;
  status: PreOrderStatus;
  arrivedAt?: string | null;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
}

// 29. PrizeAllocationPlan
export interface PrizeAllocationPlanModel {
  id: string;
  storeId: string;
  name: string;
  status: string;
  totalDraws: number;
  price1: number;
  price3: number;
  price5: number;
  price10: number;
  isTenPlusOne: boolean;
  targetMargin: number;
  items: Array<{
    grade: string;
    name: string;
    productId?: string | null;
    draws: number;
    points: number;
    cost: number;
  }>;
  createdAt: string;
  updatedAt: string;
}
