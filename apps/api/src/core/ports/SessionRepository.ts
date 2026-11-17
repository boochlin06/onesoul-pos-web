import type { CashRegisterSession } from '../entities/CashRegisterSession';

export interface SessionClosingData {
  closedBy: string;
  actualCash: number;
  discrepancy: number;
  note?: string | null;
  closedAt?: Date;
}

export interface SessionRepository {
  findActiveByStore(storeId: string, tx?: any): Promise<CashRegisterSession | null>;
  findById(id: string, tx?: any): Promise<CashRegisterSession | null>;
  openSession(session: CashRegisterSession, tx?: any): Promise<CashRegisterSession>;
  closeSession(id: string, closingData: SessionClosingData, tx?: any): Promise<void>;
  save(session: CashRegisterSession, tx?: any): Promise<void>;
}
