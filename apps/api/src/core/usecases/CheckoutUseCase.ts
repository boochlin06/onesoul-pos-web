import {
  Result,
  ok,
  err,
  AppError,
  ValidationError,
  NotFoundError,
  InsufficientPointsError,
  OverdrawError,
  InsufficientStockError,
  InvariantViolationError,
} from '@onesoul/shared';
import { PhoneNumber } from '../entities/PhoneNumber';
import { Order, OrderItem } from '../entities/Order';
import { CashRegisterSession } from '../entities/CashRegisterSession';
import { PointLog } from '../entities/Member';
import { InventoryLog } from '../entities/Product';
import { orderVoids } from '@onesoul/db/schema';
import {
  validateWalkInBlock,
  validatePointsSetOrder,
  calculatePointsSetCost,
  resolveSmallPrizePoints,
  sortProductIdsForLock,
} from '../invariants/invariants';

import type { OrderRepository } from '../ports/OrderRepository';
import type { InventoryRepository } from '../ports/InventoryRepository';
import type { LuckyBagRepository } from '../ports/LuckyBagRepository';
import type { MemberRepository } from '../ports/MemberRepository';
import type { SessionRepository } from '../ports/SessionRepository';
import type { TransactionManager } from '../ports/TransactionManager';

export interface CheckoutLotteryInput {
  bagId: string;
  prizeGrade: string;
  prizeName?: string;
  draws: number;
  pickType: 'TAKE_AWAY' | 'POINTS';
  unitPrice: number;
  amount: number;
  pointsCost?: number;
  isPointsSet?: boolean;
  remark?: string;
}

export interface CheckoutMerchandiseInput {
  productId: string;
  name?: string;
  quantity: number;
  paymentType: '現金' | '點數' | '贈送';
  unitPrice: number;
  amount: number;
  totalPoints?: number;
}

export interface CheckoutCommand {
  storeId: string;
  customer: {
    phone?: string;
    name?: string;
  };
  lotteries?: CheckoutLotteryInput[];
  merchandises?: CheckoutMerchandiseInput[];
  payment: {
    cash: number;
    creditCard: number;
    linePay: number;
    remittance: number;
    pointsUsed: number;
  };
  cashierEmail: string;
  checkoutUID?: string;
  orderNote?: string;
}

export interface CheckoutResponse {
  success: boolean;
  orderId: string;
  checkoutUID: string;
  totalDue: number;
  memberPoints: number;
  netPointsDelta: number;
  message?: string;
}

export interface VoidOrderResponse {
  success: boolean;
  orderId: string;
  checkoutUID: string;
  message: string;
}

