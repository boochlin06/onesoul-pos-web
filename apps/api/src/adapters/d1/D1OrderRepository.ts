import { eq, desc } from 'drizzle-orm';
import type { OneSoulD1Database } from '@onesoul/db';
import { orders, orderItems } from '@onesoul/db/schema';
import type { OrderRepository, OrderVoidData } from '../../core/ports/OrderRepository';
import { Order, OrderItem } from '../../core/entities/Order';
import { PhoneNumber } from '../../core/entities/PhoneNumber';
import type { OrderStatus } from '@onesoul/shared';

export class D1OrderRepository implements OrderRepository {
  constructor(private readonly db: OneSoulD1Database) {}

  private getExecutor(tx?: any): any {
    return tx ?? this.db;
  }

  async findByCheckoutUID(uid: string, tx?: any): Promise<Order | null> {
    const executor = this.getExecutor(tx);
    const row = await executor.query.orders.findFirst({
      where: eq(orders.checkoutUID, uid),
      with: { items: true, member: true },
    });
    return row ? this.mapToEntity(row) : null;
  }

  async findById(id: string, tx?: any): Promise<Order | null> {
    const executor = this.getExecutor(tx);
    const row = await executor.query.orders.findFirst({
      where: eq(orders.id, id),
      with: { items: true, member: true },
    });
    return row ? this.mapToEntity(row) : null;
  }

  async save(order: Order, tx?: any): Promise<void> {
    const executor = this.getExecutor(tx);
    const existing = await executor
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.id, order.id))
      .limit(1);

    if (existing.length === 0) {
      await executor.insert(orders).values({
        id: order.id,
        checkoutUID: order.checkoutUID,
        storeId: order.storeId,
        sessionId: order.sessionId,
        memberId: order.memberId ?? null,
        status: order.status,
        totalDue: order.totalDue,
        receivedAmount: order.receivedAmount,
        cash: order.payment.cash,
        creditCard: order.payment.creditCard,
        linePay: order.payment.linePay,
        remittance: order.payment.remittance,
        pointsUsed: order.payment.pointsUsed,
        netPointsDelta: order.netPointsDelta,
        cashierEmail: order.cashierEmail,
        orderNote: order.orderNote ?? null,
        voidReason: order.voidReason ?? null,
        voidedAt: order.voidedAt
          ? order.voidedAt instanceof Date
            ? order.voidedAt.toISOString()
            : String(order.voidedAt)
          : null,
        voidedBy: order.voidedBy ?? null,
        createdAt:
          order.createdAt instanceof Date
            ? order.createdAt.toISOString()
            : String(order.createdAt),
        updatedAt:
          order.updatedAt instanceof Date
            ? order.updatedAt.toISOString()
            : String(order.updatedAt),
      });
    } else {
      await executor
        .update(orders)
        .set({
          checkoutUID: order.checkoutUID,
          storeId: order.storeId,
          sessionId: order.sessionId,
          memberId: order.memberId ?? null,
          status: order.status,
          totalDue: order.totalDue,
          receivedAmount: order.receivedAmount,
          cash: order.payment.cash,
          creditCard: order.payment.creditCard,
          linePay: order.payment.linePay,
          remittance: order.payment.remittance,
          pointsUsed: order.payment.pointsUsed,
          netPointsDelta: order.netPointsDelta,
          cashierEmail: order.cashierEmail,
          orderNote: order.orderNote ?? null,
          voidReason: order.voidReason ?? null,
          voidedAt: order.voidedAt
            ? order.voidedAt instanceof Date
              ? order.voidedAt.toISOString()
              : String(order.voidedAt)
            : null,
          voidedBy: order.voidedBy ?? null,
          updatedAt:
            order.updatedAt instanceof Date
              ? order.updatedAt.toISOString()
              : String(order.updatedAt),
        })
        .where(eq(orders.id, order.id));
    }

    if (order.items && order.items.length > 0) {
      for (const item of order.items) {
        await executor
          .insert(orderItems)
          .values({
            id: item.id,
            orderId: order.id,
            itemType: item.itemType,
            bagId: item.bagId ?? null,
            prizeGrade: item.prizeGrade ?? null,
            prizeName: item.prizeName ?? null,
            pickType: item.pickType ?? null,
            draws: item.draws ?? null,
            productId: item.productId ?? null,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            amount: item.amount,
            pointsImpact: item.pointsImpact,
            remark: item.remark ?? null,
          })
          .onConflictDoNothing();
      }
    }
  }

  async updateStatus(
    id: string,
    status: OrderStatus,
    voidData?: OrderVoidData,
    tx?: any
  ): Promise<void> {
    const executor = this.getExecutor(tx);
    const updatePayload: any = {
      status,
      updatedAt: new Date().toISOString(),
    };
    if (voidData) {
      updatePayload.voidReason = voidData.voidReason;
      updatePayload.voidedAt = voidData.voidedAt.toISOString();
      updatePayload.voidedBy = voidData.voidedBy;
    }
    await executor.update(orders).set(updatePayload).where(eq(orders.id, id));
  }

  async listBySession(sessionId: string, tx?: any): Promise<Order[]> {
    const executor = this.getExecutor(tx);
    const rows = await executor.query.orders.findMany({
      where: eq(orders.sessionId, sessionId),
      with: { items: true, member: true },
      orderBy: [desc(orders.createdAt)],
    });
    return rows.map((r: any) => this.mapToEntity(r));
  }

  async listByStore(storeId: string, limit = 100, tx?: any): Promise<Order[]> {
    const executor = this.getExecutor(tx);
    const rows = await executor.query.orders.findMany({
      where: eq(orders.storeId, storeId),
      with: { items: true, member: true },
      orderBy: [desc(orders.createdAt)],
      limit,
    });
    return rows.map((r: any) => this.mapToEntity(r));
  }

  async listByMemberId(memberId: string, limit = 100, tx?: any): Promise<Order[]> {
    const executor = this.getExecutor(tx);
    const rows = await executor.query.orders.findMany({
      where: eq(orders.memberId, memberId),
      with: { items: true, member: true },
      orderBy: [desc(orders.createdAt)],
      limit,
    });
    return rows.map((r: any) => this.mapToEntity(r));
  }

  private mapToEntity(row: any): Order {
    const items = (row.items || []).map(
      (item: any) =>
        new OrderItem({
          id: item.id,
          orderId: item.orderId,
          itemType: item.itemType,
          bagId: item.bagId,
          prizeGrade: item.prizeGrade,
          prizeName: item.prizeName,
          pickType: item.pickType,
          draws: item.draws,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: item.amount,
          pointsImpact: item.pointsImpact,
          remark: item.remark,
        })
    );

    const memberPhone = row.member?.phone || PhoneNumber.WALKIN_PHONE;

    return new Order({
      id: row.id,
      checkoutUID: row.checkoutUID,
      storeId: row.storeId,
      sessionId: row.sessionId,
      memberPhone,
      memberId: row.memberId,
      totalDue: row.totalDue,
      receivedAmount: row.receivedAmount,
      payment: {
        cash: row.cash ?? 0,
        creditCard: row.creditCard ?? 0,
        linePay: row.linePay ?? 0,
        remittance: row.remittance ?? 0,
        pointsUsed: row.pointsUsed ?? 0,
      },
      netPointsDelta: row.netPointsDelta ?? 0,
      items,
      status: row.status,
      cashierEmail: row.cashierEmail,
      orderNote: row.orderNote,
      voidReason: row.voidReason,
      voidedAt: row.voidedAt,
      voidedBy: row.voidedBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
