import { sqliteTable, text, integer, real, check, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import {
  StoreTypeEnum,
  SessionStatusEnum,
  TransferStatusEnum,
  PointLogTypeEnum,
  ProductConditionEnum,
  InventoryChangeTypeEnum,
  StocktakeStatusEnum,
  LuckyBagStatusEnum,
  OrderStatusEnum,
  OrderItemTypeEnum,
  DrawPickTypeEnum,
  RoleEnum,
  AttendanceStatusEnum,
  OutboxTaskTypeEnum,
  OutboxStatusEnum,
  NoticeLevelEnum,
  PurchaseOrderStatusEnum,
  PreOrderStatusEnum,
} from './enums';

// 1. 門市與倉儲 (stores)
export const stores = sqliteTable('stores', {
  id: text('id').primaryKey(), // "chupei" | "jinshan" | "warehouse-main"
  name: text('name').notNull(),
  code: text('code').notNull().unique(),
  type: text('type', { enum: StoreTypeEnum }).notNull().default('RETAIL'),
  address: text('address'),
  phone: text('phone'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  openTime: text('open_time'),
  standardHours: integer('standard_hours').notNull().default(8),
  lateGraceMinutes: integer('late_grace_minutes').notNull().default(15),
  createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text('updated_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
});

// 2. 收銀班次 (cash_register_sessions)
export const cashRegisterSessions = sqliteTable(
  'cash_register_sessions',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    storeId: text('store_id').notNull().references(() => stores.id),
    openedAt: text('opened_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
    closedAt: text('closed_at'),
    openedBy: text('opened_by').notNull(),
    closedBy: text('closed_by'),
    openingCash: integer('opening_cash').notNull().default(0),
    expectedCash: integer('expected_cash'),
    actualCash: integer('actual_cash'),
    discrepancy: integer('discrepancy'),
    totalRevenue: integer('total_revenue').default(0),
    cashRevenue: integer('cash_revenue').default(0),
    cardRevenue: integer('card_revenue').default(0),
    remitRevenue: integer('remit_revenue').default(0),
    pointsIssued: integer('points_issued').default(0),
    pointsRedeemed: integer('points_redeemed').default(0),
    txCount: integer('tx_count').default(0),
    voidCount: integer('void_count').default(0),
    voidAmount: integer('void_amount').default(0),
    note: text('note'),
    status: text('status', { enum: SessionStatusEnum }).notNull().default('OPEN'),
  },
  (table) => ({
    storeStatusIdx: index('cash_register_sessions_store_id_status_idx').on(table.storeId, table.status),
    singleOpenSessionUnique: uniqueIndex('cash_register_sessions_store_id_open_unique')
      .on(table.storeId)
      .where(sql`${table.status} = 'OPEN'`),
  })
);

// 3. 跨店調撥單 (transfer_orders)
export const transferOrders = sqliteTable(
  'transfer_orders',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    transferNo: text('transfer_no').notNull().unique(),
    sourceStoreId: text('source_store_id').notNull().references(() => stores.id),
    targetStoreId: text('target_store_id').notNull().references(() => stores.id),
    status: text('status', { enum: TransferStatusEnum }).notNull().default('DRAFT'),
    dispatchedAt: text('dispatched_at'),
    receivedAt: text('received_at'),
    dispatchedBy: text('dispatched_by'),
    receivedBy: text('received_by'),
    note: text('note'),
    createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: text('updated_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    sourceStatusIdx: index('transfer_orders_source_store_id_status_idx').on(table.sourceStoreId, table.status),
    targetStatusIdx: index('transfer_orders_target_store_id_status_idx').on(table.targetStoreId, table.status),
  })
);

// 4. 跨店調撥明細 (transfer_order_items)
export const transferOrderItems = sqliteTable(
  'transfer_order_items',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    transferId: text('transfer_id').notNull().references(() => transferOrders.id, { onDelete: 'cascade' }),
    productId: text('product_id').notNull().references(() => products.id),
    requestedQty: integer('requested_qty').notNull(),
    shippedQty: integer('shipped_qty').notNull().default(0),
    receivedQty: integer('received_qty').notNull().default(0),
    remark: text('remark'),
  },
  (table) => ({
    transferProductUnique: uniqueIndex('transfer_order_items_transfer_id_product_id_unique').on(
      table.transferId,
      table.productId
    ),
  })
);

// 5. 會員主檔 (members)
export const members = sqliteTable(
  'members',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    phone: text('phone').notNull().unique(),
    barcode: text('barcode').unique(),
    lineUserId: text('line_user_id').unique(),
    name: text('name').notNull(),
    tier: text('tier').notNull().default('GENERAL'),
    gender: text('gender'),
    birthday: text('birthday'),
    registeredAt: text('registered_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
    points: integer('points').notNull().default(0),
    version: integer('version').notNull().default(0),
    note: text('note'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    totalSpent: integer('total_spent').notNull().default(0),
    orderCount: integer('order_count').notNull().default(0),
    lastPurchaseAt: text('last_purchase_at'),
    createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: text('updated_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    phoneIdx: index('members_phone_idx').on(table.phone),
    lineUserIdIdx: index('members_line_user_id_idx').on(table.lineUserId),
    pointsCheck: check('members_points_check', sql`${table.points} >= 0`),
  })
);

// 6. 點數流水帳 (point_logs)
export const pointLogs = sqliteTable(
  'point_logs',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    memberId: text('member_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
    type: text('type', { enum: PointLogTypeEnum }).notNull(),
    delta: integer('delta').notNull(),
    balance: integer('balance').notNull(),
    orderId: text('order_id').references(() => orders.id, { onDelete: 'set null' }),
    reason: text('reason'),
    operator: text('operator'),
    createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    memberIdIdx: index('point_logs_member_id_idx').on(table.memberId),
  })
);

// 7. 商品分類 (categories)
export const categories = sqliteTable(
  'categories',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull(),
    code: text('code').unique(),
    parentId: text('parent_id').references((): any => categories.id),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: text('updated_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    parentIdIdx: index('categories_parent_id_idx').on(table.parentId),
  })
);

