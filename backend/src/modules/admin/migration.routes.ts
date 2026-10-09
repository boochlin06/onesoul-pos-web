import type { FastifyPluginAsync } from 'fastify';
import { migrationManager } from './migration.service';

export const adminMigrationRoutes: FastifyPluginAsync = async (fastify) => {
  // 1. 取得當前遷移任務狀態
  fastify.get('/migration/status', async (request, reply) => {
    return reply.send({
      success: true,
      data: migrationManager.getState(),
    });
  });

  // 2. 觸發 Google Sheets 全量一鍵遷移
  fastify.post('/migration/run', async (request, reply) => {
    const { dryRun = false, source = 'auto' } = (request.body as any) || {};
    const operatorId = (request as any).user?.email || 'admin@onesoul.com';

    if (migrationManager.isRunning()) {
      return reply.code(409).send({
        success: false,
        message: '遷移任務正在執行中，請等待當前任務完成。',
        data: migrationManager.getState(),
      });
    }

    try {
      const state = await migrationManager.startMigration({
        dryRun,
        source,
        operatorId,
        ipAddress: request.ip,
      });

      return reply.send({
        success: true,
        message: 'Google Sheets 全量一鍵遷移任務已成功啟動！',
        data: state,
      });
    } catch (err: any) {
      return reply.code(500).send({
        success: false,
        message: err.message,
      });
    }
  });

  // 3. SSE (Server-Sent Events) 即時進度串流推播
  fastify.get('/migration/progress', async (request, reply) => {
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('Access-Control-Allow-Origin', '*');

    // 建立連線時立即推播一次當前狀態
    const initialState = migrationManager.getState();
    reply.raw.write(`data: ${JSON.stringify(initialState)}\n\n`);

    const onProgress = (state: any) => {
      reply.raw.write(`data: ${JSON.stringify(state)}\n\n`);
    };

    migrationManager.on('progress', onProgress);

    // 心跳定時器防止中斷
    const heartbeat = setInterval(() => {
      reply.raw.write(':ping\n\n');
    }, 10000);

    request.raw.on('close', () => {
      migrationManager.off('progress', onProgress);
      clearInterval(heartbeat);
    });
  });

  // 4. 取得歷次遷移歷史
  fastify.get('/migration/history', async (request, reply) => {
    return reply.send({
      success: true,
      data: migrationManager.getHistory(),
    });
  });
};
