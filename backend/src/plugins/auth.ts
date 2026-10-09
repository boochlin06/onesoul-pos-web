import { FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../config';

export const ALLOWED_EMAILS = [
  'onesoul.chupei@gmail.com',
  'onesoul.jinsang@gmail.com',
  'onesoul.chupei.user@gmail.com',
  'gamejeffjeff@gmail.com',
  'admin@onesoul.com',
];

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  // 支援 x-caller-email 標頭，或未來的 Bearer token
  const callerEmail = (
    (request.headers['x-caller-email'] as string) ||
    (request.headers['x-user-email'] as string) ||
    ((request.query as any)?.callerEmail as string) ||
    ''
  ).trim().toLowerCase();

  // 本機開發與測試模式若未帶 header，提供預設竹北店員帳號方便測試
  if (config.NODE_ENV !== 'production' && !callerEmail) {
    (request as any).user = {
      email: 'onesoul.chupei@gmail.com',
      isAdmin: true,
    };
    return;
  }

  if (!callerEmail) {
    return reply.status(401).send({
      success: false,
      message: '未經授權：缺少使用者身分識別 (Missing caller identity)',
    });
  }

  const isAllowed = ALLOWED_EMAILS.some((e) => e.toLowerCase() === callerEmail);
  if (!isAllowed) {
    return reply.status(403).send({
      success: false,
      message: `無存取權限：${callerEmail} 不在授權白名單內`,
    });
  }

  const isAdmin = config.adminEmailsList.includes(callerEmail);

  (request as any).user = {
    email: callerEmail,
    isAdmin,
  };
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  const user = (request as any).user;
  if (!user || !user.isAdmin) {
    return reply.status(403).send({
      success: false,
      message: '權限不足：此操作需要大師管理員權限',
    });
  }
}
