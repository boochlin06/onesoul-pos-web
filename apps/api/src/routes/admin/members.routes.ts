import { createRoute, z } from '@hono/zod-openapi';
import {
  AdjustPointsPayloadSchema,
  StandardErrorResponseSchema,
  makeSuccessResponseSchema,
} from '@onesoul/shared';
import { createRouter } from '../common';
import { getServices, handleResult } from '../../di/container';

// 手動調整會員點數
const adjustPointsRoute = createRoute({
  method: 'post',
  path: '/:id/adjust-points',
  tags: ['Admin - Members'],
  summary: '手動調整會員點數',
  description: '行級鎖保護、強制填寫原因與記錄複式記帳日誌與不可變審計日誌。',
  request: {
    params: z.object({
      id: z.string().min(1),
    }),
    body: {
      content: {
        'application/json': {
          schema: AdjustPointsPayloadSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: '點數調整成功',
      content: {
        'application/json': {
          schema: makeSuccessResponseSchema(z.any()),
        },
      },
    },
    400: {
      description: '調整失敗',
      content: {
        'application/json': {
          schema: StandardErrorResponseSchema,
        },
      },
    },
  },
});

export const adminMembersRouter = createRouter()
  .openapi(adjustPointsRoute, async (c) => {
    const services = getServices(c);
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');

    const operator = body.operator || c.get('callerEmail') || 'admin@onesoul.com';
    const result = await services.useCases.member.adjustPoints({
      memberId: id,
      delta: body.delta,
      reason: body.reason,
      operator,
    });

    return handleResult(c, result, 200);
  });
