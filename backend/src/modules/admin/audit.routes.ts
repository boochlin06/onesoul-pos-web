import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../plugins/prisma';

export const adminAuditRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/audit-logs', async (request, reply) => {
    const { targetType, targetId, operatorId, page = '1', pageSize = '30' } = request.query as any;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(pageSize, 10) || 30));
    const skip = (pageNum - 1) * limit;

    let logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
    });

    if (targetType) logs = logs.filter((l: any) => l.targetType === targetType);
    if (targetId) logs = logs.filter((l: any) => l.targetId === targetId);
    if (operatorId) logs = logs.filter((l: any) => l.operatorId === operatorId);

    const total = logs.length;
    const items = logs.slice(skip, skip + limit);

    return reply.send({
      success: true,
      data: items,
      meta: {
        total,
        page: pageNum,
        pageSize: limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  });
};