// 8. 商品主檔 (products)
export const products = sqliteTable(
  'products',
  {
    id: text('id').primaryKey(), // 貨號 (如 "1001", "GK-001")
    barcode: text('barcode').unique(),
    name: text('name').notNull(),
    categoryId: text('category_id').references(() => categories.id),
    mainCategory: text('main_category').notNull().default('GK'),
    subCategory: text('sub_category'),
    category: text('category').notNull().default('GENERAL'),
    brand: text('brand'),
    series: text('series'),
    condition: text('condition', { enum: ProductConditionEnum }).notNull().default('NEW'),
    costPrice: integer('cost_price').notNull().default(0),
    allocationCost: integer('allocation_cost').default(0),
    sellingPrice: integer('selling_price').notNull().default(0),
    suggestedPoints: integer('suggested_points').notNull().default(0),
    version: integer('version').notNull().default(0),
    isSpecial: integer('is_special', { mode: 'boolean' }).notNull().default(false),
    remark: text('remark'),
    parentId: text('parent_id').references((): any => products.id),
    createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: text('updated_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    categoryIdx: index('products_category_idx').on(table.category),
    mainCategoryIdx: index('products_main_category_idx').on(table.mainCategory),
    mainSubCategoryIdx: index('products_main_sub_category_idx').on(table.mainCategory, table.subCategory),
    categoryIdIdx: index('products_category_id_idx').on(table.categoryId),
    parentIdIdx: index('products_parent_id_idx').on(table.parentId),
    conditionIdx: index('products_condition_idx').on(table.condition),
    createdAtIdx: index('products_created_at_idx').on(table.createdAt),
  })
);

// 9. 門市在庫庫存 (store_inventories)
// 🚨 核心約束：CHECK (quantity >= 0) 杜絕負庫存破口
export const storeInventories = sqliteTable(
  'store_inventories',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    storeId: text('store_id').notNull().references(() => stores.id),
    productId: text('product_id').notNull().references(() => products.id),
    quantity: integer('quantity').notNull().default(0),
    safetyStock: integer('safety_stock').notNull().default(0),
    version: integer('version').notNull().default(0),
    updatedAt: text('updated_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    storeProductUnique: uniqueIndex('store_inventories_store_id_product_id_unique').on(
      table.storeId,
      table.productId
    ),
    quantityCheck: check('store_inventories_quantity_check', sql`${table.quantity} >= 0`),
  })
);

