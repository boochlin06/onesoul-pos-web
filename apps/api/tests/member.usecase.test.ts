import { describe, it, expect, beforeEach } from 'vitest';
import {
  MemberUseCase,
  InMemoryMemberRepository,
  InMemoryOrderRepository,
  InMemoryAuditRepository,
  InMemoryTransactionManager,
  Member,
} from '../src';
import { isOk, isErr } from '@onesoul/shared';

describe('MemberUseCase', () => {
  let memberUseCase: MemberUseCase;
  let memberRepo: InMemoryMemberRepository;
  let orderRepo: InMemoryOrderRepository;
  let auditRepo: InMemoryAuditRepository;
  let txManager: InMemoryTransactionManager;

  beforeEach(async () => {
    memberRepo = new InMemoryMemberRepository();
    orderRepo = new InMemoryOrderRepository();
    auditRepo = new InMemoryAuditRepository();
    txManager = new InMemoryTransactionManager();

    txManager.register(memberRepo);
    txManager.register(orderRepo);
    txManager.register(auditRepo);

    memberUseCase = new MemberUseCase(memberRepo, orderRepo, auditRepo, txManager);

    await memberRepo.save(
      new Member({
        id: 'mem-001',
        phone: '0912345678',
        name: '陳大文',
        points: 50,
      })
    );
  });

  describe('1. Member Registration & Validation', () => {
    it('creates a new member with canonical phone number', async () => {
      const res = await memberUseCase.createMember({
        phone: '0988776655',
        name: '林志玲',
      });

      expect(isOk(res)).toBe(true);
      if (!isOk(res)) return;
      expect(res.data.phone).toBe('0988776655');
      expect(res.data.name).toBe('林志玲');
      expect(res.data.points).toBe(0);
    });

    it('rejects registration using walk-in numbers or keywords', async () => {
      const res1 = await memberUseCase.createMember({
        phone: '111111',
        name: '散客一號',
      });
      expect(isErr(res1)).toBe(true);

      const res2 = await memberUseCase.createMember({
        phone: 'WALKIN',
        name: '現場散客',
      });
      expect(isErr(res2)).toBe(true);
    });

    it('rejects duplicate registration with same phone', async () => {
      const res = await memberUseCase.createMember({
        phone: '0912345678', // already exists
        name: '假冒大文',
      });
      expect(isErr(res)).toBe(true);
      expect(res.error?.code).toBe('CONFLICT');
    });
  });

  describe('2. Phone Lookup with Leading Zero Parity', () => {
    it('finds member whether queried with or without leading zero', async () => {
      const withZero = await memberUseCase.findByPhone('0912345678');
      expect(isOk(withZero)).toBe(true);
      expect(withZero.data?.id).toBe('mem-001');

      const withoutZero = await memberUseCase.findByPhone('912345678');
      expect(isOk(withoutZero)).toBe(true);
      expect(withoutZero.data?.id).toBe('mem-001');
    });

    it('returns null when phone not found', async () => {
      const notFound = await memberUseCase.findByPhone('0999999999');
      expect(isOk(notFound)).toBe(true);
      expect(notFound.data).toBeNull();
    });
  });

  describe('3. Points Adjustment & Audit Logging', () => {
    it('adjusts points positively and records PointLog and AuditLog', async () => {
      const res = await memberUseCase.adjustPoints({
        memberId: 'mem-001',
        delta: 100,
        reason: '門市活動贈送點數',
        operator: 'manager@onesoul.tw',
      });

      expect(isOk(res)).toBe(true);
      if (!isOk(res)) return;
      expect(res.data.points).toBe(150); // 50 + 100

      // PointLog check
      const logs = await memberRepo.findPointLogsByMemberId('mem-001');
      expect(logs.length).toBe(1);
      expect(logs[0].type).toBe('MANUAL');
      expect(logs[0].delta).toBe(100);
      expect(logs[0].balance).toBe(150);

      // AuditLog check
      const auditLogs = await auditRepo.list();
      expect(auditLogs.length).toBe(1);
      expect(auditLogs[0].action).toBe('MANUAL_POINTS_ADJUST');
    });

    it('rejects adjustment when delta is 0 or reason is too short', async () => {
      const resZero = await memberUseCase.adjustPoints({
        memberId: 'mem-001',
        delta: 0,
        reason: '調整點數理由',
        operator: 'manager@onesoul.tw',
      });
      expect(isErr(resZero)).toBe(true);

      const resShort = await memberUseCase.adjustPoints({
        memberId: 'mem-001',
        delta: 10,
        reason: '贈點', // < 4 chars
        operator: 'manager@onesoul.tw',
      });
      expect(isErr(resShort)).toBe(true);
    });

    it('prevents deducting points beyond member balance', async () => {
      const res = await memberUseCase.adjustPoints({
        memberId: 'mem-001',
        delta: -100, // 50 - 100 < 0
        reason: '人工扣除超發點數',
        operator: 'manager@onesoul.tw',
      });
      expect(isErr(res)).toBe(true);
      expect(res.error?.code).toBe('INSUFFICIENT_POINTS');

      // Verify points remained 50
      const member = await memberRepo.findById('mem-001');
      expect(member?.points).toBe(50);
    });
  });

  describe('4. Member History', () => {
    it('returns member profile, point logs, and order history', async () => {
      await memberUseCase.adjustPoints({
        memberId: 'mem-001',
        delta: 20,
        reason: '新客建檔贈禮',
        operator: 'staff',
      });

      const history = await memberUseCase.getMemberHistory('mem-001');
      expect(isOk(history)).toBe(true);
      if (!isOk(history)) return;
      expect(history.data.member.name).toBe('陳大文');
      expect(history.data.pointLogs.length).toBe(1);
    });
  });
});
