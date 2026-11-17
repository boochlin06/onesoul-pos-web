import { relations } from 'drizzle-orm';
import {
  stores,
  cashRegisterSessions,
  transferOrders,
  transferOrderItems,
  members,
  pointLogs,
  categories,
  products,
  storeInventories,
  inventoryLogs,
  stocktakes,
  stocktakeItems,
  luckyBags,
  luckyBagPrizes,
  orders,
  orderItems,
  schedules,
  shiftSchedules,
  attendances,
  attendanceRecords,
  preOrders,
  prizeAllocationPlans,
} from './schema/tables';

export const storesRelations = relations(stores, ({ many }) => ({
  inventories: many(storeInventories),
  inventoryLogs: many(inventoryLogs),
  stocktakes: many(stocktakes),
  sessions: many(cashRegisterSessions),
  orders: many(orders),
  luckyBags: many(luckyBags),
  attendances: many(attendances),
  schedules: many(schedules),
  shiftSchedules: many(shiftSchedules),
  attendanceRecords: many(attendanceRecords),
  transfersOut: many(transferOrders, { relationName: 'SourceStore' }),
  transfersIn: many(transferOrders, { relationName: 'TargetStore' }),
  allocationPlans: many(prizeAllocationPlans),
  preOrders: many(preOrders),
}));

export const cashRegisterSessionsRelations = relations(cashRegisterSessions, ({ one, many }) => ({
  store: one(stores, { fields: [cashRegisterSessions.storeId], references: [stores.id] }),
  orders: many(orders),
}));

export const transferOrdersRelations = relations(transferOrders, ({ one, many }) => ({
  sourceStore: one(stores, { fields: [transferOrders.sourceStoreId], references: [stores.id], relationName: 'SourceStore' }),
  targetStore: one(stores, { fields: [transferOrders.targetStoreId], references: [stores.id], relationName: 'TargetStore' }),
  items: many(transferOrderItems),
}));

export const transferOrderItemsRelations = relations(transferOrderItems, ({ one }) => ({
  transfer: one(transferOrders, { fields: [transferOrderItems.transferId], references: [transferOrders.id] }),
  product: one(products, { fields: [transferOrderItems.productId], references: [products.id] }),
}));

export const membersRelations = relations(members, ({ many }) => ({
  pointLogs: many(pointLogs),
  orders: many(orders),
}));

export const pointLogsRelations = relations(pointLogs, ({ one }) => ({
  member: one(members, { fields: [pointLogs.memberId], references: [members.id] }),
  order: one(orders, { fields: [pointLogs.orderId], references: [orders.id] }),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, { fields: [categories.parentId], references: [categories.id], relationName: 'CategoryHierarchy' }),
  children: many(categories, { relationName: 'CategoryHierarchy' }),
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  categoryRel: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  parentProduct: one(products, { fields: [products.parentId], references: [products.id], relationName: 'ProductVariants' }),
  variants: many(products, { relationName: 'ProductVariants' }),
  storeInventories: many(storeInventories),
  inventoryLogs: many(inventoryLogs),
  stocktakeItems: many(stocktakeItems),
  orderItems: many(orderItems),
  luckyBagPrizes: many(luckyBagPrizes),
  transferItems: many(transferOrderItems),
  preOrders: many(preOrders),
}));

export const storeInventoriesRelations = relations(storeInventories, ({ one }) => ({
  store: one(stores, { fields: [storeInventories.storeId], references: [stores.id] }),
  product: one(products, { fields: [storeInventories.productId], references: [products.id] }),
}));

export const inventoryLogsRelations = relations(inventoryLogs, ({ one }) => ({
  store: one(stores, { fields: [inventoryLogs.storeId], references: [stores.id] }),
  product: one(products, { fields: [inventoryLogs.productId], references: [products.id] }),
}));

export const stocktakesRelations = relations(stocktakes, ({ one, many }) => ({
  store: one(stores, { fields: [stocktakes.storeId], references: [stores.id] }),
  items: many(stocktakeItems),
}));

export const stocktakeItemsRelations = relations(stocktakeItems, ({ one }) => ({
  stocktake: one(stocktakes, { fields: [stocktakeItems.stocktakeId], references: [stocktakes.id] }),
  product: one(products, { fields: [stocktakeItems.productId], references: [products.id] }),
}));

export const luckyBagsRelations = relations(luckyBags, ({ one, many }) => ({
  store: one(stores, { fields: [luckyBags.storeId], references: [stores.id] }),
  prizes: many(luckyBagPrizes),
  orderItems: many(orderItems),
}));

export const luckyBagPrizesRelations = relations(luckyBagPrizes, ({ one }) => ({
  bag: one(luckyBags, { fields: [luckyBagPrizes.bagId], references: [luckyBags.id] }),
  product: one(products, { fields: [luckyBagPrizes.productId], references: [products.id] }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  store: one(stores, { fields: [orders.storeId], references: [stores.id] }),
  session: one(cashRegisterSessions, { fields: [orders.sessionId], references: [cashRegisterSessions.id] }),
  member: one(members, { fields: [orders.memberId], references: [members.id] }),
  items: many(orderItems),
  pointLogs: many(pointLogs),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  luckyBag: one(luckyBags, { fields: [orderItems.bagId], references: [luckyBags.id] }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] }),
}));

export const schedulesRelations = relations(schedules, ({ one }) => ({
  store: one(stores, { fields: [schedules.storeId], references: [stores.id] }),
}));

export const shiftSchedulesRelations = relations(shiftSchedules, ({ one }) => ({
  store: one(stores, { fields: [shiftSchedules.storeId], references: [stores.id] }),
}));

export const attendancesRelations = relations(attendances, ({ one }) => ({
  store: one(stores, { fields: [attendances.storeId], references: [stores.id] }),
}));

export const attendanceRecordsRelations = relations(attendanceRecords, ({ one }) => ({
  store: one(stores, { fields: [attendanceRecords.storeId], references: [stores.id] }),
}));

export const preOrdersRelations = relations(preOrders, ({ one }) => ({
  product: one(products, { fields: [preOrders.productId], references: [products.id] }),
  targetStore: one(stores, { fields: [preOrders.targetStoreId], references: [stores.id] }),
}));

export const prizeAllocationPlansRelations = relations(prizeAllocationPlans, ({ one }) => ({
  store: one(stores, { fields: [prizeAllocationPlans.storeId], references: [stores.id] }),
}));
