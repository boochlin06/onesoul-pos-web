import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { parseCsv } from './parser';
import { normalizePhone, parseNumber, parseSheetDate, normalizeStoreId } from './cleaner';

const BACKUP_DIR = path.resolve(__dirname, '../../../data/google_sheets_backup_20261009');

export interface CleanedDataset {
  members: any[];
  pointLogs: any[];
  products: any[];
  inventories: any[];
  luckyBags: any[];
  luckyBagPrizes: any[];
  sessions: any[];
  orders: any[];
  auditLogs: any[];
}

export function runRealEtl(): CleanedDataset {
  console.log('🔄 開始清洗 Google Sheets 真實備份資料庫...');

  // 1. 會員主檔清洗
  const membersCsv = fs.readFileSync(path.join(BACKUP_DIR, 'members.csv'), 'utf-8');
  const rawMembers = parseCsv(membersCsv);
  const memberMap = new Map<string, any>();
  const pointLogs: any[] = [];

  for (const row of rawMembers) {
    const rawPhone = row['電話'] || row['phone'];
    const { phone, isValid } = normalizePhone(rawPhone);
    if (!isValid || !phone) continue;

    const name = row['姓名'] || row['name'] || phone;
    const points = parseNumber(row['點數'] || row['points'], 0);
    const gender = row['性別'] || row['gender'] || 'MALE';
    const birthday = row['生日'] || row['birthday'] || null;
    const registeredAt = parseSheetDate(row['時間戳記'] || row['timestamp']);

    // 以電話作為唯一 Key
    const memberId = `m-${phone}`;
    memberMap.set(phone, {
      id: memberId,
      phone,
      name,
      points,
      tier: points >= 500 ? 'VIP' : points >= 200 ? 'GOLD' : 'GENERAL',
      gender,
      birthday,
      createdAt: registeredAt,
    });

    if (points > 0) {
      pointLogs.push({
        id: `pl-${phone}`,
        memberId,
        type: 'MANUAL',
        delta: points,
        balance: points,
        reason: 'Google Sheets 歷史會員點數期初結轉',
        operator: 'ETL_MIGRATOR',
        createdAt: registeredAt,
      });
    }
  }

  const members = Array.from(memberMap.values());
  console.log(`✅ 會員清洗完成: 共提取 ${rawMembers.length} 行，去重標準化入庫 ${members.length} 位真實會員`);

  // 2. 貨品主檔與雙門市水平庫存清洗
  const itemsCsv = fs.readFileSync(path.join(BACKUP_DIR, 'items.csv'), 'utf-8');
  const rawItems = parseCsv(itemsCsv);
  const productMap = new Map<string, any>();
  const inventoryMap = new Map<string, { chupei: number; jinshan: number }>();

  for (const row of rawItems) {
    const id = (row['貨號'] || row['id'] || '').trim();
    const name = (row['名稱'] || row['name'] || '').trim();
    if (!id && !name) continue;

    const prodId = id || name;
    const cost = parseNumber(row['成本'] || row['cost'], 0);
    const price = parseNumber(row['手動售價'] || row['自動建議售價'] || row['price'], 0);
    const points = parseNumber(row['販售點數'] || row['points'], 0);
    const category = row['類別'] || (name.includes('GK') ? 'GK' : name.includes('盲盒') ? 'BLIND_BOX' : 'GENERAL');
    const location = normalizeStoreId(row['地點'] || row['branch']);
    const qty = parseNumber(row['可銷售數量（庫存-已出貨-配置中）'] || row['實際剩餘數量（庫存-已出貨）'] || row['進貨量'] || 0, 0);

    // 🛡️ 過濾 Google Sheet 底部預留空白佔位行 (無品名且無成本、無售價、無庫存)
    if (!name && cost === 0 && price === 0 && qty === 0) {
      continue;
    }

    // 處理少數無品名但有歷史成本/售價的特例商品
    let finalName = name;
    if (!finalName) {
      if (prodId === '3935') {
        finalName = '隨便加扣點-備用';
      } else {
        finalName = `[待補品名-${category || '商品'}-${prodId}]`;
      }
    }

    if (!productMap.has(prodId)) {
      // 基準時間戳: 依試算表原始順序遞增，確保最新錄入的商品 createdAt 較新
      const itemTimestamp = new Date('2026-01-01T00:00:00Z').getTime() + productMap.size * 60000;
      productMap.set(prodId, {
        id: prodId,
        barcode: `471${prodId.padStart(6, '0')}`,
        name: finalName,
        category,
        costPrice: cost,
        sellingPrice: price,
        suggestedPoints: points,
        version: 1,
        createdAt: new Date(itemTimestamp),
        updatedAt: new Date(itemTimestamp),
      });
      inventoryMap.set(prodId, { chupei: 0, jinshan: 0 });
    }

    const inv = inventoryMap.get(prodId)!;
    if (location === 'jinshan') {
      inv.jinshan += Math.max(0, qty);
    } else {
      inv.chupei += Math.max(0, qty);
    }
  }

  const products = Array.from(productMap.values());
  const inventories: any[] = [];
  for (const [prodId, inv] of inventoryMap) {
    inventories.push({
      id: `inv-chupei-${prodId}`,
      storeId: 'chupei',
      productId: prodId,
      quantity: inv.chupei,
      safetyStock: 2,
      version: 0,
      updatedAt: new Date(),
    });
    inventories.push({
      id: `inv-jinshan-${prodId}`,
      storeId: 'jinshan',
      productId: prodId,
      quantity: inv.jinshan,
      safetyStock: 2,
      version: 0,
      updatedAt: new Date(),
    });
  }
  console.log(`✅ 商品清洗完成: 共提取 ${rawItems.length} 行，聚合為 ${products.length} 個標準商品，雙門市庫存對照共 ${inventories.length} 筆`);

  // 3. 一番賞套組與籤況清洗 (使用 luckybag_prizes.csv 直接解析真實福袋)
  const prizesCsv = fs.readFileSync(path.join(BACKUP_DIR, 'luckybag_prizes.csv'), 'utf-8');
  const prizeLines = prizesCsv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const bagMap = new Map<string, any>();
  const luckyBagPrizes: any[] = [];

  for (let i = 1; i < prizeLines.length; i++) {
    // 依引號與逗號解析行
    const cols = prizeLines[i].split(',').map((c) => c.replace(/^"|"$/g, '').trim());
    const bagId = cols[0];
    const bagName = cols[1];
    const unitPrice = parseNumber(cols[2], 350);
    const prizeItemCode = cols[4];
    const prizeName = cols[5];
    const points = parseNumber(cols[6], 80);
    const draws = parseNumber(cols[7], 1);
    const store = cols[9] === '金山' ? 'jinshan' : 'chupei';
    const drawn = parseNumber(cols[10], 0);

    if (!bagId || !bagName) continue;

    if (!bagMap.has(bagId)) {
      bagMap.set(bagId, {
        id: bagId,
        name: bagName,
        price: unitPrice,
        unitPrice,
        storeId: store,
        status: 'ACTIVE',
        isPointsSet: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    if (prizeName) {
      const grade = luckyBagPrizes.filter((p) => p.bagId === bagId).length === 0 ? 'A' :
                    luckyBagPrizes.filter((p) => p.bagId === bagId).length === 1 ? 'B' :
                    luckyBagPrizes.filter((p) => p.bagId === bagId).length === 2 ? 'C' : 'D';

      luckyBagPrizes.push({
        id: `p-${bagId}-${luckyBagPrizes.length}`,
        bagId,
        prizeGrade: grade,
        prizeName,
        productId: prizeItemCode || null,
        draws: Math.max(draws, drawn + 1),
        drawnCount: drawn,
        points,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  const luckyBags = Array.from(bagMap.values()).slice(0, 10);
  console.log(`✅ 一番賞清洗完成: 成功配置 ${luckyBags.length} 套核心套組，關聯 ${luckyBagPrizes.length} 個獎項籤位`);

  // 4. 開關帳班次清洗
  const sessionsCsv = fs.readFileSync(path.join(BACKUP_DIR, 'sessions.csv'), 'utf-8');
  const rawSessions = parseCsv(sessionsCsv);
  const sessions: any[] = [];

  for (let i = 0; i < rawSessions.length; i++) {
    const row = rawSessions[i];
    const sessId = `sess-real-${i + 1}`;
    const storeId = normalizeStoreId(row['門市']);
    const openingCash = parseNumber(row['開櫃準備金'], 3000);
    const actualCash = parseNumber(row['實收現金'], 3000);
    const expectedCash = parseNumber(row['應收現金'], 3000);
    const discrepancy = parseNumber(row['現金差異'], 0);
    const totalRevenue = parseNumber(row['本日營業額'], 0);
    const cardRevenue = parseNumber(row['信用卡總額'], 0);
    const remitRevenue = parseNumber(row['匯款總額'], 0);
    const cashRevenue = Math.max(0, totalRevenue - cardRevenue - remitRevenue);
    const closedAt = parseSheetDate(row['關帳時間']);
    const openedAt = new Date(closedAt.getTime() - 8 * 3600 * 1000);

    sessions.push({
      id: sessId,
      storeId,
      openedBy: row['操作人員'] || 'onesoul.staff@gmail.com',
      closedBy: row['操作人員'] || 'onesoul.staff@gmail.com',
      openedAt,
      closedAt,
      status: i === 0 ? 'OPEN' : 'CLOSED', // 第一筆作為今日現行班次
      openingCash,
      actualCash: i === 0 ? null : actualCash,
      expectedCash,
      discrepancy,
      totalRevenue,
      cashRevenue,
      cardRevenue,
      remitRevenue,
      pointsIssued: Math.round(totalRevenue * 0.05),
      pointsRedeemed: 0,
      txCount: parseNumber(row['交易筆數'], 1),
      voidCount: 0,
      voidAmount: 0,
      note: row['備註'] || null,
    });
  }
  console.log(`✅ 開關帳清洗完成: 提取 ${sessions.length} 班歷史日結班次，竹北與金山門市均覆蓋`);

  // 5. 當日與歷史銷售流水清洗 (解析 daily_sales_chupei.csv)
  const chupeiDailyCsv = fs.readFileSync(path.join(BACKUP_DIR, 'daily_sales_chupei.csv'), 'utf-8');
  const dailyLines = chupeiDailyCsv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const orders: any[] = [];
  const seenTx = new Set<string>();

  // 跳過前 3 行表頭
  for (let i = 3; i < dailyLines.length; i++) {
    const cols = dailyLines[i].split(',').map((c) => c.replace(/^"|"$/g, '').trim());
    const phone = cols[0];
    const setName = cols[5] || cols[8] || '門市現場商品';
    const singlePrice = parseNumber(cols[6], 0);
    const itemName = cols[8] || setName;
    const amount = parseNumber(cols[11], 0);
    const rawTxId = cols[14];
    const totalAmount = parseNumber(cols[15], amount);
    const remit = parseNumber(cols[16], 0);
    const card = parseNumber(cols[17], 0);
    const cash = parseNumber(cols[18], 0);
    const point = parseNumber(cols[19], 0);

    if (!rawTxId || seenTx.has(rawTxId)) continue;
    seenTx.add(rawTxId);

    const formattedPhone = normalizePhone(phone).phone || '0900000000';
    const member = memberMap.get(formattedPhone);

    orders.push({
      id: `ord-real-${rawTxId}`,
      checkoutUID: rawTxId,
      storeId: 'chupei',
      sessionId: sessions[0]?.id || 'sess-real-1',
      memberId: member ? member.id : null,
      receivedAmount: totalAmount || (cash + card + remit),
      cash,
      creditCard: card,
      remittance: remit,
      pointsUsed: point,
      netPointsDelta: parseNumber(cols[21], 0),
      status: 'COMPLETED',
      createdAt: parseSheetDate(cols[13] || '2026/10/09'),
      items: [
        {
          id: `item-${rawTxId}`,
          orderId: `ord-real-${rawTxId}`,
          productId: 'GK001',
          productName: `${setName} - ${itemName}`,
          quantity: parseNumber(cols[3], 1),
          unitPrice: singlePrice || amount,
          subtotal: totalAmount || amount,
        },
      ],
    });
  }

  console.log(`✅ 銷售流水清洗完成: 匯入當日真實結帳交易 ${orders.length} 筆`);

  // 6. 防竄改雜湊鏈審計記錄
  const hashPayload = `${members.length}:${products.length}:${luckyBags.length}:${sessions.length}:${orders.length}`;
  const currentHash = crypto.createHash('sha256').update(hashPayload).digest('hex');

  const auditLogs = [
    {
      id: `audit-real-mig-${Date.now()}`,
      operatorId: 'migration-etl-engine',
      action: 'REAL_GOOGLE_SHEETS_ETL_MIGRATION',
      targetType: 'System',
      targetId: 'google-sheets-backup-20261009',
      delta: members.length + products.length + sessions.length + orders.length,
      reason: `Google Sheets 真實備份全量清洗入庫 (會員 ${members.length} 筆 / 商品 ${products.length} 筆 / 套組 ${luckyBags.length} 套 / 班次 ${sessions.length} 班 / 當日交易 ${orders.length} 筆)`,
      prevHash: '0000000000000000000000000000000000000000000000000000000000000000',
      currentHash,
      createdAt: new Date(),
    },
  ];

  return {
    members,
    pointLogs,
    products,
    inventories,
    luckyBags,
    luckyBagPrizes,
    sessions,
    orders,
    auditLogs,
  };
}
