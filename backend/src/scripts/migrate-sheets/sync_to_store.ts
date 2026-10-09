import fs from 'fs';
import path from 'path';
import { runRealEtl } from './etl_real_backup';

const STORE_JSON_PATH = path.resolve(__dirname, '../../../data/real_migrated_store.json');

async function main() {
  console.log('🚀 開始執行 Google Sheets 真實備份資料 ETL 轉換與同步...');
  const cleaned = runRealEtl();

  const fullStore = {
    stores: [
      { id: 'chupei', name: '竹北旗艦店', code: 'CHUPEI', openTime: '14:00', standardHours: 8, lateGraceMinutes: 15 },
      { id: 'jinshan', name: '金山概念店', code: 'JINSHAN', openTime: '16:00', standardHours: 6, lateGraceMinutes: 15 },
    ],
    members: cleaned.members,
    pointLogs: cleaned.pointLogs,
    products: cleaned.products,
    inventories: cleaned.inventories,
    blindBoxes: [],
    luckyBags: cleaned.luckyBags,
    luckyBagPrizes: cleaned.luckyBagPrizes,
    orders: cleaned.orders,
    sessions: cleaned.sessions,
    inventoryLogs: [],
    stocktakes: [],
    stocktakeItems: [],
    voidSetLogs: [],
    attendances: [],
    schedules: [],
    users: [
      { id: 'u1', email: 'onesoul.admin@gmail.com', name: '總管理員', role: 'SUPER_ADMIN', assignedStoreId: null, isActive: true, createdAt: new Date() },
      { id: 'u2', email: 'onesoul.chupei@gmail.com', name: '竹北店長', role: 'STORE_MANAGER', assignedStoreId: 'chupei', isActive: true, createdAt: new Date() },
    ],
    shiftSchedules: [
      { id: 'sch-1', storeId: 'chupei', date: '2026-10-09', staffName: '王小明', staffEmail: 'onesoul.chupei@gmail.com', shiftType: 'FULL', isClosed: false, note: null, createdAt: new Date(), updatedAt: new Date() },
      { id: 'sch-2', storeId: 'jinshan', date: '2026-10-09', staffName: '李小華', staffEmail: 'onesoul.jinshan@gmail.com', shiftType: 'FULL', isClosed: false, note: null, createdAt: new Date(), updatedAt: new Date() },
    ],
    attendanceRecords: [
      { id: 'att-1', storeId: 'chupei', staffName: '王小明', staffEmail: 'onesoul.chupei@gmail.com', clockInTime: new Date('2026-10-09T05:50:00Z'), isLate: false, lateMinutes: 0, status: 'NORMAL', createdAt: new Date() },
    ],
    integrationConfigs: [
      { id: 'cfg-1', key: 'LINE_NOTIFY', value: { token: 'mock-token', channels: [{ name: 'admin', targetId: 'mock-admin-group' }] }, description: 'LINE 推播設定', isEnabled: true, updatedAt: new Date() },
      { id: 'cfg-2', key: 'TRELLO_BOARD', value: { apiKey: 'mock-trello-key', token: 'mock-trello-token', listId: 'mock-list' }, description: 'Trello GK 卡片設定', isEnabled: true, updatedAt: new Date() },
    ],
    outboxTasks: [],
    emergencyNotices: [],
    auditLogs: cleaned.auditLogs,
  };

  fs.mkdirSync(path.dirname(STORE_JSON_PATH), { recursive: true });
  fs.writeFileSync(STORE_JSON_PATH, JSON.stringify(fullStore, null, 2), 'utf-8');
  console.log(`\n🎉 真實資料庫 JSON 持久化檔案已成功寫入: ${STORE_JSON_PATH}`);
  console.log(`📊 統計指標:`);
  console.log(`  - 會員主檔: ${cleaned.members.length} 筆 (點數歷程: ${cleaned.pointLogs.length} 筆)`);
  console.log(`  - 商品主檔: ${cleaned.products.length} 筆 (雙店庫存條目: ${cleaned.inventories.length} 筆)`);
  console.log(`  - 一番賞套組: ${cleaned.luckyBags.length} 套 (獎項: ${cleaned.luckyBagPrizes.length} 個)`);
  console.log(`  - 歷史班次: ${cleaned.sessions.length} 班`);
  console.log(`  - 銷售交易: ${cleaned.orders.length} 筆`);
  console.log(`  - 審計日誌: 1 筆 (SHA-256 完整性校驗)`);
}

main().catch((err) => {
  console.error('❌ 遷移失敗:', err);
  process.exit(1);
});
