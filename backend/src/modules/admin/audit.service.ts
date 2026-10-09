import crypto from 'crypto';
import type { PrismaClient } from '@prisma/client';

const AUDIT_SECRET = process.env.AUDIT_SECRET || 'onesoul-audit-key-2026';

export interface CreateAuditLogParams {
  operatorId: string;
  action: string;
  targetType: string;
  targetId: string;
  beforeState?: any;
  afterState?: any;
  delta?: number;
  reason: string;
  ipAddress?: string;
}

export async function recordAuditLog(prisma: PrismaClient, params: CreateAuditLogParams) {
  // 取得最新一筆日誌的 Hash 作為鏈結起點
  const latest = await prisma.auditLog.findMany({
    take: 1,
    orderBy: { createdAt: 'desc' },
  });
  const prevHash = latest[0]?.currentHash || '0000000000000000000000000000000000000000000000000000000000000000';

  const hashPayload = `${prevHash}|${params.operatorId}|${params.action}|${params.targetType}|${params.targetId}|${params.delta ?? 0}|${params.reason}`;
  const currentHash = crypto.createHmac('sha256', AUDIT_SECRET).update(hashPayload).digest('hex');

  return prisma.auditLog.create({
    data: {
      operatorId: params.operatorId,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      beforeState: params.beforeState ? params.beforeState : undefined,
      afterState: params.afterState ? params.afterState : undefined,
      delta: params.delta,
      reason: params.reason,
      ipAddress: params.ipAddress,
      prevHash,
      currentHash,
    },
  });
}
