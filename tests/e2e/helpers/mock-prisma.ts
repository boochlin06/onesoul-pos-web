import { vi } from 'vitest';
import { TestStoreState, createInitialTestStore } from './test-store';
import crypto from 'crypto';

export class MockPrismaEngine {
  public store: TestStoreState;

  constructor() {
    this.store = createInitialTestStore();
  }

  public reset(customStore?: TestStoreState) {
    this.store = customStore || createInitialTestStore();
  }

  private deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj, (key, value) => {
      if (value instanceof Date) return value.toISOString();
      return value;
    }));
  }

  public createClient(): any {
    const self = this;

    const client = {
      _isMemory: true,
      store: {
        findMany: vi.fn(async () => self.store.stores),
        findUnique: vi.fn(async ({ where }: any) => self.store.stores.find((s) => s.id === where.id) || null),
        findFirst: vi.fn(async ({ where }: any) => self.store.stores.find((s) => !where || s.id === where.id) || null),
      },
      member: {
        findMany: vi.fn(async ({ where, orderBy, take, skip }: any = {}) => {
          let list = [...self.store.members];
          if (where?.q) {
            const query = where.q.toLowerCase();
            list = list.filter((m) => m.name.toLowerCase().includes(query) || m.phone.includes(query));
          }
          if (skip) list = list.slice(skip);
          if (take) list = list.slice(0, take);
          return list;
        }),
        findFirst: vi.fn(async ({ where }: any) => {
          if (!where) return self.store.members[0] || null;
          if (where.OR) {
            return self.store.members.find((m) => where.OR.some((cond: any) => cond.phone === m.phone || cond.id === m.id)) || null;
          }
          if (where.phone) {
            return self.store.members.find((m) => m.phone === where.phone) || null;
          }
          if (where.id) {
            return self.store.members.find((m) => m.id === where.id) || null;
          }
          return null;
        }),
        findUnique: vi.fn(async ({ where }: any) => {
          if (where.phone) return self.store.members.find((m) => m.phone === where.phone) || null;
          if (where.id) return self.store.members.find((m) => m.id === where.id) || null;
          return null;
        }),
        create: vi.fn(async ({ data }: any) => {
          const created = {
            id: data.id || `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            points: 0,
            ...data,
            registeredAt: data.registeredAt || new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          self.store.members.push(created);
          return created;
        }),
        update: vi.fn(async ({ where, data }: any) => {
          const m = self.store.members.find((it) => it.id === where.id || (where.phone && it.phone === where.phone));
          if (!m) throw new Error(`Member not found for update`);
          if (data.points && typeof data.points === 'object') {
            if ('increment' in data.points) m.points += data.points.increment;
            else if ('decrement' in data.points) m.points -= data.points.decrement;
          } else if (typeof data.points === 'number') {
            m.points = data.points;
          }
          Object.assign(m, { ...data, points: m.points, updatedAt: new Date() });
          return m;
        }),
      },
      cashRegisterSession: {
        findMany: vi.fn(async ({ where, orderBy }: any = {}) => {
          let list = [...self.store.sessions];
          if (where?.storeId) list = list.filter((s) => s.storeId === where.storeId);
          if (where?.status) list = list.filter((s) => s.status === where.status);
          return list;
        }),
        findFirst: vi.fn(async ({ where, orderBy }: any = {}) => {
          return self.store.sessions.find((s) => {
            if (where?.storeId && s.storeId !== where.storeId) return false;
            if (where?.status && s.status !== where.status) return false;
            return true;
          }) || null;
        }),
        findUnique: vi.fn(async ({ where }: any) => {
          return self.store.sessions.find((s) => s.id === where.id) || null;
        }),
        create: vi.fn(async ({ data }: any) => {
          const s = {
            id: data.id || `sess-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            ...data,
            orders: [],
            openedAt: new Date(),
          };
          self.store.sessions.push(s);
          return s;
        }),
        update: vi.fn(async ({ where, data }: any) => {
          const s = self.store.sessions.find((it) => it.id === where.id);
          if (!s) throw new Error(`Session not found for update`);
          Object.assign(s, data);
          return s;
        }),
      },
      product: {
        findMany: vi.fn(async ({ where, select }: any = {}) => {
          let list = [...self.store.products];
          if (where?.id) {
            if (where.id.in) list = list.filter((p) => where.id.in.includes(p.id));
            else list = list.filter((p) => p.id === where.id);
          }
          if (where?.category) list = list.filter((p) => p.category === where.category);
          if (select) {
            return list.map((p) => {
              const res: any = {};
              for (const k of Object.keys(select)) if (select[k]) res[k] = (p as any)[k];
              return res;
            });
          }
          return list;
        }),
        findUnique: vi.fn(async ({ where }: any) => {
          return self.store.products.find((p) => p.id === where.id) || null;
        }),
        create: vi.fn(async ({ data }: any) => {
          const p = {
            id: data.id || `prod-${Date.now()}`,
            version: 0,
            ...data,
          };
          self.store.products.push(p);
          return p;
        }),
        update: vi.fn(async ({ where, data }: any) => {
          const p = self.store.products.find((it) => it.id === where.id);
          if (!p) throw new Error(`Product not found for update`);
          if (data.version !== undefined && typeof data.version === 'object' && 'increment' in data.version) {
            p.version = (p.version || 0) + 1;
            delete data.version;
          }
          Object.assign(p, data);
          return p;
        }),
      },
      storeInventory: {
        findMany: vi.fn(async ({ where, include, orderBy }: any = {}) => {
          let list = [...self.store.inventories];
          if (where?.storeId) list = list.filter((inv) => inv.storeId === where.storeId);
          if (where?.productId) {
            if (where.productId.in) list = list.filter((inv) => where.productId.in.includes(inv.productId));
            else list = list.filter((inv) => inv.productId === where.productId);
          }
          if (where?.quantity?.gte !== undefined) list = list.filter((inv) => inv.quantity >= where.quantity.gte);
          return list.map((inv) => ({
            ...inv,
            product: self.store.products.find((p) => p.id === inv.productId) || { name: 'Unknown', category: 'GENERAL', suggestedPoints: 0 },
            store: self.store.stores.find((s) => s.id === inv.storeId) || { name: '竹北店' },
          }));
        }),
        findUnique: vi.fn(async ({ where }: any) => {
          let inv: any = null;
          if (where.id) {
            inv = self.store.inventories.find((it) => it.id === where.id);
          } else if (where.storeId_productId) {
            inv = self.store.inventories.find(
              (it) => it.storeId === where.storeId_productId.storeId && it.productId === where.storeId_productId.productId
            );
          }
          if (!inv) return null;
          return {
            ...inv,
            product: self.store.products.find((p) => p.id === inv.productId) || { name: 'Unknown', category: 'GENERAL', suggestedPoints: 0 },
            store: self.store.stores.find((s) => s.id === inv.storeId) || { name: '竹北店' },
          };
        }),
        create: vi.fn(async ({ data }: any) => {
          const inv = {
            id: data.id || `inv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            version: 0,
            ...data,
          };
          self.store.inventories.push(inv);
          return inv;
        }),
        update: vi.fn(async ({ where, data }: any) => {
          let inv = where.id
            ? self.store.inventories.find((it) => it.id === where.id)
            : self.store.inventories.find((it) => it.storeId === where.storeId_productId?.storeId && it.productId === where.storeId_productId?.productId);
          if (!inv) throw new Error(`StoreInventory not found for update`);
          if (data.quantity && typeof data.quantity === 'object') {
            if ('increment' in data.quantity) inv.quantity += data.quantity.increment;
            else if ('decrement' in data.quantity) inv.quantity -= data.quantity.decrement;
          } else if (typeof data.quantity === 'number') {
            inv.quantity = data.quantity;
          }
          if (data.version && typeof data.version === 'object' && 'increment' in data.version) {
            inv.version = (inv.version || 0) + 1;
            delete data.version;
          }
          Object.assign(inv, { ...data, quantity: inv.quantity });
          return inv;
        }),
        upsert: vi.fn(async ({ where, create, update }: any) => {
          let inv = self.store.inventories.find(
            (it) => it.storeId === where.storeId_productId.storeId && it.productId === where.storeId_productId.productId
          );
          if (inv) {
            if (update.quantity && typeof update.quantity === 'object' && 'increment' in update.quantity) {
              inv.quantity += update.quantity.increment;
            } else if (typeof update.quantity === 'number') {
              inv.quantity = update.quantity;
            }
            Object.assign(inv, update);
            return inv;
          }
          inv = {
            id: create.id || `inv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            version: 0,
            ...create,
          };
          self.store.inventories.push(inv);
          return inv;
        }),
      },
      luckyBag: {
        findMany: vi.fn(async ({ where, orderBy }: any = {}) => {
          let list = [...self.store.luckyBags];
          if (where?.storeId) list = list.filter((b) => b.storeId === where.storeId);
          if (where?.status) list = list.filter((b) => b.status === where.status);
          return list.map((b) => ({
            ...b,
            prizes: self.store.luckyBagPrizes.filter((p) => p.bagId === b.id),
            store: self.store.stores.find((s) => s.id === b.storeId) || { name: '竹北店' },
          }));
        }),
        findUnique: vi.fn(async ({ where }: any) => {
          const b = self.store.luckyBags.find((it) => it.id === where.id);
          if (!b) return null;
          return {
            ...b,
            prizes: self.store.luckyBagPrizes.filter((p) => p.bagId === b.id),
            store: self.store.stores.find((s) => s.id === b.storeId) || { name: '竹北店' },
          };
        }),
        create: vi.fn(async ({ data }: any) => {
          const b = {
            id: data.id || `LB-${Date.now()}`,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          self.store.luckyBags.push(b);
          return b;
        }),
        update: vi.fn(async ({ where, data }: any) => {
          const b = self.store.luckyBags.find((it) => it.id === where.id);
          if (!b) throw new Error(`LuckyBag not found for update`);
          Object.assign(b, { ...data, updatedAt: new Date() });
          return b;
        }),
      },
      luckyBagPrize: {
        findMany: vi.fn(async ({ where }: any = {}) => {
          let list = [...self.store.luckyBagPrizes];
          if (where?.bagId) {
            if (where.bagId.in) list = list.filter((p) => where.bagId.in.includes(p.bagId));
            else list = list.filter((p) => p.bagId === where.bagId);
          }
          if (where?.productId) {
            if (typeof where.productId === 'object' && 'not' in where.productId) {
              if (where.productId.not === null) list = list.filter((p) => p.productId !== null && p.productId !== undefined);
              else list = list.filter((p) => p.productId !== where.productId.not);
            } else if (where.productId.in) {
              list = list.filter((p) => where.productId.in.includes(p.productId));
            } else {
              list = list.filter((p) => p.productId === where.productId);
            }
          }
          return list;
        }),
        findFirst: vi.fn(async ({ where }: any) => {
          return self.store.luckyBagPrizes.find((p) => {
            if (where.bagId && p.bagId !== where.bagId) return false;
            if (where.prizeGrade) {
              const targetGrade = typeof where.prizeGrade === 'object' && where.prizeGrade.equals
                ? where.prizeGrade.equals
                : where.prizeGrade;
              if (p.prizeGrade.toLowerCase() !== String(targetGrade).toLowerCase()) return false;
            }
            return true;
          }) || null;
        }),
        create: vi.fn(async ({ data }: any) => {
          const p = {
            id: data.id || `lbp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            drawnCount: 0,
            ...data,
            updatedAt: new Date(),
          };
          self.store.luckyBagPrizes.push(p);
          return p;
        }),
        createMany: vi.fn(async ({ data }: any) => {
          const list = Array.isArray(data) ? data : [data];
          list.forEach((item) => {
            self.store.luckyBagPrizes.push({
              id: item.id || `lbp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              drawnCount: 0,
              ...item,
              updatedAt: new Date(),
            });
          });
          return { count: list.length };
        }),
        update: vi.fn(async ({ where, data }: any) => {
          const p = self.store.luckyBagPrizes.find((it) => it.id === where.id);
          if (!p) throw new Error(`LuckyBagPrize not found for update`);
          if (data.drawnCount && typeof data.drawnCount === 'object') {
            if ('increment' in data.drawnCount) p.drawnCount += data.drawnCount.increment;
            else if ('decrement' in data.drawnCount) p.drawnCount -= data.drawnCount.decrement;
          } else if (typeof data.drawnCount === 'number') {
            p.drawnCount = data.drawnCount;
          }
          Object.assign(p, { ...data, drawnCount: p.drawnCount, updatedAt: new Date() });
          return p;
        }),
        updateMany: vi.fn(async ({ where, data }: any) => {
          const targets = self.store.luckyBagPrizes.filter((p) => {
            if (where.bagId && p.bagId !== where.bagId) return false;
            if (where.prizeGrade) {
              const targetGrade = typeof where.prizeGrade === 'object' && where.prizeGrade.equals
                ? where.prizeGrade.equals
                : where.prizeGrade;
              if (p.prizeGrade.toLowerCase() !== String(targetGrade).toLowerCase()) return false;
            }
            return true;
          });
          targets.forEach((p) => {
            if (data.drawnCount && typeof data.drawnCount === 'object') {
              if ('increment' in data.drawnCount) p.drawnCount += data.drawnCount.increment;
              else if ('decrement' in data.drawnCount) p.drawnCount -= data.drawnCount.decrement;
            } else if (typeof data.drawnCount === 'number') {
              p.drawnCount = data.drawnCount;
            }
            Object.assign(p, { ...data, drawnCount: p.drawnCount, updatedAt: new Date() });
          });
          return { count: targets.length };
        }),
      },
      order: {
        findMany: vi.fn(async ({ where, orderBy }: any = {}) => {
          let list = [...self.store.orders];
          if (where?.sessionId) list = list.filter((o) => o.sessionId === where.sessionId);
          if (where?.storeId) list = list.filter((o) => o.storeId === where.storeId);
          if (where?.memberId) list = list.filter((o) => o.memberId === where.memberId);
          if (where?.status) list = list.filter((o) => o.status === where.status);
          if (where?.createdAt?.gte) {
            const gte = new Date(where.createdAt.gte).getTime();
            list = list.filter((o) => new Date(o.createdAt).getTime() >= gte);
          }
          return list.map((o) => ({
            ...o,
            member: self.store.members.find((m) => m.id === o.memberId) || null,
            store: self.store.stores.find((s) => s.id === o.storeId) || { name: '竹北店' },
            items: self.store.orderItems.filter((it) => it.orderId === o.id),
          }));
        }),
        findUnique: vi.fn(async ({ where }: any) => {
          const o = self.store.orders.find((it) => (where.checkoutUID && it.checkoutUID === where.checkoutUID) || (where.id && it.id === where.id));
          if (!o) return null;
          return {
            ...o,
            member: self.store.members.find((m) => m.id === o.memberId) || null,
            store: self.store.stores.find((s) => s.id === o.storeId) || { name: '竹北店' },
            items: self.store.orderItems.filter((it) => it.orderId === o.id),
          };
        }),
        create: vi.fn(async ({ data }: any) => {
          const o = {
            id: data.id || `ord-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            status: 'COMPLETED',
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          self.store.orders.push(o);
          return o;
        }),
        update: vi.fn(async ({ where, data }: any) => {
          const o = self.store.orders.find((it) => (where.checkoutUID && it.checkoutUID === where.checkoutUID) || (where.id && it.id === where.id));
          if (!o) throw new Error(`Order not found for update`);
          Object.assign(o, { ...data, updatedAt: new Date() });
          return o;
        }),
      },
      orderItem: {
        create: vi.fn(async ({ data }: any) => {
          const item = {
            id: data.id || `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            ...data,
          };
          self.store.orderItems.push(item);
          return item;
        }),
        findMany: vi.fn(async ({ where }: any = {}) => {
          let list = [...self.store.orderItems];
          if (where?.orderId) list = list.filter((it) => it.orderId === where.orderId);
          return list;
        }),
      },
      pointLog: {
        create: vi.fn(async ({ data }: any) => {
          const log = {
            id: data.id || `pt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            ...data,
            createdAt: new Date(),
          };
          self.store.pointLogs.push(log);
          return log;
        }),
        findMany: vi.fn(async ({ where, orderBy }: any = {}) => {
          let list = [...self.store.pointLogs];
          if (where?.memberId) list = list.filter((l) => l.memberId === where.memberId);
          return list;
        }),
      },
      inventoryLog: {
        create: vi.fn(async ({ data }: any) => {
          const log = {
            id: data.id || `invlog-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            ...data,
            createdAt: new Date(),
          };
          self.store.inventoryLogs.push(log);
          return log;
        }),
        findMany: vi.fn(async ({ where, orderBy }: any = {}) => {
          let list = [...self.store.inventoryLogs];
          if (where?.storeId) list = list.filter((l) => l.storeId === where.storeId);
          if (where?.productId) list = list.filter((l) => l.productId === where.productId);
          return list;
        }),
      },
      stocktake: {
        findMany: vi.fn(async ({ where, orderBy }: any = {}) => {
          let list = [...self.store.stocktakes];
          if (where?.storeId) list = list.filter((s) => s.storeId === where.storeId);
          if (where?.status) list = list.filter((s) => s.status === where.status);
          return list.map((s) => ({
            ...s,
            items: self.store.stocktakeItems.filter((it) => it.stocktakeId === s.id),
          }));
        }),
        findUnique: vi.fn(async ({ where, include }: any) => {
          const s = self.store.stocktakes.find((it) => it.id === where.id);
          if (!s) return null;
          return {
            ...s,
            items: self.store.stocktakeItems.filter((it) => it.stocktakeId === s.id),
          };
        }),
        create: vi.fn(async ({ data }: any) => {
          const s = {
            id: data.id || `st-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            status: 'DRAFT',
            ...data,
            createdAt: new Date(),
          };
          self.store.stocktakes.push(s);
          return s;
        }),
        update: vi.fn(async ({ where, data }: any) => {
          const s = self.store.stocktakes.find((it) => it.id === where.id);
          if (!s) throw new Error(`Stocktake not found for update`);
          Object.assign(s, data);
          return s;
        }),
      },
      stocktakeItem: {
        create: vi.fn(async ({ data }: any) => {
          const item = {
            id: data.id || `sti-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            ...data,
          };
          self.store.stocktakeItems.push(item);
          return item;
        }),
        findMany: vi.fn(async ({ where }: any = {}) => {
          let list = [...self.store.stocktakeItems];
          if (where?.stocktakeId) list = list.filter((it) => it.stocktakeId === where.stocktakeId);
          return list;
        }),
      },
      preOrder: {
        findMany: vi.fn(async ({ where, orderBy }: any = {}) => {
          let list = [...self.store.preOrders];
          if (where?.status && where.status !== 'ALL') list = list.filter((po) => po.status === where.status);
          if (where?.supplier) list = list.filter((po) => po.supplier === where.supplier);
          if (where?.q) {
            const query = where.q.toLowerCase();
            list = list.filter((po) => po.name.toLowerCase().includes(query) || (po.supplier && po.supplier.toLowerCase().includes(query)));
          }
          return list;
        }),
        findUnique: vi.fn(async ({ where }: any) => {
          return self.store.preOrders.find((po) => po.id === where.id) || null;
        }),
        findFirst: vi.fn(async ({ where }: any) => {
          return self.store.preOrders.find((po) => {
            if (where.id && po.id !== where.id) return false;
            if (where.status && po.status !== where.status) return false;
            return true;
          }) || null;
        }),
        create: vi.fn(async ({ data }: any) => {
          const po = {
            id: data.id || `po-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            status: 'PENDING',
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          self.store.preOrders.push(po);
          return po;
        }),
        update: vi.fn(async ({ where, data }: any) => {
          const po = self.store.preOrders.find((it) => {
            if (where.id && it.id !== where.id) return false;
            if (where.status && it.status !== where.status) return false;
            return true;
          });
          if (!po) throw new Error(`PreOrder not found or conditions not met`);
          Object.assign(po, { ...data, updatedAt: new Date() });
          return po;
        }),
        updateMany: vi.fn(async ({ where, data }: any) => {
          const targets = self.store.preOrders.filter((it) => {
            if (where.id && it.id !== where.id) return false;
            if (where.status && it.status !== where.status) return false;
            return true;
          });
          targets.forEach((po) => {
            Object.assign(po, { ...data, updatedAt: new Date() });
          });
          return { count: targets.length };
        }),
      },
      auditLog: {
        findMany: vi.fn(async ({ where, orderBy, take, skip }: any = {}) => {
          let list = [...self.store.auditLogs];
          if (orderBy?.createdAt === 'desc') {
            list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          }
          if (where?.targetType) list = list.filter((l) => l.targetType === where.targetType);
          if (where?.targetId) list = list.filter((l) => l.targetId === where.targetId);
          if (where?.operatorId) list = list.filter((l) => l.operatorId === where.operatorId);
          if (skip) list = list.slice(skip);
          if (take) list = list.slice(0, take);
          return list;
        }),
        create: vi.fn(async ({ data }: any) => {
          const now = Date.now();
          const baseTime = self.store.auditLogs.length > 0
            ? Math.max(now, new Date(self.store.auditLogs[self.store.auditLogs.length - 1].createdAt).getTime() + 10)
            : now;
          const log = {
            id: data.id || `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            ...data,
            createdAt: new Date(baseTime),
          };
          self.store.auditLogs.push(log);
          return log;
        }),
      },
      transferOrder: {
        findMany: vi.fn(async ({ where }: any = {}) => {
          let list = [...self.store.transferOrders];
          if (where?.sourceStoreId) list = list.filter((t) => t.sourceStoreId === where.sourceStoreId);
          if (where?.targetStoreId) list = list.filter((t) => t.targetStoreId === where.targetStoreId);
          if (where?.status) list = list.filter((t) => t.status === where.status);
          return list.map((t) => ({
            ...t,
            items: self.store.transferOrderItems.filter((it) => it.transferId === t.id),
          }));
        }),
        findUnique: vi.fn(async ({ where }: any) => {
          const t = self.store.transferOrders.find((it) => it.id === where.id || it.transferNo === where.transferNo);
          if (!t) return null;
          return {
            ...t,
            items: self.store.transferOrderItems.filter((it) => it.transferId === t.id),
          };
        }),
        create: vi.fn(async ({ data }: any) => {
          const t = {
            id: data.id || `tr-${Date.now()}`,
            transferNo: data.transferNo || `TR-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
            status: data.status || 'DRAFT',
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          self.store.transferOrders.push(t);
          return t;
        }),
        update: vi.fn(async ({ where, data }: any) => {
          const t = self.store.transferOrders.find((it) => it.id === where.id);
          if (!t) throw new Error(`TransferOrder not found`);
          Object.assign(t, { ...data, updatedAt: new Date() });
          return t;
        }),
      },
      transferOrderItem: {
        create: vi.fn(async ({ data }: any) => {
          const item = {
            id: data.id || `tri-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            ...data,
          };
          self.store.transferOrderItems.push(item);
          return item;
        }),
        findMany: vi.fn(async ({ where }: any = {}) => {
          let list = [...self.store.transferOrderItems];
          if (where?.transferId) list = list.filter((it) => it.transferId === where.transferId);
          return list;
        }),
      },
      integrationConfig: {
        findUnique: vi.fn(async ({ where }: any) => {
          return self.store.integrationConfigs.find((c) => c.key === where.key) || null;
        }),
        upsert: vi.fn(async ({ where, create, update }: any) => {
          let cfg = self.store.integrationConfigs.find((c) => c.key === where.key);
          if (cfg) {
            Object.assign(cfg, update);
            return cfg;
          }
          cfg = { id: `cfg-${Date.now()}`, ...create };
          self.store.integrationConfigs.push(cfg);
          return cfg;
        }),
      },
      prizeAllocationPlan: {
        findMany: vi.fn(async ({ where }: any = {}) => {
          let list = [...self.store.allocationPlans];
          if (where?.storeId) list = list.filter((p) => p.storeId === where.storeId);
          if (where?.status) list = list.filter((p) => p.status === where.status);
          return list;
        }),
        findUnique: vi.fn(async ({ where }: any) => {
          return self.store.allocationPlans.find((p) => p.id === where.id) || null;
        }),
        create: vi.fn(async ({ data }: any) => {
          const plan = {
            id: data.id || `plan-${Date.now()}`,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          self.store.allocationPlans.push(plan);
          return plan;
        }),
        update: vi.fn(async ({ where, data }: any) => {
          const p = self.store.allocationPlans.find((it) => it.id === where.id);
          if (!p) throw new Error(`Plan not found`);
          Object.assign(p, { ...data, updatedAt: new Date() });
          return p;
        }),
        delete: vi.fn(async ({ where }: any) => {
          const idx = self.store.allocationPlans.findIndex((it) => it.id === where.id);
          if (idx !== -1) {
            const removed = self.store.allocationPlans.splice(idx, 1)[0];
            return removed;
          }
          return null;
        }),
      },
      voidSetLog: {
        create: vi.fn(async ({ data }: any) => {
          const item = { id: `void-${Date.now()}`, ...data, createdAt: new Date() };
          self.store.voidSetLogs.push(item);
          return item;
        }),
      },
      schedule: {
        findUnique: vi.fn(async ({ where }: any) => {
          if (where.storeId_date) {
            return self.store.schedules.find((s) => s.storeId === where.storeId_date.storeId && s.date === where.storeId_date.date) || null;
          }
          return null;
        }),
      },
      attendance: {
        findFirst: vi.fn(async ({ where }: any) => {
          return self.store.attendances.find((a) => {
            if (where.storeId && a.storeId !== where.storeId) return false;
            if (where.userEmail && a.userEmail !== where.userEmail) return false;
            return true;
          }) || null;
        }),
        create: vi.fn(async ({ data }: any) => {
          const item = { id: `att-${Date.now()}`, ...data, clockInAt: new Date() };
          self.store.attendances.push(item);
          return item;
        }),
      },
      attendanceRecord: {
        create: vi.fn(async ({ data }: any) => {
          const item = { id: `attr-${Date.now()}`, ...data, createdAt: new Date() };
          self.store.attendanceRecords.push(item);
          return item;
        }),
      },
      user: {
        findUnique: vi.fn(async ({ where }: any) => {
          return self.store.users.find((u) => u.email === where.email || u.id === where.id) || null;
        }),
        findMany: vi.fn(async () => self.store.users),
      },
      $executeRaw: vi.fn(async () => 1),
      $transaction: vi.fn(async (callback: any) => {
        // Snapshot current store for rollback support
        const snapshot = JSON.stringify(self.store);
        try {
          return await callback(client);
        } catch (err) {
          const restored = JSON.parse(snapshot, (key, value) => {
            if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
              return new Date(value);
            }
            return value;
          });
          for (const key of Object.keys(self.store)) {
            if (Array.isArray((self.store as any)[key])) {
              (self.store as any)[key].length = 0;
              if (restored[key]) (self.store as any)[key].push(...restored[key]);
            } else {
              (self.store as any)[key] = restored[key];
            }
          }
          throw err;
        }
      }),
    };

    return client;
  }
}
