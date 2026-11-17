import { createRoute, z } from '@hono/zod-openapi';
import { createRouter } from './common';
import { v1Routes } from './v1';
import { adminRoutes } from './admin';

const healthRoute = createRoute({
  method: 'get',
  path: '/health',
  tags: ['System'],
  summary: '邊緣閘道健康檢查',
  responses: {
    200: {
      description: '服務健康正常',
      content: {
        'application/json': {
          schema: z.object({
            status: z.literal('ok'),
            timestamp: z.string(),
          }),
        },
      },
    },
  },
});

export const routes = createRouter()
  .openapi(healthRoute, (c) => {
    return c.json({
      status: 'ok' as const,
      timestamp: new Date().toISOString(),
    });
  })
  .route('/api/v1', v1Routes)
  .route('/api/admin', adminRoutes);

export type AppType = typeof routes;
