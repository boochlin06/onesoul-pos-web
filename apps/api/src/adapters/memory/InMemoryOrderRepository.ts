import type { OrderRepository, OrderVoidData } from '../../core/ports/OrderRepository';
import type { Order } from '../../core/entities/Order';
import type { OrderStatus } from '@onesoul/shared';
import type { TransactionalMemoryRepo } from './InMemoryTransactionManager';

export class InMemoryOrderRepository implements OrderRepository, TransactionalMemoryRepo {
  private orders: Map<string, Order> = new Map();
  private snapshot: Map<string, Order> | null = null;

  beginTx(): void {
    this.snapshot = new Map();
    for (const [id, order] of this.orders.entries()) {
      this.snapshot.set(id, order.clone());
    }
  }

  commitTx(): void {
    this.snapshot = null;
  }

  rollbackTx(): void {
    if (this.snapshot) {
      this.orders = this.snapshot;
      this.snapshot = null;
    }
  }

  async findByCheckoutUID(uid: string): Promise<Order | null> {
    for (const order of this.orders.values()) {
      if (order.checkoutUID === uid) {
        return order;
      }
    }
    return null;
  }

  async findById(id: string): Promise<Order | null> {
    return this.orders.get(id) ?? null;
  }

  async save(order: Order): Promise<void> {
    this.orders.set(order.id, order);
  }

  async updateStatus(
    id: string,
    status: OrderStatus,
    voidData?: OrderVoidData
  ): Promise<void> {
    const order = this.orders.get(id);
    if (!order) return;

    order.status = status;
    if (voidData) {
      order.voidReason = voidData.voidReason;
      order.voidedAt = voidData.voidedAt;
      order.voidedBy = voidData.voidedBy;
    }
    order.updatedAt = new Date();
  }

  async listBySession(sessionId: string): Promise<Order[]> {
    const result: Order[] = [];
    for (const order of this.orders.values()) {
      if (order.sessionId === sessionId) {
        result.push(order);
      }
    }
    return result;
  }

  async listByStore(storeId: string, limit = 100): Promise<Order[]> {
    const result: Order[] = [];
    for (const order of this.orders.values()) {
      if (order.storeId === storeId) {
        result.push(order);
      }
    }
    result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return result.slice(0, limit);
  }

  async listByMemberId(memberId: string, limit = 100): Promise<Order[]> {
    const result: Order[] = [];
    for (const order of this.orders.values()) {
      if (order.memberId === memberId) {
        result.push(order);
      }
    }
    result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return result.slice(0, limit);
  }
}
