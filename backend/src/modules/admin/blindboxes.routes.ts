import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../plugins/prisma';
import { recordAuditLog } from './audit.service.js';

export const adminBlindBoxesRoutes: FastifyPluginAsync = async (fastify) => {
  // 1. 盲盒專區清單與 KPI 統計
  fastify.get('/blindboxes', async (request, reply) => {
    const {
      q = '',
      storeId = 'all',
      sortBy = 'id',
      sortOrder = 'asc',
      page,
      pageSize = '50',
    } = request.query as any;

    const searchKeyword = String(q || '').trim().toLowerCase();

    // 取得所有盲盒資料與門市
    const [rawBoxes, stores] = await Promise.all([
      (prisma as any).blindBox.findMany(),
      prisma.store.findMany({ where: { isActive: true } }),
    ]);

    let list: any[] = (rawBoxes || []).map((b: any) => {
      const cost = Number(b.costPrice || 0);
      const price = Number(b.sellingPrice || 0);
      const margin = price > 0 ? Number((((price - cost) / price) * 100).toFixed(1)) : 0;
      const profit = price - cost;
      const stock = Number(b.stock || 0);
      const storeStocks = b.storeStocks || { chupei: stock, jinshan: 0 };

      // 視角庫存 (若選特定門市)
      const currentStock = storeId === 'all' ? stock : (storeStocks[storeId] || 0);

      return {
        id: b.id,
        barcode: b.barcode || `471${b.id}`,
        name: b.name,
        category: b.category || '盲盒',
        costPrice: cost,
        sellingPrice: price,
        profit,
        marginRate: margin,
        suggestedPoints: b.suggestedPoints || Math.round(price * 0.05),
        stock,
        currentStock,
        storeStocks,
        note: b.note || '',
        version: b.version || 0,
        updatedAt: b.updatedAt || new Date().toISOString(),
      };
    });

    // 關鍵字搜尋 (品名、貨號、條碼)
    if (searchKeyword) {
      list = list.filter((item) =>
        item.name.toLowerCase().includes(searchKeyword) ||
        item.id.toLowerCase().includes(searchKeyword) ||
        item.barcode.toLowerCase().includes(searchKeyword)
      );
    }

    // 排序
    list.sort((a, b) => {
      let valA: any = a[sortBy];
      let valB: any = b[sortBy];

      if (sortBy === 'id') {
        valA = parseInt(a.id, 10) || a.id;
        valB = parseInt(b.id, 10) || b.id;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    // 全量 KPI 計算
    const totalCount = list.length;
    const totalStock = list.reduce((acc, cur) => acc + cur.stock, 0);
    const totalCostValue = list.reduce((acc, cur) => acc + (cur.costPrice * cur.stock), 0);
    const totalSalesValue = list.reduce((acc, cur) => acc + (cur.sellingPrice * cur.stock), 0);
    const avgMargin = totalCount > 0 ? Number((list.reduce((acc, cur) => acc + cur.marginRate, 0) / totalCount).toFixed(1)) : 0;

    // 分頁切片
    let paginatedData = list;
    let paginationMeta: any = null;

    if (page !== undefined && page !== null && page !== '') {
      const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
      const sizeNum = Math.max(1, parseInt(String(pageSize), 10) || 50);
      const totalPages = Math.ceil(totalCount / sizeNum);
      const startIndex = (pageNum - 1) * sizeNum;
      paginatedData = list.slice(startIndex, startIndex + sizeNum);

      paginationMeta = {
        page: pageNum,
        pageSize: sizeNum,
        total: totalCount,
        totalPages,
      };
    }

    return reply.send({
      success: true,
      stores,
      data: paginatedData,
      pagination: paginationMeta,
      meta: {
        totalCount,
        totalStock,
        totalCostValue,
        totalSalesValue,
        avgMargin,
      },
    });
  });

  // 2. 單筆盲盒商品修改 (支援樂觀鎖)
  fastify.put('/blindboxes/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const callerEmail = (request as any).user?.email || 'admin@onesoul.com';

    const item = await (prisma as any).blindBox.findUnique({ where: { id } });
    if (!item) {
      return reply.code(404).send({ success: false, message: '查無此盲盒品項' });
    }

    if (body.version !== undefined && item.version !== undefined && body.version !== item.version) {
      return reply.code(409).send({
        success: false,
        message: '資料已被其他人修改，請重新整理後再試 (樂觀並發鎖衝突)',
      });
    }

    const beforeState = { ...item };
    const newSellingPrice = body.sellingPrice !== undefined ? Number(body.sellingPrice) : item.sellingPrice;
    const newCostPrice = body.costPrice !== undefined ? Number(body.costPrice) : item.costPrice;
    const newPoints = body.suggestedPoints !== undefined ? Number(body.suggestedPoints) : Math.round(newSellingPrice * 0.05);

    // 庫存更新
    let newStoreStocks = item.storeStocks || { chupei: item.stock || 0, jinshan: 0 };
    if (body.storeStocks) {
      newStoreStocks = {
        chupei: Number(body.storeStocks.chupei || 0),
        jinshan: Number(body.storeStocks.jinshan || 0),
      };
    }
    const newTotalStock = body.stock !== undefined ? Number(body.stock) : (newStoreStocks.chupei + newStoreStocks.jinshan);

    const updated = await (prisma as any).blindBox.update({
      where: { id },
      data: {
        name: body.name || item.name,
        sellingPrice: newSellingPrice,
        costPrice: newCostPrice,
        suggestedPoints: newPoints,
        stock: newTotalStock,
        storeStocks: newStoreStocks,
        note: body.note !== undefined ? body.note : item.note,
        version: (item.version || 0) + 1,
        updatedAt: new Date(),
      },
    });

    await recordAuditLog(prisma as any, {
      operatorId: callerEmail,
      action: 'UPDATE_BLIND_BOX',
      targetType: 'BLIND_BOX',
      targetId: id,
      beforeState,
      afterState: updated,
      reason: body.reason || '盲盒商品手動調價/調帳',
      ipAddress: request.ip,
    });

    return reply.send({
      success: true,
      message: '盲盒商品已成功更新',
      data: updated,
    });
  });

  // 3. 試算表級批次原地更新 (Batch Update)
  fastify.post('/blindboxes/batch-update', async (request, reply) => {
    const { updates = [], reason = '盲盒資料庫批次原地儲存' } = request.body as any;
    const callerEmail = (request as any).user?.email || 'admin@onesoul.com';

    if (!Array.isArray(updates) || updates.length === 0) {
      return reply.code(400).send({ success: false, message: '更新清單不可為空' });
    }

    const results: any[] = [];

    for (const update of updates) {
      if (!update.id) continue;
      const existing = await (prisma as any).blindBox.findUnique({ where: { id: update.id } });
      if (!existing) continue;

      const newSellingPrice = update.sellingPrice !== undefined ? Number(update.sellingPrice) : existing.sellingPrice;
      const newCostPrice = update.costPrice !== undefined ? Number(update.costPrice) : existing.costPrice;
      const newPoints = update.suggestedPoints !== undefined ? Number(update.suggestedPoints) : Math.round(newSellingPrice * 0.05);

      let storeStocks = existing.storeStocks || { chupei: existing.stock || 0, jinshan: 0 };
      if (update.storeStocks) {
        storeStocks = {
          chupei: Number(update.storeStocks.chupei ?? storeStocks.chupei),
          jinshan: Number(update.storeStocks.jinshan ?? storeStocks.jinshan),
        };
      }
      const totalStock = update.stock !== undefined ? Number(update.stock) : (storeStocks.chupei + storeStocks.jinshan);

      const updated = await (prisma as any).blindBox.update({
        where: { id: update.id },
        data: {
          name: update.name || existing.name,
          sellingPrice: newSellingPrice,
          costPrice: newCostPrice,
          suggestedPoints: newPoints,
          stock: totalStock,
          storeStocks,
          note: update.note !== undefined ? update.note : existing.note,
          version: (existing.version || 0) + 1,
          updatedAt: new Date(),
        },
      });

      results.push(updated);
    }

    await recordAuditLog(prisma as any, {
      operatorId: callerEmail,
      action: 'BATCH_UPDATE_BLIND_BOXES',
      targetType: 'BLIND_BOX',
      targetId: `Batch[${results.length}]`,
      afterState: { updatedCount: results.length },
      reason,
      ipAddress: request.ip,
    });

    return reply.send({
      success: true,
      message: `已原子性完成 ${results.length} 筆盲盒商品資料庫更新`,
      data: {
        updatedCount: results.length,
        items: results,
      },
    });
  });
};
