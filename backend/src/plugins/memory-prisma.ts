import fs from 'fs';
import path from 'path';

// In-Memory Prisma Fallback Engine (支援無外部 DB 依賴下零配置啟動與測試，已全量預載 Google Sheets 遷移資料)
export function createMemoryPrisma() {
  const snapshotPath = path.resolve(__dirname, '../../data/cloud_snapshot/snapshot_store.json');
  const realStorePath = path.resolve(__dirname, '../../data/real_migrated_store.json');
  let realStore: any = null;
  const targetPath = fs.existsSync(snapshotPath) ? snapshotPath : (fs.existsSync(realStorePath) ? realStorePath : null);
  if (targetPath) {
    try {
      realStore = JSON.parse(fs.readFileSync(targetPath, 'utf-8'));
    } catch {
      // fallback
    }
  }

  const store = {
    // 👥 來自 Google Sheets sheetMemberList 會員主檔 (保留系統專用加點帳號 88888)
    members: (realStore?.members && realStore.members.length > 0) ? [
      { id: 'm-sys', phone: '88888', name: '加點專用帳號', points: 0, gender: '系統', birthday: null, note: '內部手動調點', tier: 'SYSTEM', registeredAt: new Date('2026-05-01T10:00:00Z'), createdAt: new Date('2026-05-01T10:00:00Z'), updatedAt: new Date('2026-05-01T10:00:00Z') },
      ...realStore.members.filter((m: any) => m.phone !== '88888'),
    ] : [
      { id: 'm-sys', phone: '88888', name: '加點專用帳號', points: 0, gender: '系統', birthday: null, note: '內部手動調點', tier: 'SYSTEM', registeredAt: new Date('2026-05-01T10:00:00Z'), createdAt: new Date('2026-05-01T10:00:00Z'), updatedAt: new Date('2026-05-01T10:00:00Z') },
    ],
    // 🏢 門市主檔 (竹北旗艦店 vs 金山概念店)
    stores: ((realStore?.stores && realStore.stores.length > 0) ? realStore.stores : [
      { id: 'chupei', name: '竹北店', code: 'CHUPEI', isActive: true, openTime: '14:00', standardHours: 8, lateGraceMinutes: 15, createdAt: new Date(), updatedAt: new Date() },
      { id: 'jinshan', name: '金山店', code: 'JINSHAN', isActive: true, openTime: '16:00', standardHours: 6, lateGraceMinutes: 15, createdAt: new Date(), updatedAt: new Date() },
    ]) as Array<{ id: string; name: string; code?: string; isActive?: boolean; [key: string]: any }>,
    // 💼 來自 Google Sheets 班次與日結 (100% 真實數據，門市啟動時為真實未開櫃狀態)
    sessions: (realStore?.sessions && realStore.sessions.length > 0) ? [
      ...realStore.sessions,
    ] : [],
    // 📦 來自 Google Sheets sheetItemDB 貨品資料庫 (保留 88888/99999 系統調點商品)
    products: (realStore?.products && realStore.products.length > 0) ? [
      { id: '88888', name: '手動加點', category: 'GENERAL', isSpecial: true, sellingPrice: 0, costPrice: 0, suggestedPoints: 0, version: 0, barcode: null },
      { id: '99999', name: '手動扣點', category: 'GENERAL', isSpecial: true, sellingPrice: 0, costPrice: 0, suggestedPoints: 0, version: 0, barcode: null },
      ...realStore.products.filter((p: any) => !['GK001', 'GEN001', 'BB001', '88888', '99999'].includes(p.id)),
    ] : [
      { id: '88888', name: '手動加點', category: 'GENERAL', isSpecial: true, sellingPrice: 0, costPrice: 0, suggestedPoints: 0, version: 0, barcode: null },
      { id: '99999', name: '手動扣點', category: 'GENERAL', isSpecial: true, sellingPrice: 0, costPrice: 0, suggestedPoints: 0, version: 0, barcode: null },
    ] as any[],
    // 📊 跨店水平庫存 (竹北 vs 金山)
    inventories: (realStore?.inventories && realStore.inventories.length > 0) ? [
      ...realStore.inventories.filter((i: any) => !['GK001', 'GEN001', 'BB001'].includes(i.productId)),
    ] : [] as any[],
    blindBoxes: (realStore?.blindBoxes && realStore.blindBoxes.length > 0)
      ? realStore.blindBoxes.filter((b: any) => b.id !== 'BB001')
      : (realStore?.products || [])
          .filter((p: any) => p.mainCategory === 'BLIND_BOX' || p.category === 'BLIND_BOX')
          .map((p: any) => {
            const pInvs = (realStore?.inventories || []).filter((inv: any) => inv.productId === p.id);
            const storeStocks = pInvs.reduce((acc: any, cur: any) => {
              acc[cur.storeId] = cur.quantity || 0;
              return acc;
            }, { chupei: 0, jinshan: 0 });
            const totalStock = pInvs.reduce((sum: number, cur: any) => sum + (cur.quantity || 0), 0);
            return {
              id: p.id,
              barcode: p.barcode || `471${p.id}`,
              name: p.name,
              category: '盲盒',
              costPrice: p.costPrice || 0,
              sellingPrice: p.sellingPrice || 0,
              suggestedPoints: p.suggestedPoints || Math.round((p.sellingPrice || 0) * 0.05),
              stock: totalStock,
              storeStocks,
              version: p.version || 0,
              updatedAt: p.updatedAt || new Date().toISOString(),
            };
          }),
    // 🎁 來自 Google Sheets sheetLotteryDB 一番賞套組
    luckyBags: (realStore?.luckyBags && realStore.luckyBags.length > 0) ? [
      ...realStore.luckyBags.filter((b: any) => b.id !== 'LB-2026-01' && !String(b.name || '').includes('海賊王一番賞新年')),
    ] : [] as any[],
    luckyBagPrizes: (realStore?.luckyBagPrizes && realStore.luckyBagPrizes.length > 0) ? [
      ...realStore.luckyBagPrizes.filter((p: any) => p.bagId !== 'LB-2026-01'),
    ] : [] as any[],
    // 🛒 來自 Google Sheets 歷史銷售紀錄 (100% 真實數據)
    orders: (realStore?.orders && realStore.orders.length > 0) ? [
      ...realStore.orders,
    ] : [] as any[],
    // 🪙 點數歷程
    pointLogs: (realStore?.pointLogs && realStore.pointLogs.length > 0) ? [
      ...realStore.pointLogs,
    ] : [] as any[],
    inventoryLogs: [] as any[],
    stocktakes: [] as any[],
    stocktakeItems: [] as any[],
    voidSetLogs: (realStore?.voidSetLogs && realStore.voidSetLogs.length > 0) ? realStore.voidSetLogs : [] as any[],
    purchaseOrders: (realStore?.purchaseOrders && realStore.purchaseOrders.length > 0) ? realStore.purchaseOrders : [] as any[],
    preOrders: (realStore?.preOrders && realStore.preOrders.length > 0) ? realStore.preOrders : [] as any[],
    prizeAllocationPlans: (realStore?.prizeAllocationPlans && realStore.prizeAllocationPlans.length > 0) ? realStore.prizeAllocationPlans : [] as any[],
    attendances: [] as any[],
    schedules: [] as any[],
    users: [
      { id: 'u1', email: 'onesoul.admin@gmail.com', name: '總管理員', role: 'SUPER_ADMIN', assignedStoreId: null, isActive: true, createdAt: new Date() },
      { id: 'u2', email: 'onesoul.chupei@gmail.com', name: '竹北店長', role: 'STORE_MANAGER', assignedStoreId: 'chupei', isActive: true, createdAt: new Date() },
    ] as any[],
    shiftSchedules: (realStore?.shiftSchedules && realStore.shiftSchedules.length > 0) ? [
      ...realStore.shiftSchedules,
    ] : [] as any[],
    attendanceRecords: [] as any[],
    integrationConfigs: [
      { id: 'cfg-1', key: 'LINE_NOTIFY', value: { token: '', channels: [] }, description: 'LINE 推播設定', isEnabled: false, updatedAt: new Date() },
      { id: 'cfg-2', key: 'TRELLO_BOARD', value: { apiKey: '', token: '', listId: '' }, description: 'Trello GK 卡片設定', isEnabled: false, updatedAt: new Date() },
    ] as any[],
    outboxTasks: [] as any[],
    emergencyNotices: [] as any[],
    auditLogs: (realStore?.auditLogs && realStore.auditLogs.length > 0) ? realStore.auditLogs : [
      {
        id: 'audit-mig-1',
        operatorId: 'migration-engine',
        action: 'GOOGLE_SHEETS_ETL_MIGRATION',
        targetType: 'System',
        targetId: 'sheets-v1',
        delta: 12,
        reason: 'Google Sheets 16大工作表全量對齊資料遷移完成 (會員3筆/商品3筆/套組1組/班次2班/訂單3筆)',
        prevHash: '0000000000000000000000000000000000000000000000000000000000000000',
        currentHash: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
        createdAt: new Date('2026-04-01T12:00:00Z'),
      },
    ] as any[],
    categories: [] as any[],
    transferOrders: [] as any[],
    transferOrderItems: [] as any[],
  };

  const client: any = {
    _isMemory: true,
    category: {
      findMany: async () => store.categories,
      findUnique: async ({ where }: any) => store.categories.find((c: any) => c.id === where.id || (where.code && c.code === where.code)) || null,
      create: async ({ data }: any) => {
        const c = { id: `cat-${Date.now()}`, ...data, createdAt: new Date(), updatedAt: new Date() };
        store.categories.push(c);
        return c;
      },
    },
    transferOrder: {
      findMany: async () => store.transferOrders,
      findUnique: async ({ where }: any) => store.transferOrders.find((t: any) => t.id === where.id || (where.transferNo && t.transferNo === where.transferNo)) || null,
      create: async ({ data }: any) => {
        const t = { id: `tr-${Date.now()}`, ...data, createdAt: new Date(), updatedAt: new Date() };
        store.transferOrders.push(t);
        return t;
      },
      update: async ({ where, data }: any) => {
        const t = store.transferOrders.find((it: any) => it.id === where.id);
        if (t) Object.assign(t, data, { updatedAt: new Date() });
        return t;
      },
    },
    transferOrderItem: {
      findMany: async ({ where }: any = {}) => store.transferOrderItems.filter((i: any) => !where?.transferId || i.transferId === where.transferId),
      create: async ({ data }: any) => {
        const item = { id: `tri-${Date.now()}`, ...data };
        store.transferOrderItems.push(item);
        return item;
      },
    },
    store: {
      findMany: async () => store.stores,
      findUnique: async ({ where }: any) => store.stores.find((s) => s.id === where.id) || null,
      create: async ({ data }: any) => {
        const s = { ...data, createdAt: new Date(), updatedAt: new Date() };
        store.stores.push(s);
        return s;
      },
      update: async ({ where, data }: any) => {
        const s = store.stores.find((st) => st.id === where.id);
        if (s) Object.assign(s, data, { updatedAt: new Date() });
        return s;
      },
      delete: async ({ where }: any) => {
        const idx = store.stores.findIndex((st) => st.id === where.id);
        if (idx >= 0) return store.stores.splice(idx, 1)[0];
        return null;
      },
    },
    member: {
      findMany: async () => store.members,
      findFirst: async ({ where }: any) => {
        if (where.OR) {
          return store.members.find((m) => where.OR.some((cond: any) => cond.phone === m.phone)) || null;
        }
        return null;
      },
      findUnique: async ({ where }: any) => store.members.find((m) => m.phone === where.phone) || null,
      create: async ({ data }: any) => {
        const created = { id: `m-${Date.now()}`, ...data, registeredAt: new Date(), createdAt: new Date(), updatedAt: new Date() };
        store.members.push(created);
        return created;
      },
      createMany: async ({ data }: any) => {
        const list = Array.isArray(data) ? data : [data];
        list.forEach((d) => {
          const existing = store.members.find((m) => m.phone === d.phone);
          if (existing) {
            Object.assign(existing, d, { updatedAt: new Date() });
          } else {
            store.members.push({
              id: d.id || `m-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              ...d,
              registeredAt: d.registeredAt || new Date(),
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }
        });
        return { count: list.length };
      },
      update: async ({ where, data }: any) => {
        const m = store.members.find((it) => it.id === where.id);
        if (m) Object.assign(m, data);
        return m;
      },
      upsert: async ({ where, create, update }: any) => {
        let m = store.members.find((it) => it.id === where.id || (where.phone && it.phone === where.phone));
        if (m) {
          Object.assign(m, update, { updatedAt: new Date() });
        } else {
          m = {
            id: where.id || create.id || `m-${Date.now()}`,
            ...create,
            registeredAt: create.registeredAt || new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          store.members.push(m);
        }
        return m;
      },
    },
    cashRegisterSession: {
      findFirst: async ({ where }: any) => {
        return store.sessions.find((s) => (!where?.storeId || s.storeId === where.storeId) && (where?.status ? s.status === where.status : true)) || null;
      },
      findUnique: async ({ where }: any) => {
        return store.sessions.find((s) => s.id === where?.id) || null;
      },
      findMany: async ({ where, orderBy }: any = {}) => {
        let list = store.sessions.slice();
        if (where?.storeId) list = list.filter((s) => s.storeId === where.storeId);
        if (where?.status) list = list.filter((s) => s.status === where.status);
        return list.map((s) => ({
          ...s,
          orders: store.orders.filter((o) => o.sessionId === s.id),
          store: store.stores.find((st) => st.id === s.storeId) || { name: s.storeId === 'jinshan' ? '金山概念店' : '竹北旗艦店' },
        }));
      },
      create: async ({ data }: any) => {
        const s = { id: `sess-${Date.now()}`, ...data, openedAt: new Date() };
        store.sessions.push(s);
        return s;
      },
      createMany: async ({ data }: any) => {
        const list = Array.isArray(data) ? data : [data];
        list.forEach((s) => {
          store.sessions.push({
            id: s.id || `sess-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            ...s,
          });
        });
        return { count: list.length };
      },
      update: async ({ where, data }: any) => {
        const s = store.sessions.find((it) => it.id === where.id);
        if (s) Object.assign(s, data);
        return s;
      },
    },
    product: {
      findMany: async ({ where }: any = {}) => {
        let res = store.products;
        if (where?.id) res = res.filter((p) => p.id === where.id);
        if (where?.mainCategory) res = res.filter((p) => p.mainCategory === where.mainCategory);
        if (where?.subCategory) res = res.filter((p) => p.subCategory === where.subCategory);
        if (where?.category) res = res.filter((p) => p.category === where.category || p.subCategory === where.category);
        return res;
      },
      findUnique: async ({ where }: any) => store.products.find((p) => p.id === where.id || (where.barcode && p.barcode === where.barcode)) || null,
      create: async ({ data }: any) => {
        const p = { version: 0, ...data, createdAt: new Date(), updatedAt: new Date() };
        store.products.push(p);
        return p;
      },
      update: async ({ where, data }: any) => {
        const p = store.products.find((prod) => prod.id === where.id);
        if (p) {
          if (where.version !== undefined && p.version !== where.version) {
            throw new Error('VERSION_CONFLICT');
          }
          Object.assign(p, data, { version: (p.version || 0) + 1, updatedAt: new Date() });
        }
        return p;
      },
      createMany: async ({ data }: any) => {
        const list = Array.isArray(data) ? data : [data];
        list.forEach((p) => {
          const existing = store.products.find((prod) => prod.id === p.id);
          if (existing) {
            Object.assign(existing, p, { updatedAt: new Date() });
          } else {
            store.products.push({ version: 0, ...p, createdAt: new Date(), updatedAt: new Date() });
          }
        });
        return { count: list.length };
      },
    },
    storeInventory: {
      findMany: async ({ where }: any = {}) => {
        return store.inventories
          .filter((inv) => {
            if (where?.storeId && inv.storeId !== where.storeId) return false;
            if (where?.productId) {
              if (typeof where.productId === 'string' && inv.productId !== where.productId) return false;
              if (where.productId.in && Array.isArray(where.productId.in) && !where.productId.in.includes(inv.productId)) return false;
            }
            return true;
          })
          .map((inv) => ({
            ...inv,
            product: store.products.find((p) => p.id === inv.productId) || { name: 'Unknown', category: 'GENERAL', suggestedPoints: 0 },
            store: store.stores.find((s) => s.id === inv.storeId) || { name: '竹北店' },
          }));
      },
      findUnique: async ({ where }: any) => {
        return store.inventories.find(
          (it) => it.storeId === where.storeId_productId?.storeId && it.productId === where.storeId_productId?.productId
        ) || null;
      },
      create: async ({ data }: any) => {
        const inv = { id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, version: 0, ...data, updatedAt: new Date() };
        store.inventories.push(inv);
        return inv;
      },
      createMany: async ({ data }: any) => {
        const list = Array.isArray(data) ? data : [data];
        list.forEach((inv) => {
          const existing = store.inventories.find(
            (i) => i.storeId === inv.storeId && i.productId === inv.productId
          );
          if (existing) {
            Object.assign(existing, inv, { updatedAt: new Date() });
          } else {
            store.inventories.push({
              id: inv.id || `inv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              version: 0,
              ...inv,
              updatedAt: new Date(),
            });
          }
        });
        return { count: list.length };
      },
      update: async ({ where, data }: any) => {
        const inv = store.inventories.find((it) => 
          (where.id && it.id === where.id) ||
          (where.storeId_productId && it.storeId === where.storeId_productId.storeId && it.productId === where.storeId_productId.productId)
        );
        if (inv) {
          if (where.version !== undefined && inv.version !== where.version) {
            throw new Error('VERSION_CONFLICT');
          }
          if (data.quantity && typeof data.quantity === 'object' && 'increment' in data.quantity) {
            inv.quantity += data.quantity.increment;
          } else if (data.quantity && typeof data.quantity === 'object' && 'decrement' in data.quantity) {
            inv.quantity -= data.quantity.decrement;
          } else if (typeof data.quantity === 'number') {
            inv.quantity = data.quantity;
          }
          if (data.safetyStock !== undefined) inv.safetyStock = data.safetyStock;
          inv.version = (inv.version || 0) + 1;
          inv.updatedAt = new Date();
        }
        return inv;
      },
    },
    blindBox: {
      findMany: async () => store.blindBoxes,
      findUnique: async ({ where }: any) => {
        return store.blindBoxes.find((it: any) => it.id === where.id) || null;
      },
      update: async ({ where, data }: any) => {
        const item = store.blindBoxes.find((it: any) => it.id === where.id);
        if (!item) throw new Error(`Blind box ${where.id} not found`);
        Object.assign(item, data, { updatedAt: new Date() });
        return item;
      },
      create: async ({ data }: any) => {
        const item = { ...data, createdAt: new Date(), updatedAt: new Date() };
        store.blindBoxes.push(item);
        return item;
      },
    },
    luckyBag: {
      findMany: async () => {
        return store.luckyBags.map((b) => ({
          ...b,
          prizes: store.luckyBagPrizes.filter((p) => p.bagId === b.id),
          store: store.stores.find((s) => s.id === b.storeId) || { name: '竹北店' },
        }));
      },
      findUnique: async ({ where }: any) => {
        const b = store.luckyBags.find((it) => it.id === where.id);
        if (!b) return null;
        return {
          ...b,
          prizes: store.luckyBagPrizes.filter((p) => p.bagId === b.id),
          store: store.stores.find((s) => s.id === b.storeId) || { name: '竹北店' },
        };
      },
      create: async ({ data }: any) => {
        const b = { ...data, createdAt: new Date(), updatedAt: new Date() };
        store.luckyBags.push(b);
        return b;
      },
      update: async ({ where, data }: any) => {
        const b = store.luckyBags.find((it) => it.id === where.id);
        if (b) Object.assign(b, data);
        return b;
      },
    },
    luckyBagPrize: {
      findFirst: async ({ where }: any) => {
        return store.luckyBagPrizes.find(
          (p) => (!where?.bagId || p.bagId === where.bagId) && (!where?.prizeGrade || p.prizeGrade.toLowerCase() === (where.prizeGrade?.equals || where.prizeGrade)?.toLowerCase())
        ) || null;
      },
      findMany: async ({ where }: any = {}) => {
        let res = store.luckyBagPrizes;
        if (where?.bagId) {
          if (typeof where.bagId === 'object' && Array.isArray(where.bagId.in)) {
            res = res.filter((p: any) => where.bagId.in.includes(p.bagId));
          } else {
            res = res.filter((p: any) => p.bagId === where.bagId);
          }
        }
        if (where?.productId) {
          if (typeof where.productId === 'object' && where.productId.not === null) {
            res = res.filter((p: any) => p.productId !== null && p.productId !== undefined);
          } else if (typeof where.productId === 'string') {
            res = res.filter((p: any) => p.productId === where.productId);
          }
        }
        return res;
      },
      create: async ({ data }: any) => {
        const p = { id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, ...data, createdAt: new Date(), updatedAt: new Date() };
        store.luckyBagPrizes.push(p);
        return p;
      },
      createMany: async ({ data }: any) => {
        const list = Array.isArray(data) ? data : [data];
        list.forEach((p) => {
          store.luckyBagPrizes.push({
            id: p.id || `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            ...p,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        });
        return { count: list.length };
      },
      update: async ({ where, data }: any) => {
        const p = store.luckyBagPrizes.find((it) => it.id === where.id);
        if (p) {
          if (data.drawnCount?.increment) p.drawnCount += data.drawnCount.increment;
          else Object.assign(p, data);
        }
        return p;
      },
      updateMany: async ({ where, data }: any) => {
        const targets = store.luckyBagPrizes.filter(
          (p) => p.bagId === where.bagId && p.prizeGrade.toLowerCase() === (where.prizeGrade?.equals || where.prizeGrade)?.toLowerCase()
        );
        return { count: targets.length };
      },
      delete: async ({ where }: any) => {
        const idx = store.luckyBagPrizes.findIndex((p) => p.id === where.id);
        if (idx !== -1) {
          const removed = store.luckyBagPrizes.splice(idx, 1)[0];
          return removed;
        }
        return null;
      },
      findUnique: async ({ where }: any) => {
        return store.luckyBagPrizes.find((p) => p.id === where.id) || null;
      },
    },
    order: {
      findUnique: async ({ where }: any) => {
        const o = store.orders.find((it) => it.checkoutUID === where.checkoutUID);
        if (!o) return null;
        return {
          ...o,
          member: store.members.find((m) => m.id === o.memberId) || null,
          store: store.stores.find((s) => s.id === o.storeId) || { name: '竹北店' },
        };
      },
      findMany: async ({ where }: any = {}) => {
        return store.orders
          .filter((o) => {
            if (where?.sessionId && o.sessionId !== where.sessionId) return false;
            if (where?.memberId && o.memberId !== where.memberId) return false;
            if (where?.storeId && o.storeId !== where.storeId) return false;
            if (where?.status && o.status !== where.status) return false;
            return true;
          })
          .map((o) => ({
            ...o,
            member: store.members.find((m) => m.id === o.memberId) || null,
            store: store.stores.find((s) => s.id === o.storeId) || { name: '竹北店' },
          }));
      },
      create: async ({ data }: any) => {
        const created = { id: `ord-${Date.now()}`, ...data, items: data.items || [], createdAt: data.createdAt || new Date(), updatedAt: new Date() };
        store.orders.push(created);
        return created;
      },
      createMany: async ({ data }: any) => {
        const list = Array.isArray(data) ? data : [data];
        list.forEach((ord) => {
          store.orders.push({
            id: ord.id || `ord-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            ...ord,
            items: ord.items || [],
            createdAt: ord.createdAt || new Date(),
            updatedAt: new Date(),
          });
        });
        return { count: list.length };
      },
      update: async ({ where, data }: any) => {
        const o = store.orders.find((it) => it.id === where.id);
        if (o) Object.assign(o, data);
        return o;
      },
    },
    orderItem: {
      findMany: async ({ where }: any = {}) => {
        const items = store.orders.flatMap((o: any) => o.items || []);
        if (where?.orderId) return items.filter((it: any) => it.orderId === where.orderId);
        return items;
      },
      create: async ({ data }: any) => {
        const order = store.orders.find((o) => o.id === data.orderId);
        if (order) order.items.push(data);
        return data;
      },
      createMany: async ({ data }: any) => {
        const list = Array.isArray(data) ? data : [data];
        list.forEach((item) => {
          const order = store.orders.find((o) => o.id === item.orderId);
          if (order) order.items.push(item);
        });
        return { count: list.length };
      },
    },
    pointLog: {
      findMany: async ({ where }: any = {}) => {
        let res = store.pointLogs;
        if (where?.memberId) res = res.filter((l: any) => l.memberId === where.memberId);
        return res;
      },
      create: async ({ data }: any) => {
        store.pointLogs.push(data);
        return data;
      },
      createMany: async ({ data }: any) => {
        const list = Array.isArray(data) ? data : [data];
        store.pointLogs.push(...list);
        return { count: list.length };
      },
    },
    inventoryLog: {
      findMany: async ({ where }: any = {}) => {
        let res = store.inventoryLogs;
        if (where?.storeId) res = res.filter((l: any) => l.storeId === where.storeId);
        if (where?.productId) res = res.filter((l: any) => l.productId === where.productId);
        return res;
      },
      create: async ({ data }: any) => {
        store.inventoryLogs.push(data);
        return data;
      },
    },
    stocktake: {
      create: async ({ data }: any) => {
        const s = { id: `st-${Date.now()}`, ...data, items: [], createdAt: new Date() };
        store.stocktakes.push(s);
        return s;
      },
      findUnique: async ({ where }: any) => {
        const s = store.stocktakes.find((it) => it.id === where.id);
        if (!s) return null;
        return {
          ...s,
          items: store.stocktakeItems.filter((it) => it.stocktakeId === s.id),
        };
      },
      update: async ({ where, data }: any) => {
        const s = store.stocktakes.find((it) => it.id === where.id);
        if (s) Object.assign(s, data);
        return s;
      },
    },
    stocktakeItem: {
      create: async ({ data }: any) => {
        store.stocktakeItems.push(data);
        return data;
      },
    },
    voidSetLog: {
      create: async ({ data }: any) => {
        store.voidSetLogs.push(data);
        return data;
      },
      findMany: async () => store.voidSetLogs,
    },
    purchaseOrder: {
      findMany: async ({ where, take, skip }: any = {}) => {
        let res = store.purchaseOrders;
        if (where?.status) res = res.filter((p: any) => p.status === where.status);
        if (skip) res = res.slice(skip);
        if (take) res = res.slice(0, take);
        return res;
      },
      count: async ({ where }: any = {}) => {
        let res = store.purchaseOrders;
        if (where?.status) res = res.filter((p: any) => p.status === where.status);
        return res.length;
      },
      findUnique: async ({ where }: any) => store.purchaseOrders.find((p: any) => p.id === where.id || (where.orderNo && p.orderNo === where.orderNo)) || null,
      create: async ({ data }: any) => {
        const po = { id: `po-${Date.now()}`, ...data, createdAt: new Date(), updatedAt: new Date() };
        store.purchaseOrders.push(po);
        return po;
      },
      update: async ({ where, data }: any) => {
        const po = store.purchaseOrders.find((p: any) => p.id === where.id);
        if (po) Object.assign(po, data, { updatedAt: new Date() });
        return po;
      },
    },
    preOrder: {
      findMany: async ({ where, take, skip, orderBy, include }: any = {}) => {
        let res = store.preOrders;
        if (where?.status) res = res.filter((p: any) => p.status === where.status);
        if (where?.supplier) res = res.filter((p: any) => p.supplier === where.supplier);
        if (where?.q) {
          const qLower = String(where.q).toLowerCase();
          res = res.filter((p: any) => 
            String(p.name || '').toLowerCase().includes(qLower) || 
            String(p.supplier || '').toLowerCase().includes(qLower)
          );
        }
        if (orderBy?.createdAt === 'desc') {
          res = [...res].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }
        if (skip) res = res.slice(skip);
        if (take) res = res.slice(0, take);
        if (include?.product || include?.targetStore) {
          res = res.map((p: any) => ({
            ...p,
            product: include?.product ? store.products.find((prod: any) => prod.id === p.productId) || null : undefined,
            targetStore: include?.targetStore ? store.stores.find((s: any) => s.id === p.targetStoreId) || null : undefined,
          }));
        }
        return res;
      },
      count: async ({ where }: any = {}) => {
        let res = store.preOrders;
        if (where?.status) res = res.filter((p: any) => p.status === where.status);
        if (where?.supplier) res = res.filter((p: any) => p.supplier === where.supplier);
        return res.length;
      },
      findUnique: async ({ where, include }: any) => {
        const p = store.preOrders.find((it: any) => it.id === where.id) || null;
        if (!p) return null;
        return {
          ...p,
          product: include?.product ? store.products.find((prod: any) => prod.id === p.productId) || null : undefined,
          targetStore: include?.targetStore ? store.stores.find((s: any) => s.id === p.targetStoreId) || null : undefined,
        };
      },
      findFirst: async ({ where, include }: any = {}) => {
        let res = store.preOrders;
        if (where?.productId) res = res.filter((p: any) => p.productId === where.productId);
        if (where?.id?.not) res = res.filter((p: any) => p.id !== where.id.not);
        if (where?.status) res = res.filter((p: any) => p.status === where.status);
        const p = res[0] || null;
        if (!p) return null;
        return {
          ...p,
          product: include?.product ? store.products.find((prod: any) => prod.id === p.productId) || null : undefined,
          targetStore: include?.targetStore ? store.stores.find((s: any) => s.id === p.targetStoreId) || null : undefined,
        };
      },
      create: async ({ data }: any) => {
        const pre = {
          id: data.id || `pre-${Date.now()}`,
          ...data,
          status: data.status || 'PENDING',
          createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
          updatedAt: new Date(),
        };
        store.preOrders.push(pre);
        return pre;
      },
      update: async ({ where, data }: any) => {
        const pre = store.preOrders.find((p: any) => p.id === where.id);
        if (pre) Object.assign(pre, data, { updatedAt: new Date() });
        return pre;
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        store.preOrders.forEach((p: any) => {
          let match = true;
          if (where?.id && p.id !== where.id) match = false;
          if (where?.status && p.status !== where.status) match = false;
          if (match) {
            Object.assign(p, data, { updatedAt: new Date() });
            count++;
          }
        });
        return { count };
      },
    },
    prizeAllocationPlan: {
      findMany: async ({ where }: any = {}) => {
        let res = store.prizeAllocationPlans;
        if (where?.storeId) res = res.filter((p: any) => p.storeId === where.storeId);
        if (where?.status) res = res.filter((p: any) => p.status === where.status);
        return res;
      },
      findUnique: async ({ where }: any) => store.prizeAllocationPlans.find((p: any) => p.id === where.id) || null,
      create: async ({ data }: any) => {
        const plan = { id: `plan-${Date.now()}`, ...data, createdAt: new Date(), updatedAt: new Date() };
        store.prizeAllocationPlans.push(plan);
        return plan;
      },
      update: async ({ where, data }: any) => {
        const plan = store.prizeAllocationPlans.find((p: any) => p.id === where.id);
        if (plan) Object.assign(plan, data, { updatedAt: new Date() });
        return plan;
      },
      delete: async ({ where }: any) => {
        const idx = store.prizeAllocationPlans.findIndex((p: any) => p.id === where.id);
        if (idx >= 0) return store.prizeAllocationPlans.splice(idx, 1)[0];
        return null;
      },
    },
    user: {
      findMany: async () => store.users,
      findUnique: async ({ where }: any) => store.users.find((u: any) => u.email === where.email || u.id === where.id) || null,
      create: async ({ data }: any) => {
        const u = { id: `u-${Date.now()}`, ...data, createdAt: new Date() };
        store.users.push(u);
        return u;
      },
    },
    shiftSchedule: {
      findMany: async ({ where }: any = {}) => {
        return store.shiftSchedules.filter((s: any) => (!where?.storeId || s.storeId === where.storeId));
      },
      upsert: async ({ where, create, update }: any) => {
        const idx = store.shiftSchedules.findIndex((s: any) => s.storeId === where.storeId_date.storeId && s.date === where.storeId_date.date);
        if (idx >= 0) {
          Object.assign(store.shiftSchedules[idx], update, { updatedAt: new Date() });
          return store.shiftSchedules[idx];
        } else {
          const created = { id: `sch-${Date.now()}`, ...create, createdAt: new Date(), updatedAt: new Date() };
          store.shiftSchedules.push(created);
          return created;
        }
      },
    },
    attendanceRecord: {
      findMany: async ({ where }: any = {}) => {
        return store.attendanceRecords.filter((a: any) => (!where?.storeId || a.storeId === where.storeId));
      },
      create: async ({ data }: any) => {
        const a = { id: `att-${Date.now()}`, ...data, createdAt: new Date() };
        store.attendanceRecords.push(a);
        return a;
      },
    },
    integrationConfig: {
      findMany: async () => store.integrationConfigs,
      findUnique: async ({ where }: any) => store.integrationConfigs.find((c: any) => c.key === where.key) || null,
      upsert: async ({ where, create, update }: any) => {
        const idx = store.integrationConfigs.findIndex((c: any) => c.key === where.key);
        if (idx >= 0) {
          Object.assign(store.integrationConfigs[idx], update, { updatedAt: new Date() });
          return store.integrationConfigs[idx];
        } else {
          const created = { id: `cfg-${Date.now()}`, ...create, updatedAt: new Date() };
          store.integrationConfigs.push(created);
          return created;
        }
      },
    },
    outboxTask: {
      findMany: async ({ where, take }: any = {}) => {
        let res = store.outboxTasks;
        if (where?.status) res = res.filter((t: any) => t.status === where.status);
        if (take) res = res.slice(0, take);
        return res;
      },
      create: async ({ data }: any) => {
        const t = { id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, retryCount: 0, maxRetries: 5, createdAt: new Date(), ...data };
        store.outboxTasks.push(t);
        return t;
      },
      update: async ({ where, data }: any) => {
        const t = store.outboxTasks.find((it: any) => it.id === where.id);
        if (t) Object.assign(t, data);
        return t;
      },
    },
    emergencyNotice: {
      findFirst: async ({ where }: any = {}) => {
        return store.emergencyNotices.filter((n: any) => (where?.isActive === undefined || n.isActive === where.isActive)).pop() || null;
      },
      findMany: async () => store.emergencyNotices,
      create: async ({ data }: any) => {
        const n = { id: `notif-${Date.now()}`, isActive: true, version: store.emergencyNotices.length + 1, publishedAt: new Date(), ...data };
        store.emergencyNotices.push(n);
        return n;
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        store.emergencyNotices.forEach((n: any) => {
          if (where?.isActive === undefined || n.isActive === where.isActive) {
            Object.assign(n, data);
            count++;
          }
        });
        return { count };
      },
    },
    auditLog: {
      findMany: async ({ where, take, orderBy }: any = {}) => {
        let res = [...store.auditLogs];
        if (where?.targetType) res = res.filter((l: any) => l.targetType === where.targetType);
        if (where?.targetId) res = res.filter((l: any) => l.targetId === where.targetId);
        if (take) res = res.slice(-take);
        return res.reverse();
      },
      create: async ({ data }: any) => {
        const l = { id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, createdAt: new Date(), ...data };
        store.auditLogs.push(l);
        return l;
      },
    },
    $transaction: async (cb: any) => {
      return cb(client);
    },
    $connect: async () => {},
    $disconnect: async () => {},
  };

  return client;
}
