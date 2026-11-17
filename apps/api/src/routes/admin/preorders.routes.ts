import { createRoute, z } from '@hono/zod-openapi';
import {
  CreatePreOrderPayloadSchema,
  ReceivePreOrderPayloadSchema,
  StandardErrorResponseSchema,
  makeSuccessResponseSchema,
} from '@onesoul/shared';
import { createRouter } from '../common';
import { getServices, handleResult } from '../../di/container';

// 查詢預購單清單
const listPreOrdersRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Admin - PreOrders'],
  summary: '查詢廠商預購單清單',
  request: {
    query: z.object({
      status: z.enum(['PENDING', 'ARRIVED', 'COMPLETED', 'CANCELLED']).optional(),
    }),
  },
  responses: {
    200: {
      description: '預購單清單',
      content: {
        'application/json': {
          schema: makeSuccessResponseSchema(z.array(z.any())),
        },
      },
    },
  },
});

// 智慧推薦接續 GK 貨號
const suggestNextGkIdRoute = createRoute({
  method: 'get',
  path: '/suggest-next-id',
  tags: ['Admin - PreOrders'],
  summary: '智慧推薦接續 GK 貨號',
  responses: {
    200: {
      description: '推薦接續 GK 貨號',
      content: {
        'application/json': {
          schema: makeSuccessResponseSchema(z.object({ suggestedId: z.string() })),
        },
      },
    },
  },
});

// 建立廠商預購單
const createPreOrderRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Admin - PreOrders'],
  summary: '建立廠商預購單',
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreatePreOrderPayloadSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: '預購單建立成功',
      content: {
        'application/json': {
          schema: makeSuccessResponseSchema(z.any()),
        },
      },
    },
    400: {
      description: '建立失敗',
      content: {
        'application/json': {
          schema: StandardErrorResponseSchema,
        },
      },
    },
  },
});

// 補款驗收入庫 (防撞號原子建立 Product 與 StoreInventory 門市現貨)
const receivePreOrderRoute = createRoute({
  method: 'post',
  path: '/:id/receive',
  tags: ['Admin - PreOrders'],
  summary: '預購單補款驗收入庫',
  request: {
    params: z.object({
      id: z.string().min(1),
    }),
    body: {
      content: {
        'application/json': {
          schema: ReceivePreOrderPayloadSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: '驗收入庫成功',
      content: {
        'application/json': {
          schema: makeSuccessResponseSchema(z.any()),
        },
      },
    },
    400: {
      description: '驗收失敗',
      content: {
        'application/json': {
          schema: StandardErrorResponseSchema,
        },
      },
    },
  },
});

// 取消預購單
const cancelPreOrderRoute = createRoute({
  method: 'post',
  path: '/:id/cancel',
  tags: ['Admin - PreOrders'],
  summary: '取消預購單',
  request: {
    params: z.object({
      id: z.string().min(1),
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            reason: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: '取消成功',
      content: {
        'application/json': {
          schema: makeSuccessResponseSchema(z.any()),
        },
      },
    },
    404: {
      description: '預購單不存在',
      content: {
        'application/json': {
          schema: StandardErrorResponseSchema,
        },
      },
    },
    400: {
      description: '取消失敗',
      content: {
        'application/json': {
          schema: StandardErrorResponseSchema,
        },
      },
    },
  },
});

export const preordersRouter = createRouter()
  .openapi(listPreOrdersRoute, async (c) => {
    const services = getServices(c);
    const { status } = c.req.valid('query');

    const items = await services.repos.preOrder.list(status as any);

    return c.json({
      success: true as const,
      data: items as any,
      traceId: c.get('traceId'),
    });
  })
  .openapi(suggestNextGkIdRoute, async (c) => {
    const services = getServices(c);
    const result = await services.useCases.preOrder.suggestNextGkId();

    if (result.success) {
      return c.json({
        success: true as const,
        data: { suggestedId: result.data },
        traceId: c.get('traceId'),
      });
    }

    return handleResult(c, result);
  })
  .openapi(createPreOrderRoute, async (c) => {
    const services = getServices(c);
    const body = c.req.valid('json');

    const result = await services.useCases.preOrder.createPreOrder({
      name: body.name,
      version: body.version,
      quantity: body.quantity,
      deposit: body.deposit,
      supplier: body.supplier,
      targetStoreId: body.targetStoreId || services.tenant.storeId,
      note: body.note,
    });

    return handleResult(c, result, 201);
  })
  .openapi(receivePreOrderRoute, async (c) => {
    const services = getServices(c);
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');

    const result = await services.useCases.preOrder.receivePreOrder(id, {
      productId: body.productId,
      finalPayment: body.finalPayment,
      shippingFee: body.shippingFee,
      sellingPrice: body.sellingPrice,
      targetStoreId: body.targetStoreId,
      operator: body.operator,
    });

    return handleResult(c, result, 200);
  })
  .openapi(cancelPreOrderRoute, async (c) => {
    const services = getServices(c);
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');

    const preOrder = await services.repos.preOrder.findById(id);
    if (!preOrder) {
      return c.json(
        {
          success: false as const,
          error: {
            code: 'NOT_FOUND',
            message: `找不到預購單: ${id}`,
          },
          traceId: c.get('traceId'),
        },
        404
      );
    }

    preOrder.cancel(body.reason);
    await services.repos.preOrder.save(preOrder);

    return c.json(
      {
        success: true as const,
        data: preOrder as any,
        traceId: c.get('traceId'),
      },
      200
    );
  });
