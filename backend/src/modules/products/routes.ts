import { FastifyInstance } from 'fastify';
import { prisma } from '../../plugins/prisma';
import { authenticate } from '../../plugins/auth';

export async function productRoutes(fastify: FastifyInstance) {
  // 通用商品清單
  fastify.get('/', { preHandler: [authenticate] }, async () => {
    const products = await prisma.product.findMany({
      orderBy: { id: 'asc' },
    });
    return { success: true, data: products };
  });

  // 門市庫存清單 (相容前端 StockEntry)
  fastify.get('/stocks', { preHandler: [authenticate] }, async (request) => {
    const { branch } = request.query as { branch?: string };

    const storeId = branch === '金山' ? 'jinshan' : 'chupei';

    const inventories = await prisma.storeInventory.findMany({
      where: branch && branch !== '全部' ? { storeId } : {},
      include: {
        product: true,
        store: true,
      },
      orderBy: { productId: 'asc' },
    });

    const formatted = inventories.map((inv) => ({
      id: inv.productId,
      name: inv.product.name,
      points: inv.product.suggestedPoints,
      category: inv.product.category,
      quantity: inv.quantity,
      remark: inv.product.remark || '',
      branch: inv.store.name.replace('店', ''),
    }));

    return { success: true, data: formatted };
  });

  // 盲盒資料庫清單 (相容前端 BlindBoxEntry)
  fastify.get('/blindboxes', { preHandler: [authenticate] }, async () => {
    const blindBoxes = await prisma.blindBox.findMany({
      orderBy: { id: 'asc' },
    });

    const formatted = blindBoxes.map((b) => ({
      id: b.id,
      name: b.name,
      points: b.points,
      manualPrice: b.manualPrice,
      autoSuggestPrice: b.autoSuggestPrice,
      cost: b.cost,
      prizePoints: b.prizePoints,
      inventory: b.inventory,
      category: '盲盒',
      configuring: b.configuring,
      shipped: b.shipped,
      remaining: b.remaining,
      remark: b.remark || '',
    }));

    return { success: true, data: formatted };
  });
}
