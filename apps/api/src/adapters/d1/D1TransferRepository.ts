import { eq, or, desc } from 'drizzle-orm';
import type { OneSoulD1Database } from '@onesoul/db';
import { transferOrders, transferOrderItems } from '@onesoul/db/schema';
import type { TransferRepository } from '../../core/ports/TransferRepository';
import {
  TransferOrder,
  TransferOrderItem,
} from '../../core/entities/TransferOrder';
import type { TransferStatus } from '@onesoul/shared';

export class D1TransferRepository implements TransferRepository {
  constructor(private readonly db: OneSoulD1Database) {}

  private getExecutor(tx?: any): any {
    return tx ?? this.db;
  }

  async findById(id: string, tx?: any): Promise<TransferOrder | null> {
    const executor = this.getExecutor(tx);
    const [row] = await executor
      .select()
      .from(transferOrders)
      .where(eq(transferOrders.id, id))
      .limit(1);

    if (!row) return null;
    const items = await this.findItemsByTransferId(row.id, tx);
    return this.mapTransfer(row, items);
  }

  async findByTransferNo(transferNo: string, tx?: any): Promise<TransferOrder | null> {
    const executor = this.getExecutor(tx);
    const [row] = await executor
      .select()
      .from(transferOrders)
      .where(eq(transferOrders.transferNo, transferNo))
      .limit(1);

    if (!row) return null;
    const items = await this.findItemsByTransferId(row.id, tx);
    return this.mapTransfer(row, items);
  }

  async createTransfer(
    order: TransferOrder,
    items: TransferOrderItem[],
    tx?: any
  ): Promise<void> {
    const executor = this.getExecutor(tx);

    await executor.insert(transferOrders).values({
      id: order.id,
      transferNo: order.transferNo,
      sourceStoreId: order.sourceStoreId,
      targetStoreId: order.targetStoreId,
      status: order.status,
      dispatchedAt: order.dispatchedAt
        ? order.dispatchedAt instanceof Date
          ? order.dispatchedAt.toISOString()
          : String(order.dispatchedAt)
        : null,
      receivedAt: order.receivedAt
        ? order.receivedAt instanceof Date
          ? order.receivedAt.toISOString()
          : String(order.receivedAt)
        : null,
      dispatchedBy: order.dispatchedBy ?? null,
      receivedBy: order.receivedBy ?? null,
      note: order.note ?? null,
      createdAt:
        order.createdAt instanceof Date
          ? order.createdAt.toISOString()
          : String(order.createdAt),
      updatedAt:
        order.updatedAt instanceof Date
          ? order.updatedAt.toISOString()
          : String(order.updatedAt),
    });

    for (const item of items) {
      await executor.insert(transferOrderItems).values({
        id: item.id,
        transferId: order.id,
        productId: item.productId,
        requestedQty: item.requestedQty,
        shippedQty: item.shippedQty,
        receivedQty: item.receivedQty,
        remark: item.remark ?? null,
      });
    }
  }

  async updateStatus(
    id: string,
    status: TransferStatus,
    operator: string,
    tx?: any
  ): Promise<void> {
    const executor = this.getExecutor(tx);
    const nowIso = new Date().toISOString();
    const updatePayload: any = {
      status,
      updatedAt: nowIso,
    };

    if (status === 'DISPATCHED') {
      updatePayload.dispatchedBy = operator;
      updatePayload.dispatchedAt = nowIso;
    } else if (status === 'RECEIVED') {
      updatePayload.receivedBy = operator;
      updatePayload.receivedAt = nowIso;
    }

    await executor
      .update(transferOrders)
      .set(updatePayload)
      .where(eq(transferOrders.id, id));
  }

