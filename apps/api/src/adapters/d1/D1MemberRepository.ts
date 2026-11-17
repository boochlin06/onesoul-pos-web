import { eq, or, desc } from 'drizzle-orm';
import type { OneSoulD1Database } from '@onesoul/db';
import { members, pointLogs } from '@onesoul/db/schema';
import type { MemberRepository } from '../../core/ports/MemberRepository';
import { Member, PointLog } from '../../core/entities/Member';
import { PhoneNumber } from '../../core/entities/PhoneNumber';

export class D1MemberRepository implements MemberRepository {
  constructor(private readonly db: OneSoulD1Database) {}

  private getExecutor(tx?: any): any {
    return tx ?? this.db;
  }

  async findById(id: string, tx?: any): Promise<Member | null> {
    const executor = this.getExecutor(tx);
    const [row] = await executor
      .select()
      .from(members)
      .where(eq(members.id, id))
      .limit(1);

    return row ? this.mapMember(row) : null;
  }

  async findByPhone(phone: string, tx?: any): Promise<Member | null> {
    const executor = this.getExecutor(tx);
    const canonical = PhoneNumber.canonical(phone);
    const [row] = await executor
      .select()
      .from(members)
      .where(or(eq(members.phone, canonical), eq(members.phone, phone)))
      .limit(1);

    return row ? this.mapMember(row) : null;
  }

  async findOrCreateByPhone(phone: string, name?: string, tx?: any): Promise<Member> {
    const existing = await this.findByPhone(phone, tx);
    if (existing) {
      return existing;
    }

    const canonical = PhoneNumber.canonical(phone);
    const newMember = new Member({
      id: crypto.randomUUID(),
      phone: canonical,
      name: name || `會員${canonical.slice(-4)}`,
      tier: 'NORMAL',
      points: 0,
      version: 1,
      totalSpent: 0,
      orderCount: 0,
      isActive: true,
    });

    await this.save(newMember, tx);
    return newMember;
  }

  async save(member: Member, tx?: any): Promise<void> {
    const executor = this.getExecutor(tx);
    const [existing] = await executor
      .select({ id: members.id })
      .from(members)
      .where(eq(members.id, member.id))
      .limit(1);

    if (existing) {
      await executor
        .update(members)
        .set({
          phone: member.phone,
          name: member.name,
          tier: member.tier as any,
          points: member.points,
          version: member.version,
          totalSpent: member.totalSpent,
          orderCount: member.orderCount,
          lastPurchaseAt: member.lastPurchaseAt
            ? member.lastPurchaseAt.toISOString()
            : null,
          isActive: member.isActive,
          updatedAt:
            member.updatedAt instanceof Date
              ? member.updatedAt.toISOString()
              : String(member.updatedAt),
        })
        .where(eq(members.id, member.id));
    } else {
      await executor.insert(members).values({
        id: member.id,
        phone: member.phone,
        name: member.name,
        tier: member.tier as any,
        points: member.points,
        version: member.version,
        totalSpent: member.totalSpent,
        orderCount: member.orderCount,
        lastPurchaseAt: member.lastPurchaseAt
          ? member.lastPurchaseAt.toISOString()
          : null,
        isActive: member.isActive,
        createdAt:
          member.createdAt instanceof Date
            ? member.createdAt.toISOString()
            : String(member.createdAt),
        updatedAt:
          member.updatedAt instanceof Date
            ? member.updatedAt.toISOString()
            : String(member.updatedAt),
      });
    }
  }

  async recordPointLog(log: PointLog, tx?: any): Promise<void> {
    const executor = this.getExecutor(tx);
    await executor.insert(pointLogs).values({
      id: log.id,
      memberId: log.memberId,
      type: log.type as any,
      delta: log.delta,
      balance: log.balance,
      orderId: log.orderId ?? null,
      reason: log.reason ?? null,
      operator: log.operator ?? null,
      createdAt:
        log.createdAt instanceof Date
          ? log.createdAt.toISOString()
          : String(log.createdAt),
    });
  }

  async findPointLogsByMemberId(
    memberId: string,
    limit = 100,
    tx?: any
  ): Promise<PointLog[]> {
    const executor = this.getExecutor(tx);
    const rows = await executor
      .select()
      .from(pointLogs)
      .where(eq(pointLogs.memberId, memberId))
      .orderBy(desc(pointLogs.createdAt))
      .limit(limit);

    return rows.map((r: any) => this.mapPointLog(r));
  }

  private mapMember(row: any): Member {
    return new Member({
      id: row.id,
      phone: row.phone,
      name: row.name,
      tier: row.tier,
      points: row.points ?? 0,
      version: row.version ?? 1,
      totalSpent: row.totalSpent ?? 0,
      orderCount: row.orderCount ?? 0,
      lastPurchaseAt: row.lastPurchaseAt,
      isActive: Boolean(row.isActive),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  private mapPointLog(row: any): PointLog {
    return new PointLog({
      id: row.id,
      memberId: row.memberId,
      type: row.type,
      delta: row.delta,
      balance: row.balance,
      orderId: row.orderId,
      reason: row.reason,
      operator: row.operator,
      createdAt: row.createdAt,
    });
  }
}
