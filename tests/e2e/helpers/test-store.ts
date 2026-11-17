import crypto from 'crypto';

export interface TestStoreState {
  members: any[];
  stores: any[];
  sessions: any[];
  products: any[];
  inventories: any[];
  blindBoxes: any[];
  luckyBags: any[];
  luckyBagPrizes: any[];
  orders: any[];
  orderItems: any[];
  pointLogs: any[];
  inventoryLogs: any[];
  stocktakes: any[];
  stocktakeItems: any[];
  preOrders: any[];
  auditLogs: any[];
  transferOrders: any[];
  transferOrderItems: any[];
  integrationConfigs: any[];
  attendances: any[];
  attendanceRecords: any[];
  schedules: any[];
  users: any[];
  allocationPlans: any[];
  voidSetLogs: any[];
}

export function createInitialTestStore(): TestStoreState {
  const chupeiStore = {
    id: 'chupei',
    name: '竹北店',
    code: 'CHUPEI',
    isActive: true,
    openTime: '14:00',
    standardHours: 8,
    lateGraceMinutes: 15,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };

  const jinshanStore = {
    id: 'jinshan',
    name: '金山店',
    code: 'JINSHAN',
    isActive: true,
    openTime: '16:00',
    standardHours: 6,
    lateGraceMinutes: 15,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };

  const members = [
    {
      id: 'm-vip',
      phone: '0912345678',
      name: '王小明',
      points: 500,
      gender: '男',
      birthday: '1995-05-15',
      note: 'VIP顧客',
      tier: 'VIP',
      registeredAt: new Date('2026-01-10T10:00:00Z'),
      createdAt: new Date('2026-01-10T10:00:00Z'),
      updatedAt: new Date('2026-01-10T10:00:00Z'),
    },
    {
      id: 'm-regular',
      phone: '0987654321',
      name: '李小華',
      points: 50,
      gender: '女',
      birthday: '1998-08-20',
      note: '一般會員',
      tier: 'GENERAL',
      registeredAt: new Date('2026-02-01T12:00:00Z'),
      createdAt: new Date('2026-02-01T12:00:00Z'),
      updatedAt: new Date('2026-02-01T12:00:00Z'),
    },
    {
      id: 'm-zero',
      phone: '0933111222',
      name: '陳大文',
      points: 0,
      gender: '男',
      birthday: '2000-01-01',
      note: '新進會員無點數',
      tier: 'GENERAL',
      registeredAt: new Date('2026-03-01T14:00:00Z'),
      createdAt: new Date('2026-03-01T14:00:00Z'),
      updatedAt: new Date('2026-03-01T14:00:00Z'),
    },
    {
      id: 'm-sys',
      phone: '88888',
      name: '加點專用帳號',
      points: 0,
      gender: '系統',
      birthday: null,
      note: '內部手動調點',
      tier: 'SYSTEM',
      registeredAt: new Date('2026-01-01T00:00:00Z'),
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    },
  ];

  const products = [
    {
      id: '88888',
      name: '手動加點',
      category: 'GENERAL',
      mainCategory: 'GENERAL',
      isSpecial: true,
      sellingPrice: 0,
      costPrice: 0,
      suggestedPoints: 0,
      version: 0,
      barcode: '88888',
    },
    {
      id: '99999',
      name: '手動扣點',
      category: 'GENERAL',
      mainCategory: 'GENERAL',
      isSpecial: true,
      sellingPrice: 0,
      costPrice: 0,
      suggestedPoints: 0,
      version: 0,
      barcode: '99999',
    },
    {
      id: 'GK001',
      name: '海賊王 魯夫 GK 雕像',
      category: 'GK',
      mainCategory: 'GK',
      isSpecial: false,
      sellingPrice: 15000,
      costPrice: 8000,
      suggestedPoints: 300,
      version: 0,
      barcode: '471000100001',
    },
    {
      id: 'GK002',
      name: '火影忍者 鳴人 六道仙人 GK',
      category: 'GK',
      mainCategory: 'GK',
      isSpecial: false,
      sellingPrice: 12000,
      costPrice: 6500,
      suggestedPoints: 240,
      version: 0,
      barcode: '471000100002',
    },
    {
      id: 'GEN001',
      name: '壓克力高級展示盒',
      category: 'GENERAL',
      mainCategory: 'GENERAL',
      isSpecial: false,
      sellingPrice: 300,
      costPrice: 150,
      suggestedPoints: 5,
      version: 0,
      barcode: '471000100003',
    },
    {
      id: '4108',
      name: '海賊王 魯夫 太陽神四檔 巨雕 GK',
      category: 'GK',
      mainCategory: 'GK',
      isSpecial: false,
      sellingPrice: 15000,
      costPrice: 8000,
      suggestedPoints: 300,
      version: 0,
      barcode: '471900100001',
    },
    {
      id: 'BB001',
      name: 'Labubu 盲盒公仔',
      category: 'BLIND_BOX',
      mainCategory: 'BLIND_BOX',
      isSpecial: false,
      sellingPrice: 350,
      costPrice: 200,
      suggestedPoints: 10,
      version: 0,
      barcode: '471000100004',
    },
  ];

  const inventories = [
    { id: 'inv-cp-1', storeId: 'chupei', productId: 'GK001', quantity: 5, safetyStock: 1, version: 0 },
    { id: 'inv-cp-2', storeId: 'chupei', productId: 'GK002', quantity: 3, safetyStock: 1, version: 0 },
    { id: 'inv-cp-3', storeId: 'chupei', productId: 'GEN001', quantity: 50, safetyStock: 5, version: 0 },
    { id: 'inv-cp-4', storeId: 'chupei', productId: 'BB001', quantity: 20, safetyStock: 3, version: 0 },
    { id: 'inv-cp-4108', storeId: 'chupei', productId: '4108', quantity: 5, safetyStock: 1, version: 0 },
    { id: 'inv-js-1', storeId: 'jinshan', productId: 'GK001', quantity: 2, safetyStock: 1, version: 0 },
    { id: 'inv-js-2', storeId: 'jinshan', productId: 'GEN001', quantity: 20, safetyStock: 5, version: 0 },
    { id: 'inv-js-4108', storeId: 'jinshan', productId: '4108', quantity: 2, safetyStock: 1, version: 0 },
  ];

  const sessions = [
    {
      id: 'sess-chupei-active',
      storeId: 'chupei',
      openingCash: 8000,
      openedBy: 'onesoul.chupei@gmail.com',
      status: 'OPEN',
      openedAt: new Date('2026-10-10T10:00:00Z'),
      closedAt: null,
      orders: [],
    },
  ];

  const luckyBags = [
    {
      id: 'LB001',
      storeId: 'chupei',
      name: '海賊王一番賞新年特別企劃',
      unitPrice: 350,
      isPointsSet: false,
      status: 'ACTIVE',
      totalDraws: 30,
      createdAt: new Date('2026-10-01T00:00:00Z'),
      updatedAt: new Date('2026-10-01T00:00:00Z'),
    },
    {
      id: 'LB_PTS_001',
      storeId: 'chupei',
      name: '限定純點數特惠套',
      unitPrice: 340,
      isPointsSet: true,
      status: 'ACTIVE',
      totalDraws: 10,
      createdAt: new Date('2026-10-01T00:00:00Z'),
      updatedAt: new Date('2026-10-01T00:00:00Z'),
    },
  ];

  const luckyBagPrizes = [
    {
      id: 'lbp-001-a',
      bagId: 'LB001',
      prizeGrade: 'A',
      prizeName: 'A賞 魯夫 MASTERLISE',
      productId: 'GK001',
      points: 150,
      draws: 2,
      drawnCount: 0,
      updatedAt: new Date('2026-10-01T00:00:00Z'),
    },
    {
      id: 'lbp-001-b',
      bagId: 'LB001',
      prizeGrade: 'B',
      prizeName: 'B賞 索隆 MASTERLISE',
      productId: null,
      points: 100,
      draws: 3,
      drawnCount: 0,
      updatedAt: new Date('2026-10-01T00:00:00Z'),
    },
    {
      id: 'lbp-001-x',
      bagId: 'LB001',
      prizeGrade: 'X',
      prizeName: 'X賞 盲盒任選',
      productId: null,
      points: 10,
      draws: 5,
      drawnCount: 0,
      updatedAt: new Date('2026-10-01T00:00:00Z'),
    },
    {
      id: 'lbp-001-z',
      bagId: 'LB001',
      prizeGrade: 'Z',
      prizeName: 'Z賞 紀念小徽章',
      productId: null,
      points: 1,
      draws: 20,
      drawnCount: 0,
      updatedAt: new Date('2026-10-01T00:00:00Z'),
    },
    {
      id: 'lbp-pts-a',
      bagId: 'LB_PTS_001',
      prizeGrade: 'A',
      prizeName: 'A賞 特選火影六道鳴人 GK',
      productId: 'GK002',
      points: 0,
      draws: 2,
      drawnCount: 0,
      updatedAt: new Date('2026-10-01T00:00:00Z'),
    },
    {
      id: 'lbp-pts-z',
      bagId: 'LB_PTS_001',
      prizeGrade: 'Z',
      prizeName: 'Z賞 紀念雷射小卡',
      productId: null,
      points: 1,
      draws: 8,
      drawnCount: 0,
      updatedAt: new Date('2026-10-01T00:00:00Z'),
    },
  ];

  const preOrders = [
    {
      id: 'po-001',
      name: '七龍珠 悟吉塔 GK 雕像',
      version: 'EX限定版',
      quantity: 2,
      deposit: 2000,
      finalPayment: 4000,
      shippingFee: 500,
      totalCost: 6500,
      supplier: '玩譯模型',
      targetStoreId: 'chupei',
      productId: null,
      status: 'PENDING',
      arrivedAt: null,
      note: '廠商承諾11月中旬前到貨',
      createdAt: new Date('2026-09-15T00:00:00Z'),
      updatedAt: new Date('2026-09-15T00:00:00Z'),
    },
  ];

  const integrationConfigs = [
    {
      id: 'cfg-brand',
      key: 'STORE_BRAND_INFO',
      value: JSON.stringify({
        brandName: 'OneSoul 模型玩具一番賞',
        brandSubtitle: '門市管理與即時營運系統',
        logoText: 'OS',
        supportPhone: '0912-345-678',
        blindBoxPointsValue: 10,
        pointRateTwd: 20,
        smallPrizePointsValue: 1,
      }),
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    },
  ];

  const genesisPrev = '0000000000000000000000000000000000000000000000000000000000000000';
  const genesisPayload = `${genesisPrev}|system|INIT_SYSTEM|Store|chupei|0|Genesis System Setup`;
  const genesisCurrentHash = crypto.createHmac('sha256', 'onesoul-audit-key-2026').update(genesisPayload).digest('hex');

  const auditLogs = [
    {
      id: 'audit-001',
      operatorId: 'system',
      action: 'INIT_SYSTEM',
      targetType: 'Store',
      targetId: 'chupei',
      beforeState: null,
      afterState: { initialized: true },
      delta: 0,
      reason: 'Genesis System Setup',
      ipAddress: '127.0.0.1',
      prevHash: genesisPrev,
      currentHash: genesisCurrentHash,
      createdAt: new Date('2026-01-01T00:00:00Z'),
    },
  ];

  return {
    members,
    stores: [chupeiStore, jinshanStore],
    sessions,
    products,
    inventories,
    blindBoxes: [],
    luckyBags,
    luckyBagPrizes,
    orders: [],
    orderItems: [],
    pointLogs: [],
    inventoryLogs: [],
    stocktakes: [],
    stocktakeItems: [],
    preOrders,
    auditLogs,
    transferOrders: [],
    transferOrderItems: [],
    integrationConfigs,
    attendances: [],
    attendanceRecords: [],
    schedules: [],
    users: [
      { id: 'u1', email: 'onesoul.admin@gmail.com', name: '總管理員', role: 'SUPER_ADMIN', assignedStoreId: null, isActive: true },
      { id: 'u2', email: 'onesoul.chupei@gmail.com', name: '竹北店長', role: 'STORE_MANAGER', assignedStoreId: 'chupei', isActive: true },
    ],
    allocationPlans: [],
    voidSetLogs: [],
  };
}