  async save(order: TransferOrder, tx?: any): Promise<void> {
    const executor = this.getExecutor(tx);
    const [existing] = await executor
      .select({ id: transferOrders.id })
      .from(transferOrders)
      .where(eq(transferOrders.id, order.id))
      .limit(1);

    if (existing) {
      await executor
        .update(transferOrders)
        .set({
          transferNo: order.transferNo,
          sourceStoreId: order.sourceStoreId,
          targetStoreId: order.targetStoreId,
          status: order.status,
          dispatchedAt: order.dispatchedAt
            ? order.dispatchedAt instanceof Date
              ? order.dispatchedAt.toISOString()
              : String(order.dispatchedAt)
            : null,
          receivedAt: order.receivedAt
            ? order.receivedAt instanceof Date
              ? order.receivedAt.toISOString()
              : String(order.receivedAt)
            : null,
          dispatchedBy: order.dispatchedBy ?? null,
          receivedBy: order.receivedBy ?? null,
          note: order.note ?? null,
          updatedAt:
            order.updatedAt instanceof Date
              ? order.updatedAt.toISOString()
              : String(order.updatedAt),
        })
        .where(eq(transferOrders.id, order.id));
    } else {
      await executor.insert(transferOrders).values({
        id: order.id,
        transferNo: order.transferNo,
        sourceStoreId: order.sourceStoreId,
        targetStoreId: order.targetStoreId,
        status: order.status,
        dispatchedAt: order.dispatchedAt
          ? order.dispatchedAt instanceof Date
            ? order.dispatchedAt.toISOString()
            : String(order.dispatchedAt)
          : null,
        receivedAt: order.receivedAt
          ? order.receivedAt instanceof Date
            ? order.receivedAt.toISOString()
            : String(order.receivedAt)
          : null,
        dispatchedBy: order.dispatchedBy ?? null,
        receivedBy: order.receivedBy ?? null,
        note: order.note ?? null,
        createdAt:
          order.createdAt instanceof Date
            ? order.createdAt.toISOString()
            : String(order.createdAt),
        updatedAt:
          order.updatedAt instanceof Date
            ? order.updatedAt.toISOString()
            : String(order.updatedAt),
      });
    }

    if (order.items && order.items.length > 0) {
      for (const item of order.items) {
        const [existingItem] = await executor
          .select({ id: transferOrderItems.id })
          .from(transferOrderItems)
          .where(eq(transferOrderItems.id, item.id))
          .limit(1);

        if (existingItem) {
          await executor
            .update(transferOrderItems)
            .set({
              requestedQty: item.requestedQty,
              shippedQty: item.shippedQty,
              receivedQty: item.receivedQty,
              remark: item.remark ?? null,
            })
            .where(eq(transferOrderItems.id, item.id));
        } else {
          await executor.insert(transferOrderItems).values({
            id: item.id,
            transferId: order.id,
            productId: item.productId,
            requestedQty: item.requestedQty,
            shippedQty: item.shippedQty,
            receivedQty: item.receivedQty,
            remark: item.remark ?? null,
          });
        }
      }
    }
  }

  async findItemsByTransferId(
    transferId: string,
    tx?: any
  ): Promise<TransferOrderItem[]> {
    const executor = this.getExecutor(tx);
    const rows = await executor
      .select()
      .from(transferOrderItems)
      .where(eq(transferOrderItems.transferId, transferId));

    return rows.map((r: any) => this.mapItem(r));
  }

  async listByStore(storeId: string, tx?: any): Promise<TransferOrder[]> {
    const executor = this.getExecutor(tx);
    const rows = await executor
      .select()
      .from(transferOrders)
      .where(
        or(
          eq(transferOrders.sourceStoreId, storeId),
          eq(transferOrders.targetStoreId, storeId)
        )
      )
      .orderBy(desc(transferOrders.createdAt));

    const result: TransferOrder[] = [];
    for (const row of rows) {
      const items = await this.findItemsByTransferId(row.id, tx);
      result.push(this.mapTransfer(row, items));
    }
    return result;
  }

  private mapTransfer(row: any, items: TransferOrderItem[]): TransferOrder {
    return new TransferOrder({
      id: row.id,
      transferNo: row.transferNo,
      sourceStoreId: row.sourceStoreId,
      targetStoreId: row.targetStoreId,
      status: row.status,
      dispatchedAt: row.dispatchedAt,
      receivedAt: row.receivedAt,
      dispatchedBy: row.dispatchedBy,
      receivedBy: row.receivedBy,
      note: row.note,
      items,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  private mapItem(row: any): TransferOrderItem {
    return new TransferOrderItem({
      id: row.id,
      transferId: row.transferId,
      productId: row.productId,
      requestedQty: row.requestedQty,
      shippedQty: row.shippedQty,
      receivedQty: row.receivedQty,
      remark: row.remark,
    });
  }
}
