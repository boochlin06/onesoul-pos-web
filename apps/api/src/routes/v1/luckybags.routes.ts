import { createRoute, z } from '@hono/zod-openapi';
import {
  StandardErrorResponseSchema,
  makeSuccessResponseSchema,
} from '@onesoul/shared';
import { createRouter } from '../common';
import { getServices } from '../../di/container';

// 查詢門市在架活躍一番賞套組
const listLuckyBagsRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['LuckyBags'],
  summary: '查詢門市在架一番賞套組清單',
  responses: {
    200: {
      description: '在架活躍一番賞套組清單',
      content: {
        'application/json': {
          schema: makeSuccessResponseSchema(z.array(z.any())),
        },
      },
    },
  },
});

// 查詢門市所有在架獎項明細 (供收銀台快速選賞)
const listPrizesRoute = createRoute({
  method: 'get',
  path: '/prizes',
  tags: ['LuckyBags'],
  summary: '查詢在架一番賞獎項庫明細',
  responses: {
    200: {
      description: '獎項明細列表',
      content: {
        'application/json': {
          schema: makeSuccessResponseSchema(z.array(z.any())),
        },
      },
    },
  },
});

// 查詢各一番賞套組抽數統計
const getDrawCountsRoute = createRoute({
  method: 'get',
  path: '/draw-counts',
  tags: ['LuckyBags'],
  summary: '查詢各一番賞套組獎項抽數統計',
  responses: {
    200: {
      description: '抽數統計物件',
      content: {
        'application/json': {
          schema: makeSuccessResponseSchema(z.record(z.number())),
        },
      },
    },
  },
});

// 查詢單一番賞套組明細
const getLuckyBagRoute = createRoute({
  method: 'get',
  path: '/:id',
  tags: ['LuckyBags'],
  summary: '查詢單一番賞套組主檔與獎項明細',
  request: {
    params: z.object({
      id: z.string().min(1),
    }),
  },
  responses: {
    200: {
      description: '一番賞套組主檔與獎項明細',
      content: {
        'application/json': {
          schema: makeSuccessResponseSchema(z.any()),
        },
      },
    },
    404: {
      description: '一番賞套組不存在',
      content: {
        'application/json': {
          schema: StandardErrorResponseSchema,
        },
      },
    },
  },
});

// 下架一番賞套組
const voidLuckyBagRoute = createRoute({
  method: 'delete',
  path: '/:id',
  tags: ['LuckyBags'],
  summary: '下架特定一番賞套組',
  request: {
    params: z.object({
      id: z.string().min(1),
    }),
  },
  responses: {
    200: {
      description: '下架成功',
      content: {
        'application/json': {
          schema: makeSuccessResponseSchema(z.object({ voided: z.boolean(), bagId: z.string() })),
        },
      },
    },
    404: {
      description: '一番賞套組不存在',
      content: {
        'application/json': {
          schema: StandardErrorResponseSchema,
        },
      },
    },
  },
});

export const luckybagsRouter = createRouter()
  .openapi(listLuckyBagsRoute, async (c) => {
    const services = getServices(c);
    const bags = await services.repos.luckyBag.findActiveBagsByStore(services.tenant.storeId);

    return c.json({
      success: true as const,
      data: bags as any,
      traceId: c.get('traceId'),
    });
  })
  .openapi(listPrizesRoute, async (c) => {
    const services = getServices(c);
    const bags = await services.repos.luckyBag.findActiveBagsByStore(services.tenant.storeId);

    const allPrizes: any[] = [];
    for (const bag of bags) {
      const prizes = await services.repos.luckyBag.findPrizesByBagId(bag.id);
      for (const p of prizes) {
        allPrizes.push({
          bagId: bag.id,
          bagName: bag.name,
          unitPrice: bag.unitPrice,
          isPointsSet: bag.isPointsSet,
          prizeId: p.id,
          prizeGrade: p.prizeGrade,
          prizeName: p.prizeName,
          productId: p.productId,
          points: p.points,
          draws: p.draws,
          drawnCount: p.drawnCount,
          remainingDraws: Math.max(0, p.draws - p.drawnCount),
        });
      }
    }

    return c.json({
      success: true as const,
      data: allPrizes,
      traceId: c.get('traceId'),
    });
  })
  .openapi(getDrawCountsRoute, async (c) => {
    const services = getServices(c);
    const bags = await services.repos.luckyBag.findActiveBagsByStore(services.tenant.storeId);

    const counts: Record<string, number> = {};
    for (const bag of bags) {
      const prizes = await services.repos.luckyBag.findPrizesByBagId(bag.id);
      for (const p of prizes) {
        counts[`${bag.id}:${p.prizeGrade}`] = p.drawnCount;
      }
    }

    return c.json({
      success: true as const,
      data: counts,
      traceId: c.get('traceId'),
    });
  })
  .openapi(getLuckyBagRoute, async (c) => {
    const services = getServices(c);
    const { id } = c.req.valid('param');

    const bag = await services.repos.luckyBag.findById(id);
    if (!bag) {
      return c.json(
        {
          success: false as const,
          error: {
            code: 'NOT_FOUND',
            message: `找不到一番賞套組: ${id}`,
          },
          traceId: c.get('traceId'),
        },
        404
      );
    }

    const prizes = await services.repos.luckyBag.findPrizesByBagId(id);

    return c.json(
      {
        success: true as const,
        data: {
          ...(bag as any),
          prizes: prizes as any,
        },
        traceId: c.get('traceId'),
      },
      200
    );
  })
  .openapi(voidLuckyBagRoute, async (c) => {
    const services = getServices(c);
    const { id } = c.req.valid('param');

    const bag = await services.repos.luckyBag.findById(id);
    if (!bag) {
      return c.json(
        {
          success: false as const,
          error: {
            code: 'NOT_FOUND',
            message: `找不到一番賞套組: ${id}`,
          },
          traceId: c.get('traceId'),
        },
        404
      );
    }

    bag.void();
    await services.repos.luckyBag.saveBagWithPrizes(bag, []);

    return c.json(
      {
        success: true as const,
        data: { voided: true, bagId: id },
        traceId: c.get('traceId'),
      },
      200
    );
  });
