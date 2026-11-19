import { createRoute, z } from '@hono/zod-openapi';
import {
  CheckoutPayloadSchema,
  CheckoutResponseSchema,
  StandardErrorResponseSchema,
  makeSuccessResponseSchema,
} from '@onesoul/shared';
import { createRouter } from '../common';
import { getServices, handleResult } from '../../di/container';
import { PhoneNumber } from '../../core/entities/PhoneNumber';

const checkoutRoute = createRoute({
  method: 'post',
  path: '/checkout',
  tags: ['Orders'],
  summary: '收銀台結帳核心',
  description: '處理零售商品與一番賞抽獎結帳，執行散客零容忍防禦、金額防竄改重算、行級悲觀鎖與冪等性防重複保護。',
  request: {
    body: {
      content: {
        'application/json': {
          schema: CheckoutPayloadSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: '結帳成功',
      content: {
        'application/json': {
          schema: makeSuccessResponseSchema(CheckoutResponseSchema),
        },
      },
    },
    400: {
      description: '業務不變量違反（如散客扣點、超抽、門市現貨不足、點數不足）',
      content: {
        'application/json': {
          schema: StandardErrorResponseSchema,
        },
      },
    },
  },
});

// 查詢門市訂單列表
const listOrdersRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Orders'],
  summary: '查詢銷售訂單列表',
  request: {
    query: z.object({
      sessionId: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(100).default(50),
    }),
  },
  responses: {
    200: {
      description: '銷售訂單列表',
      content: {
        'application/json': {
          schema: makeSuccessResponseSchema(z.array(z.any())),
        },
      },
    },
  },
});

// 查詢單筆銷售訂單
const getOrderRoute = createRoute({
  method: 'get',
  path: '/:id',
  tags: ['Orders'],
  summary: '查詢單筆銷售訂單',
  request: {
    params: z.object({
      id: z.string().min(1),
    }),
  },
  responses: {
    200: {
      description: '銷售訂單明細',
      content: {
        'application/json': {
          schema: makeSuccessResponseSchema(z.any()),
        },
      },
    },
    404: {
      description: '銷售訂單不存在',
      content: {
        'application/json': {
          schema: StandardErrorResponseSchema,
        },
      },
    },
  },
});

// 作廢銷售訂單
const voidOrderRoute = createRoute({
  method: 'post',
  path: '/:id/void',
  tags: ['Orders'],
  summary: '作廢銷售訂單',
  request: {
    params: z.object({
      id: z.string().min(1),
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            reason: z.string().default('收銀員手動作廢'),
            cashierEmail: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: '銷售訂單作廢成功',
      content: {
        'application/json': {
          schema: makeSuccessResponseSchema(z.any()),
        },
      },
    },
    400: {
      description: '作廢失敗',
      content: {
        'application/json': {
          schema: StandardErrorResponseSchema,
        },
      },
    },
  },
});

export const ordersRouter = createRouter()
  .openapi(checkoutRoute, async (c) => {
    const services = getServices(c);
    const payload = c.req.valid('json');

    // Invariant #1: 散客點數穿透阻斷
    const phoneVo = new PhoneNumber(payload.customer?.phone || 'WALKIN');
    if (phoneVo.isWalkIn) {
      const hasPointsUsed = (payload.payment?.pointsUsed ?? 0) > 0;
      const hasMerchPoints = payload.merchandises?.some(
        (m) => m.paymentType === '點數' || (m as any).paymentType === 'POINTS'
      );
      const hasLotteryPoints = payload.lotteries?.some(
        (l) => l.type === '點數' || (l.pointsCost ?? 0) > 0
      );
      if (hasPointsUsed || hasMerchPoints || hasLotteryPoints) {
        return c.json(
          {
            success: false as const,
            error: {
              code: 'INVARIANT_VIOLATION',
              message: '散客無會員帳號，嚴禁使用點數扣抵或抽取限定點數套，請先為顧客建檔綁定會員手機號碼。',
            },
            traceId: c.get('traceId'),
          },
          400
        );
      }
    }

    const result = await services.useCases.checkout.execute({
      storeId: services.tenant.storeId,
      customer: payload.customer,
      lotteries: payload.lotteries?.map((l) => ({
        bagId: l.id,
        prizeGrade: l.prize,
        draws: l.draws,
        pickType: l.type === '點數' ? 'POINTS' : 'TAKE_AWAY',
        unitPrice: l.unitPrice,
        amount: l.amount,
        pointsCost: l.pointsCost,
        remark: l.remark,
      })),
      merchandises: payload.merchandises?.map((m) => ({
        productId: m.id,
        name: m.name,
        quantity: m.quantity,
        paymentType: m.paymentType === 'POINTS' ? '點數' : (m.paymentType as any),
        unitPrice: m.unitAmount,
        amount: m.actualAmount,
        totalPoints: m.totalPoints,
      })),
      payment: payload.payment,
      cashierEmail: payload.cashierEmail,
      checkoutUID: payload.checkoutUID,
      orderNote: payload.orderNote,
    });

    return handleResult(c, result, 200);
  })
  .openapi(listOrdersRoute, async (c) => {
    const services = getServices(c);
    const { sessionId, limit } = c.req.valid('query');

    let orders = [];
    if (sessionId) {
      orders = await services.repos.order.listBySession(sessionId);
    } else {
      orders = await services.repos.order.listByStore(services.tenant.storeId, limit);
    }

    return c.json({
      success: true as const,
      data: orders as any,
      traceId: c.get('traceId'),
    });
  })
  .openapi(getOrderRoute, async (c) => {
    const services = getServices(c);
    const { id } = c.req.valid('param');

    let order = await services.repos.order.findByCheckoutUID(id);
    if (!order) {
      order = await services.repos.order.findById(id);
    }

    if (!order) {
      return c.json(
        {
          success: false as const,
          error: {
            code: 'NOT_FOUND',
            message: `找不到銷售訂單: ${id}`,
          },
          traceId: c.get('traceId'),
        },
        404
      );
    }

    return c.json(
      {
        success: true as const,
        data: order as any,
        traceId: c.get('traceId'),
      },
      200
    );
  })
  .openapi(voidOrderRoute, async (c) => {
    const services = getServices(c);
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');

    const operator = body.cashierEmail || c.get('callerEmail') || 'cashier@onesoul.com';
    const result = await services.useCases.checkout.voidOrder(id, body.reason, operator);

    return handleResult(c, result, 200);
  });
