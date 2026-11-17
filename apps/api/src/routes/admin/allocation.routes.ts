import { createRoute, z } from '@hono/zod-openapi';
import {
  StandardErrorResponseSchema,
  makeSuccessResponseSchema,
} from '@onesoul/shared';
import { createRouter } from '../common';
import { getServices, handleResult } from '../../di/container';
import { PrizeAllocationPlan } from '../../core/entities/LuckyBag';

const LiveStockRadarItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  costPrice: z.number().int(),
  sellingPrice: z.number().int(),
  suggestedPoints: z.number().int(),
  stock: z.number().int(),
  allocatedCount: z.number().int(),
  availableStock: z.number().int(),
  isOverAllocated: z.boolean(),
});

// 查詢門市現貨雷達動態看板 (遵守 Invariant #2)
const getLiveStockRadarRoute = createRoute({
  method: 'get',
  path: '/live-stock',
  tags: ['Admin - Allocation'],
  summary: '配賞現貨雷達即時看板',
  description: '依據在架活躍一番賞套組未抽數動態計算 allocatedCount，可配門市現貨為 max(0, currentQty - allocatedCount)。',
  request: {
    query: z.object({
      category: z.string().optional(),
      minQty: z.coerce.number().optional(),
      q: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: '配賞現貨雷達數據清單',
      content: {
        'application/json': {
          schema: makeSuccessResponseSchema(z.array(LiveStockRadarItemSchema)),
        },
      },
    },
    400: {
      description: '查詢失敗',
      content: {
        'application/json': {
          schema: StandardErrorResponseSchema,
        },
      },
    },
  },
});

// 查詢配賞草稿方案列表
const listPlansRoute = createRoute({
  method: 'get',
  path: '/plans',
  tags: ['Admin - Allocation'],
  summary: '查詢配賞方案草稿清單',
  responses: {
    200: {
      description: '方案草稿清單',
      content: {
        'application/json': {
          schema: makeSuccessResponseSchema(z.array(z.any())),
        },
      },
    },
  },
});

// 查詢單一方案草稿明細
const getPlanRoute = createRoute({
  method: 'get',
  path: '/plans/:id',
  tags: ['Admin - Allocation'],
  summary: '查詢單筆配賞方案草稿',
  request: {
    params: z.object({
      id: z.string().min(1),
    }),
  },
  responses: {
    200: {
      description: '方案草稿明細',
      content: {
        'application/json': {
          schema: makeSuccessResponseSchema(z.any()),
        },
      },
    },
    404: {
      description: '方案不存在',
      content: {
        'application/json': {
          schema: StandardErrorResponseSchema,
        },
      },
    },
  },
});

// 儲存配賞方案草稿
const savePlanRoute = createRoute({
  method: 'post',
  path: '/plans',
  tags: ['Admin - Allocation'],
  summary: '儲存配賞方案草稿',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            id: z.string().optional(),
            name: z.string().min(1),
            totalDraws: z.number().int().min(1),
            price1: z.number().int().default(0),
            price3: z.number().int().default(0),
            price5: z.number().int().default(0),
            price10: z.number().int().default(0),
            isTenPlusOne: z.boolean().default(false),
            targetMargin: z.number().default(0),
            status: z.string().default('DRAFT'),
            items: z.array(
              z.object({
                grade: z.string().min(1),
                name: z.string().min(1),
                draws: z.number().int().min(1),
                productId: z.string().nullable().optional(),
                points: z.number().int().default(0),
                cost: z.number().int().default(0),
              })
            ),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: '儲存成功',
      content: {
        'application/json': {
          schema: makeSuccessResponseSchema(z.any()),
        },
      },
    },
  },
});

// 刪除方案草稿
const deletePlanRoute = createRoute({
  method: 'delete',
  path: '/plans/:id',
  tags: ['Admin - Allocation'],
  summary: '刪除配賞方案草稿',
  request: {
    params: z.object({
      id: z.string().min(1),
    }),
  },
  responses: {
    200: {
      description: '刪除成功',
      content: {
        'application/json': {
          schema: makeSuccessResponseSchema(z.object({ deleted: z.boolean() })),
        },
      },
    },
  },
});

