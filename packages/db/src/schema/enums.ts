/**
 * OneSoul Drizzle ORM SQLite Enums
 * 19 Enums aligned with Prisma schema and specification
 */

export const StoreTypeEnum = ['RETAIL', 'WAREHOUSE', 'POPUP'] as const;
export type StoreType = (typeof StoreTypeEnum)[number];

export const SessionStatusEnum = ['OPEN', 'CLOSED'] as const;
export type SessionStatus = (typeof SessionStatusEnum)[number];

export const TransferStatusEnum = ['DRAFT', 'DISPATCHED', 'RECEIVED', 'CANCELLED'] as const;
export type TransferStatus = (typeof TransferStatusEnum)[number];

export const PointLogTypeEnum = ['EARN', 'REDEEM', 'REFUND', 'MANUAL'] as const;
export type PointLogType = (typeof PointLogTypeEnum)[number];

export const ProductConditionEnum = ['NEW', 'DISPLAY_OPENED', 'BOX_DAMAGED', 'SECOND_HAND'] as const;
export type ProductCondition = (typeof ProductConditionEnum)[number];

export const ProductCategoryEnum = ['GENERAL', 'GK', 'BLIND_BOX'] as const;
export type ProductCategory = (typeof ProductCategoryEnum)[number];

export const InventoryChangeTypeEnum = [
  'SALE',
  'SALE_VOID_RETURN',
  'STOCKTAKE_ADJUST',
  'MANUAL_ADJUST',
  'TRANSFER_OUT',
  'TRANSFER_IN',
  'ALLOCATE_TO_LOTTERY',
] as const;
export type InventoryChangeType = (typeof InventoryChangeTypeEnum)[number];

export const StocktakeStatusEnum = ['DRAFT', 'POSTED', 'CANCELLED'] as const;
export type StocktakeStatus = (typeof StocktakeStatusEnum)[number];

export const LuckyBagStatusEnum = ['ACTIVE', 'DEPLETED', 'VOIDED'] as const;
export type LuckyBagStatus = (typeof LuckyBagStatusEnum)[number];

export const OrderStatusEnum = ['COMPLETED', 'CANCELLED'] as const;
export type OrderStatus = (typeof OrderStatusEnum)[number];

export const OrderItemTypeEnum = ['LOTTERY', 'MERCHANDISE', 'SPECIAL'] as const;
export type OrderItemType = (typeof OrderItemTypeEnum)[number];

export const DrawPickTypeEnum = ['TAKE_AWAY', 'POINTS'] as const;
export type DrawPickType = (typeof DrawPickTypeEnum)[number];

export const RoleEnum = ['SUPER_ADMIN', 'STORE_MANAGER', 'CASHIER'] as const;
export type Role = (typeof RoleEnum)[number];

export const AttendanceStatusEnum = ['NORMAL', 'LATE', 'EARLY_LEAVE', 'ABSENT'] as const;
export type AttendanceStatus = (typeof AttendanceStatusEnum)[number];

export const OutboxTaskTypeEnum = [
  'LINE_SHIFT_CLOSED',
  'LINE_ORDER_VOIDED',
  'LINE_LATE_ALERT',
  'TRELLO_GK_CARD',
] as const;
export type OutboxTaskType = (typeof OutboxTaskTypeEnum)[number];

export const OutboxStatusEnum = ['PENDING', 'PROCESSING', 'SUCCESS', 'FAILED'] as const;
export type OutboxStatus = (typeof OutboxStatusEnum)[number];

export const NoticeLevelEnum = ['INFO', 'WARNING', 'CRITICAL'] as const;
export type NoticeLevel = (typeof NoticeLevelEnum)[number];

export const PurchaseOrderStatusEnum = [
  'DRAFT',
  'SUBMITTED',
  'PARTIALLY_RECEIVED',
  'COMPLETED',
  'CANCELLED',
] as const;
export type PurchaseOrderStatus = (typeof PurchaseOrderStatusEnum)[number];

export const PreOrderStatusEnum = ['PENDING', 'COMPLETED', 'CANCELLED'] as const;
export type PreOrderStatus = (typeof PreOrderStatusEnum)[number];
