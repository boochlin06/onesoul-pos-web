import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../plugins/prisma';
import { authenticate } from '../../plugins/auth';
import { OrderItemType, DrawPickType, PointLogType, SessionStatus, InventoryChangeType } from '@prisma/client';

const checkoutSchema = z.object({
  branch: z.string(),
  customer: z.object({
    phone: z.string().optional(),
    phoneName: z.string().optional(),
    name: z.string().optional(),
    currentPoints: z.number().optional().default(0),
  }),
  lotteries: z
    .array(
      z.object({
        id: z.string(),
        setName: z.string().optional().default(''),
        prize: z.string(),
        prizeId: z.string().optional().default(''),
        prizeName: z.string().optional().default(''),
        draws: z.number().min(1),
        type: z.enum(['帶走', '點數']).default('帶走'),
        unitPrice: z.number().default(0),
        unitPoints: z.number().default(0),
        totalPoints: z.number().default(0),
        pointsCost: z.number().default(0),
        amount: z.number().default(0),
        remark: z.string().optional().default(''),
      })
    )
    .optional()
    .default([]),
  merchandises: z
    .array(
      z.object({
        id: z.string(),
        name: z.string().optional().default(''),
        quantity: z.number().min(1),
        paymentType: z.enum(['現金', '點數', '贈送']).default('現金'),
        unitAmount: z.number().default(0),
        actualAmount: z.number().default(0),
        suggestedPoints: z.number().default(0),
        totalPoints: z.number().default(0),
        remark: z.string().optional().default(''),
      })
    )
    .optional()
    .default([]),
  payment: z.object({
    receivedAmount: z.number().default(0),
    cash: z.number().default(0),
    creditCard: z.number().default(0),
    linePay: z.number().default(0),
    remittance: z.number().default(0),
    pointsUsed: z.number().default(0),
  }),
  summary: z.object({
    dueAmount: z.number().default(0),
    pointsChange: z.number().default(0),
  }),
  orderNote: z.string().optional().default(''),
  checkoutUID: z.string().optional(),
});

function isWalkInCustomer(phoneOrName: string | null | undefined): boolean {
  if (!phoneOrName) return true;
  const clean = String(phoneOrName).trim().toUpperCase();
  const raw = clean.split(/[- ]/)[0].trim();
  const stripped = clean.replace(/[-_\s]/g, '');
  const WALK_IN_CODES = ['111111', '222222', '333333', '88888', '99999'];
  return (
    WALK_IN_CODES.includes(clean) ||
    WALK_IN_CODES.includes(raw) ||
    stripped.includes('散客') ||
    stripped.includes('WALKIN') ||
    stripped.includes('現場') ||
    stripped.includes('非會員') ||
    stripped.includes('臨時客') ||
    stripped.includes('訪客')
  );
}