// 10. 庫存異動流水 (inventory_logs)
export const inventoryLogs = sqliteTable(
  'inventory_logs',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    storeId: text('store_id').notNull().references(() => stores.id),
    productId: text('product_id').notNull().references(() => products.id),
    changeType: text('change_type', { enum: InventoryChangeTypeEnum }).notNull(),
    delta: integer('delta').notNull(),
    balance: integer('balance').notNull(),
    orderId: text('order_id'),
    stocktakeId: text('stocktake_id'),
    operator: text('operator'),
    reason: text('reason'),
    createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    storeProductIdx: index('inventory_logs_store_id_product_id_idx').on(table.storeId, table.productId),
    createdAtIdx: index('inventory_logs_created_at_idx').on(table.createdAt),
  })
);

// 11. 門市實盤主檔 (stocktakes)
export const stocktakes = sqliteTable('stocktakes', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  storeId: text('store_id').notNull().references(() => stores.id),
  status: text('status', { enum: StocktakeStatusEnum }).notNull().default('DRAFT'),
  countedBy: text('counted_by').notNull(),
  postedBy: text('posted_by'),
  postedAt: text('posted_at'),
  note: text('note'),
  createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text('updated_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
});

// 12. 門市實盤明細 (stocktake_items)
export const stocktakeItems = sqliteTable(
  'stocktake_items',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    stocktakeId: text('stocktake_id').notNull().references(() => stocktakes.id, { onDelete: 'cascade' }),
    productId: text('product_id').notNull().references(() => products.id),
    systemQty: integer('system_qty').notNull(),
    actualQty: integer('actual_qty').notNull(),
    variance: integer('variance').notNull(),
    itemRemark: text('item_remark'),
  },
  (table) => ({
    stocktakeProductUnique: uniqueIndex('stocktake_items_stocktake_id_product_id_unique').on(
      table.stocktakeId,
      table.productId
    ),
  })
);

// 13. 一番賞套組 (lucky_bags)
export const luckyBags = sqliteTable('lucky_bags', {
  id: text('id').primaryKey(), // 套組代碼 (如 "LB-01")
  storeId: text('store_id').notNull().references(() => stores.id),
  name: text('name').notNull(),
  unitPrice: integer('unit_price').notNull().default(0),
  isPointsSet: integer('is_points_set', { mode: 'boolean' }).notNull().default(false),
  status: text('status', { enum: LuckyBagStatusEnum }).notNull().default('ACTIVE'),
  createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text('updated_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
});

// 14. 一番賞獎項明細 (lucky_bag_prizes)
// 🚨 核心約束：CHECK (drawn_count <= draws) 杜絕超抽
export const luckyBagPrizes = sqliteTable(
  'lucky_bag_prizes',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    bagId: text('bag_id').notNull().references(() => luckyBags.id, { onDelete: 'cascade' }),
    prizeGrade: text('prize_grade').notNull(), // "A", "B", "X", "Z", "LAST"
    prizeName: text('prize_name').notNull(),
    productId: text('product_id').references(() => products.id, { onDelete: 'set null' }),
    points: integer('points').notNull().default(0),
    draws: integer('draws').notNull().default(1),
    drawnCount: integer('drawn_count').notNull().default(0),
    createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: text('updated_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    bagIdIdx: index('lucky_bag_prizes_bag_id_idx').on(table.bagId),
    drawnCountCheck: check('lucky_bag_prizes_drawn_count_check', sql`${table.drawnCount} <= ${table.draws}`),
  })
);

