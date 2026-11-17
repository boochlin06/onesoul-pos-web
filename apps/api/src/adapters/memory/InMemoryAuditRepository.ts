import crypto from 'node:crypto';
import type { AuditRepository } from '../../core/ports/AuditRepository';
import { AuditLog } from '../../core/entities/AuditLog';
import type { TransactionalMemoryRepo } from './InMemoryTransactionManager';

export class InMemoryAuditRepository implements AuditRepository, TransactionalMemoryRepo {
  private logs: AuditLog[] = [];
  private snapshotLogs: AuditLog[] | null = null;
  private readonly secret: string;

  constructor(secret = 'onesoul-audit-key-2026') {
    this.secret = secret;
  }

  beginTx(): void {
    this.snapshotLogs = [...this.logs];
  }

  commitTx(): void {
    this.snapshotLogs = null;
  }

  rollbackTx(): void {
    if (this.snapshotLogs) {
      this.logs = this.snapshotLogs;
      this.snapshotLogs = null;
    }
  }

  async getLatestHash(): Promise<string> {
    if (this.logs.length === 0) {
      return AuditLog.GENESIS_HASH;
    }
    return this.logs[this.logs.length - 1].currentHash;
  }

  async append(log: AuditLog): Promise<void> {
    this.logs.push(log);
  }

  async verifyChain(): Promise<{
    valid: boolean;
    totalCount: number;
    brokenAt?: string;
  }> {
    let expectedPrevHash = AuditLog.GENESIS_HASH;

    for (let i = 0; i < this.logs.length; i++) {
      const log = this.logs[i];

      // 1. Verify link to previous log
      if (log.prevHash !== expectedPrevHash) {
        return {
          valid: false,
          totalCount: this.logs.length,
          brokenAt: log.id,
        };
      }

      // 2. Re-calculate hash to ensure contents were not tampered with
      const payload = `${log.prevHash}|${log.operatorId}|${log.action}|${log.targetType}|${log.targetId}|${log.delta ?? 0}|${log.reason}`;
      const calculatedHash = crypto
        .createHmac('sha256', this.secret)
        .update(payload)
        .digest('hex');

      if (calculatedHash !== log.currentHash) {
        return {
          valid: false,
          totalCount: this.logs.length,
          brokenAt: log.id,
        };
      }

      expectedPrevHash = log.currentHash;
    }

    return {
      valid: true,
      totalCount: this.logs.length,
    };
  }

  async list(limit = 100): Promise<AuditLog[]> {
    const sorted = [...this.logs].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
    return sorted.slice(0, limit);
  }
}
