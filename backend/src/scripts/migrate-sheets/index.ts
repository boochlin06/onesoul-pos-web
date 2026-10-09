import { SheetMigrator } from './migrator';

async function main() {
  const args = process.argv.slice(2);
  const isExecute = args.includes('--execute');
  const dryRun = !isExecute;

  const dataDirIdx = args.indexOf('--data-dir');
  const dataDir = dataDirIdx !== -1 ? args[dataDirIdx + 1] : undefined;

  const migrator = new SheetMigrator({
    dryRun,
    dataDir,
  });

  try {
    await migrator.run();
    process.exit(0);
  } catch (err: any) {
    console.error('❌ 遷移過程發生嚴重錯誤:', err);
    process.exit(1);
  }
}

main();