// 15. 銷售訂單 (orders)
// 🚨 核心約束：checkoutUID UNIQUE 達成原子冪等防重複結帳
export const orders = sqliteTable(
  'orders',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    checkoutUID: text('checkout_uid').notNull(),
    storeId: text('store_id').notNull().references(() => stores.id),
    sessionId: text('session_id').notNull().references(() => cashRegisterSessions.id),
    memberId: text('member_id').references(() => members.id),
    status: text('status', { enum: OrderStatusEnum }).notNull().default('COMPLETED'),
    totalDue: integer('total_due').notNull().default(0),
    receivedAmount: integer('received_amount').notNull().default(0),
    payments: text('payments', { mode: 'json' }).$type<Array<{ method: string; amount: number; ref?: string }>>(),
    discounts: text('discounts', { mode: 'json' }).$type<Array<{ type: string; amount: number; note?: string }>>(),
    cash: integer('cash').notNull().default(0),
    creditCard: integer('credit_card').notNull().default(0),
    linePay: integer('line_pay').notNull().default(0),
    remittance: integer('remittance').notNull().default(0),
    pointsUsed: integer('points_used').notNull().default(0),
    netPointsDelta: integer('net_points_delta').notNull().default(0),
    isWalkin: integer('is_walkin').notNull().default(0),
    cashierEmail: text('cashier_email').notNull(),
    orderNote: text('order_note'),
    voidReason: text('void_reason'),
    voidedAt: text('voided_at'),
    voidedBy: text('voided_by'),
    createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: text('updated_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    storeCreatedAtIdx: index('orders_store_id_created_at_idx').on(table.storeId, table.createdAt),
    sessionIdIdx: index('orders_session_id_idx').on(table.sessionId),
    memberIdIdx: index('orders_member_id_idx').on(table.memberId),
    checkoutUIDUniqueIdx: uniqueIndex('orders_checkout_uid_unique_idx').on(table.checkoutUID),
    walkinPointsCheck: check(
      'orders_walkin_points_check',
      sql`${table.isWalkin} = 0 OR ${table.pointsUsed} = 0`
    ),
  })
);
(orders.checkoutUID as any).isUnique = true;

// 16. 訂單銷售明細 (order_items)
export const orderItems = sqliteTable('order_items', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  orderId: text('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  itemType: text('item_type', { enum: OrderItemTypeEnum }).notNull(),
  bagId: text('bag_id').references(() => luckyBags.id),
  prizeGrade: text('prize_grade'),
  prizeName: text('prize_name'),
  pickType: text('pick_type', { enum: DrawPickTypeEnum }),
  draws: integer('draws').default(1),
  productId: text('product_id').references(() => products.id),
  quantity: integer('quantity').notNull().default(1),
  unitPrice: integer('unit_price').notNull().default(0),
  amount: integer('amount').notNull().default(0),
  pointsImpact: integer('points_impact').notNull().default(0),
  remark: text('remark'),
});

// 17. 系統使用者 (users)
export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  role: text('role', { enum: RoleEnum }).notNull().default('CASHIER'),
  assignedStoreId: text('assigned_store_id'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
});

// 18. 排班記錄 (schedules)
export const schedules = sqliteTable(
  'schedules',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    storeId: text('store_id').notNull().references(() => stores.id),
    date: text('date').notNull(), // "YYYY-MM-DD"
    staffName: text('staff_name').notNull(),
    isClosed: integer('is_closed', { mode: 'boolean' }).notNull().default(false),
  },
  (table) => ({
    storeDateUnique: uniqueIndex('schedules_store_id_date_unique').on(table.storeId, table.date),
  })
);

// 19. 門市員工排班 (shift_schedules)
export const shiftSchedules = sqliteTable(
  'shift_schedules',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    storeId: text('store_id').notNull().references(() => stores.id),
    date: text('date').notNull(),
    staffName: text('staff_name').notNull(),
    staffEmail: text('staff_email'),
    shiftType: text('shift_type').notNull().default('FULL'),
    isClosed: integer('is_closed', { mode: 'boolean' }).notNull().default(false),
    note: text('note'),
    createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: text('updated_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    storeDateUnique: uniqueIndex('shift_schedules_store_id_date_unique').on(table.storeId, table.date),
  })
);

// 20. 打卡快照 (attendances)
export const attendances = sqliteTable('attendances', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  storeId: text('store_id').notNull().references(() => stores.id),
  userEmail: text('user_email').notNull(),
  clockInAt: text('clock_in_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
  clockOutAt: text('clock_out_at'),
  status: text('status').notNull().default('NORMAL'),
});

