import { createRoute, z } from '@hono/zod-openapi';
import {
  makeSuccessResponseSchema,
  StandardErrorResponseSchema,
} from '@onesoul/shared';
import { createRouter } from '../common';
import { getServices, handleResult } from '../../di/container';

// 查詢當前門市即時戰情 (LIVE X-Report) 與當前收銀班次流水
const getLiveShiftRoute = createRoute({
  method: 'get',
  path: '/live-shift',
  tags: ['Admin - Sessions'],
  summary: '查詢即時戰情與當前收銀班次營收監控',
  request: {
    query: z.object({
      sessionId: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: '即時收銀班次戰情概覽',
      content: {
        'application/json': {
          schema: makeSuccessResponseSchema(z.any()),
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

export const adminSessionsRouter = createRouter()
  .openapi(getLiveShiftRoute, async (c) => {
    const services = getServices(c);
    const { sessionId } = c.req.valid('query');

    let targetSessionId = sessionId;
    if (!targetSessionId) {
      const active = await services.repos.session.findActiveByStore(services.tenant.storeId);
      if (!active) {
        return c.json(
          {
            success: false as const,
            error: {
              code: 'NOT_FOUND',
              message: '當前門市無進行中之收銀班次',
            },
            traceId: c.get('traceId'),
          },
          400
        );
      }
      targetSessionId = active.id;
    }

    const result = await services.useCases.session.getLiveShiftSummary(targetSessionId);
    return handleResult(c, result, 200);
  });
