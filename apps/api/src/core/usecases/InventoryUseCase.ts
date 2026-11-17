import {
  Result,
  ok,
  err,
  AppError,
  ValidationError,
  NotFoundError,
  InsufficientStockError,
} from '@onesoul/shared';
import { StoreInventory, InventoryLog } from '../entities/Product';
import { TransferOrder, TransferOrderItem } from '../entities/TransferOrder';
import { Stocktake, StocktakeItem } from '../entities/Stocktake';
import { AuditLog } from '../entities/AuditLog';
import { sortProductIdsForLock } from '../invariants/invariants';

import type { InventoryRepository } from '../ports/InventoryRepository';
import type { TransferRepository } from '../ports/TransferRepository';
import type { StocktakeRepository } from '../ports/StocktakeRepository';
import type { AuditRepository } from '../ports/AuditRepository';
import type { TransactionManager } from '../ports/TransactionManager';

export interface AdjustStockCommand {
  storeId: string;
  productId: string;
  delta: number;
  reason: string;
  operator: string;
}

export interface CreateTransferCommand {
  transferNo?: string;
  sourceStoreId: string;
  targetStoreId: string;
  operator: string;
  note?: string;
  items: Array<{
    productId: string;
    requestedQty: number;
    remark?: string;
  }>;
}

export interface CreateStocktakeCommand {
  storeId: string;
  countedBy: string;
  note?: string;
  items: Array<{
    productId: string;
    actualQty: number;
    remark?: string;
  }>;
}

export class InventoryUseCase {
  constructor(
    private readonly inventoryRepo: InventoryRepository,
    private readonly transferRepo: TransferRepository,
    private readonly stocktakeRepo: StocktakeRepository,
    private readonly auditRepo: AuditRepository,
    private readonly txManager: TransactionManager
  ) {}

