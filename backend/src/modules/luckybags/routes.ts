import { FastifyInstance } from 'fastify';
import { prisma } from '../../plugins/prisma';
import { authenticate } from '../../plugins/auth';
import { LuckyBagStatus } from '@prisma/client';

export async function luckyBagRoutes(fastify: FastifyInstance) {
  // 福袋獎項庫清單 (相容前端 PrizeEntry)
  fastify.get('/prizes', { preHandler: [authenticate] }, async (request) => {
    const { branch } = request.query as { branch?: string };

    const storeId = branch === '金山' ? 'jinshan' : 'chupei';

    const bags = await prisma.luckyBag.findMany({
      where: {
        status: LuckyBagStatus.ACTIVE,
        ...(branch && branch !== '全部' ? { storeId } : {}),
      },
      include: {
        prizes: true,
        store: true,
      },
      orderBy: { id: 'asc' },
    });

    const results = bags.flatMap((bag) =>
      bag.prizes.map((p) => ({
        setId: bag.id,
        setName: bag.name,
        unitPrice: bag.unitPrice,
        prize: p.prizeGrade,
        prizeId: p.productId || '',
        prizeName: p.prizeName,
        points: p.points,
        draws: p.draws,
        date: bag.createdAt.toISOString().slice(0, 10).replace(/-/g, '/'),
        branch: bag.store.name.replace('店', ''),
        isPointsSet: bag.isPointsSet,
        drawnCount: p.drawnCount,
      }))
    );

    return { success: true, data: results };
  });

  // 取得各套組抽數統計 (Master view draw counts)
  fastify.get('/draw-counts', { preHandler: [authenticate] }, async () => {
    const prizes = await prisma.luckyBagPrize.findMany({
      select: {
        bagId: true,
        prizeGrade: true,
        drawnCount: true,
      },
    });

    const counts: Record<string, number> = {};
    for (const p of prizes) {
      const key = `${p.bagId}_${p.prizeGrade.toLowerCase()}`;
      counts[key] = p.drawnCount;
    }

    return { success: true, data: counts };
  });

  // 作廢/刪除福袋套組 (寫入廢套紀錄)
  fastify.delete('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { branch } = request.query as { branch?: string };
    const user = (request as any).user;

    const bag = await prisma.luckyBag.findUnique({
      where: { id },
      include: { prizes: true, store: true },
    });

    if (!bag) {
      return reply.status(404).send({ success: false, message: '找不到此福袋套組' });
    }

    const totalDraws = bag.prizes.reduce((sum, p) => sum + p.draws, 0);
    const totalDrawn = bag.prizes.reduce((sum, p) => sum + p.drawnCount, 0);
    const details = bag.prizes
      .map((p) => `${p.prizeGrade}:${p.prizeName}:${p.points}:已抽${p.drawnCount}`)
      .join(' | ');

    await prisma.$transaction(async (tx) => {
      // 1. 軟作廢標記
      await tx.luckyBag.update({
        where: { id },
        data: { status: LuckyBagStatus.VOIDED },
      });

      // 2. 寫入廢套日誌
      await tx.voidSetLog.create({
        data: {
          storeId: bag.storeId,
          bagId: bag.id,
          bagName: bag.name,
          unitPrice: bag.unitPrice,
          totalDraws,
          drawnCount: totalDrawn,
          details,
          isPointsSet: bag.isPointsSet,
          operator: user?.email || 'unknown',
        },
      });
    });

    return { success: true, message: `福袋套組 [${id}] 已成功作廢並記入廢套紀錄` };
  });
}
