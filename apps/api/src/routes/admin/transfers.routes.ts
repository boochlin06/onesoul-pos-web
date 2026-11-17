import { createRoute, z } from '@hono/zod-openapi';
import {
  CreateTransferPayloadSchema,
  StandardErrorResponseSchema,
  makeSuccessResponseSchema,
} from '@onesoul/shared';
import { createRouter } from '../common';
import { getServices, handleResult } from '../../di/container';

// 建立跨店調撥單 (草稿 DRAFT 狀態)
const createTransferRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Admin - Transfers'],
  summary: '建立跨店調撥單',
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateTransferPayloadSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: '跨店調撥單建立成功',
      content: {
        'application/json': {
          schema: makeSuccessResponseSchema(z.any()),
        },
      },
    },
    400: {
      description: '參數錯誤',
      content: {
        'application/json': {
          schema: StandardErrorResponseSchema,
        },
      },
    },
  },
});

// 查詢跨店調撥單列表
const listTransfersRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Admin - Transfers'],
  summary: '查詢跨店調撥單清單',
  request: {
    query: z.object({
      storeId: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: '跨店調撥單清單',
      content: {
        'application/json': {
          schema: makeSuccessResponseSchema(z.array(z.any())),
        },
      },
    },
  },
});

// 查詢單筆跨店調撥單詳細資訊
const getTransferRoute = createRoute({
  method: 'get',
  path: '/:id',
  tags: ['Admin - Transfers'],
  summary: '查詢單筆跨店調撥單與品項明細',
  request: {
    params: z.object({
      id: z.string().min(1),
    }),
  },
  responses: {
    200: {
      description: '跨店調撥單明細',
      content: {
        'application/json': {
          schema: makeSuccessResponseSchema(z.any()),
        },
      },
    },
    404: {
      description: '跨店調撥單不存在',
      content: {
        'application/json': {
          schema: StandardErrorResponseSchema,
        },
      },
    },
  },
});

// 調撥出庫發貨 (🚨 Invariant #3: 字典序排序商品 ID，原子扣減來源門市現貨)
const dispatchTransferRoute = createRoute({
  method: 'post',
  path: '/:id/dispatch',
  tags: ['Admin - Transfers'],
  summary: '跨店調撥出庫發貨',
  request: {
    params: z.object({
      id: z.string().min(1),
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            operator: z.string().min(1),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: '出庫成功',
      content: {
        'application/json': {
          schema: makeSuccessResponseSchema(z.any()),
        },
      },
    },
    400: {
      description: '出庫失敗',
      content: {
        'application/json': {
          schema: StandardErrorResponseSchema,
        },
      },
    },
  },
});

// 調撥驗收入庫 (DISPATCHED -> RECEIVED，增加目標門市現貨)
const receiveTransferRoute = createRoute({
  method: 'post',
  path: '/:id/receive',
  tags: ['Admin - Transfers'],
  summary: '跨店調撥驗收入庫',
  request: {
    params: z.object({
      id: z.string().min(1),
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            operator: z.string().min(1),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: '驗收成功',
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

// 取消跨店調撥單 (若已出庫則在途門市現貨退回來源門市)
const cancelTransferRoute = createRoute({
  method: 'post',
  path: '/:id/cancel',
  tags: ['Admin - Transfers'],
  summary: '取消跨店調撥單',
  request: {
    params: z.object({
      id: z.string().min(1),
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            operator: z.string().min(1),
            note: z.string().optional(),
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

export const transfersRouter = createRouter()
  .openapi(createTransferRoute, async (c) => {
    const services = getServices(c);
    const body = c.req.valid('json');

    const result = await services.useCases.inventory.createTransfer({
      sourceStoreId: body.sourceStoreId,
      targetStoreId: body.targetStoreId,
      operator: body.dispatchedBy,
      note: body.note,
      items: body.items,
    });

    return handleResult(c, result, 201);
  })
  .openapi(listTransfersRoute, async (c) => {
    const services = getServices(c);
    const { storeId } = c.req.valid('query');

    const targetStore = storeId || services.tenant.storeId;
    const items = await services.repos.transfer.listByStore(targetStore);

    return c.json({
      success: true as const,
      data: items as any,
      traceId: c.get('traceId'),
    });
  })
  .openapi(getTransferRoute, async (c) => {
    const services = getServices(c);
    const { id } = c.req.valid('param');

    let order = await services.repos.transfer.findById(id);
    if (!order) {
      order = await services.repos.transfer.findByTransferNo(id);
    }

    if (!order) {
      return c.json(
        {
          success: false as const,
          error: {
            code: 'NOT_FOUND',
            message: `找不到跨店調撥單: ${id}`,
          },
          traceId: c.get('traceId'),
        },
        404
      );
    }

    const items = await services.repos.transfer.findItemsByTransferId(order.id);

    return c.json(
      {
        success: true as const,
        data: {
          ...(order as any),
          items: items as any,
        },
        traceId: c.get('traceId'),
      },
      200
    );
  })
  .openapi(dispatchTransferRoute, async (c) => {
    const services = getServices(c);
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');

    const result = await services.useCases.inventory.dispatchTransfer(id, body.operator);
    return handleResult(c, result, 200);
  })
  .openapi(receiveTransferRoute, async (c) => {
    const services = getServices(c);
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');

    const result = await services.useCases.inventory.receiveTransfer(id, body.operator);
    return handleResult(c, result, 200);
  })
  .openapi(cancelTransferRoute, async (c) => {
    const services = getServices(c);
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');

    const result = await services.useCases.inventory.cancelTransfer(id, body.operator, body.note);
    return handleResult(c, result, 200);
  });
