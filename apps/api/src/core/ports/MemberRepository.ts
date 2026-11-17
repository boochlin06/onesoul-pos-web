import type { Member, PointLog } from '../entities/Member';

export interface MemberRepository {
  findById(id: string, tx?: any): Promise<Member | null>;
  findByPhone(phone: string, tx?: any): Promise<Member | null>;
  findOrCreateByPhone(phone: string, name?: string, tx?: any): Promise<Member>;
  save(member: Member, tx?: any): Promise<void>;
  recordPointLog(log: PointLog, tx?: any): Promise<void>;
  findPointLogsByMemberId(memberId: string, limit?: number, tx?: any): Promise<PointLog[]>;
}
