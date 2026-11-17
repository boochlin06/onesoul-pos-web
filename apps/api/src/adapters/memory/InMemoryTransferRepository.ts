import type { TransferRepository } from '../../core/ports/TransferRepository';
import { TransferOrder, TransferOrderItem } from '../../core/entities/TransferOrder';
import type { TransferStatus } from '@onesoul/shared';
import type { TransactionalMemoryRepo } from './InMemoryTransactionManager';

export class InMemoryTransferRepository implements TransferRepository, TransactionalMemoryRepo {
  private orders: Map<string, TransferOrder> = new Map();
  private items: Map<string, TransferOrderItem[]> = new Map();

  private snapshotOrders: Map<string, TransferOrder> | null = null;
  private snapshotItems: Map<string, TransferOrderItem[]> | null = null;

  beginTx(): void {
    this.snapshotOrders = new Map();
    for (const [id, o] of this.orders.entries()) {
      this.snapshotOrders.set(
        id,
        new TransferOrder({
          id: o.id,
          transferNo: o.transferNo,
          sourceStoreId: o.sourceStoreId,
          targetStoreId: o.targetStoreId,
          status: o.status,
          dispatchedAt: o.dispatchedAt,
          receivedAt: o.receivedAt,
          dispatchedBy: o.dispatchedBy,
          receivedBy: o.receivedBy,
          note: o.note,
          createdAt: o.createdAt,
          updatedAt: o.updatedAt,
        })
      );
    }
    this.snapshotItems = new Map();
    for (const [id, list] of this.items.entries()) {
      this.snapshotItems.set(
        id,
        list.map(
          (it) =>
            new TransferOrderItem({
              id: it.id,
              transferId: it.transferId,
              productId: it.productId,
              requestedQty: it.requestedQty,
              shippedQty: it.shippedQty,
              receivedQty: it.receivedQty,
              remark: it.remark,
            })
        )
      );
    }
  }

  commitTx(): void {
    this.snapshotOrders = null;
    this.snapshotItems = null;
  }

  rollbackTx(): void {
    if (this.snapshotOrders) {
      this.orders = this.snapshotOrders;
      this.snapshotOrders = null;
    }
    if (this.snapshotItems) {
      this.items = this.snapshotItems;
      this.snapshotItems = null;
    }
  }

  async findById(id: string): Promise<TransferOrder | null> {
    const order = this.orders.get(id);
    if (!order) return null;
    order.items = this.items.get(id) ?? [];
    return order;
  }

  async findByTransferNo(transferNo: string): Promise<TransferOrder | null> {
    for (const order of this.orders.values()) {
      if (order.transferNo === transferNo) {
        order.items = this.items.get(order.id) ?? [];
        return order;
      }
    }
    return null;
  }

  async createTransfer(
    order: TransferOrder,
    items: TransferOrderItem[]
  ): Promise<void> {
    order.items = items;
    this.orders.set(order.id, order);
    this.items.set(order.id, items);
  }

  async updateStatus(
    id: string,
    status: TransferStatus,
    operator: string
  ): Promise<void> {
    const order = this.orders.get(id);
    if (!order) return;

    if (order.status !== status) {
      if (status === 'DISPATCHED') {
        order.dispatch(operator);
      } else if (status === 'RECEIVED') {
        order.receive(operator);
      } else if (status === 'CANCELLED') {
        order.cancel(operator);
      } else {
        order.status = status;
      }
    }
    order.updatedAt = new Date();
  }

  async save(order: TransferOrder): Promise<void> {
    this.orders.set(order.id, order);
    if (order.items && order.items.length > 0) {
      this.items.set(order.id, order.items);
    }
  }

  async findItemsByTransferId(transferId: string): Promise<TransferOrderItem[]> {
    return this.items.get(transferId) ?? [];
  }

  async listByStore(storeId: string): Promise<TransferOrder[]> {
    const result: TransferOrder[] = [];
    for (const order of this.orders.values()) {
      if (order.sourceStoreId === storeId || order.targetStoreId === storeId) {
        order.items = this.items.get(order.id) ?? [];
        result.push(order);
      }
    }
    result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return result;
  }
}