  /**
   * 手動調整門市庫存 (含審計與流水日誌)
   */
  async adjustStock(
    command: AdjustStockCommand
  ): Promise<Result<StoreInventory, AppError>> {
    try {
      if (command.delta === 0) {
        return err(new ValidationError('調整數量不可為 0'));
      }
      if (!command.reason || command.reason.trim().length < 2) {
        return err(new ValidationError('請填寫至少 2 個字之調整原因'));
      }

      return await this.txManager.runInTransaction(async (tx) => {
        let inv = await this.inventoryRepo.findByStoreAndProduct(
          command.storeId,
          command.productId,
          tx
        );

        if (!inv) {
          if (command.delta < 0) {
            throw new InsufficientStockError(
              `商品 [${command.productId}] 在門市 [${command.storeId}] 無庫存，不可扣減`
            );
          }
          inv = new StoreInventory({
            id: `inv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            storeId: command.storeId,
            productId: command.productId,
            quantity: 0,
          });
        }

        const beforeQty = inv.quantity;
        const afterQty = beforeQty + command.delta;
        if (afterQty < 0) {
          throw new InsufficientStockError(
            `商品 [${command.productId}] 調整後庫存小於 0 (目前: ${beforeQty}, 欲調整: ${command.delta})`
          );
        }

        if (command.delta > 0) {
          inv.add(command.delta);
        } else {
          inv.deduct(-command.delta);
        }

        await this.inventoryRepo.save(inv, tx);

        // 寫入庫存異動日誌
        await this.inventoryRepo.recordLog(
          new InventoryLog({
            id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            storeId: command.storeId,
            productId: command.productId,
            changeType: 'MANUAL_ADJUST',
            delta: command.delta,
            balance: inv.quantity,
            operator: command.operator,
            reason: command.reason,
          }),
          tx
        );

        // 寫入密碼學審計日誌
        const prevHash = await this.auditRepo.getLatestHash(tx);
        const currentHash = AuditLog.calculateHash(prevHash, {
          operatorId: command.operator,
          action: 'MANUAL_STOCK_ADJUST',
          targetType: 'STORE_INVENTORY',
          targetId: `${command.storeId}:${command.productId}`,
          delta: command.delta,
          reason: command.reason,
        });
        const auditLog = new AuditLog({
          id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          operatorId: command.operator,
          action: 'MANUAL_STOCK_ADJUST',
          targetType: 'STORE_INVENTORY',
          targetId: `${command.storeId}:${command.productId}`,
          beforeState: { quantity: beforeQty },
          afterState: { quantity: inv.quantity },
          delta: command.delta,
          reason: command.reason,
          prevHash,
          currentHash,
        });
        await this.auditRepo.append(auditLog, tx);

        return ok(inv);
      });
    } catch (error) {
      if (error instanceof AppError) return err(error);
      return err(new AppError('ADJUST_STOCK_FAILED', (error as Error).message));
    }
  }

  /**
   * 建立調撥單 (DRAFT 狀態)
   */
  async createTransfer(
    command: CreateTransferCommand
  ): Promise<Result<TransferOrder, AppError>> {
    try {
      if (command.items.length === 0) {
        return err(new ValidationError('調撥單明細不可為空'));
      }

      const transferId = `tr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const transferNo =
        command.transferNo ||
        `TR-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;

      const items = command.items.map((it, idx) => {
        if (it.requestedQty <= 0) {
          throw new ValidationError('調撥數量必須大於 0');
        }
        return new TransferOrderItem({
          id: `tri-${transferId}-${idx + 1}`,
          transferId,
          productId: it.productId,
          requestedQty: it.requestedQty,
          remark: it.remark,
        });
      });

      const order = new TransferOrder({
        id: transferId,
        transferNo,
        sourceStoreId: command.sourceStoreId,
        targetStoreId: command.targetStoreId,
        status: 'DRAFT',
        dispatchedBy: command.operator,
        note: command.note,
        items,
      });

      await this.transferRepo.createTransfer(order, items);
      return ok(order);
    } catch (error) {
      if (error instanceof AppError) return err(error);
      return err(new AppError('CREATE_TRANSFER_FAILED', (error as Error).message));
    }
  }

  /**
   * 調撥出庫發貨 (DRAFT -> DISPATCHED)
   * 遵守 Invariant #3: 字典序排序商品 ID 扣減來源庫存
   */
  async dispatchTransfer(
    transferId: string,
    operator: string
  ): Promise<Result<TransferOrder, AppError>> {
    try {
      const order = await this.transferRepo.findById(transferId);
      if (!order) {
        return err(new NotFoundError('調撥單', transferId));
      }

      return await this.txManager.runInTransaction(async (tx) => {
        const items = await this.transferRepo.findItemsByTransferId(transferId, tx);
        const sortedIds = sortProductIdsForLock(items.map((it) => it.productId));
        const itemMap = new Map(items.map((it) => [it.productId, it.shippedQty]));

        for (const pid of sortedIds) {
          const qty = itemMap.get(pid) || 0;
          const inv = await this.inventoryRepo.findByStoreAndProduct(
            order.sourceStoreId,
            pid,
            tx
          );
          if (!inv || inv.quantity < qty) {
            throw new InsufficientStockError(
              `調撥出庫失敗: 來源門市 [${order.sourceStoreId}] 商品 [${pid}] 庫存不足 (現有: ${inv?.quantity ?? 0}, 欲發貨: ${qty})`
            );
          }
          await this.inventoryRepo.deductQuantities(
            order.sourceStoreId,
            [{ productId: pid, quantity: qty }],
            tx
          );
          await this.inventoryRepo.recordLog(
            new InventoryLog({
              id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              storeId: order.sourceStoreId,
              productId: pid,
              changeType: 'TRANSFER_OUT',
              delta: -qty,
              balance: inv.quantity - qty,
              operator,
              reason: `跨店調撥出庫: ${order.transferNo}`,
            }),
            tx
          );
        }

        order.dispatch(operator);
        await this.transferRepo.updateStatus(order.id, 'DISPATCHED', operator, tx);
        return ok(order);
      });
    } catch (error) {
      if (error instanceof AppError) return err(error);
      return err(new AppError('DISPATCH_TRANSFER_FAILED', (error as Error).message));
    }
  }

  /**
   * 調撥入庫收貨 (DISPATCHED -> RECEIVED)
   */
  async receiveTransfer(
    transferId: string,
    operator: string
  ): Promise<Result<TransferOrder, AppError>> {
    try {
      const order = await this.transferRepo.findById(transferId);
      if (!order) {
        return err(new NotFoundError('調撥單', transferId));
      }

      return await this.txManager.runInTransaction(async (tx) => {
        const items = await this.transferRepo.findItemsByTransferId(transferId, tx);

        for (const it of items) {
          await this.inventoryRepo.addQuantities(
            order.targetStoreId,
            [{ productId: it.productId, quantity: it.shippedQty }],
            tx
          );
          const inv = await this.inventoryRepo.findByStoreAndProduct(
            order.targetStoreId,
            it.productId,
            tx
          );
          await this.inventoryRepo.recordLog(
            new InventoryLog({
              id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              storeId: order.targetStoreId,
              productId: it.productId,
              changeType: 'TRANSFER_IN',
              delta: it.shippedQty,
              balance: inv?.quantity ?? it.shippedQty,
              operator,
              reason: `跨店調撥入庫: ${order.transferNo}`,
            }),
            tx
          );
        }

        order.receive(operator);
        await this.transferRepo.updateStatus(order.id, 'RECEIVED', operator, tx);
        return ok(order);
      });
    } catch (error) {
      if (error instanceof AppError) return err(error);
      return err(new AppError('RECEIVE_TRANSFER_FAILED', (error as Error).message));
    }
  }

  /**
   * 取消調撥單
   * 若已出庫 (DISPATCHED)，則將在途庫存原子退回來源門市
   */
  async cancelTransfer(
    transferId: string,
    operator: string,
    note?: string
  ): Promise<Result<TransferOrder, AppError>> {
    try {
      const order = await this.transferRepo.findById(transferId);
      if (!order) {
        return err(new NotFoundError('調撥單', transferId));
      }

      return await this.txManager.runInTransaction(async (tx) => {
        if (order.status === 'DISPATCHED') {
          const items = await this.transferRepo.findItemsByTransferId(transferId, tx);
          for (const it of items) {
            await this.inventoryRepo.addQuantities(
              order.sourceStoreId,
              [{ productId: it.productId, quantity: it.shippedQty }],
              tx
            );
            const inv = await this.inventoryRepo.findByStoreAndProduct(
              order.sourceStoreId,
              it.productId,
              tx
            );
            await this.inventoryRepo.recordLog(
              new InventoryLog({
                id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                storeId: order.sourceStoreId,
                productId: it.productId,
                changeType: 'TRANSFER_IN',
                delta: it.shippedQty,
                balance: inv?.quantity ?? it.shippedQty,
                operator,
                reason: `調撥單取消退回庫存: ${order.transferNo}`,
              }),
              tx
            );
          }
        }

        order.cancel(operator, note);
        await this.transferRepo.updateStatus(order.id, 'CANCELLED', operator, tx);
        return ok(order);
      });
    } catch (error) {
      if (error instanceof AppError) return err(error);
      return err(new AppError('CANCEL_TRANSFER_FAILED', (error as Error).message));
    }
  }

  /**
   * 建立門市實盤草稿 (盲盤錄入，計算盈虧差異)
   */
  async createStocktakeDraft(
    command: CreateStocktakeCommand
  ): Promise<Result<Stocktake, AppError>> {
    try {
      if (command.items.length === 0) {
        return err(new ValidationError('盤點品項不可為空'));
      }

      const stocktakeId = `stk-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const items: StocktakeItem[] = [];

      for (let i = 0; i < command.items.length; i++) {
        const item = command.items[i];
        const inv = await this.inventoryRepo.findByStoreAndProduct(
          command.storeId,
          item.productId
        );
        const systemQty = inv?.quantity ?? 0;

        items.push(
          new StocktakeItem({
            id: `stki-${stocktakeId}-${i + 1}`,
            stocktakeId,
            productId: item.productId,
            systemQty,
            actualQty: item.actualQty,
            variance: item.actualQty - systemQty,
            itemRemark: item.remark,
          })
        );
      }

      const stocktake = new Stocktake({
        id: stocktakeId,
        storeId: command.storeId,
        status: 'DRAFT',
        countedBy: command.countedBy,
        note: command.note,
        items,
      });

      await this.stocktakeRepo.createStocktake(stocktake, items);
      return ok(stocktake);
    } catch (error) {
      if (error instanceof AppError) return err(error);
      return err(new AppError('CREATE_STOCKTAKE_FAILED', (error as Error).message));
    }
  }

  /**
   * 審核過帳門市實盤 (DRAFT -> POSTED)
   * 原子套用 variance 修正 StoreInventory 並記錄日誌
   */
  async postStocktake(
    stocktakeId: string,
    postedBy: string
  ): Promise<Result<Stocktake, AppError>> {
    try {
      const stocktake = await this.stocktakeRepo.findById(stocktakeId);
      if (!stocktake) {
        return err(new NotFoundError('門市實盤', stocktakeId));
      }

      return await this.txManager.runInTransaction(async (tx) => {
        const items = await this.stocktakeRepo.findItemsByStocktakeId(stocktakeId, tx);

        for (const it of items) {
          if (it.variance !== 0) {
            let inv = await this.inventoryRepo.findByStoreAndProduct(
              stocktake.storeId,
              it.productId,
              tx
            );

            if (!inv) {
              inv = new StoreInventory({
                id: `inv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                storeId: stocktake.storeId,
                productId: it.productId,
                quantity: it.actualQty,
              });
              await this.inventoryRepo.save(inv, tx);
            } else {
              if (it.variance > 0) {
                inv.add(it.variance);
              } else {
                inv.deduct(-it.variance);
              }
              await this.inventoryRepo.save(inv, tx);
            }

            await this.inventoryRepo.recordLog(
              new InventoryLog({
                id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                storeId: stocktake.storeId,
                productId: it.productId,
                changeType: 'STOCKTAKE_ADJUST',
                delta: it.variance,
                balance: inv.quantity,
                stocktakeId,
                operator: postedBy,
                reason: `門市實盤過帳調帳 (盤差: ${it.variance})`,
              }),
              tx
            );
          }
        }

        stocktake.post(postedBy);
        await this.stocktakeRepo.updateStatus(
          stocktake.id,
          'POSTED',
          postedBy,
          stocktake.postedAt!,
          tx
        );

        return ok(stocktake);
      });
    } catch (error) {
      if (error instanceof AppError) return err(error);
      return err(new AppError('POST_STOCKTAKE_FAILED', (error as Error).message));
    }
  }
}
