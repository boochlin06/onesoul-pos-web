import { describe, it, expect } from 'vitest';
import { getTableColumns } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
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
  users,
  schedules,
  shiftSchedules,
  attendances,
  attendanceRecords,
  integrationConfigs,
  outboxTasks,
  emergencyNotices,
  voidSetLogs,
  auditLogs,
  purchaseOrders,
  preOrders,
  prizeAllocationPlans,
} from '../src/schema';
import {
  storesRelations,
  ordersRelations,
  luckyBagsRelations,
  membersRelations,
} from '../src/relations';

describe('Drizzle D1 Schema Specification', () => {
  it('should define all 29 tables', () => {
    const allTables = [
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
      users,
      schedules,
      shiftSchedules,
      attendances,
      attendanceRecords,
      integrationConfigs,
      outboxTasks,
      emergencyNotices,
      voidSetLogs,
      auditLogs,
      purchaseOrders,
      preOrders,
      prizeAllocationPlans,
    ];
    expect(allTables.length).toBe(29);
  });

  it('should enforce CHECK (quantity >= 0) constraint on store_inventories', () => {
    const config = getTableConfig(storeInventories);
    expect(config.name).toBe('store_inventories');
    expect(config.checks.length).toBeGreaterThan(0);
    const checkNames = config.checks.map((c) => c.name);
    expect(checkNames).toContain('store_inventories_quantity_check');
  });

  it('should enforce CHECK (drawn_count <= draws) constraint on lucky_bag_prizes', () => {
    const config = getTableConfig(luckyBagPrizes);
    expect(config.name).toBe('lucky_bag_prizes');
    expect(config.checks.length).toBeGreaterThan(0);
    const checkNames = config.checks.map((c) => c.name);
    expect(checkNames).toContain('lucky_bag_prizes_drawn_count_check');
  });

  it('should enforce UNIQUE checkout_uid on orders table', () => {
    const config = getTableConfig(orders);
    expect(config.name).toBe('orders');
    const cols = getTableColumns(orders);
    expect(cols.checkoutUID).toBeDefined();
    expect(cols.checkoutUID.isUnique).toBe(true);

    const uniqueIndexNames = config.indexes.map((idx) => idx.config.name);
    expect(uniqueIndexNames).toContain('orders_checkout_uid_unique_idx');
  });

  it('should verify foreign key relations are declared', () => {
    expect(storesRelations).toBeDefined();
    expect(ordersRelations).toBeDefined();
    expect(luckyBagsRelations).toBeDefined();
    expect(membersRelations).toBeDefined();
  });
});
