import { createRoute, z } from '@hono/zod-openapi';
import {
  CreateStocktakePayloadSchema,
  PostStocktakePayloadSchema,
  StandardErrorResponseSchema,
  makeSuccessResponseSchema,
} from '@onesoul/shared';
import { createRouter } from '../common';
import { getServices, handleResult } from '../../di/container';

// 取得門市實盤盤點清單 (載入系統帳面門市現貨)
const getChecklistRoute = createRoute({
  method: 'get',
  path: '/checklist',
  tags: ['Stocktakes'],
  summary: '產出門市現況門市實盤檢查清單',
  responses: {
    200: {
      description: '門市實盤檢查清單',
      content: {
        'application/json': {
          schema: makeSuccessResponseSchema(z.array(z.any())),
        },
      },
    },
  },
});

// 提交門市實盤草稿 (店員盲盤、差額比對)
const createStocktakeRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Stocktakes'],
  summary: '提交門市實盤草稿',
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateStocktakePayloadSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: '門市實盤草稿建立成功',
      content: {
        'application/json': {
          schema: makeSuccessResponseSchema(z.any()),
        },
      },
    },
    400: {
      description: '參數驗證失敗',
      content: {
        'application/json': {
          schema: StandardErrorResponseSchema,
        },
      },
    },
  },
});

// 審核過帳門市實盤 (原子修正門市現貨)
const postStocktakeRoute = createRoute({
  method: 'post',
  path: '/:id/post',
  tags: ['Stocktakes'],
  summary: '審核過帳門市實盤',
  request: {
    params: z.object({
      id: z.string().min(1),
    }),
    body: {
      content: {
        'application/json': {
          schema: PostStocktakePayloadSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: '門市實盤過帳成功',
      content: {
        'application/json': {
          schema: makeSuccessResponseSchema(z.any()),
        },
      },
    },
    400: {
      description: '過帳失敗',
      content: {
        'application/json': {
          schema: StandardErrorResponseSchema,
        },
      },
    },
  },
});

// 查詢門市實盤歷史清單
const listStocktakesRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Stocktakes'],
  summary: '查詢門市實盤記錄清單',
  responses: {
    200: {
      description: '門市實盤清單',
      content: {
        'application/json': {
          schema: makeSuccessResponseSchema(z.array(z.any())),
        },
      },
    },
  },
});

// 查詢單筆門市實盤明細
const getStocktakeRoute = createRoute({
  method: 'get',
  path: '/:id',
  tags: ['Stocktakes'],
  summary: '查詢單筆門市實盤明細與品項',
  request: {
    params: z.object({
      id: z.string().min(1),
    }),
  },
  responses: {
    200: {
      description: '門市實盤明細',
      content: {
        'application/json': {
          schema: makeSuccessResponseSchema(z.any()),
        },
      },
    },
    404: {
      description: '門市實盤不存在',
      content: {
        'application/json': {
          schema: StandardErrorResponseSchema,
        },
      },
    },
  },
});

export const stocktakesRouter = createRouter()
  .openapi(getChecklistRoute, async (c) => {
    const services = getServices(c);
    const stocks = await services.repos.inventory.findAllByStore(services.tenant.storeId);
    const products = await services.repos.inventory.findAllProducts();
    const productMap = new Map(products.map((p) => [p.id, p]));

    const checklist = stocks.map((s) => {
      const prod = productMap.get(s.productId);
      return {
        productId: s.productId,
        productName: prod ? prod.name : s.productId,
        category: prod ? prod.category : 'OTHER',
        systemQty: s.quantity,
        actualQty: s.quantity,
      };
    });

    return c.json({
      success: true as const,
      data: checklist,
      traceId: c.get('traceId'),
    });
  })
  .openapi(createStocktakeRoute, async (c) => {
    const services = getServices(c);
    const body = c.req.valid('json');

    const result = await services.useCases.inventory.createStocktakeDraft({
      storeId: services.tenant.storeId,
      countedBy: body.countedBy,
      note: body.note,
      items: body.items.map((it) => ({
        productId: it.productId,
        actualQty: it.actualQty,
        remark: it.itemRemark,
      })),
    });

    return handleResult(c, result, 201);
  })
  .openapi(postStocktakeRoute, async (c) => {
    const services = getServices(c);
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');

    const result = await services.useCases.inventory.postStocktake(id, body.postedBy);
    return handleResult(c, result, 200);
  })
  .openapi(listStocktakesRoute, async (c) => {
    const services = getServices(c);
    const items = await services.repos.stocktake.listByStore(services.tenant.storeId);

    return c.json({
      success: true as const,
      data: items as any,
      traceId: c.get('traceId'),
    });
  })
  .openapi(getStocktakeRoute, async (c) => {
    const services = getServices(c);
    const { id } = c.req.valid('param');

    const stocktake = await services.repos.stocktake.findById(id);
    if (!stocktake) {
      return c.json(
        {
          success: false as const,
          error: {
            code: 'NOT_FOUND',
            message: `找不到門市實盤: ${id}`,
          },
          traceId: c.get('traceId'),
        },
        404
      );
    }

    const items = await services.repos.stocktake.findItemsByStocktakeId(id);

    return c.json(
      {
        success: true as const,
        data: {
          ...(stocktake as any),
          items: items as any,
        },
        traceId: c.get('traceId'),
      },
      200
    );
  });
