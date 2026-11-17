import type { AuditLog } from '../entities/AuditLog';

export interface AuditRepository {
  getLatestHash(tx?: any): Promise<string>;
  append(log: AuditLog, tx?: any): Promise<void>;
  verifyChain(): Promise<{ valid: boolean; totalCount: number; brokenAt?: string }>;
  list(limit?: number, tx?: any): Promise<AuditLog[]>;
}
