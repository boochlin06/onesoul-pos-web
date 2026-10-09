import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../plugins/prisma';
import { authenticate, requireAdmin } from '../../plugins/auth';
import { StocktakeStatus, InventoryChangeType } from '@prisma/client';

const createStocktakeSchema = z.object({
  branch: z.string(),
  note: z.string().optional().default(''),
  items: z.array(
    z.object({
      id: z.string(),
      systemQty: z.number(),
      actualQty: z.number(),
      itemRemark: z.string().optional().default(''),
    })
  ),
});

export async function stocktakeRoutes(fastify: FastifyInstance) {
  // 取得庫存盤點清單 (相容 apiGetInventoryCheckList)
  fastify.get('/checklist', { preHandler: [authenticate] }, async (request) => {
    const { branch } = request.query as { branch?: string };
    const storeId = branch === '金山' ? 'jinshan' : 'chupei';

    const inventories = await prisma.storeInventory.findMany({
      where: {
        storeId,
        quantity: { gte: 1 },
      },
      include: { product: true, store: true },
      orderBy: { productId: 'asc' },
    });

    const items = inventories.map((inv) => ({
      id: inv.productId,
      name: inv.product.name,
      category: inv.product.category,
      systemQty: inv.quantity,
      actualQty: inv.quantity,
      branch: inv.store.name.replace('店', ''),
      checked: false,
      itemRemark: '',
    }));

    return { success: true, data: items };
  });

  // 建立盤點單草稿 (店員盤點盲點完送出)
  fastify.post('/', { preHandler: [authenticate] }, async (request, reply) => {
    const parse = createStocktakeSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ success: false, message: parse.error.errors[0].message });
    }

    const { branch, note, items } = parse.data;
    const storeId = branch === '金山' ? 'jinshan' : 'chupei';
    const user = (request as any).user;

    const stocktake = await prisma.$transaction(async (tx) => {
      const created = await tx.stocktake.create({
        data: {
          storeId,
          countedBy: user?.email || 'unknown',
          status: StocktakeStatus.DRAFT,
          note,
        },
      });

      for (const item of items) {
        const variance = item.actualQty - item.systemQty;
        await tx.stocktakeItem.create({
          data: {
            stocktakeId: created.id,
            productId: item.id,
            systemQty: item.systemQty,
            actualQty: item.actualQty,
            variance,
            itemRemark: item.itemRemark,
          },
        });
      }

      return created;
    });

    return {
      success: true,
      message: '盤點草稿已建立，待管理者審核入帳',
      data: stocktake,
    };
  });

  // 管理者/大師審核過帳 (Post / Adjust Inventory)
  fastify.post('/:id/post', { preHandler: [authenticate, requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = (request as any).user;

    const stocktake = await prisma.stocktake.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!stocktake) {
      return reply.status(404).send({ success: false, message: '找不到此盤點單' });
    }

    if (stocktake.status === StocktakeStatus.POSTED) {
      return reply.status(400).send({ success: false, message: '此盤點單已審核過帳，不可重複操作' });
    }

    await prisma.$transaction(async (tx) => {
      // 1. 更新盤點單狀態
      await tx.stocktake.update({
        where: { id },
        data: {
          status: StocktakeStatus.POSTED,
          postedBy: user?.email || 'unknown',
          postedAt: new Date(),
        },
      });

      // 2. 校正各品項庫存並記錄流水
      for (const it of stocktake.items) {
        if (it.variance !== 0) {
          const inv = await tx.storeInventory.findUnique({
            where: { storeId_productId: { storeId: stocktake.storeId, productId: it.productId } },
          });

          if (inv) {
            const updatedInv = await tx.storeInventory.update({
              where: { id: inv.id },
              data: { quantity: { increment: it.variance } },
            });

            await tx.inventoryLog.create({
              data: {
                storeId: stocktake.storeId,
                productId: it.productId,
                changeType: InventoryChangeType.STOCKTAKE_ADJUST,
                delta: it.variance,
                balance: updatedInv.quantity,
                stocktakeId: stocktake.id,
                operator: user?.email,
                reason: `盤點差異過帳 (系統: ${it.systemQty}, 實盤: ${it.actualQty}, 盈虧: ${it.variance})`,
              },
            });
          }
        }
      }
    });

    return { success: true, message: `盤點單 ${id} 審核成功，庫存已完成校正過帳！` };
  });
}
