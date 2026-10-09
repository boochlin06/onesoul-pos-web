import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../plugins/prisma';
import { enqueueOutboxTask } from './outbox.service.js';

export const adminScheduleRoutes: FastifyPluginAsync = async (fastify) => {
  // 1. 取得門市月排班表
  fastify.get('/schedule/month', async (request, reply) => {
    const { storeId = 'chupei', yearMonth } = request.query as any;

    const schedules = await prisma.shiftSchedule.findMany({
      where: { storeId },
    });

    const filtered = yearMonth
      ? schedules.filter((s: any) => s.date.startsWith(yearMonth))
      : schedules;

    return reply.send({
      success: true,
      data: filtered,
    });
  });

  // 2. 批次更新排班
  fastify.put('/schedule/days', async (request, reply) => {
    const { storeId = 'chupei', days = [] } = request.body as any;

    if (!Array.isArray(days) || days.length === 0) {
      return reply.code(400).send({ success: false, message: '請提供排班日列表' });
    }

    const updatedList = [];
    for (const d of days) {
      const res = await prisma.shiftSchedule.upsert({
        where: {
          storeId_date: {
            storeId,
            date: d.date,
          },
        },
        create: {
          storeId,
          date: d.date,
          staffName: d.staffName || '',
          staffEmail: d.staffEmail || null,
          shiftType: d.shiftType || 'FULL',
          isClosed: !!d.isClosed,
          note: d.note || null,
        },
        update: {
          staffName: d.staffName,
          staffEmail: d.staffEmail,
          shiftType: d.shiftType,
          isClosed: !!d.isClosed,
          note: d.note,
        },
      });
      updatedList.push(res);
    }

    return reply.send({
      success: true,
      message: `成功更新 ${updatedList.length} 天的排班`,
      data: updatedList,
    });
  });

  // 3. 考勤打卡紀錄查詢
  const getAttendanceHandler = async (request: any, reply: any) => {
    const { storeId, startDate, endDate } = request.query as any;

    let records = await prisma.attendanceRecord.findMany({
      where: storeId ? { storeId } : undefined,
    });

    if (startDate) {
      records = records.filter((r: any) => new Date(r.clockInAt) >= new Date(startDate));
    }
    if (endDate) {
      records = records.filter((r: any) => new Date(r.clockInAt) <= new Date(endDate));
    }

    records.sort((a: any, b: any) => new Date(b.clockInAt).getTime() - new Date(a.clockInAt).getTime());

    return reply.send({
      success: true,
      data: records,
    });
  };

  fastify.get('/attendance/records', getAttendanceHandler);
  fastify.get('/attendance', getAttendanceHandler);

  // 4. POS 打卡考勤端點 (支援遲到寬限計算與 Outbox LINE 警示)
  fastify.post('/attendance/clock-in', async (request, reply) => {
    const { storeId = 'chupei', userEmail, userName } = request.body as any;

    if (!userEmail) {
      return reply.code(400).send({ success: false, message: '缺少使用者 Email' });
    }

    const store = (await prisma.store.findMany()).find((s: any) => s.id === storeId);
    const openTimeStr = store?.openTime || (storeId === 'chupei' ? '14:00' : '16:00');
    const lateGrace = store?.lateGraceMinutes || 15;

    // 計算打卡時間是否遲到
    const now = new Date();
    const [targetHour, targetMin] = openTimeStr.split(':').map((n: string) => parseInt(n, 10));
    const targetMinutes = targetHour * 60 + targetMin;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const diff = currentMinutes - targetMinutes;

    let status = 'NORMAL';
    let lateMinutes = 0;

    if (diff > 0) {
      lateMinutes = diff;
      status = 'LATE';

      if (diff > lateGrace) {
        // 超過遲到寬限，寫入 Outbox 佇列推播 LINE
        await enqueueOutboxTask(prisma, {
          taskType: 'LINE_LATE_ALERT',
          payload: {
            storeId,
            userEmail,
            userName: userName || userEmail,
            lateMinutes,
            clockInTime: now.toISOString(),
          },
        });
      }
    }

    const record = await prisma.attendanceRecord.create({
      data: {
        storeId,
        userEmail,
        userName,
        clockInAt: now,
        status: status as any,
        lateMinutes,
        ipAddress: request.ip,
      },
    });

    return reply.send({
      success: true,
      message: status === 'LATE' ? `打卡成功 (遲到 ${lateMinutes} 分鐘)` : '準時打卡成功',
      data: record,
    });
  });
};
