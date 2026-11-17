import { vi } from 'vitest';
import crypto from 'crypto';
import { MockPrismaEngine } from './mock-prisma';
import type { FastifyInstance } from 'fastify';

export const engine = new MockPrismaEngine();
export const mockPrisma = engine.createClient();

export function getTestStore() {
  return engine.store;
}

export function resetTestStore() {
  engine.reset();
}

export function authInject(app: FastifyInstance, opts: any) {
  return app.inject({
    ...opts,
    headers: {
      'x-caller-email': 'admin@onesoul.com',
      ...(opts.headers || {}),
    },
  });
}

export function computeAuditHash(
  prevHash: string,
  operatorId: string,
  action: string,
  targetType: string,
  targetId: string,
  delta: number = 0,
  reason: string,
  secret = 'onesoul-audit-key-2026'
): string {
  const hashPayload = `${prevHash}|${operatorId}|${action}|${targetType}|${targetId}|${delta}|${reason}`;
  return crypto.createHmac('sha256', secret).update(hashPayload).digest('hex');
}
