import { createRoute, z } from '@hono/zod-openapi';
import { makeSuccessResponseSchema } from '@onesoul/shared';
import { createRouter } from '../common';
import { getServices } from '../../di/container';

const listNoticesRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Notifications'],
  summary: '查詢門市即時廣播緊急公告',
  responses: {
    200: {
      description: '緊急公告清單',
      content: {
        'application/json': {
          schema: makeSuccessResponseSchema(z.array(z.any())),
        },
      },
    },
  },
});

export const notificationsRouter = createRouter()
  .openapi(listNoticesRoute, async (c) => {
    const services = getServices(c);
    const notices = await services.repos.settings.listEmergencyNotices(true);

    return c.json({
      success: true as const,
      data: notices,
      traceId: c.get('traceId'),
    });
  });
