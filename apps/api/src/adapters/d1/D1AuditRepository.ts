import { sql } from 'drizzle-orm';
import type { OneSoulD1Database } from '@onesoul/db';
import { auditLogs } from '@onesoul/db/schema';
import type { AuditRepository } from '../../core/ports/AuditRepository';
import { AuditLog } from '../../core/entities/AuditLog';

export class D1AuditRepository implements AuditRepository {
  private readonly secret: string;

  constructor(
    private readonly db: OneSoulD1Database,
    secret = AuditLog.DEFAULT_SECRET
  ) {
    this.secret = secret;
  }

  private getExecutor(tx?: any): any {
    return tx ?? this.db;
  }

  async getLatestHash(tx?: any): Promise<string> {
    const executor = this.getExecutor(tx);
    const [latest] = await executor
      .select({ currentHash: auditLogs.currentHash })
      .from(auditLogs)
      .orderBy(sql`${auditLogs.createdAt} DESC, rowid DESC`)
      .limit(1);

    return latest?.currentHash ?? AuditLog.GENESIS_HASH;
  }

  async append(log: AuditLog, tx?: any): Promise<void> {
    const executor = this.getExecutor(tx);
    await executor.insert(auditLogs).values({
      id: log.id,
      operatorId: log.operatorId,
      action: log.action,
      targetType: log.targetType,
      targetId: log.targetId,
      beforeState: (log.beforeState ?? null) as any,
      afterState: (log.afterState ?? null) as any,
      delta: log.delta ?? null,
      reason: log.reason,
      ipAddress: log.ipAddress ?? null,
      prevHash: log.prevHash,
      currentHash: log.currentHash,
      createdAt:
        log.createdAt instanceof Date
          ? log.createdAt.toISOString()
          : String(log.createdAt),
    });
  }

  async verifyChain(): Promise<{
    valid: boolean;
    totalCount: number;
    brokenAt?: string;
  }> {
    const rows = await this.db
      .select()
      .from(auditLogs)
      .orderBy(sql`${auditLogs.createdAt} ASC, rowid ASC`);

    let expectedPrevHash = AuditLog.GENESIS_HASH;

    for (const row of rows) {
      if (row.prevHash !== expectedPrevHash) {
        return {
          valid: false,
          totalCount: rows.length,
          brokenAt: row.id,
        };
      }

      const calculated = AuditLog.calculateHash(
        expectedPrevHash,
        {
          operatorId: row.operatorId,
          action: row.action,
          targetType: row.targetType,
          targetId: row.targetId,
          delta: row.delta,
          reason: row.reason,
        },
        this.secret
      );

      if (calculated !== row.currentHash) {
        return {
          valid: false,
          totalCount: rows.length,
          brokenAt: row.id,
        };
      }

      expectedPrevHash = row.currentHash;
    }

    return {
      valid: true,
      totalCount: rows.length,
    };
  }

  async list(limit = 100, tx?: any): Promise<AuditLog[]> {
    const executor = this.getExecutor(tx);
    const rows = await executor
      .select()
      .from(auditLogs)
      .orderBy(sql`${auditLogs.createdAt} DESC, rowid DESC`)
      .limit(limit);

    return rows.map((r: any) => this.mapAuditLog(r));
  }

  private mapAuditLog(row: any): AuditLog {
    const beforeState =
      typeof row.beforeState === 'string'
        ? JSON.parse(row.beforeState)
        : row.beforeState;
    const afterState =
      typeof row.afterState === 'string'
        ? JSON.parse(row.afterState)
        : row.afterState;

    return new AuditLog({
      id: row.id,
      operatorId: row.operatorId,
      action: row.action,
      targetType: row.targetType,
      targetId: row.targetId,
      beforeState,
      afterState,
      delta: row.delta,
      reason: row.reason,
      ipAddress: row.ipAddress,
      prevHash: row.prevHash,
      currentHash: row.currentHash,
      createdAt: row.createdAt,
    });
  }
}
