import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../plugins/prisma';
import { authenticate } from '../../plugins/auth';
import { sendLinePush } from '../notifications/lineService';

const clockInSchema = z.object({
  branch: z.string(),
});

export async function operationRoutes(fastify: FastifyInstance) {
  // 取得門市班表營運參數 (相容 apiGetBranchConfig)
  fastify.get('/config', { preHandler: [authenticate] }, async (request, reply) => {
    const { branch } = request.query as { branch?: string };
    const storeId = branch === '金山' ? 'jinshan' : 'chupei';

    const store = await prisma.store.findUnique({ where: { id: storeId } });
    if (!store) {
      return reply.status(404).send({ success: false, message: '找不到門市' });
    }

    return {
      success: true,
      data: {
        startTime: store.openTime || (branch === '竹北' ? '14:00' : '16:00'),
        standardHours: store.standardHours,
        lateGraceMinutes: store.lateGraceMinutes,
      },
    };
  });

  // 取得今日排班人員 (相容 apiGetTodaySchedule)
  fastify.get('/schedule', { preHandler: [authenticate] }, async (request) => {
    const { branch } = request.query as { branch?: string };
    const storeId = branch === '金山' ? 'jinshan' : 'chupei';
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const schedule = await prisma.schedule.findUnique({
      where: { storeId_date: { storeId, date: today } },
    });

    if (!schedule) {
      // 預設有營業
      return {
        success: true,
        data: {
          open: true,
          staff: branch === '竹北' ? '竹北值班人員' : '金山值班人員',
          row: 1,
        },
      };
    }

    return {
      success: true,
      data: {
        open: !schedule.isClosed,
        staff: schedule.staffName,
        row: 1,
      },
    };
  });

  // 取得今日打卡紀錄 (相容 apiGetTodayAttendance)
  fastify.get('/attendance', { preHandler: [authenticate] }, async (request) => {
    const { branch } = request.query as { branch?: string };
    const storeId = branch === '金山' ? 'jinshan' : 'chupei';
    const user = (request as any).user;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const record = await prisma.attendance.findFirst({
      where: {
        storeId,
        userEmail: user?.email,
        clockInAt: { gte: startOfDay },
      },
      orderBy: { clockInAt: 'desc' },
    });

    return {
      success: true,
      data: record || null,
    };
  });

  // 執行打卡 (相容 apiClockIn)
  fastify.post('/clock-in', { preHandler: [authenticate] }, async (request, reply) => {
    const parse = clockInSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ success: false, message: parse.error.errors[0].message });
    }

    const { branch } = parse.data;
    const storeId = branch === '金山' ? 'jinshan' : 'chupei';
    const user = (request as any).user;

    const store = await prisma.store.findUnique({ where: { id: storeId } });
    const now = new Date();

    // 判斷是否遲到
    let status = 'NORMAL';
    if (store?.openTime) {
      const [h, m] = store.openTime.split(':').map(Number);
      const shiftStart = new Date(now);
      shiftStart.setHours(h, m + (store.lateGraceMinutes || 15), 0, 0);

      if (now > shiftStart) {
        status = 'LATE';
      }
    }

    const attendance = await prisma.attendance.create({
      data: {
        storeId,
        userEmail: user?.email || 'unknown',
        clockInAt: now,
        status,
      },
    });

    if (status === 'LATE') {
      sendLinePush(`⚠️ [${branch}門市 遲到提醒] 員工 ${user?.email} 已於 ${now.toLocaleTimeString()} 打卡 (狀態: 遲到)`).catch(() => {});
    }

    return {
      success: true,
      message: `${branch}門市打卡成功！(${status === 'LATE' ? '遲到' : '正常'})`,
      data: attendance,
    };
  });
}
