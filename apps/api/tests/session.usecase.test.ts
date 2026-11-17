import { describe, it, expect, beforeEach } from 'vitest';
import {
  SessionUseCase,
  InMemorySessionRepository,
  InMemoryOrderRepository,
  InMemoryAuditRepository,
  InMemoryTransactionManager,
  Order,
} from '../src';
import { isOk, isErr } from '@onesoul/shared';

describe('SessionUseCase', () => {
  let sessionUseCase: SessionUseCase;
  let sessionRepo: InMemorySessionRepository;
  let orderRepo: InMemoryOrderRepository;
  let auditRepo: InMemoryAuditRepository;
  let txManager: InMemoryTransactionManager;

  beforeEach(async () => {
    sessionRepo = new InMemorySessionRepository();
    orderRepo = new InMemoryOrderRepository();
    auditRepo = new InMemoryAuditRepository();
    txManager = new InMemoryTransactionManager();

    txManager.register(sessionRepo);
    txManager.register(orderRepo);
    txManager.register(auditRepo);

    sessionUseCase = new SessionUseCase(sessionRepo, orderRepo, auditRepo, txManager);
  });

  describe('1. Open Shift Session', () => {
    it('opens a new cash register shift session with initial float cash', async () => {
      const res = await sessionUseCase.openSession({
        storeId: 'chupei',
        openingCash: 8000,
        openedBy: 'cashier@onesoul.tw',
      });

      expect(isOk(res)).toBe(true);
      if (!isOk(res)) return;
      expect(res.data.status).toBe('OPEN');
      expect(res.data.openingCash).toBe(8000);
      expect(res.data.openedBy).toBe('cashier@onesoul.tw');
    });

    it('prevents opening multiple concurrent sessions for the same store', async () => {
      await sessionUseCase.openSession({
        storeId: 'chupei',
        openingCash: 8000,
        openedBy: 'cashier1@onesoul.tw',
      });

      const duplicate = await sessionUseCase.openSession({
        storeId: 'chupei',
        openingCash: 5000,
        openedBy: 'cashier2@onesoul.tw',
      });

      expect(isErr(duplicate)).toBe(true);
      expect(duplicate.error?.code).toBe('CONFLICT');
    });
  });

  describe('2. Live Shift Summary', () => {
    it('aggregates live shift revenue and expected cash accurately', async () => {
      const openRes = await sessionUseCase.openSession({
        storeId: 'chupei',
        openingCash: 8000,
        openedBy: 'cashier@onesoul.tw',
      });
      const sessionId = openRes.data!.id;

      // Seed completed and cancelled orders
      await orderRepo.save(
        new Order({
          id: 'ord-1',
          checkoutUID: 'uid-1',
          storeId: 'chupei',
          sessionId,
          memberPhone: '0912345678',
          totalDue: 1500,
          payment: { cash: 1000, creditCard: 500, linePay: 0, remittance: 0, pointsUsed: 0 },
          netPointsDelta: 20,
          items: [],
          status: 'COMPLETED',
          cashierEmail: 'cashier@onesoul.tw',
        })
      );
      await orderRepo.save(
        new Order({
          id: 'ord-2',
          checkoutUID: 'uid-2',
          storeId: 'chupei',
          sessionId,
          memberPhone: '0922334455',
          totalDue: 800,
          payment: { cash: 0, creditCard: 0, linePay: 800, remittance: 0, pointsUsed: 0 },
          netPointsDelta: 10,
          items: [],
          status: 'COMPLETED',
          cashierEmail: 'cashier@onesoul.tw',
        })
      );
      await orderRepo.save(
        new Order({
          id: 'ord-3',
          checkoutUID: 'uid-3',
          storeId: 'chupei',
          sessionId,
          memberPhone: '0933445566',
          totalDue: 600,
          payment: { cash: 600, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
          netPointsDelta: 0,
          items: [],
          status: 'CANCELLED',
          cashierEmail: 'cashier@onesoul.tw',
        })
      );

      const summaryRes = await sessionUseCase.getLiveShiftSummary(sessionId);
      expect(isOk(summaryRes)).toBe(true);
      if (!isOk(summaryRes)) return;

      const summary = summaryRes.data;
      expect(summary.openingCash).toBe(8000);
      expect(summary.cashRevenue).toBe(1000); // 1000 from ord-1 (ord-3 is cancelled)
      expect(summary.cardRevenue).toBe(500);
      expect(summary.linePayRevenue).toBe(800);
      expect(summary.totalRevenue).toBe(2300); // 1500 + 800
      expect(summary.expectedCash).toBe(9000); // 8000 + 1000
      expect(summary.txCount).toBe(2);
      expect(summary.voidCount).toBe(1);
      expect(summary.voidAmount).toBe(600);
      expect(summary.pointsIssued).toBe(30);
    });
  });

  describe('3. Close Shift & 22:00 Z-Report Snapshot', () => {
    it('freezes Z-Report, calculates discrepancy, and records AuditLog', async () => {
      const openRes = await sessionUseCase.openSession({
        storeId: 'chupei',
        openingCash: 8000,
        openedBy: 'cashier@onesoul.tw',
      });
      const sessionId = openRes.data!.id;

      await orderRepo.save(
        new Order({
          id: 'ord-1',
          checkoutUID: 'uid-1',
          storeId: 'chupei',
          sessionId,
          memberPhone: '0912345678',
          totalDue: 1200,
          payment: { cash: 1200, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
          netPointsDelta: 10,
          items: [],
          status: 'COMPLETED',
          cashierEmail: 'cashier@onesoul.tw',
        })
      );

      // Expected cash = 8000 + 1200 = 9200
      // Actual counted cash = 9150 (shortage -50)
      const closeRes = await sessionUseCase.closeSession({
        sessionId,
        actualCash: 9150,
        closedBy: 'manager@onesoul.tw',
        note: '日結短少 50 元找零失誤',
      });

      expect(isOk(closeRes)).toBe(true);
      if (!isOk(closeRes)) return;

      const zReport = closeRes.data;
      expect(zReport.expectedCash).toBe(9200);
      expect(zReport.actualCash).toBe(9150);
      expect(zReport.discrepancy).toBe(-50);
      expect(zReport.cashRevenue).toBe(1200);
      expect(zReport.totalRevenue).toBe(1200);

      // Check session status in repository
      const session = await sessionRepo.findById(sessionId);
      expect(session?.status).toBe('CLOSED');
      expect(session?.discrepancy).toBe(-50);

      // Check audit log
      const auditLogs = await auditRepo.list();
      expect(auditLogs.length).toBe(1);
      expect(auditLogs[0].action).toBe('SESSION_CLOSE_Z_REPORT');

      // Cannot close an already closed session
      const reClose = await sessionUseCase.closeSession({
        sessionId,
        actualCash: 9200,
        closedBy: 'manager@onesoul.tw',
      });
      expect(isErr(reClose)).toBe(true);
    });
  });
});
