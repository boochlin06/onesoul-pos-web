import {
  Result,
  ok,
  err,
  AppError,
  ValidationError,
  NotFoundError,
  ConflictError,
} from '@onesoul/shared';
import { CashRegisterSession, type ZReport } from '../entities/CashRegisterSession';
import { AuditLog } from '../entities/AuditLog';

import type { SessionRepository } from '../ports/SessionRepository';
import type { OrderRepository } from '../ports/OrderRepository';
import type { AuditRepository } from '../ports/AuditRepository';
import type { TransactionManager } from '../ports/TransactionManager';

export interface OpenSessionCommand {
  storeId: string;
  openingCash?: number;
  openedBy: string;
}

export interface CloseSessionCommand {
  sessionId: string;
  actualCash: number;
  closedBy: string;
  note?: string;
  closedAt?: Date;
}

export interface LiveShiftSummary {
  sessionId: string;
  storeId: string;
  status: string;
  openedAt: Date;
  openedBy: string;
  openingCash: number;
  expectedCash: number;
  cashRevenue: number;
  cardRevenue: number;
  linePayRevenue: number;
  remitRevenue: number;
  totalRevenue: number;
  txCount: number;
  voidCount: number;
  voidAmount: number;
  pointsIssued: number;
  pointsRedeemed: number;
}

export class SessionUseCase {
  constructor(
    private readonly sessionRepo: SessionRepository,
    private readonly orderRepo: OrderRepository,
    private readonly auditRepo: AuditRepository,
    private readonly txManager: TransactionManager
  ) {}

  async openSession(
    command: OpenSessionCommand
  ): Promise<Result<CashRegisterSession, AppError>> {
    try {
      const active = await this.sessionRepo.findActiveByStore(command.storeId);
      if (active) {
        return err(
          new ConflictError(
            `門市 [${command.storeId}] 目前已有進行中的收銀班次 [${active.id}]`
          )
        );
      }

      const openingCash = Math.max(0, command.openingCash ?? 8000);
      const session = new CashRegisterSession({
        id: `sess-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        storeId: command.storeId,
        openedBy: command.openedBy,
        openingCash,
        status: 'OPEN',
      });

      await this.sessionRepo.openSession(session);
      return ok(session);
    } catch (error) {
      if (error instanceof AppError) return err(error);
      return err(new AppError('OPEN_SESSION_FAILED', (error as Error).message));
    }
  }

  async getLiveShiftSummary(
    sessionId: string
  ): Promise<Result<LiveShiftSummary, AppError>> {
    try {
      const session = await this.sessionRepo.findById(sessionId);
      if (!session) {
        return err(new NotFoundError('收銀班次', sessionId));
      }

      const orders = await this.orderRepo.listBySession(sessionId);

      let cashRev = 0;
      let cardRev = 0;
      let lineRev = 0;
      let remitRev = 0;
      let totalRev = 0;
      let validTx = 0;
      let voidedTx = 0;
      let voidedAmt = 0;
      let ptsIssued = 0;
      let ptsRedeemed = 0;

      for (const order of orders) {
        if (order.status === 'CANCELLED') {
          voidedTx += 1;
          voidedAmt += order.totalDue;
          continue;
        }
        validTx += 1;
        cashRev += order.payment.cash;
        cardRev += order.payment.creditCard;
        lineRev += order.payment.linePay;
        remitRev += order.payment.remittance;
        totalRev += order.totalDue;
        ptsRedeemed += order.payment.pointsUsed;
        if (order.netPointsDelta > 0) {
          ptsIssued += order.netPointsDelta;
        }
      }

      return ok({
        sessionId: session.id,
        storeId: session.storeId,
        status: session.status,
        openedAt: session.openedAt,
        openedBy: session.openedBy,
        openingCash: session.openingCash,
        expectedCash: session.openingCash + cashRev,
        cashRevenue: cashRev,
        cardRevenue: cardRev,
        linePayRevenue: lineRev,
        remitRevenue: remitRev,
        totalRevenue: totalRev,
        txCount: validTx,
        voidCount: voidedTx,
        voidAmount: voidedAmt,
        pointsIssued: ptsIssued,
        pointsRedeemed: ptsRedeemed,
      });
    } catch (error) {
      return err(new AppError('GET_SHIFT_SUMMARY_FAILED', (error as Error).message));
    }
  }

  /**
   * 22:00 日結關帳 (Z-Report 快照與溢短盤點)
   */
  async closeSession(
    command: CloseSessionCommand
  ): Promise<Result<ZReport, AppError>> {
    try {
      if (command.actualCash < 0) {
        return err(new ValidationError('實盤現金金額不可小於 0'));
      }

      const session = await this.sessionRepo.findById(command.sessionId);
      if (!session) {
        return err(new NotFoundError('收銀班次', command.sessionId));
      }

      if (!session.isOpen) {
        return err(new ConflictError(`收銀班次 [${command.sessionId}] 已經關閉`));
      }

      const orders = await this.orderRepo.listBySession(command.sessionId);

      return await this.txManager.runInTransaction(async (tx) => {
        const zReport = session.close({
          closedBy: command.closedBy,
          actualCash: command.actualCash,
          orders,
          note: command.note,
          closedAt: command.closedAt,
        });

        await this.sessionRepo.closeSession(
          session.id,
          {
            closedBy: zReport.closedBy,
            actualCash: zReport.actualCash,
            discrepancy: zReport.discrepancy,
            note: zReport.note,
            closedAt: zReport.closedAt,
          },
          tx
        );

        // 寫入密碼學審計日誌
        const reason = command.note || '收銀班次日結關帳';
        const prevHash = await this.auditRepo.getLatestHash(tx);
        const currentHash = AuditLog.calculateHash(prevHash, {
          operatorId: command.closedBy,
          action: 'SESSION_CLOSE_Z_REPORT',
          targetType: 'CASH_REGISTER_SESSION',
          targetId: session.id,
          delta: 0,
          reason,
        });
        const auditLog = new AuditLog({
          id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          operatorId: command.closedBy,
          action: 'SESSION_CLOSE_Z_REPORT',
          targetType: 'CASH_REGISTER_SESSION',
          targetId: session.id,
          beforeState: { status: 'OPEN', openingCash: session.openingCash },
          afterState: {
            status: 'CLOSED',
            actualCash: zReport.actualCash,
            expectedCash: zReport.expectedCash,
            discrepancy: zReport.discrepancy,
            totalRevenue: zReport.totalRevenue,
          },
          reason,
          prevHash,
          currentHash,
        });
        await this.auditRepo.append(auditLog, tx);

        return ok(zReport);
      });
    } catch (error) {
      if (error instanceof AppError) return err(error);
      return err(new AppError('CLOSE_SESSION_FAILED', (error as Error).message));
    }
  }
}
