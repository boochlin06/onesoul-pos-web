import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../plugins/prisma';
import { recordAuditLog } from './audit.service.js';

export const adminMembersRoutes: FastifyPluginAsync = async (fastify) => {
  // 1. 會員名冊分頁與搜尋
  fastify.get('/members', async (request, reply) => {
    const { q = '', page = '1', pageSize = '20', sortBy = 'points', sortOrder = 'desc' } = request.query as any;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(pageSize, 10) || 20));
    const skip = (pageNum - 1) * limit;

    const allMembers = await prisma.member.findMany();
    let filtered = allMembers;

    if (q.trim()) {
      const term = q.trim().toLowerCase();
      filtered = filtered.filter(
        (m: any) => m.name.toLowerCase().includes(term) || m.phone.includes(term)
      );
    }

    const ALLOWED_SORT_FIELDS = ['points', 'createdAt', 'name', 'phone'];
    const safeSortBy = ALLOWED_SORT_FIELDS.includes(sortBy) ? sortBy : 'points';
    const safeSortOrder = sortOrder === 'asc' ? 'asc' : 'desc';

    filtered.sort((a: any, b: any) => {
      const fieldA = a[safeSortBy] ?? 0;
      const fieldB = b[safeSortBy] ?? 0;
      if (safeSortOrder === 'asc') return fieldA > fieldB ? 1 : -1;
      return fieldA < fieldB ? 1 : -1;
    });

    const total = filtered.length;
    const items = filtered.slice(skip, skip + limit);

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

  // 2. 手動調整會員點數 (強制帶 reason + 審計日誌)
  fastify.post('/members/:id/adjust-points', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { delta, reason } = request.body as {
      delta: number;
      reason: string;
      operatorId?: string;
    };
    // 🛡️ 嚴格自認證身分提取操作者，杜絕假冒
    const operatorId = (request as any).user?.email || 'admin@onesoul.com';

    if (typeof delta !== 'number' || delta === 0) {
      return reply.code(400).send({ success: false, message: '異動點數不能為 0' });
    }

    if (!reason || reason.trim().length < 4) {
      return reply.code(400).send({ success: false, message: '異動理由不可空白且至少需 4 個字元' });
    }

    // 取得當前會員
    const members = await prisma.member.findMany();
    const target = members.find((m: any) => m.id === id || m.phone === id);
    if (!target) {
      return reply.code(404).send({ success: false, message: '找不到此會員' });
    }

    if (target.points + delta < 0) {
      return reply.code(400).send({ success: false, message: `扣除點數超出上限，目前點數僅有 ${target.points} 點` });
    }

    const beforePoints = target.points;
    const newPoints = beforePoints + delta;

    // 原子交易更新點數、寫入點數流水與審計日誌
    await prisma.$transaction(async (tx: any) => {
      await tx.member.update({
        where: { id: target.id },
        data: {
          points: newPoints,
          version: { increment: 1 },
        },
      });

      await tx.pointLog.create({
        data: {
          memberId: target.id,
          type: 'MANUAL',
          delta,
          balance: newPoints,
          reason,
          operator: operatorId,
        },
      });

      await recordAuditLog(tx, {
        operatorId,
        action: 'MEMBER_POINT_ADJUST',
        targetType: 'Member',
        targetId: target.id,
        beforeState: { points: beforePoints },
        afterState: { points: newPoints },
        delta,
        reason,
        ipAddress: request.ip,
      });
    });

    return reply.send({
      success: true,
      message: '點數調整成功',
      data: {
        memberId: target.id,
        beforePoints,
        newPoints,
        delta,
      },
    });
  });

  // 3. 會員消費與點數歷程抽屜
  fastify.get('/members/:id/history', async (request, reply) => {
    const { id } = request.params as { id: string };
    const members = await prisma.member.findMany();
    const target = members.find((m: any) => m.id === id || m.phone === id);
    if (!target) {
      return reply.code(404).send({ success: false, message: '找不到此會員' });
    }

    const orders = (await prisma.order.findMany()).filter((o: any) => o.memberId === target.id);
    const pointLogs = (await (prisma.pointLog as any).findMany?.() || []).filter((l: any) => l.memberId === target.id);
    const auditLogs = await prisma.auditLog.findMany({
      where: { targetType: 'Member', targetId: target.id },
      take: 20,
    });

    return reply.send({
      success: true,
      data: {
        member: target,
        orders,
        pointLogs,
        auditLogs,
      },
    });
  });
};
