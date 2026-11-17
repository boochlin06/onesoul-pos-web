import crypto from 'node:crypto';

export interface AuditLogProps {
  id: string;
  operatorId: string;
  action: string;
  targetType: string;
  targetId: string;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  delta?: number | null;
  reason: string;
  ipAddress?: string | null;
  prevHash: string;
  currentHash: string;
  createdAt?: Date | string;
}

export class AuditLog {
  public static readonly GENESIS_HASH =
    '0000000000000000000000000000000000000000000000000000000000000000';
  public static readonly DEFAULT_SECRET = 'onesoul-audit-key-2026';

  public static calculateHash(
    prevHash: string,
    params: {
      operatorId: string;
      action: string;
      targetType: string;
      targetId: string;
      delta?: number | null;
      reason: string;
    },
    secret = AuditLog.DEFAULT_SECRET
  ): string {
    const payload = `${prevHash}|${params.operatorId}|${params.action}|${params.targetType}|${params.targetId}|${params.delta ?? 0}|${params.reason}`;
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  public readonly id: string;
  public readonly operatorId: string;
  public readonly action: string;
  public readonly targetType: string;
  public readonly targetId: string;
  public readonly beforeState?: Record<string, unknown> | null;
  public readonly afterState?: Record<string, unknown> | null;
  public readonly delta?: number | null;
  public readonly reason: string;
  public readonly ipAddress?: string | null;
  public readonly prevHash: string;
  public readonly currentHash: string;
  public readonly createdAt: Date;

  constructor(props: AuditLogProps) {
    this.id = props.id;
    this.operatorId = props.operatorId;
    this.action = props.action;
    this.targetType = props.targetType;
    this.targetId = props.targetId;
    this.beforeState = props.beforeState ?? null;
    this.afterState = props.afterState ?? null;
    this.delta = props.delta ?? null;
    this.reason = props.reason;
    this.ipAddress = props.ipAddress ?? null;
    this.prevHash = props.prevHash || AuditLog.GENESIS_HASH;
    this.currentHash = props.currentHash;
    this.createdAt = props.createdAt ? new Date(props.createdAt) : new Date();
  }
}