// 21. 考勤審計明細 (attendance_records)
export const attendanceRecords = sqliteTable(
  'attendance_records',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    storeId: text('store_id').notNull().references(() => stores.id),
    userEmail: text('user_email').notNull(),
    userName: text('user_name'),
    clockInAt: text('clock_in_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
    clockOutAt: text('clock_out_at'),
    status: text('status', { enum: AttendanceStatusEnum }).notNull().default('NORMAL'),
    lateMinutes: integer('late_minutes').notNull().default(0),
    ipAddress: text('ip_address'),
    note: text('note'),
    createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    storeClockInIdx: index('attendance_records_store_id_clock_in_at_idx').on(table.storeId, table.clockInAt),
  })
);

// 22. 外部整合與全域設定 (integration_configs)
export const integrationConfigs = sqliteTable('integration_configs', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  key: text('key').notNull().unique(), // 如 "STORE_BRAND_INFO", "LINE_NOTIFY"
  value: text('value', { mode: 'json' }).notNull(),
  description: text('description'),
  isEnabled: integer('is_enabled', { mode: 'boolean' }).notNull().default(true),
  updatedBy: text('updated_by'),
  updatedAt: text('updated_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
});

// 23. Transactional Outbox (outbox_tasks)
export const outboxTasks = sqliteTable(
  'outbox_tasks',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    taskType: text('task_type', { enum: OutboxTaskTypeEnum }).notNull(),
    payload: text('payload', { mode: 'json' }).notNull(),
    status: text('status', { enum: OutboxStatusEnum }).notNull().default('PENDING'),
    retryCount: integer('retry_count').notNull().default(0),
    maxRetries: integer('max_retries').notNull().default(5),
    lastError: text('last_error'),
    nextRetryAt: text('next_retry_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
    createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
    processedAt: text('processed_at'),
  },
  (table) => ({
    statusRetryIdx: index('outbox_tasks_status_next_retry_at_idx').on(table.status, table.nextRetryAt),
  })
);

// 24. POS 即時廣播緊急公告 (emergency_notices)
export const emergencyNotices = sqliteTable(
  'emergency_notices',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    title: text('title').notNull(),
    content: text('content').notNull(),
    level: text('level', { enum: NoticeLevelEnum }).notNull().default('INFO'),
    targetStoreIds: text('target_store_ids', { mode: 'json' })
      .$type<string[]>()
      .notNull()
      .default(sql`('[]')`),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    version: integer('version').notNull().default(1),
    publisherEmail: text('publisher_email').notNull(),
    publishedAt: text('published_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
    expiresAt: text('expires_at'),
  },
  (table) => ({
    isActiveIdx: index('emergency_notices_is_active_idx').on(table.isActive),
  })
);

// 25. 殘套廢套損益日誌 (void_set_logs)
export const voidSetLogs = sqliteTable('void_set_logs', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  storeId: text('store_id').notNull(),
  bagId: text('bag_id').notNull(),
  bagName: text('bag_name').notNull(),
  unitPrice: integer('unit_price').notNull(),
  totalDraws: integer('total_draws').notNull(),
  drawnCount: integer('drawn_count').notNull(),
  realizedIncome: integer('realized_income').notNull().default(0),
  totalCost: integer('total_cost').notNull().default(0),
  residualValue: integer('residual_value').notNull().default(0),
  netProfitLoss: integer('net_profit_loss').notNull().default(0),
  restoredItems: text('restored_items', { mode: 'json' }),
  isPointsSet: integer('is_points_set', { mode: 'boolean' }).notNull().default(false),
  details: text('details').notNull(),
  operator: text('operator').notNull(),
  createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
});

