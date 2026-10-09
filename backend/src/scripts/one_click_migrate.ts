import { migrationManager } from '../modules/admin/migration.service';
import { initPrisma } from '../plugins/prisma';

async function main() {
  const args = process.argv.slice(2);
  const isExecute = args.includes('--execute') || args.includes('-e');
  const dryRun = !isExecute;

  console.log(`\n================================================================`);
  console.log(`🚀 OneSoul POS Google Sheets 全量一鍵極速遷移 CLI 引擎`);
  console.log(`================================================================`);

  await initPrisma();

  migrationManager.on('progress', (state) => {
    // 列印最新一筆 log
    const lastLog = state.logs[state.logs.length - 1];
    if (lastLog) {
      const color =
        lastLog.level === 'error'
          ? '\x1b[31m'
          : lastLog.level === 'success'
          ? '\x1b[32m'
          : lastLog.level === 'warn'
          ? '\x1b[33m'
          : '\x1b[36m';
      console.log(`[${lastLog.time}] ${color}[${lastLog.level.toUpperCase()}]\x1b[0m ${lastLog.message}`);
    }
  });

  try {
    const initialState = await migrationManager.startMigration({
      dryRun,
      source: 'auto',
      operatorId: 'cli-admin@onesoul.com',
    });

    // 輪詢等待完成
    await new Promise<void>((resolve, reject) => {
      const timer = setInterval(() => {
        const state = migrationManager.getState();
        if (state.status === 'COMPLETED') {
          clearInterval(timer);
          resolve();
        } else if (state.status === 'FAILED') {
          clearInterval(timer);
          reject(new Error(state.error || '遷移執行失敗'));
        }
      }, 500);
    });

    const finalState = migrationManager.getState();
    console.log(`\n================================================================`);
    console.log(`🏁 遷移報告總覽 (耗時: ${(finalState.durationMs / 1000).toFixed(2)} 秒)`);
    console.log(`  - 👥 會員主檔: ${finalState.metrics.members.imported} 筆 (衝突/異常排除: ${finalState.metrics.members.conflicts} 筆)`);
    console.log(`  - 📦 商品主檔: ${finalState.metrics.products.imported} 筆`);
    console.log(`  - 🏬 門市庫存: 竹北 ${finalState.metrics.inventories.chupei} 件 | 金山 ${finalState.metrics.inventories.jinshan} 件`);
    console.log(`  - 🎯 一番賞套組: ${finalState.metrics.luckyBags.bags} 套 (獎項: ${finalState.metrics.luckyBags.prizes} 個)`);
    console.log(`  - 💼 開關帳班次: ${finalState.metrics.sessions.imported} 班`);
    console.log(`  - 🧾 銷售交易: ${finalState.metrics.orders.imported} 筆`);
    console.log(`================================================================\n`);

    process.exit(0);
  } catch (err: any) {
    console.error(`\n❌ 致命錯誤: ${err.message}\n`);
    process.exit(1);
  }
}

main();