// 發布開套 (🚨 Invariant #2: 嚴禁預扣 StoreInventory 門市現貨)
const publishPlanRoute = createRoute({
  method: 'post',
  path: '/plans/publish',
  tags: ['Admin - Allocation'],
  summary: '發布開套一番賞套組',
  description: '原子建立 LuckyBag 與獎項籤位，嚴禁預扣門市現貨。X賞等價折抵點數注入，Z賞保底點數注入。',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            name: z.string().min(1),
            unitPrice: z.number().int().min(0),
            totalDraws: z.number().int().min(1),
            isPointsSet: z.boolean().default(false),
            batchCount: z.number().int().min(1).default(1),
            blindBoxPoints: z.number().int().default(10),
            smallPrizePoints: z.number().int().default(1),
            items: z.array(
              z.object({
                grade: z.string().min(1),
                name: z.string().min(1),
                draws: z.number().int().min(1),
                productId: z.string().nullable().optional(),
                points: z.number().int().default(0),
                cost: z.number().int().default(0),
                isNonGk: z.boolean().optional(),
              })
            ),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: '開套發布成功',
      content: {
        'application/json': {
          schema: makeSuccessResponseSchema(z.any()),
        },
      },
    },
    400: {
      description: '發布校驗失敗',
      content: {
        'application/json': {
          schema: StandardErrorResponseSchema,
        },
      },
    },
  },
});

export const allocationRouter = createRouter()
  .openapi(getLiveStockRadarRoute, async (c) => {
    const services = getServices(c);
    const query = c.req.valid('query');

    const result = await services.useCases.allocation.calculateLiveStockRadar(
      services.tenant.storeId,
      query
    );

    return handleResult(c, result, 200);
  })
  .openapi(listPlansRoute, async (c) => {
    const services = getServices(c);
    const plans = await services.repos.luckyBag.findPlansByStore(services.tenant.storeId);

    return c.json({
      success: true as const,
      data: plans as any,
      traceId: c.get('traceId'),
    });
  })
  .openapi(getPlanRoute, async (c) => {
    const services = getServices(c);
    const { id } = c.req.valid('param');

    const plan = await services.repos.luckyBag.findPlanById(id);
    if (!plan) {
      return c.json(
        {
          success: false as const,
          error: {
            code: 'NOT_FOUND',
            message: `找不到配賞方案: ${id}`,
          },
          traceId: c.get('traceId'),
        },
        404
      );
    }

    return c.json(
      {
        success: true as const,
        data: plan as any,
        traceId: c.get('traceId'),
      },
      200
    );
  })
  .openapi(savePlanRoute, async (c) => {
    const services = getServices(c);
    const body = c.req.valid('json');

    const planId = body.id || `plan-${Date.now()}`;
    const plan = new PrizeAllocationPlan({
      id: planId,
      storeId: services.tenant.storeId,
      name: body.name,
      status: body.status,
      totalDraws: body.totalDraws,
      unitPrice: body.price1 || 0,
      targetMargin: body.targetMargin,
      items: body.items,
    });

    await services.repos.luckyBag.savePlan(plan);

    return c.json({
      success: true as const,
      data: plan as any,
      traceId: c.get('traceId'),
    });
  })
  .openapi(deletePlanRoute, async (c) => {
    const services = getServices(c);
    const { id } = c.req.valid('param');

    await services.repos.luckyBag.deletePlan(id);

    return c.json({
      success: true as const,
      data: { deleted: true },
      traceId: c.get('traceId'),
    });
  })
  .openapi(publishPlanRoute, async (c) => {
    const services = getServices(c);
    const body = c.req.valid('json');

    const result = await services.useCases.allocation.publishPlan({
      storeId: services.tenant.storeId,
      name: body.name,
      unitPrice: body.unitPrice,
      totalDraws: body.totalDraws,
      isPointsSet: body.isPointsSet,
      batchCount: body.batchCount,
      blindBoxPoints: body.blindBoxPoints,
      items: body.items,
    });

    return handleResult(c, result, 200);
  });
