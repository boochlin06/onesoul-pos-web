import {
  Result,
  ok,
  err,
  AppError,
  ValidationError,
  NotFoundError,
  ConflictError,
  InsufficientPointsError,
} from '@onesoul/shared';
import { Member, PointLog } from '../entities/Member';
import { PhoneNumber } from '../entities/PhoneNumber';
import { AuditLog } from '../entities/AuditLog';

import type { MemberRepository } from '../ports/MemberRepository';
import type { OrderRepository } from '../ports/OrderRepository';
import type { AuditRepository } from '../ports/AuditRepository';
import type { TransactionManager } from '../ports/TransactionManager';

export interface CreateMemberCommand {
  phone: string;
  name: string;
  tier?: string;
  points?: number;
}

export interface AdjustMemberPointsCommand {
  memberId: string;
  delta: number;
  reason: string;
  operator: string;
}

export interface MemberHistoryResult {
  member: Member;
  pointLogs: PointLog[];
  orders: any[];
}

export class MemberUseCase {
  constructor(
    private readonly memberRepo: MemberRepository,
    private readonly orderRepo: OrderRepository,
    private readonly auditRepo: AuditRepository,
    private readonly txManager: TransactionManager
  ) {}

  async createMember(
    command: CreateMemberCommand
  ): Promise<Result<Member, AppError>> {
    try {
      const phoneVo = new PhoneNumber(command.phone);
      if (phoneVo.isWalkIn) {
        return err(
          new ValidationError('散客代碼不可用於註冊正規會員帳號')
        );
      }
      if (phoneVo.canonical.length < 6 || !/\d/.test(phoneVo.canonical)) {
        return err(
          new ValidationError('會員手機號碼格式無效，長度至少需 6 碼且包含數字')
        );
      }

      const existing = await this.memberRepo.findByPhone(command.phone);
      if (existing) {
        return err(
          new ConflictError(`手機號碼 [${phoneVo.canonical}] 已經被註冊`)
        );
      }

      const member = new Member({
        id: `mem-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        phone: phoneVo.canonical,
        name: command.name.trim(),
        tier: command.tier ?? 'NORMAL',
        points: Math.max(0, command.points ?? 0),
        totalSpent: 0,
        orderCount: 0,
      });

      await this.memberRepo.save(member);
      return ok(member);
    } catch (error) {
      if (error instanceof AppError) return err(error);
      return err(new AppError('CREATE_MEMBER_FAILED', (error as Error).message));
    }
  }

  async findByPhone(phone: string): Promise<Result<Member | null, AppError>> {
    try {
      const member = await this.memberRepo.findByPhone(phone);
      return ok(member);
    } catch (error) {
      return err(new AppError('FIND_MEMBER_FAILED', (error as Error).message));
    }
  }

  async adjustPoints(
    command: AdjustMemberPointsCommand
  ): Promise<Result<Member, AppError>> {
    try {
      if (command.delta === 0) {
        return err(new ValidationError('點數異動不可為 0'));
      }
      if (!command.reason || command.reason.trim().length < 4) {
        return err(new ValidationError('請填寫至少 4 個字之調整原因'));
      }

      const member = await this.memberRepo.findById(command.memberId);
      if (!member) {
        return err(new NotFoundError('會員', command.memberId));
      }

      if (member.points + command.delta < 0) {
        return err(
          new InsufficientPointsError(
            `會員點數不足: 目前 ${member.points} 點，欲折抵扣除 ${Math.abs(command.delta)} 點`
          )
        );
      }

      return await this.txManager.runInTransaction(async (tx) => {
        const beforePoints = member.points;
        member.adjustPoints(command.delta);
        await this.memberRepo.save(member, tx);

        // 寫入 PointLog 複式記帳日誌
        await this.memberRepo.recordPointLog(
          new PointLog({
            id: `pt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            memberId: member.id,
            type: 'MANUAL',
            delta: command.delta,
            balance: member.points,
            reason: command.reason,
            operator: command.operator,
          }),
          tx
        );

        // 寫入密碼學審計日誌 (Guardrail 4: store_id 分區 CAS 鏈)
        const prevHash = await (this.auditRepo as any).getLatestHash(tx, 'chupei');
        const currentHash = AuditLog.calculateHash(prevHash, {
          operatorId: command.operator,
          action: 'MANUAL_POINTS_ADJUST',
          targetType: 'MEMBER',
          targetId: member.id,
          delta: command.delta,
          reason: command.reason,
        });
        const auditLog = new AuditLog({
          id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          storeId: 'chupei',
          operatorId: command.operator,
          action: 'MANUAL_POINTS_ADJUST',
          targetType: 'MEMBER',
          targetId: member.id,
          beforeState: { points: beforePoints },
          afterState: { points: member.points },
          delta: command.delta,
          reason: command.reason,
          prevHash,
          currentHash,
        });
        await this.auditRepo.append(auditLog, tx);

        return ok(member);
      });
    } catch (error) {
      if (error instanceof AppError) return err(error);
      return err(new AppError('ADJUST_POINTS_FAILED', (error as Error).message));
    }
  }

  async getMemberHistory(
    memberId: string
  ): Promise<Result<MemberHistoryResult, AppError>> {
    try {
      const member = await this.memberRepo.findById(memberId);
      if (!member) {
        return err(new NotFoundError('會員', memberId));
      }

      const pointLogs = await this.memberRepo.findPointLogsByMemberId(memberId, 100);
      const orders = await this.orderRepo.listByMemberId(memberId, 50);
      return ok({
        member,
        pointLogs,
        orders,
      });
    } catch (error) {
      return err(new AppError('GET_HISTORY_FAILED', (error as Error).message));
    }
  }
}
