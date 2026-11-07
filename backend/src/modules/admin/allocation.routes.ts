import type { FastifyPluginAsync } from 'fastify';
import { allocationService, AllocationServiceError } from './allocation/allocation.service.js';
import { DEFAULT_PRESET_TEMPLATES } from './allocation/allocation.templates.js';

// 向下相容匯出經典配置範本庫
export { DEFAULT_PRESET_TEMPLATES };

/**
 * 配賞看板薄 Controller
 * 職責：HTTP 路由分發、參數解構、狀態碼映射與異常捕獲，業務計算與交易全面委託 AllocationService
 */
export const adminAllocationRoutes: FastifyPluginAsync = async (fastify) => {
  // 1. 門市即時現貨看板 (專供配賞參考：現貨 >= 1、支援門市、分類與搜尋)
  fastify.get('/allocation/live-stock', async (request, reply) => {
    const result = await allocationService.getLiveStock(request.query as any);
    return reply.send(result);
  });

  // 2. 取得配賞方案清單 (包含草稿箱與預設常用範本庫)
  fastify.get('/allocation/plans', async (_request, reply) => {
    const result = allocationService.getPlans();
    return reply.send(result);
  });

  // 3. 儲存或更新配賞草稿 / 範本
  fastify.post('/allocation/plans', async (request, reply) => {
    try {
      const result = allocationService.saveDraft(request.body as any);
      return reply.send(result);
    } catch (err: any) {
      const status = err instanceof AllocationServiceError ? err.statusCode : 400;
      return reply.code(status).send({ success: false, message: err.message });
    }
  });

  // 4. 刪除配賞草稿
  fastify.delete('/allocation/plans/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = allocationService.deleteDraft(id);
    return reply.send(result);
  });

  // 5. 發布上線至指定門市 POS 開抽 (支援單套、批次或多方案發布)
  fastify.post('/allocation/plans/publish', async (request, reply) => {
    const operatorId = (request as any).user?.email || 'admin@onesoul.com';
    try {
      const result = await allocationService.publishPlans(request.body as any, operatorId, request.ip);
      return reply.code(201).send(result);
    } catch (err: any) {
      const status = err instanceof AllocationServiceError ? err.statusCode : 400;
      return reply.code(status).send({ success: false, message: err.message });
    }
  });
};
