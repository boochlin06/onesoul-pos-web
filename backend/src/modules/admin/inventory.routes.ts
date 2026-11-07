import type { FastifyPluginAsync } from 'fastify';
import {
  inventoryService,
  InventoryServiceError,
} from './inventory/inventory.service.js';
import {
  resolveCanonicalIP,
  IP_TO_RAW_CATEGORY_MAP,
} from './inventory/inventory.calculator.js';

// 向下相容既有模組與全域依賴引用
export { resolveCanonicalIP, IP_TO_RAW_CATEGORY_MAP };

export const adminInventoryRoutes: FastifyPluginAsync = async (fastify) => {
  // 0. 極速輕量商品自動補全 (Autocomplete / Suggest)
  fastify.get('/inventory/suggest', async (request, reply) => {
    const { q, storeId, limit } = request.query as any;
    const result = await inventoryService.suggest({ q, storeId, limit });
    return reply.send(result);
  });

  // 1. 跨門市商品庫存水平對照總覽
  fastify.get('/inventory/summary', async (request, reply) => {
    const query = request.query as any;
    const result = await inventoryService.getSummary(query);
    return reply.send(result);
  });

  // 1.2 跨店 IP 存貨平衡與動銷決策看板分析
  fastify.get('/inventory/decision-analytics', async (request, reply) => {
    const query = request.query as any;
    const result = await inventoryService.getDecisionAnalytics(query);
    return reply.send(result);
  });

  // 1.5 獲取商品全部分類清單
  fastify.get('/inventory/categories', async (_request, reply) => {
    const result = await inventoryService.getCategories();
    return reply.send(result);
  });

  // 2. 手動新增單品主檔與各門市期初庫存錄入
  fastify.post('/inventory/products', async (request, reply) => {
    const operatorId = (request as any).user?.email || 'admin@onesoul.com';
    try {
      const result = await inventoryService.createProduct(request.body as any, operatorId);
      return reply.code(201).send(result);
    } catch (err: any) {
      const status = err instanceof InventoryServiceError ? err.statusCode : 400;
      return reply.code(status).send({
        success: false,
        message: err.message || '新增商品主檔失敗',
      });
    }
  });

  // 3. 修改商品主檔 (支援樂觀鎖 version 與類別更新)
  fastify.put('/inventory/products/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const operatorId = (request as any).user?.email || 'admin@onesoul.com';
    try {
      const result = await inventoryService.updateProduct(id, request.body as any, operatorId, request.ip);
      return reply.send(result);
    } catch (err: any) {
      const status = err instanceof InventoryServiceError ? err.statusCode : 400;
      return reply.code(status).send({
        success: false,
        message: err.message || '修改商品主檔失敗',
      });
    }
  });

  // 3. 單品手動庫存調帳 (附理由與審計日誌)
  fastify.post('/inventory/adjust-stock', async (request, reply) => {
    const operatorId = (request as any).user?.email || 'admin@onesoul.com';
    try {
      const result = await inventoryService.adjustStock(request.body as any, operatorId, request.ip);
      return reply.send(result);
    } catch (err: any) {
      const status = err instanceof InventoryServiceError ? err.statusCode : 400;
      return reply.code(status).send({
        success: false,
        message: err.message || '庫存調帳失敗',
      });
    }
  });

  // 3.5 試算表級批次原地更新 (商品主檔 + 門市庫存調帳一次性原子提交)
  fastify.post('/inventory/batch-update', async (request, reply) => {
    const operatorId = (request as any).user?.email || 'admin@onesoul.com';
    try {
      const result = await inventoryService.batchUpdate(request.body as any, operatorId, request.ip);
      return reply.send(result);
    } catch (err: any) {
      const status = err instanceof InventoryServiceError ? err.statusCode : 400;
      return reply.code(status).send({
        success: false,
        message: err.message || '批次更新失敗',
      });
    }
  });

  // 4. Excel / CSV 批次上架精靈 (Bulk Import)
  fastify.post('/inventory/products/bulk-import', async (request, reply) => {
    const operatorId = (request as any).user?.email || 'admin@onesoul.com';
    try {
      const result = await inventoryService.bulkImport(request.body as any, operatorId, request.ip);
      return reply.send(result);
    } catch (err: any) {
      const status = err instanceof InventoryServiceError ? err.statusCode : 400;
      return reply.code(status).send({
        success: false,
        message: err.message || '批次匯入失敗',
      });
    }
  });
};