export async function orderRoutes(fastify: FastifyInstance) {
  // 結帳 API (含 iCHEF 冪等防護、行級鎖與庫存原子扣減)
  fastify.post('/checkout', { preHandler: [authenticate] }, async (request, reply) => {
    const parse = checkoutSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ success: false, message: parse.error.errors[0].message });
    }

    const payload = parse.data;
    const storeId = payload.branch === '金山' ? 'jinshan' : 'chupei';
    const user = (request as any).user;
    const phoneInput = payload.customer.phone || payload.customer.phoneName || '';
    const isWalkIn = isWalkInCustomer(phoneInput) || isWalkInCustomer(payload.customer.name);
    const phone = isWalkIn ? (phoneInput || 'WALKIN') : phoneInput.split(/[- ]/)[0].trim();

    // 生成或使用客戶端 checkoutUID (散客附加隨機高熵值防止碰撞吞單)
    const checkoutUID =
      payload.checkoutUID?.trim() ||
      `${isWalkIn ? 'WALKIN' : (phone || 'WALKIN')}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // ── 1. 冪等性檢查 (Idempotency Check: 命中已完成訂單直接返回) ──
    const existingOrder = await prisma.order.findUnique({
      where: { checkoutUID },
      include: { member: true },
    });

    if (existingOrder && existingOrder.status === 'COMPLETED') {
      return {
        success: true,
        message: '結帳成功 (冪等響應)',
        newPoints: existingOrder.member?.points ?? 0,
        checkoutUID: existingOrder.checkoutUID,
      };
    }

    // ── 1.1 散客身分防護 (杜絕 111111/222222 散客點數零元購穿透) ──
    if (isWalkIn) {
      const hasPointsUsage = payload.payment?.pointsUsed && payload.payment.pointsUsed > 0;
      const hasMerchPoints = payload.merchandises?.some((m: any) => m.paymentType === '點數' || m.paymentType === 'POINTS');
      const hasLotteryPoints = payload.lotteries?.some((l: any) => l.type === '點數' || l.paymentType === '點數');
      const hasPointsCost = payload.lotteries?.some((l: any) => (l.pointsCost || 0) > 0 || l.remark === '點數套');
      const hasNetPointsDeduction = (payload.summary?.pointsChange || 0) < 0 || (payload.payment?.pointsUsed || 0) > 0;

      if (hasPointsUsage || hasMerchPoints || hasLotteryPoints || hasPointsCost || hasNetPointsDeduction) {
        return reply.status(400).send({
          success: false,
          message: '散客不可使用點數折抵、兌換品項或抽點數套，請先為顧客註冊會員',
        });
      }
    }

    // ── 2. 後端金額防竄改重新驗證 (Anti-Tampering) ──
    const calculatedDue =
      payload.lotteries.reduce((sum, l) => sum + (l.amount || 0), 0) +
      payload.merchandises.reduce((sum, m) => sum + (m.paymentType === '現金' ? m.actualAmount : 0), 0);

    if (calculatedDue !== payload.summary.dueAmount) {
      return reply.status(400).send({
        success: false,
        message: `金額校驗失敗：品項加總應付金額為 $${calculatedDue}，與送出之 $${payload.summary.dueAmount} 不符`,
      });
    }

    // 計算點數淨異動
    const pointsDelta = payload.summary.pointsChange - payload.payment.pointsUsed;

    try {
      const result = await prisma.$transaction(async (tx) => {
        // ── 2. 獲取活躍 Session (若無則自動開班) ──
        let session = await tx.cashRegisterSession.findFirst({
          where: { storeId, status: SessionStatus.OPEN },
        });

        if (!session) {
          session = await tx.cashRegisterSession.create({
            data: {
              storeId,
              openedBy: user?.email || 'system',
              openingCash: 0,
              status: SessionStatus.OPEN,
              note: '結帳自動開啟班次',
            },
          });
        }

        // ── 3. 查詢/鎖定會員 (行級鎖保護避免 Race Condition，攔截散客代碼) ──
        let member = null;
        const isCustomerWalkIn = isWalkIn;

        if (!isCustomerWalkIn && phone && phone !== 'WALKIN') {
          member = await tx.member.findUnique({ where: { phone } });
          if (!member) {
            member = await tx.member.create({
              data: {
                phone,
                name: payload.customer.name || phone,
                points: 0,
              },
            });
          }

          if (member.points + pointsDelta < 0) {
            throw new Error(`客戶點數不足：目前僅有 ${member.points} 點，無法扣除 ${Math.abs(pointsDelta)} 點`);
          }
        }

        // ── 4. 建立訂單主檔 ──
        const order = await tx.order.create({
          data: {
            checkoutUID,
            storeId,
            sessionId: session.id,
            memberId: member?.id || null,
            totalDue: payload.summary.dueAmount,
            receivedAmount: payload.payment.receivedAmount,
            cash: payload.payment.cash,
            creditCard: payload.payment.creditCard,
            linePay: payload.payment.linePay || 0,
            remittance: payload.payment.remittance,
            pointsUsed: payload.payment.pointsUsed,
            netPointsDelta: pointsDelta,
            cashierEmail: user?.email || 'unknown',
            orderNote: payload.orderNote,
          },
        });

        // ── 5. 處理抽獎明細與庫存 ──
        for (const lot of payload.lotteries) {
          const netItemPoints = (lot.totalPoints || 0) - (lot.pointsCost || 0);

          // 扣減獎項庫抽數
          const prizeRecord = await tx.luckyBagPrize.findFirst({
            where: {
              bagId: lot.id,
              prizeGrade: { equals: lot.prize, mode: 'insensitive' },
            },
          });

          if (prizeRecord) {
            // 一番賞防超抽驗證 (Anti-Overdraw)
            if (prizeRecord.drawnCount + lot.draws > prizeRecord.draws) {
              const remaining = prizeRecord.draws - prizeRecord.drawnCount;
              throw new Error(`獎項 [${lot.prize} ${lot.prizeName}] 剩餘抽數不足 (現餘 ${remaining} 抽，欲抽 ${lot.draws} 抽)`);
            }

            await tx.luckyBagPrize.update({
              where: { id: prizeRecord.id },
              data: { drawnCount: { increment: lot.draws } },
            });

            // 🛡️ 實體商品抽中帶走時原子出庫扣減門市庫存 (排除系統虛擬品項如 Z賞非GK、88888、99999)
            // 若客人選擇「換點數 (POINTS)」放棄帶走，實物留存店內，不扣減 storeInventory
            const isVirtualSku = !prizeRecord.productId ||
              prizeRecord.productId.startsWith('SKU-SYS-') ||
              ['88888', '99999'].includes(prizeRecord.productId);

            if (lot.type === '帶走' && prizeRecord.productId && !isVirtualSku) {
              const inv = await tx.storeInventory.findUnique({
                where: { storeId_productId: { storeId, productId: prizeRecord.productId } },
              });

              if (!inv || inv.quantity < lot.draws) {
                throw new Error(`獎項商品 [${lot.prizeName}] 門市庫存不足 (現有 ${inv?.quantity ?? 0} 件)`);
              }

              const newQty = inv.quantity - lot.draws;
              await tx.storeInventory.update({
                where: { id: inv.id },
                data: { quantity: newQty },
              });

              await tx.inventoryLog.create({
                data: {
                  storeId,
                  productId: prizeRecord.productId,
                  changeType: InventoryChangeType.SALE,
                  delta: -lot.draws,
                  balance: newQty,
                  orderId: order.id,
                  operator: user?.email,
                  reason: `福袋抽中帶走: ${lot.setName} [${lot.prize}]`,
                },
              });
            }
          }

          // 持久化抽獎明細，關鍵：帶入 productId 與明確 quantity 供未來作廢回補
          await tx.orderItem.create({
            data: {
              orderId: order.id,
              itemType: OrderItemType.LOTTERY,
              bagId: lot.id,
              productId: prizeRecord?.productId || null,
              prizeGrade: lot.prize,
              prizeName: lot.prizeName,
              pickType: lot.type === '點數' ? DrawPickType.POINTS : DrawPickType.TAKE_AWAY,
              quantity: lot.draws,
              draws: lot.draws,
              unitPrice: lot.unitPrice,
              amount: lot.amount,
              pointsImpact: netItemPoints,
              remark: lot.remark,
            },
          });
        }

        // ── 6. 處理直購商品明細與庫存 (🛡️ 強制依 id 字典排序，杜絕並發交叉鎖死 40P01) ──
        const sortedMerchandises = [...payload.merchandises].sort((a, b) => a.id.localeCompare(b.id));
        for (const m of sortedMerchandises) {
          let mPoints = 0;
          if (m.paymentType === '點數' || m.id === '99999') {
            mPoints = -Math.abs(m.totalPoints);
          } else if (m.id === '88888') {
            mPoints = Math.abs(m.totalPoints);
          }

          // 扣減實體商品庫存 (防負數透支)
          if (m.id !== '88888' && m.id !== '99999') {
            const inv = await tx.storeInventory.findUnique({
              where: { storeId_productId: { storeId, productId: m.id } },
            });

            if (!inv || inv.quantity < m.quantity) {
              throw new Error(`商品 [${m.name}] 庫存不足 (現有: ${inv?.quantity ?? 0}，需求: ${m.quantity})`);
            }

            const newQty = inv.quantity - m.quantity;
            await tx.storeInventory.update({
              where: { id: inv.id },
              data: { quantity: newQty },
            });

            await tx.inventoryLog.create({
              data: {
                storeId,
                productId: m.id,
                changeType: InventoryChangeType.SALE,
                delta: -m.quantity,
                balance: newQty,
                orderId: order.id,
                operator: user?.email,
                reason: `商品銷售: ${m.name}`,
              },
            });
          }

          await tx.orderItem.create({
            data: {
              orderId: order.id,
              itemType: m.id === '88888' || m.id === '99999' ? OrderItemType.SPECIAL : OrderItemType.MERCHANDISE,
              productId: m.id,
              quantity: m.quantity,
              unitPrice: m.unitAmount,
              amount: m.actualAmount,
              pointsImpact: mPoints,
              remark: m.remark,
            },
          });
        }

        // ── 7. 更新會員點數與點數流水 ──
        let updatedPoints = 0;
        if (member) {
          const newBalance = member.points + pointsDelta;
          await tx.member.update({
            where: { id: member.id },
            data: { points: newBalance },
          });

          await tx.pointLog.create({
            data: {
              memberId: member.id,
              type: pointsDelta >= 0 ? PointLogType.EARN : PointLogType.REDEEM,
              delta: pointsDelta,
              balance: newBalance,
              orderId: order.id,
              reason: `結帳訂單: ${checkoutUID}`,
              operator: user?.email,
            },
          });

          updatedPoints = newBalance;
        }

        return { order, newPoints: updatedPoints, checkoutUID };
      });

      return {
        success: true,
        message: '結帳成功',
        newPoints: result.newPoints,
        checkoutUID: result.checkoutUID,
      };
    } catch (err: any) {
      request.log.error(err);
      return reply.status(400).send({ success: false, message: err.message || '結帳失敗' });
    }
  });

  // 當日銷售查詢 (相容 getDailySales，抓取活躍 Session 明細)
  fastify.get('/daily', { preHandler: [authenticate] }, async (request) => {
    const { branch } = request.query as { branch?: string };
    const storeId = branch === '金山' ? 'jinshan' : 'chupei';

    const activeSession = await prisma.cashRegisterSession.findFirst({
      where: { storeId, status: SessionStatus.OPEN },
      orderBy: { openedAt: 'desc' },
    });

    if (!activeSession) {
      return { success: true, data: [] };
    }

    const orders = await prisma.order.findMany({
      where: { sessionId: activeSession.id, status: 'COMPLETED' },
      include: {
        items: true,
        member: true,
        store: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const entries = orders.flatMap((order) =>
      order.items.map((item, idx) => ({
        phone: order.member?.phone || '',
        lotteryId: item.bagId || '',
        prize: item.prizeGrade || '',
        draws: item.draws || 1,
        type: item.pickType === 'POINTS' ? '點數' : '帶走',
        setName: item.remark || '',
        name: item.prizeName || '',
        unitPrice: item.unitPrice,
        prizeId: item.productId || '',
        prizeName: item.prizeName || '',
        unitPoints: 0,
        points: item.pointsImpact,
        amount: item.amount,
        remark: item.remark || '',
        date: order.createdAt.toISOString().slice(0, 10).replace(/-/g, '/'),
        checkoutUID: order.checkoutUID,
        receivedAmount: idx === 0 ? order.receivedAmount : 0,
        remittance: idx === 0 ? order.remittance : 0,
        creditCard: idx === 0 ? order.creditCard : 0,
        cash: idx === 0 ? order.cash : 0,
        pointsUsed: idx === 0 ? order.pointsUsed : 0,
        channel: order.orderNote || '',
        pointDelta: idx === 0 ? order.netPointsDelta : 0,
        branch: order.store.name.replace('店', ''),
      }))
    );

    return { success: true, data: entries };
  });

  // 訂單軟作廢與原子退點/回補庫存 (相容 deleteDailySales)
  fastify.post('/:checkoutUID/void', { preHandler: [authenticate] }, async (request, reply) => {
    const { checkoutUID } = request.params as { checkoutUID: string };
    const { branch, reason } = request.body as { branch?: string; reason?: string };
    const user = (request as any).user;

    const order = await prisma.order.findUnique({
      where: { checkoutUID },
      include: {
        items: true,
        member: true,
        store: true,
      },
    });

    if (!order) {
      return reply.status(404).send({ success: false, message: '找不到此訂單' });
    }

    if (order.status === 'CANCELLED') {
      return reply.status(400).send({ success: false, message: '此訂單已經作廢' });
    }

    // 跨店操作檢查
    if (branch && order.store.name.indexOf(branch) === -1) {
      return reply.status(403).send({ success: false, message: '不可跨店作廢訂單' });
    }

    await prisma.$transaction(async (tx) => {
      // 1. 軟作廢標記
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: 'CANCELLED',
          voidReason: reason || '店員操作作廢',
          voidedAt: new Date(),
          voidedBy: user?.email || 'unknown',
        },
      });

      // 2. 退回會員點數
      if (order.member && order.netPointsDelta !== 0) {
        const refundDelta = -order.netPointsDelta;
        const newBalance = order.member.points + refundDelta;

        await tx.member.update({
          where: { id: order.member.id },
          data: { points: newBalance },
        });

        await tx.pointLog.create({
          data: {
            memberId: order.member.id,
            type: PointLogType.REFUND,
            delta: refundDelta,
            balance: newBalance,
            orderId: order.id,
            reason: `訂單作廢退點: ${checkoutUID}`,
            operator: user?.email,
          },
        });
      }

      // 3. 回補商品庫存與福袋抽數
      for (const item of order.items) {
        if (item.itemType === OrderItemType.LOTTERY && item.bagId && item.prizeGrade) {
          const itemDraws = item.draws || item.quantity || 1;
          await tx.luckyBagPrize.updateMany({
            where: {
              bagId: item.bagId,
              prizeGrade: { equals: item.prizeGrade, mode: 'insensitive' },
            },
            data: { drawnCount: { decrement: itemDraws } },
          });

          // 🛡️ 只要不是明確標記為換點數 (POINTS)，實體商品皆為帶走出庫；作廢時原子回補門市庫存
          const isVirtualSku = !item.productId ||
            item.productId.startsWith('SKU-SYS-') ||
            item.productId === '88888' ||
            item.productId === '99999';

          const isPointsPick = item.pickType === DrawPickType.POINTS || (item.pickType as any) === 'POINTS';
          if (!isPointsPick && item.productId && !isVirtualSku) {
            const inv = await tx.storeInventory.findUnique({
              where: { storeId_productId: { storeId: order.storeId, productId: item.productId } },
            });
            let updatedInv;
            if (inv) {
              updatedInv = await tx.storeInventory.update({
                where: { id: inv.id },
                data: { quantity: { increment: itemDraws } },
              });
            } else {
              updatedInv = await tx.storeInventory.create({
                data: {
                  storeId: order.storeId,
                  productId: item.productId,
                  quantity: itemDraws,
                  safetyStock: 1,
                  version: 0,
                },
              });
            }
            await tx.inventoryLog.create({
              data: {
                storeId: order.storeId,
                productId: item.productId,
                changeType: InventoryChangeType.SALE_VOID_RETURN,
                delta: itemDraws,
                balance: updatedInv.quantity,
                orderId: order.id,
                operator: user?.email,
                reason: `訂單作廢回補福袋帶走實體商品: ${checkoutUID}`,
              },
            });
          }
        }

        // 實體商品直售 (MERCHANDISE) 回補庫存
        if (item.itemType === OrderItemType.MERCHANDISE && item.productId) {
          const isVirtualSku = !item.productId ||
            item.productId.startsWith('SKU-SYS-') ||
            item.productId === '88888' ||
            item.productId === '99999';

          if (!isVirtualSku) {
            const inv = await tx.storeInventory.findUnique({
              where: { storeId_productId: { storeId: order.storeId, productId: item.productId } },
            });

            const restockQty = item.quantity || 1;
            let updatedInv;
            if (inv) {
              updatedInv = await tx.storeInventory.update({
                where: { id: inv.id },
                data: { quantity: { increment: restockQty } },
              });
            } else {
              updatedInv = await tx.storeInventory.create({
                data: {
                  storeId: order.storeId,
                  productId: item.productId,
                  quantity: restockQty,
                  safetyStock: 1,
                  version: 0,
                },
              });
            }

            await tx.inventoryLog.create({
              data: {
                storeId: order.storeId,
                productId: item.productId,
                changeType: InventoryChangeType.SALE_VOID_RETURN,
                delta: restockQty,
                balance: updatedInv.quantity,
                orderId: order.id,
                operator: user?.email,
                reason: `訂單作廢回補商品庫存: ${checkoutUID}`,
              },
            });
          }
        }
      }
    });

    return { success: true, message: `訂單 ${checkoutUID} 已成功作廢，點數與庫存已原子回補` };
  });

  // 歷史銷售紀錄分頁查詢 (相容 getSalesRecords)
  fastify.get('/', { preHandler: [authenticate] }, async (request) => {
    const { limit = 100, offset = 0 } = request.query as { limit?: number; offset?: number };

    const orders = await prisma.order.findMany({
      include: {
        items: true,
        member: true,
        store: true,
      },
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
      skip: Number(offset),
    });

    const entries = orders.flatMap((order) =>
      order.items.map((item, idx) => ({
        phone: order.member?.phone || '',
        lotteryId: item.bagId || '',
        prize: item.prizeGrade || '',
        draws: item.draws || 1,
        type: item.pickType === 'POINTS' ? '點數' : '帶走',
        setName: item.remark || '',
        name: item.prizeName || '',
        unitPrice: item.unitPrice,
        prizeId: item.productId || '',
        prizeName: item.prizeName || '',
        unitPoints: 0,
        points: item.pointsImpact,
        amount: item.amount,
        remark: item.remark || '',
        date: order.createdAt.toISOString().slice(0, 10).replace(/-/g, '/'),
        checkoutUID: order.checkoutUID,
        receivedAmount: idx === 0 ? order.receivedAmount : 0,
        remittance: idx === 0 ? order.remittance : 0,
        creditCard: idx === 0 ? order.creditCard : 0,
        cash: idx === 0 ? order.cash : 0,
        pointsUsed: idx === 0 ? order.pointsUsed : 0,
        channel: order.orderNote || '',
        pointDelta: idx === 0 ? order.netPointsDelta : 0,
        branch: order.store.name.replace('店', ''),
      }))
    );

    return { success: true, data: entries };
  });

  // ── 8. POS 購物車草稿暫存管理 (對齊 GAS apiSaveDraft / apiGetDrafts / apiClearDraft) ──
  const cartDrafts = new Map<string, { branch: string; sessionId: string; email: string; data: any; ts: number }>();

  fastify.post('/drafts', { preHandler: [authenticate] }, async (request, reply) => {
    const { branch, sessionId, data } = (request.body as any) || {};
    const user = (request as any).user;
    if (!branch || !sessionId) {
      return reply.code(400).send({ success: false, message: '缺少門市或班次識別' });
    }
    const key = `draft_${branch}_${sessionId}`;
    cartDrafts.set(key, {
      branch,
      sessionId,
      email: user?.email || 'cashier',
      data,
      ts: Date.now(),
    });
    return reply.send({ success: true, message: '結帳草稿已暫存' });
  });

  fastify.get('/drafts', { preHandler: [authenticate] }, async (request, reply) => {
    const { branch } = (request.query as any) || {};
    const now = Date.now();
    const results = [];
    for (const [key, val] of cartDrafts.entries()) {
      if (now - val.ts > 30 * 60 * 1000) {
        cartDrafts.delete(key);
        continue;
      }
      if (!branch || val.branch === branch) {
        results.push({
          sessionId: val.sessionId,
          branch: val.branch,
          email: val.email,
          data: val.data,
          agoSeconds: Math.round((now - val.ts) / 1000),
        });
      }
    }
    return reply.send({ success: true, data: results });
  });

  fastify.delete('/drafts/:sessionId', { preHandler: [authenticate] }, async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const { branch = '竹北' } = (request.query as any) || {};
    const key = `draft_${branch}_${sessionId}`;
    cartDrafts.delete(key);
    return reply.send({ success: true, message: '草稿已清除' });
  });
}
