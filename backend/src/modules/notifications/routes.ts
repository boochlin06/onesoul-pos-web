import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireAdmin } from '../../plugins/auth';
import { sendLinePush } from './lineService';

const sendMessageSchema = z.object({
  channel: z.string().min(1, '發送目標不可為空'),
  message: z.string().min(1, '訊息不可為空'),
});

export async function notificationRoutes(fastify: FastifyInstance) {
  // 取得 LINE 頻道清單
  fastify.get('/channels', { preHandler: [authenticate, requireAdmin] }, async () => {
    return {
      success: true,
      data: [
        { value: 'boss', label: '老闆私聊' },
        { value: 'all', label: '門市工作群組' },
      ],
    };
  });

  // 發送 LINE 廣播訊息
  fastify.post('/send', { preHandler: [authenticate, requireAdmin] }, async (request, reply) => {
    const parse = sendMessageSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ success: false, message: parse.error.errors[0].message });
    }

    const { channel, message } = parse.data;
    const ok = await sendLinePush(message);

    return {
      success: ok,
      message: ok ? `已發送訊息至 [${channel}]` : '發送失敗或尚未配置 LINE Token',
    };
  });

  // 取得 API / LINE 用量 (大師頁面)
  fastify.get('/quota', { preHandler: [authenticate, requireAdmin] }, async () => {
    return {
      success: true,
      data: {
        gasApiToday: 0,
        gasApiMonth: 0,
        linePushToday: 1,
        lineReplyToday: 0,
        urlFetchToday: 1,
        linePushMonth: 25,
        linePushLimit: 200,
        urlFetchLimit: 20000,
      },
    };
  });
}
