import { eq, and, sql } from 'drizzle-orm';
import type { OneSoulD1Database } from '@onesoul/db';
import { cashRegisterSessions } from '@onesoul/db/schema';
import type {
  SessionRepository,
  SessionClosingData,
} from '../../core/ports/SessionRepository';
import { CashRegisterSession } from '../../core/entities/CashRegisterSession';

export class D1SessionRepository implements SessionRepository {
  constructor(private readonly db: OneSoulD1Database) {}

  private getExecutor(tx?: any): any {
    return tx ?? this.db;
  }

  async findActiveByStore(
    storeId: string,
    tx?: any
  ): Promise<CashRegisterSession | null> {
    const executor = this.getExecutor(tx);
    const [row] = await executor
      .select()
      .from(cashRegisterSessions)
      .where(
        and(
          eq(cashRegisterSessions.storeId, storeId),
          eq(cashRegisterSessions.status, 'OPEN')
        )
      )
      .limit(1);

    return row ? this.mapSession(row) : null;
  }

  async findById(id: string, tx?: any): Promise<CashRegisterSession | null> {
    const executor = this.getExecutor(tx);
    const [row] = await executor
      .select()
      .from(cashRegisterSessions)
      .where(eq(cashRegisterSessions.id, id))
      .limit(1);

    return row ? this.mapSession(row) : null;
  }

  async openSession(
    session: CashRegisterSession,
    tx?: any
  ): Promise<CashRegisterSession> {
    const executor = this.getExecutor(tx);
    // 門市僅允許單一 OPEN 班次：若該門市存在歷史未關閉班次，先標記封存以維持單一 OPEN 不變量
    await executor
      .update(cashRegisterSessions)
      .set({
        status: 'CLOSED',
        closedAt: sql`(CURRENT_TIMESTAMP)`,
        closedBy: 'system-rollover',
      })
      .where(
        and(
          eq(cashRegisterSessions.storeId, session.storeId),
          eq(cashRegisterSessions.status, 'OPEN')
        )
      );

    await executor.insert(cashRegisterSessions).values({
      id: session.id,
      storeId: session.storeId,
      openedAt:
        session.openedAt instanceof Date
          ? session.openedAt.toISOString()
          : String(session.openedAt),
      openedBy: session.openedBy,
      openingCash: session.openingCash,
      status: 'OPEN',
      note: session.note ?? null,
    });
    return session;
  }

  async closeSession(
    id: string,
    closingData: SessionClosingData,
    tx?: any
  ): Promise<void> {
    const executor = this.getExecutor(tx);
    const closedDate = closingData.closedAt || new Date();
    await executor
      .update(cashRegisterSessions)
      .set({
        status: 'CLOSED',
        closedBy: closingData.closedBy,
        actualCash: closingData.actualCash,
        discrepancy: closingData.discrepancy,
        closedAt:
          closedDate instanceof Date
            ? closedDate.toISOString()
            : String(closedDate),
        note: closingData.note ?? null,
      })
      .where(eq(cashRegisterSessions.id, id));
  }

  async save(session: CashRegisterSession, tx?: any): Promise<void> {
    const executor = this.getExecutor(tx);
    const [existing] = await executor
      .select({ id: cashRegisterSessions.id })
      .from(cashRegisterSessions)
      .where(eq(cashRegisterSessions.id, session.id))
      .limit(1);

    if (existing) {
      await executor
        .update(cashRegisterSessions)
        .set({
          storeId: session.storeId,
          openedAt:
            session.openedAt instanceof Date
              ? session.openedAt.toISOString()
              : String(session.openedAt),
          closedAt: session.closedAt
            ? session.closedAt instanceof Date
              ? session.closedAt.toISOString()
              : String(session.closedAt)
            : null,
          openedBy: session.openedBy,
          closedBy: session.closedBy ?? null,
          openingCash: session.openingCash,
          expectedCash: session.expectedCash ?? null,
          actualCash: session.actualCash ?? null,
          discrepancy: session.discrepancy ?? null,
          totalRevenue: session.totalRevenue ?? null,
          cashRevenue: session.cashRevenue ?? null,
          cardRevenue: session.cardRevenue ?? null,
          linePayRevenue: session.linePayRevenue ?? null,
          remitRevenue: session.remitRevenue ?? null,
          pointsIssued: session.pointsIssued ?? null,
          pointsRedeemed: session.pointsRedeemed ?? null,
          txCount: session.txCount ?? null,
          voidCount: session.voidCount ?? null,
          voidAmount: session.voidAmount ?? null,
          note: session.note ?? null,
          status: session.status,
        })
        .where(eq(cashRegisterSessions.id, session.id));
    } else {
      await executor.insert(cashRegisterSessions).values({
        id: session.id,
        storeId: session.storeId,
        openedAt:
          session.openedAt instanceof Date
            ? session.openedAt.toISOString()
            : String(session.openedAt),
        closedAt: session.closedAt
          ? session.closedAt instanceof Date
            ? session.closedAt.toISOString()
            : String(session.closedAt)
          : null,
        openedBy: session.openedBy,
        closedBy: session.closedBy ?? null,
        openingCash: session.openingCash,
        expectedCash: session.expectedCash ?? null,
        actualCash: session.actualCash ?? null,
        discrepancy: session.discrepancy ?? null,
        totalRevenue: session.totalRevenue ?? null,
        cashRevenue: session.cashRevenue ?? null,
        cardRevenue: session.cardRevenue ?? null,
        linePayRevenue: session.linePayRevenue ?? null,
        remitRevenue: session.remitRevenue ?? null,
        pointsIssued: session.pointsIssued ?? null,
        pointsRedeemed: session.pointsRedeemed ?? null,
        txCount: session.txCount ?? null,
        voidCount: session.voidCount ?? null,
        voidAmount: session.voidAmount ?? null,
        note: session.note ?? null,
        status: session.status,
      });
    }
  }

  private mapSession(row: any): CashRegisterSession {
    return new CashRegisterSession({
      id: row.id,
      storeId: row.storeId,
      openedAt: row.openedAt,
      closedAt: row.closedAt,
      openedBy: row.openedBy,
      closedBy: row.closedBy,
      openingCash: row.openingCash,
      expectedCash: row.expectedCash,
      actualCash: row.actualCash,
      discrepancy: row.discrepancy,
      totalRevenue: row.totalRevenue,
      cashRevenue: row.cashRevenue,
      cardRevenue: row.cardRevenue,
      linePayRevenue: row.linePayRevenue,
      remitRevenue: row.remitRevenue,
      pointsIssued: row.pointsIssued,
      pointsRedeemed: row.pointsRedeemed,
      txCount: row.txCount,
      voidCount: row.voidCount,
      voidAmount: row.voidAmount,
      note: row.note,
      status: row.status,
    });
  }
}
