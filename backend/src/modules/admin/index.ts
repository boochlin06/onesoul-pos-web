import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../plugins/prisma';
import { authenticate, requireAdmin } from '../../plugins/auth';
import { adminMembersRoutes } from './members.routes.js';
import { adminInventoryRoutes } from './inventory.routes.js';
import { adminLotteryRoutes } from './lottery.routes.js';
import { adminReportsRoutes } from './reports.routes.js';
import { adminScheduleRoutes } from './schedule.routes.js';
import { adminSettingsRoutes } from './settings.routes.js';
import { adminAuditRoutes } from './audit.routes.js';
import { processOutboxTasks } from './outbox.service.js';

export const adminPlugin: FastifyPluginAsync = async (fastify) => {
  // 🛡️ OWASP Top 10 / MASVS: 全域掛載身份認證與大師管理員權限防護 (全 /api/admin/* 端點生效)
  fastify.addHook('onRequest', authenticate);
  fastify.addHook('preHandler', requireAdmin);

  // 註冊 Admin 各模組子路由
  await fastify.register(adminMembersRoutes);
  await fastify.register(adminInventoryRoutes);
  await fastify.register(adminLotteryRoutes);
  await fastify.register(adminReportsRoutes);
  await fastify.register(adminScheduleRoutes);
  await fastify.register(adminSettingsRoutes);
  await fastify.register(adminAuditRoutes);

  // 啟動 Transactional Outbox Worker (每 5 秒非同步處理 PENDING 任務)
  const workerInterval = setInterval(async () => {
    try {
      await processOutboxTasks(prisma, fastify.log);
    } catch (e: any) {
      fastify.log.error({ err: e.message }, '[OutboxWorker] Error processing tasks');
    }
  }, 5000);

  fastify.addHook('onClose', (_instance, done) => {
    clearInterval(workerInterval);
    done();
  });
};
