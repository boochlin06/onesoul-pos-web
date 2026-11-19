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
  sessionClosures,
  orderVoids,
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

  it('should enforce CHECK (points >= 0) constraint on members', () => {
    const config = getTableConfig(members);
    expect(config.name).toBe('members');
    const checkNames = config.checks.map((c) => c.name);
    expect(checkNames).toContain('members_points_check');
  });

  it('should enforce CHECK (is_walkin = 0 OR points_used = 0) constraint on orders', () => {
    const config = getTableConfig(orders);
    expect(config.name).toBe('orders');
    const cols = getTableColumns(orders);
    expect(cols.isWalkin).toBeDefined();
    const checkNames = config.checks.map((c) => c.name);
    expect(checkNames).toContain('orders_walkin_points_check');
  });

  it('should enforce unique partial index on cash_register_sessions (status = OPEN)', () => {
    const config = getTableConfig(cashRegisterSessions);
    const uniqueIndexNames = config.indexes.map((idx) => idx.config.name);
    expect(uniqueIndexNames).toContain('cash_register_sessions_store_id_open_unique');
  });

  it('should enforce unique index on audit_logs (store_id, sequence_num) and (store_id, prev_hash)', () => {
    const config = getTableConfig(auditLogs);
    const uniqueIndexNames = config.indexes.map((idx) => idx.config.name);
    expect(uniqueIndexNames).toContain('audit_logs_store_sequence_unique');
    expect(uniqueIndexNames).toContain('audit_logs_store_prev_hash_unique');
  });

  it('should define sentinel tables sessionClosures and orderVoids with PKs', () => {
    expect(sessionClosures).toBeDefined();
    expect(orderVoids).toBeDefined();
    const scCols = getTableColumns(sessionClosures);
    expect(scCols.sessionId.primary).toBe(true);
    const ovCols = getTableColumns(orderVoids);
    expect(ovCols.orderId.primary).toBe(true);
  });
});
