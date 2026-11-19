import { sql, eq } from 'drizzle-orm';
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

  async getLatestHash(tx?: any, storeId?: string): Promise<string> {
    const executor = this.getExecutor(tx);
    const query = executor
      .select({ currentHash: auditLogs.currentHash })
      .from(auditLogs);

    if (storeId) {
      query.where(eq(auditLogs.storeId, storeId));
    }

    const [latest] = await query
      .orderBy(sql`${auditLogs.sequenceNum} DESC, ${auditLogs.createdAt} DESC, rowid DESC`)
      .limit(1);

    return latest?.currentHash ?? AuditLog.GENESIS_HASH;
  }

  async append(log: AuditLog, tx?: any): Promise<void> {
    const executor = this.getExecutor(tx);
    const storeId = log.storeId || 'chupei';
    let seq = log.sequenceNum;
    if (!seq || seq <= 0) {
      const [res] = await executor
        .select({ maxSeq: sql<number>`coalesce(max(${auditLogs.sequenceNum}), 0)` })
        .from(auditLogs)
        .where(eq(auditLogs.storeId, storeId));
      seq = (Number(res?.maxSeq) || 0) + 1;
    }

    await executor.insert(auditLogs).values({
      id: log.id,
      storeId,
      sequenceNum: seq,
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

  async verifyChain(storeId?: string): Promise<{
    valid: boolean;
    totalCount: number;
    brokenAt?: string;
  }> {
    if (storeId) {
      return this.verifyStoreChain(storeId);
    }
    const storeRows = await this.db
      .selectDistinct({ storeId: auditLogs.storeId })
      .from(auditLogs);

    if (storeRows.length === 0) {
      return { valid: true, totalCount: 0 };
    }

    let total = 0;
    for (const { storeId: sid } of storeRows) {
      const res = await this.verifyStoreChain(sid);
      if (!res.valid) {
        return res;
      }
      total += res.totalCount;
    }
    return { valid: true, totalCount: total };
  }

  private async verifyStoreChain(storeId: string): Promise<{
    valid: boolean;
    totalCount: number;
    brokenAt?: string;
  }> {
    const rows = await this.db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.storeId, storeId))
      .orderBy(sql`${auditLogs.sequenceNum} ASC, rowid ASC`);

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
      storeId: row.storeId,
      sequenceNum: row.sequenceNum,
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
