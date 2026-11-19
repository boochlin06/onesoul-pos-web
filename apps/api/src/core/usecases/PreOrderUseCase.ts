import {
  Result,
  ok,
  err,
  AppError,
  ValidationError,
  NotFoundError,
  ConflictError,
} from '@onesoul/shared';
import { PreOrder } from '../entities/PreOrder';
import { Product, StoreInventory, InventoryLog } from '../entities/Product';
import { AuditLog } from '../entities/AuditLog';

import type { PreOrderRepository } from '../ports/PreOrderRepository';
import type { InventoryRepository } from '../ports/InventoryRepository';
import type { AuditRepository } from '../ports/AuditRepository';
import type { TransactionManager } from '../ports/TransactionManager';

export interface CreatePreOrderCommand {
  name: string;
  version?: string;
  quantity: number;
  deposit: number;
  finalPayment?: number;
  shippingFee?: number;
  supplier?: string;
  targetStoreId?: string;
  note?: string;
}

export interface ReceivePreOrderCommand {
  productId: string;
  targetStoreId: string;
  sellingPrice: number;
  finalPayment?: number;
  shippingFee?: number;
  operator: string;
}

export class PreOrderUseCase {
  constructor(
    private readonly preOrderRepo: PreOrderRepository,
    private readonly inventoryRepo: InventoryRepository,
    private readonly auditRepo: AuditRepository,
    private readonly txManager: TransactionManager
  ) {}

  /**
   * 推薦接續 GK 貨號 (過濾 88888, 99999 與 100000+ 盲盒號)
   */
  async suggestNextGkId(): Promise<Result<string, AppError>> {
    try {
      const products = await this.inventoryRepo.findAllProducts();

      let maxGkId = 4100;
      for (const prod of products) {
        const num = parseInt(prod.id, 10);
        if (!isNaN(num) && num !== 88888 && num !== 99999 && num < 100000) {
          if (num > maxGkId) {
            maxGkId = num;
          }
        }
      }

      return ok(String(maxGkId + 1));
    } catch (error) {
      return err(new AppError('SUGGEST_GK_ID_FAILED', (error as Error).message));
    }
  }

  async createPreOrder(
    command: CreatePreOrderCommand
  ): Promise<Result<PreOrder, AppError>> {
    try {
      if (command.quantity <= 0) {
        return err(new ValidationError('預購數量必須大於 0'));
      }
      if (command.deposit < 0) {
        return err(new ValidationError('訂金不可小於 0'));
      }

      const preOrderId = `po-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const preOrder = new PreOrder({
        id: preOrderId,
        name: command.name.trim(),
        version: command.version,
        quantity: command.quantity,
        deposit: command.deposit,
        finalPayment: command.finalPayment ?? 0,
        shippingFee: command.shippingFee ?? 0,
        supplier: command.supplier,
        targetStoreId: command.targetStoreId,
        status: 'PENDING',
        note: command.note,
      });

      await this.preOrderRepo.create(preOrder);
      return ok(preOrder);
    } catch (error) {
      if (error instanceof AppError) return err(error);
      return err(new AppError('CREATE_PREORDER_FAILED', (error as Error).message));
    }
  }

  /**
   * 補款驗收入庫 (防撞號原子建立 Product 與 StoreInventory)
   */
  async receivePreOrder(
    preOrderId: string,
    command: ReceivePreOrderCommand
  ): Promise<Result<Product, AppError>> {
    try {
      const preOrder = await this.preOrderRepo.findById(preOrderId);
      if (!preOrder) {
        return err(new NotFoundError('預購單', preOrderId));
      }

      if (preOrder.status !== 'PENDING') {
        return err(
          new ConflictError(
            `預購單 [${preOrderId}] 狀態為 ${preOrder.status}，僅 PENDING 可驗收`
          )
        );
      }

      // 防撞號檢查: 若商品已存在且品名不同，禁止覆蓋
      const existingProd = await this.inventoryRepo.findProductById(command.productId);
      if (existingProd && existingProd.name !== preOrder.name) {
        return err(
          new ConflictError(
            `貨號碰撞: 商品代碼 [${command.productId}] 已被商品 [${existingProd.name}] 佔用，請更換貨號`
          )
        );
      }

      return await this.txManager.runInTransaction(async (tx) => {
        // 1. 驗收預購單並計算單件成本
        const { unitCost } = preOrder.receive({
          productId: command.productId,
          finalPayment: command.finalPayment,
          shippingFee: command.shippingFee,
        });

        // 2. 原子建立或更新商品主檔 (必須先建立 Product 以滿足 pre_orders 的 foreign key 參照)
        let product = existingProd;
        if (!product) {
          product = new Product({
            id: command.productId,
            name: preOrder.name,
            category: 'GK',
            costPrice: unitCost,
            sellingPrice: command.sellingPrice,
            suggestedPoints: Math.round(command.sellingPrice * 0.05),
          });
        } else {
          product.costPrice = unitCost;
          product.sellingPrice = command.sellingPrice;
          product.updatedAt = new Date();
        }
        await this.inventoryRepo.saveProduct(product, tx);

        // 3. 儲存預購單 (此時 Product 已存在，FK 驗證成功)
        await this.preOrderRepo.save(preOrder, tx);

        // 3. 原子建立或累加門市庫存
        let inv = await this.inventoryRepo.findByStoreAndProduct(
          command.targetStoreId,
          command.productId,
          tx
        );
        if (!inv) {
          inv = new StoreInventory({
            id: `inv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            storeId: command.targetStoreId,
            productId: command.productId,
            quantity: preOrder.quantity,
          });
        } else {
          inv.add(preOrder.quantity);
        }
        await this.inventoryRepo.save(inv, tx);

        // 4. 記錄採購入庫日誌
        await this.inventoryRepo.recordLog(
          new InventoryLog({
            id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            storeId: command.targetStoreId,
            productId: command.productId,
            changeType: 'MANUAL_ADJUST',
            delta: preOrder.quantity,
            balance: inv.quantity,
            operator: command.operator,
            reason: `預購單驗收入庫: ${preOrder.id} (${preOrder.name})`,
          }),
          tx
        );

        // 5. 記錄密碼學審計日誌 (Guardrail 4: store_id 分區 CAS 鏈)
        const prevHash = await (this.auditRepo as any).getLatestHash(tx, command.targetStoreId);
        const currentHash = AuditLog.calculateHash(prevHash, {
          operatorId: command.operator,
          action: 'PREORDER_RECEIVE',
          targetType: 'PREORDER',
          targetId: preOrder.id,
          delta: preOrder.quantity,
          reason: '預購單驗收入庫入架',
        });
        const auditLog = new AuditLog({
          id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          storeId: command.targetStoreId,
          operatorId: command.operator,
          action: 'PREORDER_RECEIVE',
          targetType: 'PREORDER',
          targetId: preOrder.id,
          afterState: {
            productId: command.productId,
            quantity: preOrder.quantity,
            totalCost: preOrder.totalCost,
            unitCost,
          },
          delta: preOrder.quantity,
          reason: '預購單驗收入庫入架',
          prevHash,
          currentHash,
        });
        await this.auditRepo.append(auditLog, tx);

        return ok(product);
      });
    } catch (error) {
      if (error instanceof AppError) return err(error);
      return err(new AppError('RECEIVE_PREORDER_FAILED', (error as Error).message));
    }
  }
}
