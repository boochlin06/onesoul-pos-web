import type { PreOrderRepository } from '../../core/ports/PreOrderRepository';
import { PreOrder } from '../../core/entities/PreOrder';
import type { PreOrderStatus } from '@onesoul/shared';
import type { TransactionalMemoryRepo } from './InMemoryTransactionManager';

export class InMemoryPreOrderRepository implements PreOrderRepository, TransactionalMemoryRepo {
  private preOrders: Map<string, PreOrder> = new Map();
  private snapshot: Map<string, PreOrder> | null = null;

  beginTx(): void {
    this.snapshot = new Map();
    for (const [id, p] of this.preOrders.entries()) {
      this.snapshot.set(
        id,
        new PreOrder({
          id: p.id,
          name: p.name,
          version: p.version,
          quantity: p.quantity,
          deposit: p.deposit,
          finalPayment: p.finalPayment,
          shippingFee: p.shippingFee,
          totalCost: p.totalCost,
          supplier: p.supplier,
          targetStoreId: p.targetStoreId,
          productId: p.productId,
          status: p.status,
          arrivedAt: p.arrivedAt,
          note: p.note,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        })
      );
    }
  }

  commitTx(): void {
    this.snapshot = null;
  }

  rollbackTx(): void {
    if (this.snapshot) {
      this.preOrders = this.snapshot;
      this.snapshot = null;
    }
  }

  async findById(id: string): Promise<PreOrder | null> {
    return this.preOrders.get(id) ?? null;
  }

  async create(preOrder: PreOrder): Promise<void> {
    this.preOrders.set(preOrder.id, preOrder);
  }

  async save(preOrder: PreOrder): Promise<void> {
    this.preOrders.set(preOrder.id, preOrder);
  }

  async list(status?: PreOrderStatus): Promise<PreOrder[]> {
    const list = Array.from(this.preOrders.values());
    if (status) {
      return list.filter((p) => p.status === status);
    }
    return list;
  }
}
