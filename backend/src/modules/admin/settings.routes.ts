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

  // 5. 動態門市主檔管理 (支援單門市預設，可擴增至最多 5 間門市)
  fastify.get('/settings/stores', async (request, reply) => {
    const stores = await prisma.store.findMany();
    return reply.send({
      success: true,
      data: stores,
      meta: {
        total: stores.length,
        isSingleStore: stores.length === 1,
        canAddMore: stores.length < 5,
        maxStores: 5,
      },
    });
  });

  fastify.post('/settings/stores', async (request, reply) => {
    const { name, code, openTime = '12:00', standardHours = 8 } = request.body as any;
    const operatorId = (request as any).user?.email || 'admin@onesoul.com';

    if (!name || !name.trim()) {
      return reply.code(400).send({ success: false, message: '門市名稱為必填' });
    }

    const currentStores = await prisma.store.findMany();
    if (currentStores.length >= 5) {
      return reply.code(400).send({
        success: false,
        message: '⚠️ 門市擴增上限為 5 間！為維護輕量與低資源消耗架構，目前最多支援 5 間分店。',
      });
    }

    const storeId = (code || `store-${Date.now().toString().slice(-4)}`).toLowerCase().trim();
    const storeCode = (code || `STORE${currentStores.length + 1}`).toUpperCase().trim();

    const created = await prisma.store.create({
      data: {
        id: storeId,
        name: name.trim(),
        code: storeCode,
        isActive: true,
        openTime,
        standardHours,
        lateGraceMinutes: 15,
      },
    });

    await recordAuditLog(prisma, {
      operatorId,
      action: 'CREATE_STORE',
      targetType: 'Store',
      targetId: created.id,
      afterState: { name: created.name, code: created.code },
      reason: `新增門市分店：${created.name} (${currentStores.length + 1}/5)`,
      ipAddress: request.ip,
    });

    return reply.code(201).send({
      success: true,
      message: `🎉 門市「${created.name}」已成功新增！目前共有 ${currentStores.length + 1} 間門市。`,
      data: created,
    });
  });

  fastify.put('/settings/stores/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { name, code, openTime, standardHours, isActive } = request.body as any;
    const operatorId = (request as any).user?.email || 'admin@onesoul.com';

    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (code !== undefined) updateData.code = code.trim().toUpperCase();
    if (openTime !== undefined) updateData.openTime = openTime;
    if (standardHours !== undefined) updateData.standardHours = Number(standardHours) || 8;
    if (isActive !== undefined) updateData.isActive = !!isActive;

    const updated = await prisma.store.update({
      where: { id },
      data: updateData,
    });

    await recordAuditLog(prisma, {
      operatorId,
      action: 'UPDATE_STORE',
      targetType: 'Store',
      targetId: id,
      afterState: updateData,
      reason: `修改門市主檔資訊：${updated.name}`,
      ipAddress: request.ip,
    });

    return reply.send({
      success: true,
      message: `門市「${updated.name}」資料已更新`,
      data: updated,
    });
  });

  fastify.delete('/settings/stores/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const operatorId = (request as any).user?.email || 'admin@onesoul.com';

    const currentStores = await prisma.store.findMany();
    if (currentStores.length <= 1) {
      return reply.code(400).send({
        success: false,
        message: '⚠️ 無法刪除：系統中必須至少保留 1 間主要門市！',
      });
    }

    const deleted = await prisma.store.delete({
      where: { id },
    });

    await recordAuditLog(prisma, {
      operatorId,
      action: 'DELETE_STORE',
      targetType: 'Store',
      targetId: id,
      reason: `刪除/關閉門市分店：${id}`,
      ipAddress: request.ip,
    });

    return reply.send({
      success: true,
      message: `門市已成功移除`,
      data: deleted,
    });
  });

  // 6. 店家品牌與系統資訊設定 (便於推廣給不同店家快速替換品牌)
  fastify.get('/settings/brand', async (request, reply) => {
    const brandConfig = await prisma.integrationConfig.findUnique({
      where: { key: 'STORE_BRAND_INFO' },
    });

    const defaultBrand = {
      brandName: 'OneSoul 模型玩具一番賞',
      brandSubtitle: '門市管理與即時營運系統',
      logoText: 'OS',
      supportPhone: '0912-345-678',
      blindBoxPointsValue: 10, // 一番賞 X 賞盲盒等價點數 (預設 10 點)
      pointRateTwd: 20, // 點數現金匯率 (預設 1 點 = 20 元台幣)
      smallPrizePointsValue: 1, // 一番賞 Z 賞小賞等價點數 (預設 1 點)
    };

    let brandData = { ...defaultBrand };
    if (brandConfig?.value) {
      try {
        const parsed = typeof brandConfig.value === 'string'
          ? JSON.parse(brandConfig.value)
          : (brandConfig.value as any);
        brandData = { ...defaultBrand, ...parsed };
      } catch {
        brandData = { ...defaultBrand };
      }
    }

    return reply.send({
      success: true,
      data: brandData,
    });
  });

  fastify.put('/settings/brand', async (request, reply) => {
    const body = request.body as any;
    const operatorId = (request as any).user?.email || 'admin@onesoul.com';

    const updated = await prisma.integrationConfig.upsert({
      where: { key: 'STORE_BRAND_INFO' },
      create: {
        key: 'STORE_BRAND_INFO',
        value: JSON.stringify(body),
        description: '店家品牌名稱與Logo客製設定',
        isEnabled: true,
        updatedBy: operatorId,
      },
      update: {
        value: JSON.stringify(body),
        updatedBy: operatorId,
      },
    });

    return reply.send({
      success: true,
      message: '店家品牌客製化資訊已更新',
      data: body,
    });
  });
};
