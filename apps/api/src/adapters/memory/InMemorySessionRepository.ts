import type { SessionRepository, SessionClosingData } from '../../core/ports/SessionRepository';
import { CashRegisterSession } from '../../core/entities/CashRegisterSession';
import type { TransactionalMemoryRepo } from './InMemoryTransactionManager';

export class InMemorySessionRepository implements SessionRepository, TransactionalMemoryRepo {
  private sessions: Map<string, CashRegisterSession> = new Map();
  private snapshot: Map<string, CashRegisterSession> | null = null;

  beginTx(): void {
    this.snapshot = new Map();
    for (const [id, s] of this.sessions.entries()) {
      this.snapshot.set(
        id,
        new CashRegisterSession({
          id: s.id,
          storeId: s.storeId,
          openedAt: s.openedAt,
          closedAt: s.closedAt,
          openedBy: s.openedBy,
          closedBy: s.closedBy,
          openingCash: s.openingCash,
          expectedCash: s.expectedCash,
          actualCash: s.actualCash,
          discrepancy: s.discrepancy,
          totalRevenue: s.totalRevenue,
          cashRevenue: s.cashRevenue,
          cardRevenue: s.cardRevenue,
          linePayRevenue: s.linePayRevenue,
          remitRevenue: s.remitRevenue,
          pointsIssued: s.pointsIssued,
          pointsRedeemed: s.pointsRedeemed,
          txCount: s.txCount,
          voidCount: s.voidCount,
          voidAmount: s.voidAmount,
          note: s.note,
          status: s.status,
        })
      );
    }
  }

  commitTx(): void {
    this.snapshot = null;
  }

  rollbackTx(): void {
    if (this.snapshot) {
      this.sessions = this.snapshot;
      this.snapshot = null;
    }
  }

  async findActiveByStore(storeId: string): Promise<CashRegisterSession | null> {
    for (const session of this.sessions.values()) {
      if (session.storeId === storeId && session.status === 'OPEN') {
        return session;
      }
    }
    return null;
  }

  async findById(id: string): Promise<CashRegisterSession | null> {
    return this.sessions.get(id) ?? null;
  }

  async openSession(session: CashRegisterSession): Promise<CashRegisterSession> {
    this.sessions.set(session.id, session);
    return session;
  }

  async closeSession(id: string, closingData: SessionClosingData): Promise<void> {
    const session = this.sessions.get(id);
    if (!session) return;

    session.status = 'CLOSED';
    session.closedBy = closingData.closedBy;
    session.closedAt = closingData.closedAt ?? new Date();
    session.actualCash = closingData.actualCash;
    session.discrepancy = closingData.discrepancy;
    session.note = closingData.note ?? session.note;
  }

  async save(session: CashRegisterSession): Promise<void> {
    this.sessions.set(session.id, session);
  }
}
