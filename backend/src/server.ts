import { buildApp } from './app';
import { config } from './config';
import { initPrisma } from './plugins/prisma';

async function start() {
  await initPrisma();
  const app = buildApp();

  try {
    const address = await app.listen({
      port: config.PORT,
      host: config.HOST,
    });
    console.log(`🚀 OneSoul POS 後端服務已啟動: ${address}`);
    console.log(`🖥️ 後端視覺化管理儀表板: ${address}/`);
    console.log(`📋 健康檢查端點: ${address}/health`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
