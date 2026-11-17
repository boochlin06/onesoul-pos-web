import type { Order } from '../entities/Order';
import type { OrderStatus } from '@onesoul/shared';

export interface OrderVoidData {
  voidReason: string;
  voidedAt: Date;
  voidedBy: string;
}

export interface OrderRepository {
  findByCheckoutUID(uid: string, tx?: any): Promise<Order | null>;
  findById(id: string, tx?: any): Promise<Order | null>;
  save(order: Order, tx?: any): Promise<void>;
  updateStatus(id: string, status: OrderStatus, voidData?: OrderVoidData, tx?: any): Promise<void>;
  listBySession(sessionId: string, tx?: any): Promise<Order[]>;
  listByStore(storeId: string, limit?: number, tx?: any): Promise<Order[]>;
  listByMemberId(memberId: string, limit?: number, tx?: any): Promise<Order[]>;
}
