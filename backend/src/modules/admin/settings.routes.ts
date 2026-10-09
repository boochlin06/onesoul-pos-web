import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../plugins/prisma';
import { recordAuditLog } from './audit.service.js';

export const adminSettingsRoutes: FastifyPluginAsync = async (fastify) => {
  // 1. 讀取整合設定 (LINE / Trello / 門市營業時間)
  fastify.get('/settings/integrations', async (request, reply) => {
    const configs = await prisma.integrationConfig.findMany();
    return reply.send({
      success: true,
      data: configs,
    });
  });

  // 2. 更新整合設定
  fastify.put('/settings/integrations', async (request, reply) => {
    const { key, value, description, isEnabled = true } = request.body as any;
    const operatorId = (request as any).user?.email || 'admin@onesoul.com';

    if (!key || !value) {
      return reply.code(400).send({ success: false, message: '缺少 key 或 value' });
    }

    const updated = await prisma.integrationConfig.upsert({
      where: { key },
      create: {
        key,
        value,
        description,
        isEnabled,
        updatedBy: operatorId,
      },
      update: {
        value,
        description,
        isEnabled,
        updatedBy: operatorId,
      },
    });

    await recordAuditLog(prisma, {
      operatorId,
      action: 'UPDATE_INTEGRATION_CONFIG',
      targetType: 'IntegrationConfig',
      targetId: key,
      afterState: value,
      reason: `更新外部整合設定：${key}`,
      ipAddress: request.ip,
    });

    return reply.send({
      success: true,
      message: '設定已更新',
      data: updated,
    });
  });

  // 3. 測試發送 LINE 訊息
  fastify.post('/settings/line-test', async (request, reply) => {
    const { channel = 'admin', message = 'OneSoul ERP 測試推播訊息' } = request.body as any;

    fastify.log.info({ channel, message }, `[LINE Test] Simulated sending push notification`);

    return reply.send({
      success: true,
      message: `已向 [${channel}] 頻道模擬發送測試推播`,
    });
  });

  // 4. POS 緊急廣播公告管理
  fastify.get('/settings/emergency-notices', async (request, reply) => {
    const notices = await prisma.emergencyNotice.findMany();
    return reply.send({
      success: true,
      data: notices,
    });
  });

  fastify.post('/settings/emergency-notices', async (request, reply) => {
    const { title, content, level = 'WARNING', targetStoreIds = [] } = request.body as any;
    const publisherEmail = (request as any).user?.email || 'admin@onesoul.com';

    if (!title || !content) {
      return reply.code(400).send({ success: false, message: '公告標題與內容為必填' });
    }

    // 先停用其他公告
    await prisma.emergencyNotice.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });

    const created = await prisma.emergencyNotice.create({
      data: {
        title,
        content,
        level,
        targetStoreIds,
        isActive: true,
        publisherEmail,
      },
    });

    await recordAuditLog(prisma, {
      operatorId: publisherEmail,
      action: 'PUBLISH_EMERGENCY_NOTICE',
      targetType: 'EmergencyNotice',
      targetId: created.id,
      afterState: { title, level },
      reason: `發佈緊急公告：${title}`,
      ipAddress: request.ip,
    });

    return reply.send({
      success: true,
      message: '緊急公告發佈成功，各門市 POS 將即時彈窗',
      data: created,
    });
  });

  fastify.delete('/settings/emergency-notices/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    await prisma.emergencyNotice.updateMany({
      where: { id },
      data: { isActive: false },
    });

    return reply.send({
      success: true,
      message: '公告已撤回',
    });
  });

  // 5. SSE (Server-Sent Events) POS 長連線公告推播端點
  fastify.get('/notifications/stream', async (request, reply) => {
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');

    // 發送即時心跳
    reply.raw.write(':ping\n\n');

    // 取得當前有效公告
    const activeNotice = await prisma.emergencyNotice.findFirst({
      where: { isActive: true },
    });

    if (activeNotice) {
      reply.raw.write(`data: ${JSON.stringify(activeNotice)}\n\n`);
    }

    // 當客戶端斷線時清理
    request.raw.on('close', () => {
      // client disconnected
    });
  });
};
