import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../plugins/prisma';
import { authenticate } from '../../plugins/auth';
import { SessionStatus } from '@prisma/client';
import { sendLinePush } from '../notifications/lineService';

const openSessionSchema = z.object({
  branch: z.string(),
  amount: z.number().min(0, '開帳金額不可小於 0'),
});

const closeSessionSchema = z.object({
  branch: z.string(),
  actualCash: z.number().min(0, '實盤現金不可為負數'),
  note: z.string().optional().default(''),
});

export async function sessionRoutes(fastify: FastifyInstance) {
  // 取得班次列表或當前班次 (供 Admin 與 POS 核心查詢)
  fastify.get('/current', { preHandler: [authenticate] }, async (request) => {
    const { storeId, branch } = request.query as { storeId?: string; branch?: string };
    const queryStoreId = storeId || (branch ? (branch === '金山' ? 'jinshan' : 'chupei') : undefined);
    const sessions = await prisma.cashRegisterSession.findMany({
      where: queryStoreId ? { storeId: queryStoreId } : undefined,
    });
    return {
      success: true,
      data: sessions,
    };
  });

  fastify.get('/', { preHandler: [authenticate] }, async (request) => {
    const { storeId, branch } = request.query as { storeId?: string; branch?: string };
    const queryStoreId = storeId || (branch ? (branch === '金山' ? 'jinshan' : 'chupei') : undefined);
    const sessions = await prisma.cashRegisterSession.findMany({
      where: queryStoreId ? { storeId: queryStoreId } : undefined,
    });
    return {
      success: true,
      data: sessions,
    };
  });

  // 取得當前活躍開帳狀態 (相容 getOpeningCash)
  fastify.get('/active', { preHandler: [authenticate] }, async (request) => {
    const { branch } = request.query as { branch?: string };
    const storeId = branch === '金山' ? 'jinshan' : 'chupei';

    const session = await prisma.cashRegisterSession.findFirst({
      where: { storeId, status: SessionStatus.OPEN },
      orderBy: { openedAt: 'desc' },
    });

    return {
      success: true,
      amount: session ? session.openingCash : null,
      session: session || null,
    };
  });

  // 開店 / 設定開帳零錢備金 (相容 setOpeningCash)
  fastify.post('/open', { preHandler: [authenticate] }, async (request, reply) => {
    const parse = openSessionSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ success: false, message: parse.error.errors[0].message });
    }

    const { branch, amount } = parse.data;
    const storeId = branch === '金山' ? 'jinshan' : 'chupei';
    const user = (request as any).user;

    // 檢查是否已有開啟中的 Session
    const activeSession = await prisma.cashRegisterSession.findFirst({
      where: { storeId, status: SessionStatus.OPEN },
    });

    if (activeSession) {
      // 若已開啟，更新其備用金
      const updated = await prisma.cashRegisterSession.update({
        where: { id: activeSession.id },
        data: { openingCash: amount },
      });
      return { success: true, message: '開帳備用金已更新', data: updated };
    }

    // 建立新 Session
    const newSession = await prisma.cashRegisterSession.create({
      data: {
        storeId,
        openingCash: amount,
        openedBy: user?.email || 'unknown',
        status: SessionStatus.OPEN,
      },
    });

    return { success: true, message: '開帳成功', data: newSession };
  });

  // 打烊關帳 / iCHEF Z-Report 審計日結與 LINE 推播 (相容 closeDay)
  fastify.post('/close', { preHandler: [authenticate] }, async (request, reply) => {
    const parse = closeSessionSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ success: false, message: parse.error.errors[0].message });
    }

    const { branch, actualCash, note } = parse.data;
    const storeId = branch === '金山' ? 'jinshan' : 'chupei';
    const user = (request as any).user;

    const activeSession = await prisma.cashRegisterSession.findFirst({
      where: { storeId, status: SessionStatus.OPEN },
      include: { store: true },
    });

    if (!activeSession) {
      return reply.status(400).send({ success: false, message: '當前無進行中的開帳班次' });
    }

    // 原子計算真實營收與財務指標
    const orders = await prisma.order.findMany({
      where: { sessionId: activeSession.id },
    });

    const completedOrders = orders.filter((o) => o.status === 'COMPLETED');
    const voidOrders = orders.filter((o) => o.status === 'CANCELLED');

    const totalRevenue = completedOrders.reduce((sum, o) => sum + o.receivedAmount, 0);
    const cashRevenue = completedOrders.reduce((sum, o) => sum + o.cash, 0);
    const cardRevenue = completedOrders.reduce((sum, o) => sum + o.creditCard, 0);
    const remitRevenue = completedOrders.reduce((sum, o) => sum + o.remittance, 0);
    const pointsIssued = completedOrders.reduce((sum, o) => sum + Math.max(0, o.netPointsDelta), 0);
    const pointsRedeemed = completedOrders.reduce((sum, o) => sum + o.pointsUsed, 0);
    const voidAmount = voidOrders.reduce((sum, o) => sum + o.receivedAmount, 0);

    const expectedCash = activeSession.openingCash + cashRevenue;
    const discrepancy = actualCash - expectedCash;

    // 封存 Session
    const closedSession = await prisma.cashRegisterSession.update({
      where: { id: activeSession.id },
      data: {
        status: SessionStatus.CLOSED,
        closedAt: new Date(),
        closedBy: user?.email || 'unknown',
        actualCash,
        expectedCash,
        discrepancy,
        totalRevenue,
        cashRevenue,
        cardRevenue,
        remitRevenue,
        pointsIssued,
        pointsRedeemed,
        txCount: completedOrders.length,
        voidCount: voidOrders.length,
        voidAmount,
        note,
      },
    });

    // 自動非同步推播 LINE 關帳通知
    const lineMessage =
      `【${branch}門市 關帳日結報表】\n` +
      `關帳人員：${user?.email || '未知'}\n` +
      `營業總額：$${totalRevenue.toLocaleString()}\n` +
      `├ 現金實收：$${cashRevenue.toLocaleString()}\n` +
      `├ 信用卡：$${cardRevenue.toLocaleString()}\n` +
      `└ 匯款：$${remitRevenue.toLocaleString()}\n` +
      `備用零錢：$${activeSession.openingCash.toLocaleString()}\n` +
      `應有現金：$${expectedCash.toLocaleString()}\n` +
      `實盤現金：$${actualCash.toLocaleString()}\n` +
      `錢櫃溢短：${discrepancy >= 0 ? `+${discrepancy}` : discrepancy} 元\n` +
      `交易筆數：${completedOrders.length} 筆 (作廢 ${voidOrders.length} 筆)\n` +
      `備註：${note || '無'}`;

    sendLinePush(lineMessage).catch((err) => {
      request.log.error({ err }, 'LINE 關帳推播非同步發送失敗');
    });

    return {
      success: true,
      message: `${branch}門市關帳成功！溢短：${discrepancy} 元`,
      data: closedSession,
    };
  });
}
