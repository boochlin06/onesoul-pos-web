import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../plugins/prisma';
import { authenticate } from '../../plugins/auth';

const createMemberSchema = z.object({
  phone: z.string().min(8, '電話號碼長度不足'),
  name: z.string().min(1, '姓名為必填'),
  gender: z.string().optional().default(''),
  birthday: z.string().optional().default(''),
  store: z.string().optional().default('竹北'),
  note: z.string().optional().default(''),
});

export async function memberRoutes(fastify: FastifyInstance) {
  // 取得所有會員 (相容前端 MemberEntry)
  fastify.get('/', { preHandler: [authenticate] }, async (request) => {
    const { q } = request.query as { q?: string };
    const where = q
      ? {
          OR: [
            { phone: { contains: q } },
            { name: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const members = await prisma.member.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    const formatted = members.map((m) => ({
      timestamp: m.registeredAt.toISOString(),
      name: m.name,
      phone: m.phone,
      gender: m.gender || '',
      birthday: m.birthday || '',
      store: '竹北',
      points: m.points,
      note: m.note || '',
      duplicate: '',
    }));

    return { success: true, data: formatted };
  });

  // 單一會員查詢
  fastify.get('/:phone', { preHandler: [authenticate] }, async (request, reply) => {
    const { phone } = request.params as { phone: string };
    const cleaned = phone.replace(/^0/, '').trim();

    const member = await prisma.member.findFirst({
      where: {
        OR: [{ phone: phone.trim() }, { phone: cleaned }, { phone: `0${cleaned}` }],
      },
    });

    if (!member) {
      return reply.status(404).send({ success: false, message: '找不到會員' });
    }

    return {
      success: true,
      data: {
        name: member.name,
        phone: member.phone,
        points: member.points,
        birthday: member.birthday || '',
        gender: member.gender || '',
        note: member.note || '',
      },
    };
  });

  // 新增會員
  fastify.post('/', { preHandler: [authenticate] }, async (request, reply) => {
    const parse = createMemberSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ success: false, message: parse.error.errors[0].message });
    }

    const { phone, name, gender, birthday, note } = parse.data;
    const existing = await prisma.member.findUnique({ where: { phone } });
    if (existing) {
      return reply.status(409).send({ success: false, message: '此電話號碼已註冊' });
    }

    const created = await prisma.member.create({
      data: {
        phone,
        name,
        gender,
        birthday,
        points: 0,
        note,
      },
    });

    return { success: true, message: '會員註冊成功', data: created };
  });

  // 會員消費紀錄
  fastify.get('/:phone/history', { preHandler: [authenticate] }, async (request) => {
    const { phone } = request.params as { phone: string };
    const cleaned = phone.replace(/^0/, '').trim();

    const member = await prisma.member.findFirst({
      where: {
        OR: [{ phone: phone.trim() }, { phone: cleaned }, { phone: `0${cleaned}` }],
      },
    });

    if (!member) {
      return { success: true, data: [] };
    }

    const orders = await prisma.order.findMany({
      where: { memberId: member.id, status: 'COMPLETED' },
      include: {
        items: true,
        store: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const records = orders.flatMap((order) =>
      order.items.map((item, idx) => ({
        checkoutUID: order.checkoutUID,
        date: order.createdAt.toISOString().slice(0, 10).replace(/-/g, '/'),
        branch: order.store.name.replace('店', ''),
        receivedAmount: idx === 0 ? order.receivedAmount : 0,
        remittance: idx === 0 ? order.remittance : 0,
        creditCard: idx === 0 ? order.creditCard : 0,
        cash: idx === 0 ? order.cash : 0,
        pointsUsed: idx === 0 ? order.pointsUsed : 0,
        pointDelta: idx === 0 ? order.netPointsDelta : 0,
        lotteryId: item.bagId || '',
        draws: item.draws || 1,
        prize: item.prizeGrade || '',
        type: item.pickType === 'POINTS' ? '點數' : '帶走',
        prizeName: item.prizeName || '',
        setName: item.remark || '',
        amount: item.amount,
        points: item.pointsImpact,
        remark: item.remark || '',
      }))
    );

    return { success: true, data: records };
  });
}