export class CheckoutUseCase {
  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly inventoryRepo: InventoryRepository,
    private readonly luckyBagRepo: LuckyBagRepository,
    private readonly memberRepo: MemberRepository,
    private readonly sessionRepo: SessionRepository,
    private readonly txManager: TransactionManager
  ) {}

  async execute(command: CheckoutCommand): Promise<Result<CheckoutResponse, AppError>> {
    try {
      const phoneVo = new PhoneNumber(command.customer.phone);
      const checkoutUID =
        command.checkoutUID ||
        `ord-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

      // 1. 冪等性防護 (Idempotency Check)
      const existing = await this.orderRepo.findByCheckoutUID(checkoutUID);
      if (existing && existing.status === 'COMPLETED') {
        const member = existing.memberId
          ? await this.memberRepo.findById(existing.memberId)
          : null;
        return ok({
          success: true,
          orderId: existing.id,
          checkoutUID: existing.checkoutUID,
          totalDue: existing.totalDue,
          memberPoints: member?.points ?? 0,
          netPointsDelta: existing.netPointsDelta,
          message: '結帳成功 (冪等響應)',
        });
      }

      // 2. 🚨 Invariant #1: 散客點數零容忍阻斷
      validateWalkInBlock(
        phoneVo,
        command.payment,
        command.lotteries,
        command.merchandises
      );

      // 購物車非空檢驗
      const lotteries = command.lotteries ?? [];
      const merchandises = command.merchandises ?? [];
      if (lotteries.length === 0 && merchandises.length === 0) {
        return err(new ValidationError('購物車不可為空'));
      }

      // 3. 事務執行
      return await this.txManager.runInTransaction(async (tx) => {
        // 3.1 確保有效收銀班次
        let session = await this.sessionRepo.findActiveByStore(command.storeId, tx);
        if (!session) {
          session = await this.sessionRepo.openSession(
            new CashRegisterSession({
              id: `sess-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              storeId: command.storeId,
              openedBy: command.cashierEmail,
              openingCash: 8000,
            }),
            tx
          );
        }

        // 3.2 算費與點數淨異動計算
        let calculatedDue = 0;
        let pointsIssued = 0;
        let pointsDeducted = command.payment.pointsUsed || 0;
        const orderItems: OrderItem[] = [];
        const pendingDeductions: {
          productId: string;
          quantity: number;
          prizeName?: string;
          source: 'LOTTERY' | 'MERCHANDISE';
          reason: string;
        }[] = [];

        // 3.3 處理一番賞抽獎項目
        for (const lot of lotteries) {
          if (lot.draws <= 0) {
            throw new ValidationError('抽數必須大於 0');
          }

          const bag = await this.luckyBagRepo.findById(lot.bagId, tx);
          if (!bag) {
            throw new NotFoundError(`一番賞套組 [${lot.bagId}]`);
          }

          // Invariant #1: 散客絕對禁止參與限定點數套
          if (bag.isPointsSet && phoneVo.isWalkIn) {
            throw new InvariantViolationError(
              '散客無會員帳號，嚴禁使用點數扣抵或抽取點數套，請先為顧客建檔綁定會員手機號碼。'
            );
          }

          const prize = await this.luckyBagRepo.findPrize(lot.bagId, lot.prizeGrade, tx);
          if (!prize) {
            throw new NotFoundError(
              `福袋 [${lot.bagId}] 之賞項 [${lot.prizeGrade}]`
            );
          }

          // 抽數足夠防超抽
          if (prize.drawnCount + lot.draws > prize.draws) {
            throw new OverdrawError(
              `賞項 [${lot.prizeGrade}] 剩餘抽數不足: 剩餘 ${prize.remainingDraws} 抽，欲抽取 ${lot.draws} 抽`
            );
          }

          // 限定點數套不變量防護
          if (bag.isPointsSet) {
            const pointsCost = calculatePointsSetCost(bag.unitPrice, lot.draws);
            validatePointsSetOrder(true, bag.unitPrice, lot.draws, lot.amount, pointsCost);
            pointsDeducted += pointsCost;
          } else {
            calculatedDue += lot.amount;
          }

          // 扣減籤位抽數
          await this.luckyBagRepo.incrementDrawnCount(lot.bagId, lot.prizeGrade, lot.draws, tx);

          let pointsImpact = 0;
          // 提貨模式處理 (Invariant #2)
          if (lot.pickType === 'POINTS') {
            // 小賞換點
            const ptsPerDraw = resolveSmallPrizePoints(
              lot.prizeGrade,
              prize.points,
              10
            );
            const totalPointsAwarded = ptsPerDraw * lot.draws;
            pointsIssued += totalPointsAwarded;
            pointsImpact = totalPointsAwarded;
          } else {
            // 現場帶走 TAKE_AWAY: 實體大賞 GK 雕像收集至全域待扣清單 (依 Invariant #3 字典序鎖定)
            if (prize.productId && prize.isGrandPrize()) {
              pendingDeductions.push({
                productId: prize.productId,
                quantity: lot.draws,
                prizeName: prize.prizeName,
                source: 'LOTTERY',
                reason: `一番賞出賞提貨: ${lot.prizeGrade}賞`,
              });
            }
          }

          orderItems.push(
            new OrderItem({
              id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              orderId: checkoutUID,
              itemType: 'LOTTERY',
              bagId: lot.bagId,
              prizeGrade: lot.prizeGrade,
              prizeName: lot.prizeName || prize.prizeName,
              pickType: lot.pickType,
              draws: lot.draws,
              productId: prize.productId,
              quantity: lot.draws,
              unitPrice: lot.unitPrice,
              amount: lot.amount,
              pointsImpact,
              remark: lot.remark,
            })
          );
        }

        // 3.4 處理零售直售品項 (收集實體出庫至全域待扣清單)
        for (const m of merchandises) {
          if (m.quantity <= 0) {
            throw new ValidationError('商品數量必須大於 0');
          }

          let pointsImpact = 0;
          if (m.paymentType === '點數') {
            const ptsCost = m.totalPoints || m.quantity * m.unitPrice;
            pointsDeducted += ptsCost;
            pointsImpact = -ptsCost;
          } else if (m.paymentType === '現金') {
            calculatedDue += m.amount;
          }

          // 虛擬商品特殊處理
          if (m.productId === '88888') {
            // 人工加點
            pointsIssued += m.quantity;
            pointsImpact = m.quantity;
          } else if (m.productId === '99999') {
            // 人工扣點
            pointsDeducted += m.quantity;
            pointsImpact = -m.quantity;
          } else {
            // 實體商品出庫
            pendingDeductions.push({
              productId: m.productId,
              quantity: m.quantity,
              source: 'MERCHANDISE',
              reason: '零售直售出庫',
            });
          }

          orderItems.push(
            new OrderItem({
              id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              orderId: checkoutUID,
              itemType: 'MERCHANDISE',
              productId: m.productId,
              quantity: m.quantity,
              unitPrice: m.unitPrice,
              amount: m.amount,
              pointsImpact,
            })
          );
        }

        // 執行實體商品庫存扣減 (按照 Invariant #3 字典序排程，全域合併一番賞提貨與零售出庫)
        if (pendingDeductions.length > 0) {
          const deductionMap = new Map<
            string,
            {
              totalQty: number;
              items: {
                productId: string;
                quantity: number;
                prizeName?: string;
                source: 'LOTTERY' | 'MERCHANDISE';
                reason: string;
              }[];
            }
          >();

          for (const d of pendingDeductions) {
            const entry = deductionMap.get(d.productId);
            if (entry) {
              entry.totalQty += d.quantity;
              entry.items.push(d);
            } else {
              deductionMap.set(d.productId, { totalQty: d.quantity, items: [d] });
            }
          }

          const sortedIds = sortProductIdsForLock([...deductionMap.keys()]);
          const batchDeductions: { productId: string; quantity: number }[] = [];
          const invMap = new Map<string, number>();

          // 1. 預檢各品項庫存是否充足
          for (const pid of sortedIds) {
            const entry = deductionMap.get(pid)!;
            const inv = await this.inventoryRepo.findByStoreAndProduct(command.storeId, pid, tx);
            const currentQty = inv?.quantity ?? 0;
            invMap.set(pid, currentQty);
            if (!inv || currentQty < entry.totalQty) {
              const prizeItem = entry.items.find((it) => it.source === 'LOTTERY');
              if (prizeItem?.prizeName) {
                throw new InsufficientStockError(
                  `大賞商品 [${prizeItem.prizeName}] 門市庫存不足 (現有: ${currentQty}, 需提貨: ${entry.totalQty})`
                );
              }
              throw new InsufficientStockError(
                `商品 [${pid}] 庫存不足 (現有: ${currentQty}, 欲出庫: ${entry.totalQty})`
              );
            }
            batchDeductions.push({ productId: pid, quantity: entry.totalQty });
          }

          // 2. 依嚴格字典序批次獲取鎖與扣減庫存
          await this.inventoryRepo.deductQuantities(command.storeId, batchDeductions, tx);

          // 3. 循序寫入庫存異動流水 (InventoryLog)
          for (const pid of sortedIds) {
            const entry = deductionMap.get(pid)!;
            let runningBalance = invMap.get(pid) ?? 0;

            for (const item of entry.items) {
              runningBalance -= item.quantity;
              await this.inventoryRepo.recordLog(
                new InventoryLog({
                  id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                  storeId: command.storeId,
                  productId: pid,
                  changeType: 'SALE',
                  delta: -item.quantity,
                  balance: runningBalance,
                  orderId: checkoutUID,
                  operator: command.cashierEmail,
                  reason: item.reason,
                }),
                tx
              );
            }
          }
        }

        // 3.5 金額平帳校驗
        const totalPaid =
          command.payment.cash +
          command.payment.creditCard +
          command.payment.linePay +
          command.payment.remittance;

        if (totalPaid !== calculatedDue) {
          throw new InvariantViolationError(
            `實付總額 ($${totalPaid}) 不等於應收金額 ($${calculatedDue})`
          );
        }

        const netPointsDelta = pointsIssued - pointsDeducted;

        // 3.6 會員帳戶點數更新
        let member = null;
        if (!phoneVo.isWalkIn) {
          member = await this.memberRepo.findOrCreateByPhone(
            phoneVo.canonical,
            command.customer.name,
            tx
          );

          if (member.points + netPointsDelta < 0) {
            throw new InsufficientPointsError(
              `會員點數不足: 目前 ${member.points} 點，欲折抵扣除 ${Math.abs(netPointsDelta)} 點`
            );
          }

          member.adjustPoints(netPointsDelta);
          member.recordPurchase(calculatedDue);
          await this.memberRepo.save(member, tx);
        }

        // 3.7 先建立並儲存訂單 (確保 orders.id 已持久化，滿足 PointLog 外鍵約束)
        const order = new Order({
          id: `ord-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          checkoutUID,
          storeId: command.storeId,
          sessionId: session.id,
          memberPhone: phoneVo,
          memberId: member?.id ?? null,
          totalDue: calculatedDue,
          payment: command.payment,
          netPointsDelta,
          items: orderItems,
          status: 'COMPLETED',
          cashierEmail: command.cashierEmail,
          orderNote: command.orderNote,
        });

        await this.orderRepo.save(order, tx);

        // 3.8 於訂單建立後，方記錄會員點數流水帳 (滿足 point_logs.order_id REFERENCES orders.id)
        if (member && netPointsDelta !== 0) {
          await this.memberRepo.recordPointLog(
            new PointLog({
              id: `pt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              memberId: member.id,
              type: netPointsDelta > 0 ? 'EARN' : 'REDEEM',
              delta: netPointsDelta,
              balance: member.points,
              orderId: order.id,
              reason: `結帳扣抵/贈點: ${checkoutUID}`,
              operator: command.cashierEmail,
            }),
            tx
          );
        }

        return ok({
          success: true,
          orderId: order.id,
          checkoutUID: order.checkoutUID,
          totalDue: calculatedDue,
          memberPoints: member?.points ?? 0,
          netPointsDelta,
        });
      });
    } catch (error) {
      if (error instanceof AppError) {
        return err(error);
      }
      const rawMsg = (error as Error)?.message || String(error);
      if (rawMsg.includes('FOREIGN KEY constraint failed')) {
        return err(
          new AppError('FOREIGN_KEY_VIOLATION', '關聯資料外鍵約束失敗，所引用的關聯實體不存在。', 400)
        );
      }
      return err(new AppError('CHECKOUT_FAILED', (error as Error).message, 400));
    }
  }

  async voidOrder(
    checkoutUID: string,
    voidReason: string,
    operator: string
  ): Promise<Result<VoidOrderResponse, AppError>> {
    try {
      const order = await this.orderRepo.findByCheckoutUID(checkoutUID);
      if (!order) {
        return err(new NotFoundError('訂單', checkoutUID));
      }

      if (!order.canVoid()) {
        return err(new InvariantViolationError('訂單已經作廢，不可重複作廢'));
      }

      return await this.txManager.runInTransaction(async (tx) => {
        // Guardrail 2 (Sentinel Unique Tables): Insert into order_voids (order_id) on voidOrder
        if (tx && typeof tx.insert === 'function') {
          await tx.insert(orderVoids).values({
            orderId: order.id,
            voidedAt: (order.voidedAt instanceof Date ? order.voidedAt : new Date()).toISOString(),
            operator,
            reason: voidReason,
          });
        }

        // 1. 軟作廢標記
        order.void(voidReason, operator);
        await this.orderRepo.updateStatus(
          order.id,
          'CANCELLED',
          {
            voidReason,
            voidedAt: order.voidedAt!,
            voidedBy: operator,
          },
          tx
        );

        // 2. 點數與消費累計回滾
        if (order.memberId && (order.netPointsDelta !== 0 || order.totalDue > 0)) {
          const member = await this.memberRepo.findById(order.memberId, tx);
          if (member) {
            if (order.totalDue > 0) {
              member.revertPurchase(order.totalDue);
            }
            if (order.netPointsDelta !== 0) {
              // 反向補償：netPointsDelta > 0 扣回，< 0 加回
              const reverseDelta = -order.netPointsDelta;
              member.adjustPoints(reverseDelta);
              await this.memberRepo.recordPointLog(
                new PointLog({
                  id: `pt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                  memberId: member.id,
                  type: 'REFUND',
                  delta: reverseDelta,
                  balance: member.points,
                  orderId: order.id,
                  reason: `訂單作廢點數沖正: ${voidReason}`,
                  operator,
                }),
                tx
              );
            }
            await this.memberRepo.save(member, tx);
          }
        }

        // 3. 籤位與庫存回滾 (Guardrail 5: 聚合品項並依字典序加回庫存)
        const inventoryRestores = new Map<string, { quantity: number; reason: string }>();

        for (const item of order.items) {
          if (item.itemType === 'LOTTERY' && item.bagId && item.prizeGrade) {
            // 籤位抽數回補
            await this.luckyBagRepo.decrementDrawnCount(
              item.bagId,
              item.prizeGrade,
              item.quantity,
              tx
            );

            // 若當時是現場帶走實體商品，庫存回補 (防禦性排除抽象 ID 如 0p, 1p, x, z, blind_box)
            const pid = (item.productId || '').trim().toLowerCase();
            const isAbstract =
              ['0p', '1p', 'x', 'z', 'blind_box'].includes(pid) ||
              item.prizeGrade === 'X' ||
              item.prizeGrade === 'Z';
            if (item.pickType === 'TAKE_AWAY' && item.productId && !isAbstract) {
              const current = inventoryRestores.get(item.productId) || {
                quantity: 0,
                reason: `訂單作廢一番賞大賞退回庫存: ${voidReason}`,
              };
              current.quantity += item.quantity;
              inventoryRestores.set(item.productId, current);
            }
          } else if (item.itemType === 'MERCHANDISE' && item.productId) {
            if (item.productId !== '88888' && item.productId !== '99999') {
              const current = inventoryRestores.get(item.productId) || {
                quantity: 0,
                reason: `訂單作廢商品退回庫存: ${voidReason}`,
              };
              current.quantity += item.quantity;
              inventoryRestores.set(item.productId, current);
            }
          }
        }

        if (inventoryRestores.size > 0) {
          const sortedRestoreIds = sortProductIdsForLock([...inventoryRestores.keys()]);
          for (const pid of sortedRestoreIds) {
            const entry = inventoryRestores.get(pid)!;
            const inv = await this.inventoryRepo.findByStoreAndProduct(order.storeId, pid, tx);
            await this.inventoryRepo.addQuantities(
              order.storeId,
              [{ productId: pid, quantity: entry.quantity }],
              tx
            );
            await this.inventoryRepo.recordLog(
              new InventoryLog({
                id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                storeId: order.storeId,
                productId: pid,
                changeType: 'SALE_VOID_RETURN',
                delta: entry.quantity,
                balance: (inv?.quantity ?? 0) + entry.quantity,
                orderId: order.checkoutUID,
                operator,
                reason: entry.reason,
              }),
              tx
            );
          }
        }

        return ok({
          success: true,
          orderId: order.id,
          checkoutUID: order.checkoutUID,
          message: '訂單作廢成功，庫存與點數已全數回滾',
        });
      });
    } catch (error) {
      if (error instanceof AppError) {
        return err(error);
      }
      const rawMsg = (error as Error)?.message || String(error);
      if (rawMsg.includes('FOREIGN KEY constraint failed')) {
        return err(
          new AppError('FOREIGN_KEY_VIOLATION', '關聯資料外鍵約束失敗，所引用的關聯實體不存在。', 400)
        );
      }
      return err(new AppError('VOID_FAILED', (error as Error).message, 400));
    }
  }
}
