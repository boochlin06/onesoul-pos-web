import { createRoute, z } from '@hono/zod-openapi';
import { makeSuccessResponseSchema } from '@onesoul/shared';
import { createRouter } from '../common';
import { getServices } from '../../di/container';

const getBrandSettingsRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Brand'],
  summary: '公開取得店家品牌設定與點數匯率',
  responses: {
    200: {
      description: '品牌設定資料',
      content: {
        'application/json': {
          schema: makeSuccessResponseSchema(z.any()),
        },
      },
    },
  },
});

export const brandRouter = createRouter()
  .openapi(getBrandSettingsRoute, async (c) => {
    const services = getServices(c);
    const brand = await services.repos.settings.getBrandSettings();

    return c.json({
      success: true as const,
      data: brand,
      traceId: c.get('traceId'),
    });
  });
