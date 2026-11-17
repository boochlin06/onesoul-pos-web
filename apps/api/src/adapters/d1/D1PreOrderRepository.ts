import { eq, desc } from 'drizzle-orm';
import type { OneSoulD1Database } from '@onesoul/db';
import { preOrders } from '@onesoul/db/schema';
import type { PreOrderRepository } from '../../core/ports/PreOrderRepository';
import { PreOrder } from '../../core/entities/PreOrder';
import type { PreOrderStatus } from '@onesoul/shared';

export class D1PreOrderRepository implements PreOrderRepository {
  constructor(private readonly db: OneSoulD1Database) {}

  private getExecutor(tx?: any): any {
    return tx ?? this.db;
  }

  async findById(id: string, tx?: any): Promise<PreOrder | null> {
    const executor = this.getExecutor(tx);
    const [row] = await executor
      .select()
      .from(preOrders)
      .where(eq(preOrders.id, id))
      .limit(1);

    return row ? this.mapPreOrder(row) : null;
  }

  async create(preOrder: PreOrder, tx?: any): Promise<void> {
    const executor = this.getExecutor(tx);
    await executor.insert(preOrders).values({
      id: preOrder.id,
      name: preOrder.name,
      version: preOrder.version ?? null,
      quantity: preOrder.quantity,
      deposit: preOrder.deposit,
      finalPayment: preOrder.finalPayment,
      shippingFee: preOrder.shippingFee,
      totalCost: preOrder.totalCost,
      supplier: preOrder.supplier ?? null,
      targetStoreId: preOrder.targetStoreId ?? null,
      productId: preOrder.productId ?? null,
      status: preOrder.status,
      arrivedAt: preOrder.arrivedAt
        ? preOrder.arrivedAt instanceof Date
          ? preOrder.arrivedAt.toISOString()
          : String(preOrder.arrivedAt)
        : null,
      note: preOrder.note ?? null,
      createdAt:
        preOrder.createdAt instanceof Date
          ? preOrder.createdAt.toISOString()
          : String(preOrder.createdAt),
      updatedAt:
        preOrder.updatedAt instanceof Date
          ? preOrder.updatedAt.toISOString()
          : String(preOrder.updatedAt),
    });
  }

  async save(preOrder: PreOrder, tx?: any): Promise<void> {
    const executor = this.getExecutor(tx);
    const [existing] = await executor
      .select({ id: preOrders.id })
      .from(preOrders)
      .where(eq(preOrders.id, preOrder.id))
      .limit(1);

    if (existing) {
      await executor
        .update(preOrders)
        .set({
          name: preOrder.name,
          version: preOrder.version ?? null,
          quantity: preOrder.quantity,
          deposit: preOrder.deposit,
          finalPayment: preOrder.finalPayment,
          shippingFee: preOrder.shippingFee,
          totalCost: preOrder.totalCost,
          supplier: preOrder.supplier ?? null,
          targetStoreId: preOrder.targetStoreId ?? null,
          productId: preOrder.productId ?? null,
          status: preOrder.status,
          arrivedAt: preOrder.arrivedAt
            ? preOrder.arrivedAt instanceof Date
              ? preOrder.arrivedAt.toISOString()
              : String(preOrder.arrivedAt)
            : null,
          note: preOrder.note ?? null,
          updatedAt:
            preOrder.updatedAt instanceof Date
              ? preOrder.updatedAt.toISOString()
              : String(preOrder.updatedAt),
        })
        .where(eq(preOrders.id, preOrder.id));
    } else {
      await this.create(preOrder, tx);
    }
  }

  async list(status?: PreOrderStatus, tx?: any): Promise<PreOrder[]> {
    const executor = this.getExecutor(tx);
    const query = executor.select().from(preOrders);

    if (status) {
      const rows = await query
        .where(eq(preOrders.status, status))
        .orderBy(desc(preOrders.createdAt));
      return rows.map((r: any) => this.mapPreOrder(r));
    }

    const rows = await query.orderBy(desc(preOrders.createdAt));
    return rows.map((r: any) => this.mapPreOrder(r));
  }

  private mapPreOrder(row: any): PreOrder {
    return new PreOrder({
      id: row.id,
      name: row.name,
      version: row.version,
      quantity: row.quantity,
      deposit: row.deposit ?? 0,
      finalPayment: row.finalPayment ?? 0,
      shippingFee: row.shippingFee ?? 0,
      totalCost: row.totalCost ?? 0,
      supplier: row.supplier,
      targetStoreId: row.targetStoreId,
      productId: row.productId,
      status: row.status,
      arrivedAt: row.arrivedAt,
      note: row.note,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
