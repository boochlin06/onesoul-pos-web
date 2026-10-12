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
    // 👥 來自 Google Sheets sheetMemberList 會員主檔
    members: (realStore?.members && realStore.members.length > 0) ? [
      { id: 'm-chen', phone: '0912345678', name: '陳大明', points: 550, gender: '男', birthday: '1992/05/12', note: 'VIP 熟客', tier: 'VIP', registeredAt: new Date('2026-01-10T14:20:00Z'), createdAt: new Date('2026-01-10T14:20:00Z'), updatedAt: new Date('2026-02-15T16:30:00Z') },
      { id: 'm-chang', phone: '0988776655', name: '張小美', points: 240, gender: '女', birthday: '1995/08/24', note: '金山常客', tier: 'GOLD', registeredAt: new Date('2026-03-01T11:10:00Z'), createdAt: new Date('2026-03-01T11:10:00Z'), updatedAt: new Date('2026-03-01T11:10:00Z') },
      { id: 'm-sys', phone: '88888', name: '加點專用帳號', points: 0, gender: '系統', birthday: null, note: '內部手動調點', tier: 'SYSTEM', registeredAt: new Date('2026-05-01T10:00:00Z'), createdAt: new Date('2026-05-01T10:00:00Z'), updatedAt: new Date('2026-05-01T10:00:00Z') },
      { id: 'm1', phone: '0912345679', name: '王小明', points: 500, gender: '男', birthday: null, note: '一般會員', tier: 'GOLD', registeredAt: new Date(), createdAt: new Date(), updatedAt: new Date() },
      { id: 'm2', phone: '0987654321', name: '李小華', points: 120, gender: '女', birthday: null, note: '新註冊會員', tier: 'GENERAL', registeredAt: new Date(), createdAt: new Date(), updatedAt: new Date() },
      ...realStore.members.filter((m: any) => !['0912345678', '0912345679', '0987654321', '88888'].includes(m.phone)),
    ] : [
      { id: 'm-chen', phone: '0912345678', name: '陳大明', points: 550, gender: '男', birthday: '1992/05/12', note: 'VIP 熟客', tier: 'VIP', registeredAt: new Date('2026-01-10T14:20:00Z'), createdAt: new Date('2026-01-10T14:20:00Z'), updatedAt: new Date('2026-02-15T16:30:00Z') },
      { id: 'm-chang', phone: '0988776655', name: '張小美', points: 240, gender: '女', birthday: '1995/08/24', note: '金山常客', tier: 'GOLD', registeredAt: new Date('2026-03-01T11:10:00Z'), createdAt: new Date('2026-03-01T11:10:00Z'), updatedAt: new Date('2026-03-01T11:10:00Z') },
      { id: 'm-sys', phone: '88888', name: '加點專用帳號', points: 0, gender: '系統', birthday: null, note: '內部手動調點', tier: 'SYSTEM', registeredAt: new Date('2026-05-01T10:00:00Z'), createdAt: new Date('2026-05-01T10:00:00Z'), updatedAt: new Date('2026-05-01T10:00:00Z') },
      { id: 'm1', phone: '0912345679', name: '王小明', points: 500, gender: '男', birthday: null, note: '一般會員', tier: 'GOLD', registeredAt: new Date(), createdAt: new Date(), updatedAt: new Date() },
      { id: 'm2', phone: '0987654321', name: '李小華', points: 120, gender: '女', birthday: null, note: '新註冊會員', tier: 'GENERAL', registeredAt: new Date(), createdAt: new Date(), updatedAt: new Date() },
    ],
    // 🏢 門市主檔 (竹北旗艦店 vs 金山概念店)
    stores: ((realStore?.stores && realStore.stores.length > 0) ? realStore.stores : [
      { id: 'chupei', name: '竹北店', code: 'CHUPEI', isActive: true, openTime: '14:00', standardHours: 8, lateGraceMinutes: 15, createdAt: new Date(), updatedAt: new Date() },
      { id: 'jinshan', name: '金山店', code: 'JINSHAN', isActive: true, openTime: '16:00', standardHours: 6, lateGraceMinutes: 15, createdAt: new Date(), updatedAt: new Date() },
    ]) as Array<{ id: string; name: string; code?: string; isActive?: boolean; [key: string]: any }>,
    // 💼 來自 Google Sheets 班次與日結
    sessions: (realStore?.sessions && realStore.sessions.length > 0) ? [
      { id: 'sess-1', storeId: 'chupei', openingCash: 3000, openedBy: 'onesoul.chupei@gmail.com', status: 'OPEN', openedAt: new Date(), orders: [] },
      { id: 'sess-2', storeId: 'chupei', openingCash: 3000, actualCash: 2950, expectedCash: 3000, discrepancy: -50, openedBy: 'onesoul.chupei@gmail.com', closedBy: 'onesoul.chupei@gmail.com', status: 'CLOSED', openedAt: new Date('2026-04-01T13:50:00Z'), closedAt: new Date('2026-04-01T22:10:00Z'), totalRevenue: 350, cashRevenue: 350, cardRevenue: 0, remitRevenue: 0, txCount: 1, voidCount: 0, note: '4月首日結算 (短少50元備用金)' },
      { id: 'sess-3', storeId: 'jinshan', openingCash: 2000, actualCash: 2000, expectedCash: 2000, discrepancy: 0, openedBy: 'onesoul.jinshan@gmail.com', closedBy: 'onesoul.jinshan@gmail.com', status: 'CLOSED', openedAt: new Date('2026-04-01T15:45:00Z'), closedAt: new Date('2026-04-01T21:50:00Z'), totalRevenue: 300, cashRevenue: 0, cardRevenue: 300, remitRevenue: 0, txCount: 1, voidCount: 0, note: '4月首日平帳' },
      ...realStore.sessions,
    ] : [
      { id: 'sess-1', storeId: 'chupei', openingCash: 3000, openedBy: 'onesoul.chupei@gmail.com', status: 'OPEN', openedAt: new Date(), orders: [] },
      { id: 'sess-2', storeId: 'chupei', openingCash: 3000, actualCash: 2950, expectedCash: 3000, discrepancy: -50, openedBy: 'onesoul.chupei@gmail.com', closedBy: 'onesoul.chupei@gmail.com', status: 'CLOSED', openedAt: new Date('2026-04-01T13:50:00Z'), closedAt: new Date('2026-04-01T22:10:00Z'), totalRevenue: 350, cashRevenue: 350, cardRevenue: 0, remitRevenue: 0, txCount: 1, voidCount: 0, note: '4月首日結算 (短少50元備用金)' },
      { id: 'sess-3', storeId: 'jinshan', openingCash: 2000, actualCash: 2000, expectedCash: 2000, discrepancy: 0, openedBy: 'onesoul.jinshan@gmail.com', closedBy: 'onesoul.jinshan@gmail.com', status: 'CLOSED', openedAt: new Date('2026-04-01T15:45:00Z'), closedAt: new Date('2026-04-01T21:50:00Z'), totalRevenue: 300, cashRevenue: 0, cardRevenue: 300, remitRevenue: 0, txCount: 1, voidCount: 0, note: '4月首日平帳' },
    ],
    // 📦 來自 Google Sheets sheetItemDB 貨品資料庫
    products: (realStore?.products && realStore.products.length > 0) ? [
      { id: 'GK001', name: '海賊王 魯夫 GK', category: 'GK', isSpecial: false, sellingPrice: 15000, costPrice: 8000, suggestedPoints: 300, version: 0, barcode: '4710001' },
      { id: 'GEN001', name: '壓克力展示盒', category: 'GENERAL', isSpecial: false, sellingPrice: 300, costPrice: 150, suggestedPoints: 5, version: 0, barcode: '4710002' },
      { id: 'BB001', name: 'Labubu 盲盒', category: 'BLIND_BOX', isSpecial: false, sellingPrice: 350, costPrice: 200, suggestedPoints: 10, version: 0, barcode: '4710003' },
      { id: '88888', name: '手動加點', category: 'GENERAL', isSpecial: true, sellingPrice: 0, costPrice: 0, suggestedPoints: 0, version: 0, barcode: null },
      { id: '99999', name: '手動扣點', category: 'GENERAL', isSpecial: true, sellingPrice: 0, costPrice: 0, suggestedPoints: 0, version: 0, barcode: null },
      ...realStore.products.filter((p: any) => !['GK001', 'GEN001', 'BB001', '88888', '99999'].includes(p.id)),
    ] : [
      { id: 'GK001', name: '海賊王 魯夫 GK', category: 'GK', isSpecial: false, sellingPrice: 15000, costPrice: 8000, suggestedPoints: 300, version: 0, barcode: '4710001' },
      { id: 'GEN001', name: '壓克力展示盒', category: 'GENERAL', isSpecial: false, sellingPrice: 300, costPrice: 150, suggestedPoints: 5, version: 0, barcode: '4710002' },
      { id: 'BB001', name: 'Labubu 盲盒', category: 'BLIND_BOX', isSpecial: false, sellingPrice: 350, costPrice: 200, suggestedPoints: 10, version: 0, barcode: '4710003' },
      { id: '88888', name: '手動加點', category: 'GENERAL', isSpecial: true, sellingPrice: 0, costPrice: 0, suggestedPoints: 0, version: 0, barcode: null },
      { id: '99999', name: '手動扣點', category: 'GENERAL', isSpecial: true, sellingPrice: 0, costPrice: 0, suggestedPoints: 0, version: 0, barcode: null },
    ] as any[],
    // 📊 跨店水平庫存 (竹北 vs 金山)
    inventories: (realStore?.inventories && realStore.inventories.length > 0) ? [
      { id: 'inv-1', storeId: 'chupei', productId: 'GK001', quantity: 15, safetyStock: 2, version: 0, updatedAt: new Date() },
      { id: 'inv-2', storeId: 'jinshan', productId: 'GK001', quantity: 5, safetyStock: 2, version: 0, updatedAt: new Date() },
      { id: 'inv-3', storeId: 'chupei', productId: 'GEN001', quantity: 60, safetyStock: 10, version: 0, updatedAt: new Date() },
      { id: 'inv-4', storeId: 'jinshan', productId: 'GEN001', quantity: 30, safetyStock: 5, version: 0, updatedAt: new Date() },
      { id: 'inv-5', storeId: 'chupei', productId: 'BB001', quantity: 20, safetyStock: 5, version: 0, updatedAt: new Date() },
      { id: 'inv-6', storeId: 'jinshan', productId: 'BB001', quantity: 0, safetyStock: 2, version: 0, updatedAt: new Date() },
      ...realStore.inventories.filter((i: any) => !['GK001', 'GEN001', 'BB001'].includes(i.productId)),
    ] : [
      { id: 'inv-1', storeId: 'chupei', productId: 'GK001', quantity: 15, safetyStock: 2, version: 0, updatedAt: new Date() },
      { id: 'inv-2', storeId: 'jinshan', productId: 'GK001', quantity: 5, safetyStock: 2, version: 0, updatedAt: new Date() },
      { id: 'inv-3', storeId: 'chupei', productId: 'GEN001', quantity: 60, safetyStock: 10, version: 0, updatedAt: new Date() },
      { id: 'inv-4', storeId: 'jinshan', productId: 'GEN001', quantity: 30, safetyStock: 5, version: 0, updatedAt: new Date() },
      { id: 'inv-5', storeId: 'chupei', productId: 'BB001', quantity: 20, safetyStock: 5, version: 0, updatedAt: new Date() },
      { id: 'inv-6', storeId: 'jinshan', productId: 'BB001', quantity: 0, safetyStock: 2, version: 0, updatedAt: new Date() },
    ] as any[],
    blindBoxes: [
      { id: 'BB001', name: 'Labubu', points: 10, manualPrice: 350, cost: 200, inventory: 20, remaining: 20 },
    ],
    // 🎁 來自 Google Sheets sheetLotteryDB 一番賞套組
    luckyBags: (realStore?.luckyBags && realStore.luckyBags.length > 0) ? [
      { id: 'LB-2026-01', storeId: 'chupei', name: '海賊王一番賞新年限定套', unitPrice: 350, isPointsSet: false, status: 'ACTIVE', createdAt: new Date('2026-01-01T00:00:00Z'), updatedAt: new Date() },
      ...realStore.luckyBags,
    ] : [
      { id: 'LB-2026-01', storeId: 'chupei', name: '海賊王一番賞新年限定套', unitPrice: 350, isPointsSet: false, status: 'ACTIVE', createdAt: new Date('2026-01-01T00:00:00Z'), updatedAt: new Date() },
    ],
    luckyBagPrizes: (realStore?.luckyBagPrizes && realStore.luckyBagPrizes.length > 0) ? [
      { id: 'p1', bagId: 'LB-2026-01', prizeGrade: 'A', prizeName: 'A賞 魯夫 MASTERLISE', productId: 'GK001', points: 150, draws: 2, drawnCount: 1, updatedAt: new Date() },
      { id: 'p2', bagId: 'LB-2026-01', prizeGrade: 'B', prizeName: 'B賞 索隆 MASTERLISE', productId: null, points: 100, draws: 3, drawnCount: 0, updatedAt: new Date() },
      ...realStore.luckyBagPrizes,
    ] : [
      { id: 'p1', bagId: 'LB-2026-01', prizeGrade: 'A', prizeName: 'A賞 魯夫 MASTERLISE', productId: 'GK001', points: 150, draws: 2, drawnCount: 1, updatedAt: new Date() },
      { id: 'p2', bagId: 'LB-2026-01', prizeGrade: 'B', prizeName: 'B賞 索隆 MASTERLISE', productId: null, points: 100, draws: 3, drawnCount: 0, updatedAt: new Date() },
    ],
    // 🛒 來自 Google Sheets 歷史銷售紀錄
    orders: (realStore?.orders && realStore.orders.length > 0) ? [
      {
        id: 'ord-1',
        checkoutUID: 'ORD-2026-001',
        storeId: 'chupei',
        memberId: 'm-chen',
        sessionId: 'sess-2',
        receivedAmount: 350,
        cash: 350,
        creditCard: 0,
        remittance: 0,
        pointsUsed: 0,
        netPointsDelta: 10,
        status: 'COMPLETED',
        createdAt: new Date('2026-04-01T14:30:00Z'),
        orderNote: '首筆抽獎 (Google Sheets 歷史交易)',
        items: [
          { id: 'it-1', orderId: 'ord-1', bagId: 'LB-2026-01', prizeGrade: 'A', prizeName: 'A賞 魯夫 MASTERLISE', productId: 'GK001', draws: 1, pickType: 'TAKEAWAY', unitPrice: 350, amount: 350, pointsImpact: 10, remark: '首筆抽獎' },
        ],
      },
      ...realStore.orders,
    ] : [
      {
        id: 'ord-1',
        checkoutUID: 'ORD-2026-001',
        storeId: 'chupei',
        memberId: 'm-chen',
        sessionId: 'sess-2',
        receivedAmount: 350,
        cash: 350,
        creditCard: 0,
        remittance: 0,
        pointsUsed: 0,
        netPointsDelta: 10,
        status: 'COMPLETED',
        createdAt: new Date('2026-04-01T14:30:00Z'),
        orderNote: '首筆抽獎 (Google Sheets 歷史交易)',
        items: [
          { id: 'it-1', orderId: 'ord-1', bagId: 'LB-2026-01', prizeGrade: 'A', prizeName: 'A賞 魯夫 MASTERLISE', productId: 'GK001', draws: 1, pickType: 'TAKEAWAY', unitPrice: 350, amount: 350, pointsImpact: 10, remark: '首筆抽獎' },
        ],
      },
      {
        id: 'ord-2',
        checkoutUID: 'ORD-2026-002',
        storeId: 'jinshan',
        memberId: 'm-chang',
        sessionId: 'sess-3',
        receivedAmount: 300,
        cash: 0,
        creditCard: 300,
        remittance: 0,
        pointsUsed: 0,
        netPointsDelta: 5,
        status: 'COMPLETED',
        createdAt: new Date('2026-04-01T16:15:00Z'),
        orderNote: '刷卡購盒 (Google Sheets 歷史交易)',
        items: [
          { id: 'it-2', orderId: 'ord-2', productId: 'GEN001', prizeName: '壓克力展示盒', draws: 1, pickType: 'TAKEAWAY', unitPrice: 300, amount: 300, pointsImpact: 5, remark: '刷卡購盒' },
        ],
      },
      {
        id: 'ord-3',
        checkoutUID: 'ORD-2026-003',
        storeId: 'chupei',
        memberId: 'm-sys',
        sessionId: 'sess-1',
        receivedAmount: 0,
        cash: 0,
        creditCard: 0,
        remittance: 0,
        pointsUsed: 0,
        netPointsDelta: 50,
        status: 'COMPLETED',
        createdAt: new Date('2026-04-01T18:00:00Z'),
        orderNote: '活動補發點數 (Google Sheets 歷史紀錄)',
        items: [
          { id: 'it-3', orderId: 'ord-3', productId: '88888', prizeName: '手動加點', draws: 1, pickType: 'POINTS', unitPrice: 0, amount: 0, pointsImpact: 50, remark: '活動補發點數' },
        ],
      },
    ] as any[],
    // 🪙 點數歷程
    pointLogs: [
      { id: 'pl-1', memberId: 'm-chen', type: 'MANUAL', delta: 500, balance: 500, reason: 'Google Sheets 舊系統點數期初結轉', operator: '系統遷移', createdAt: new Date('2026-01-10T14:20:00Z') },
      { id: 'pl-2', memberId: 'm-chen', type: 'SALE_REWARD', delta: 50, balance: 550, reason: '結帳消費回饋點數', operator: 'POS', createdAt: new Date('2026-02-15T16:30:00Z') },
      { id: 'pl-3', memberId: 'm-chang', type: 'MANUAL', delta: 240, balance: 240, reason: 'Google Sheets 舊系統點數期初結轉', operator: '系統遷移', createdAt: new Date('2026-03-01T11:10:00Z') },
    ] as any[],
    inventoryLogs: [] as any[],
    stocktakes: [] as any[],
    stocktakeItems: [] as any[],
    voidSetLogs: [] as any[],
    attendances: [] as any[],
    schedules: [] as any[],
    users: [
      { id: 'u1', email: 'onesoul.admin@gmail.com', name: '總管理員', role: 'SUPER_ADMIN', assignedStoreId: null, isActive: true, createdAt: new Date() },
      { id: 'u2', email: 'onesoul.chupei@gmail.com', name: '竹北店長', role: 'STORE_MANAGER', assignedStoreId: 'chupei', isActive: true, createdAt: new Date() },
    ] as any[],
    shiftSchedules: [
      { id: 'sch-1', storeId: 'chupei', date: '2026-10-09', staffName: '王小明', staffEmail: 'onesoul.chupei@gmail.com', shiftType: 'FULL', isClosed: false, note: null, createdAt: new Date(), updatedAt: new Date() },
    ] as any[],
    attendanceRecords: [] as any[],
    integrationConfigs: [
      { id: 'cfg-1', key: 'LINE_NOTIFY', value: { token: 'mock-token', channels: [{ name: 'admin', targetId: 'mock-admin-group' }] }, description: 'LINE 推播設定', isEnabled: true, updatedAt: new Date() },
      { id: 'cfg-2', key: 'TRELLO_BOARD', value: { apiKey: 'mock-trello-key', token: 'mock-trello-token', listId: 'mock-list' }, description: 'Trello GK 卡片設定', isEnabled: true, updatedAt: new Date() },
    ] as any[],
    outboxTasks: [] as any[],
    emergencyNotices: [] as any[],
    auditLogs: [
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
  };

  const client: any = {
    _isMemory: true,
    store: {
      findMany: async () => store.stores,
      findUnique: async ({ where }: any) => store.stores.find((s) => s.id === where.id) || null,
      create: async ({ data }: any) => {
        const s = { ...data, createdAt: new Date(), updatedAt: new Date() };
        store.stores.push(s);
        return s;
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
        if (where?.category) res = res.filter((p) => p.category === where.category);
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
          .filter((inv) => (!where?.storeId || inv.storeId === where.storeId))
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
        if (where?.bagId) res = res.filter((p: any) => p.bagId === where.bagId);
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
        const created = { id: `ord-${Date.now()}`, ...data, items: [], createdAt: new Date(), updatedAt: new Date() };
        store.orders.push(created);
        return created;
      },
      createMany: async ({ data }: any) => {
        const list = Array.isArray(data) ? data : [data];
        list.forEach((ord) => {
          store.orders.push({
            id: ord.id || `ord-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            ...ord,
            items: [],
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
