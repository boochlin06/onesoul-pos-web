import { execSync } from 'node:child_process';

export const TENANT_DATABASES = [
  { id: 'chupei', name: '竹北門市', d1Name: 'DB_CHUPEI' },
  { id: 'jinshan', name: '金山門市', d1Name: 'DB_JINSHAN' },
  { id: 'warehouse', name: '中央總倉', d1Name: 'DB_WAREHOUSE' },
  { id: 'coordinator', name: '全域協調庫', d1Name: 'DB_COORDINATOR' },
];

export async function runTenantMigrations(options?: { remote?: boolean }): Promise<void> {
  const isRemote = options?.remote ?? process.argv.includes('--remote');
  const flag = isRemote ? '--remote' : '--local';

  console.log(`🚀 [D1 Migration] 開始執行全門市資料庫遷移 (${flag})...`);

  for (const tenant of TENANT_DATABASES) {
    console.log(`📦 正在遷移 [${tenant.name}] (${tenant.d1Name})...`);
    try {
      execSync(`npx wrangler d1 migrations apply ${tenant.d1Name} ${flag}`, {
        stdio: 'inherit',
      });
      console.log(`✅ [${tenant.name}] 遷移完成！`);
    } catch (err: any) {
      console.error(`❌ [${tenant.name}] 遷移失敗:`, err.message);
      throw err;
    }
  }

  console.log('🎉 全門市 D1 遷移作業 100% 成功！');
}

if (process.argv[1]?.endsWith('migrate-tenants.ts')) {
  runTenantMigrations().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