// 26. 密碼學審計雜湊鏈日誌 (audit_logs)
export const auditLogs = sqliteTable(
  'audit_logs',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    storeId: text('store_id').notNull().references(() => stores.id),
    sequenceNum: integer('sequence_num').notNull(),
    operatorId: text('operator_id').notNull(),
    action: text('action').notNull(),
    targetType: text('target_type').notNull(),
    targetId: text('target_id').notNull(),
    beforeState: text('before_state', { mode: 'json' }),
    afterState: text('after_state', { mode: 'json' }),
    delta: real('delta'),
    reason: text('reason').notNull(),
    ipAddress: text('ip_address'),
    prevHash: text('prev_hash'),
    currentHash: text('current_hash').notNull(),
    createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    storeSequenceUnique: uniqueIndex('audit_logs_store_sequence_unique').on(
      table.storeId,
      table.sequenceNum
    ),
    storePrevHashUnique: uniqueIndex('audit_logs_store_prev_hash_unique').on(
      table.storeId,
      table.prevHash
    ),
    targetIdx: index('audit_logs_target_type_target_id_idx').on(table.targetType, table.targetId),
    operatorIdx: index('audit_logs_operator_id_idx').on(table.operatorId),
    createdAtIdx: index('audit_logs_created_at_idx').on(table.createdAt),
  })
);

// 27. 廠商進貨單 (purchase_orders)
export const purchaseOrders = sqliteTable('purchase_orders', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  orderNo: text('order_no').notNull().unique(),
  title: text('title').notNull(),
  supplier: text('supplier'),
  status: text('status', { enum: PurchaseOrderStatusEnum }).notNull().default('DRAFT'),
  unitPrice: integer('unit_price').notNull().default(0),
  qtyChupei: integer('qty_chupei').notNull().default(0),
  qtyJinshan: integer('qty_jinshan').notNull().default(0),
  totalQty: integer('total_qty').notNull().default(0),
  totalAmount: integer('total_amount').notNull().default(0),
  note: text('note'),
  rawQuote: text('raw_quote'),
  createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text('updated_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
});

// 28. 廠商預購單 (pre_orders)
export const preOrders = sqliteTable(
  'pre_orders',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull(),
    version: text('version'),
    quantity: integer('quantity').notNull().default(1),
    deposit: integer('deposit').notNull().default(0),
    finalPayment: integer('final_payment').notNull().default(0),
    shippingFee: integer('shipping_fee').notNull().default(0),
    totalCost: integer('total_cost').notNull().default(0),
    supplier: text('supplier'),
    targetStoreId: text('target_store_id').references(() => stores.id),
    productId: text('product_id').references(() => products.id),
    status: text('status', { enum: PreOrderStatusEnum }).notNull().default('PENDING'),
    arrivedAt: text('arrived_at'),
    note: text('note'),
    createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: text('updated_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    statusIdx: index('pre_orders_status_idx').on(table.status),
    supplierIdx: index('pre_orders_supplier_idx').on(table.supplier),
    createdAtIdx: index('pre_orders_created_at_idx').on(table.createdAt),
  })
);

// 29. 一番賞配賞方案 (prize_allocation_plans)
export const prizeAllocationPlans = sqliteTable(
  'prize_allocation_plans',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    storeId: text('store_id').notNull().references(() => stores.id),
    name: text('name').notNull(),
    status: text('status').notNull().default('DRAFT'),
    totalDraws: integer('total_draws').notNull(),
    price1: integer('price1').notNull().default(0),
    price3: integer('price3').notNull().default(0),
    price5: integer('price5').notNull().default(0),
    price10: integer('price10').notNull().default(0),
    isTenPlusOne: integer('is_ten_plus_one', { mode: 'boolean' }).notNull().default(false),
    targetMargin: real('target_margin').notNull().default(0),
    items: text('items', { mode: 'json' }).notNull(),
    createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: text('updated_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    storeStatusIdx: index('prize_allocation_plans_store_id_status_idx').on(table.storeId, table.status),
  })
);

// 30. 關帳哨兵防重入表 (session_closures)
export const sessionClosures = sqliteTable('session_closures', {
  sessionId: text('session_id').primaryKey().references(() => cashRegisterSessions.id),
  closedAt: text('closed_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
  closedBy: text('closed_by').notNull(),
});

// 31. 作廢哨兵防重入表 (order_voids)
export const orderVoids = sqliteTable('order_voids', {
  orderId: text('order_id').primaryKey().references(() => orders.id),
  voidedAt: text('voided_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
  operator: text('operator').notNull(),
  reason: text('reason').notNull(),
});
