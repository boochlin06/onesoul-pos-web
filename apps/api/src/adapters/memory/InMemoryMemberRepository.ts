import type { MemberRepository } from '../../core/ports/MemberRepository';
import { Member, PointLog } from '../../core/entities/Member';
import { PhoneNumber } from '../../core/entities/PhoneNumber';
import type { TransactionalMemoryRepo } from './InMemoryTransactionManager';

export class InMemoryMemberRepository implements MemberRepository, TransactionalMemoryRepo {
  private members: Map<string, Member> = new Map();
  private pointLogs: PointLog[] = [];

  private snapshotMembers: Map<string, Member> | null = null;
  private snapshotPointLogs: PointLog[] | null = null;

  beginTx(): void {
    this.snapshotMembers = new Map();
    for (const [id, m] of this.members.entries()) {
      this.snapshotMembers.set(
        id,
        new Member({
          id: m.id,
          phone: m.phone,
          name: m.name,
          tier: m.tier,
          points: m.points,
          version: m.version,
          totalSpent: m.totalSpent,
          orderCount: m.orderCount,
          lastPurchaseAt: m.lastPurchaseAt,
          isActive: m.isActive,
          createdAt: m.createdAt,
          updatedAt: m.updatedAt,
        })
      );
    }
    this.snapshotPointLogs = [...this.pointLogs];
  }

  commitTx(): void {
    this.snapshotMembers = null;
    this.snapshotPointLogs = null;
  }

  rollbackTx(): void {
    if (this.snapshotMembers) {
      this.members = this.snapshotMembers;
      this.snapshotMembers = null;
    }
    if (this.snapshotPointLogs) {
      this.pointLogs = this.snapshotPointLogs;
      this.snapshotPointLogs = null;
    }
  }

  async findById(id: string): Promise<Member | null> {
    return this.members.get(id) ?? null;
  }

  async findByPhone(phone: string): Promise<Member | null> {
    const targetPhoneVo = new PhoneNumber(phone);
    for (const member of this.members.values()) {
      if (targetPhoneVo.equals(member.phone)) {
        return member;
      }
    }
    return null;
  }

  async findOrCreateByPhone(phone: string, name?: string): Promise<Member> {
    const existing = await this.findByPhone(phone);
    if (existing) {
      return existing;
    }

    const phoneVo = new PhoneNumber(phone);
    const newMember = new Member({
      id: `mem-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      phone: phoneVo.canonical,
      name: name && name.trim().length > 0 ? name.trim() : `會員-${phoneVo.canonical.slice(-4)}`,
      tier: 'NORMAL',
      points: 0,
      totalSpent: 0,
      orderCount: 0,
    });
    await this.save(newMember);
    return newMember;
  }

  async save(member: Member): Promise<void> {
    this.members.set(member.id, member);
  }

  async recordPointLog(log: PointLog): Promise<void> {
    this.pointLogs.push(log);
  }

  async findPointLogsByMemberId(memberId: string, limit = 100): Promise<PointLog[]> {
    const logs = this.pointLogs.filter((l) => l.memberId === memberId);
    logs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return logs.slice(0, limit);
  }
}
