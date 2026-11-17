import crypto from 'node:crypto';
import { Result, ok, err, AppError, ValidationError } from '@onesoul/shared';
import { AuditLog } from '../entities/AuditLog';
import type { AuditRepository } from '../ports/AuditRepository';

export interface RecordAuditCommand {
  operatorId: string;
  action: string;
  targetType: string;
  targetId: string;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  delta?: number | null;
  reason: string;
  ipAddress?: string | null;
}

export interface VerifyChainResult {
  valid: boolean;
  totalCount: number;
  brokenAt?: string;
}

export class AuditUseCase {
  private readonly secret: string;

  constructor(
    private readonly auditRepo: AuditRepository,
    secret = 'onesoul-audit-key-2026'
  ) {
    this.secret = secret;
  }

  /**
   * 寫入防篡改密碼學審計日誌 (HMAC-SHA256 雜湊鏈)
   */
  async recordLog(
    command: RecordAuditCommand
  ): Promise<Result<AuditLog, AppError>> {
    try {
      if (!command.operatorId || !command.action || !command.targetType || !command.targetId) {
        return err(new ValidationError('審計日誌關鍵欄位不可為空'));
      }

      const prevHash = await this.auditRepo.getLatestHash();
      const payload = `${prevHash}|${command.operatorId}|${command.action}|${command.targetType}|${command.targetId}|${command.delta ?? 0}|${command.reason}`;
      const currentHash = crypto
        .createHmac('sha256', this.secret)
        .update(payload)
        .digest('hex');

      const auditLog = new AuditLog({
        id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        operatorId: command.operatorId,
        action: command.action,
        targetType: command.targetType,
        targetId: command.targetId,
        beforeState: command.beforeState,
        afterState: command.afterState,
        delta: command.delta,
        reason: command.reason,
        ipAddress: command.ipAddress,
        prevHash,
        currentHash,
      });

      await this.auditRepo.append(auditLog);
      return ok(auditLog);
    } catch (error) {
      return err(new AppError('RECORD_AUDIT_FAILED', (error as Error).message));
    }
  }

  /**
   * 驗證整條審計日誌鏈之線性完整性與密碼學簽章
   */
  async verifyChain(): Promise<Result<VerifyChainResult, AppError>> {
    try {
      const verification = await this.auditRepo.verifyChain();
      return ok(verification);
    } catch (error) {
      return err(new AppError('VERIFY_CHAIN_FAILED', (error as Error).message));
    }
  }
}
