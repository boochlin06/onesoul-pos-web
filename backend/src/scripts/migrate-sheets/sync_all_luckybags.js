const fs = require('fs');
const path = require('path');

const BACKUP_DIR = path.join(__dirname, '../../../data/google_sheets_backup_20261009');
const STORE_PATH = path.join(__dirname, '../../../data/real_migrated_store.json');

const prizesCsv = fs.readFileSync(path.join(BACKUP_DIR, 'luckybag_prizes.csv'), 'utf-8');
const voidCsv = fs.readFileSync(path.join(BACKUP_DIR, 'void_sets.csv'), 'utf-8');

const voidLines = voidCsv.split(/\r?\n/).filter(l => l.trim().length > 0);
const voidSetIds = new Set();
voidLines.slice(1).forEach(l => {
  const parts = l.split(',');
  if (parts[0]) voidSetIds.add(parts[0].replace(/"/g, '').trim());
});

function parseCsvLine(line) {
  const row = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      row.push(cur.replace(/^"|"$/g, '').trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  row.push(cur.replace(/^"|"$/g, '').trim());
  return row;
}

const prizeLines = prizesCsv.split(/\r?\n/).filter(l => l.trim().length > 0);

const bagMap = new Map();
const prizeList = [];

for (let i = 1; i < prizeLines.length; i++) {
  const cols = parseCsvLine(prizeLines[i]);
  const bagId = cols[0];
  const bagName = cols[1];
  const unitPrice = parseInt(cols[2], 10) || 350;
  const prizeCode = cols[3] || '';
  const itemNo = cols[4] || '';
  const prizeName = cols[5] || '';
  const points = parseInt(cols[6], 10) || 0;
  const draws = parseInt(cols[7], 10) || 1;
  const launchDate = cols[8] || '2026/01/25';
  const branchName = cols[9] || '竹北';
  const drawnCount = parseInt(cols[10], 10) || 0;

  if (!bagId || isNaN(parseInt(bagId, 10)) || !bagName) continue;

  const storeId = branchName.includes('金山') ? 'jinshan' : 'chupei';
  const isPointsSet = branchName.includes('點數');
  const isVoid = voidSetIds.has(bagId);

  if (!bagMap.has(bagId)) {
    bagMap.set(bagId, {
      id: bagId,
      name: bagName,
      unitPrice,
      storeId,
      branch: branchName,
      isPointsSet,
      launchDate,
      status: isVoid ? 'VOIDED' : 'ACTIVE',
      createdAt: new Date(launchDate || Date.now()).toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  const pId = `p-${bagId}-${prizeList.filter(p => p.bagId === bagId).length + 1}`;
  prizeList.push({
    id: pId,
    bagId,
    prizeGrade: prizeCode || (prizeName === '非GK' ? 'Z' : '大獎'),
    prizeCode: prizeCode || (prizeName === '非GK' ? 'Z' : '大獎'),
    prizeName: prizeName || '大獎',
    productId: itemNo || null,
    itemNo: itemNo || null,
    points,
    draws,
    drawnCount,
    isMajor: prizeName !== '非GK',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
}

console.log(`總解析套數: ${bagMap.size}, 總解析獎項: ${prizeList.length}`);

const activeBags = Array.from(bagMap.values()).filter(b => b.status === 'ACTIVE');
console.log(`進行中套數 (未廢套): ${activeBags.length}`);

// 更新至 real_migrated_store.json
const store = JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'));
store.luckyBags = Array.from(bagMap.values());
store.luckyBagPrizes = prizeList;

fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
console.log('✅ 已成功更新 real_migrated_store.json 內存資料庫！');
