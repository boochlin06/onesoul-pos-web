import { createRoute, z } from '@hono/zod-openapi';
import {
  makeSuccessResponseSchema,
} from '@onesoul/shared';
import { createRouter } from '../common';
import { getServices } from '../../di/container';

// 取得全域品牌設定
const getBrandSettingsRoute = createRoute({
  method: 'get',
  path: '/brand',
  tags: ['Admin - Settings'],
  summary: '取得全域品牌設定與點數匯率',
  responses: {
    200: {
      description: '品牌設定',
      content: {
        'application/json': {
          schema: makeSuccessResponseSchema(z.any()),
        },
      },
    },
  },
});

// 更新全域品牌設定
const saveBrandSettingsRoute = createRoute({
  method: 'put',
  path: '/brand',
  tags: ['Admin - Settings'],
  summary: '更新全域品牌設定與點數匯率',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            brandName: z.string().min(1),
            brandSubtitle: z.string().optional(),
            logoText: z.string().optional(),
            supportPhone: z.string().optional(),
            blindBoxPointsValue: z.number().int().min(1).default(10),
            pointRateTwd: z.number().int().min(1).default(20),
            smallPrizePointsValue: z.number().int().min(1).default(1),
            logoHorizontal: z.string().nullable().optional(),
            logoSquare: z.string().nullable().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: '更新成功',
      content: {
        'application/json': {
          schema: makeSuccessResponseSchema(z.any()),
        },
      },
    },
  },
});

// 取得外部整合設定
const listIntegrationsRoute = createRoute({
  method: 'get',
  path: '/integrations',
  tags: ['Admin - Settings'],
  summary: '取得外部整合設定清單',
  responses: {
    200: {
      description: '外部整合清單',
      content: {
        'application/json': {
          schema: makeSuccessResponseSchema(z.array(z.any())),
        },
      },
    },
  },
});

// 儲存外部整合設定
const saveIntegrationRoute = createRoute({
  method: 'put',
  path: '/integrations',
  tags: ['Admin - Settings'],
  summary: '更新外部整合設定',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            key: z.string().min(1),
            value: z.record(z.any()),
            description: z.string().optional(),
            isEnabled: z.boolean().default(true),
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

// 查詢緊急廣播公告清單
const listEmergencyNoticesRoute = createRoute({
  method: 'get',
  path: '/emergency-notices',
  tags: ['Admin - Settings'],
  summary: '查詢即時廣播緊急公告',
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

// 發布緊急廣播公告
const publishEmergencyNoticeRoute = createRoute({
  method: 'post',
  path: '/emergency-notices',
  tags: ['Admin - Settings'],
  summary: '發布即時廣播緊急公告',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            title: z.string().min(1),
            content: z.string().min(1),
            level: z.string().default('NORMAL'),
            targetStoreIds: z.array(z.string()).default([]),
            expiresAt: z.string().nullable().optional(),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: '發布成功',
      content: {
        'application/json': {
          schema: makeSuccessResponseSchema(z.any()),
        },
      },
    },
  },
});

// 撤回緊急公告
const deleteEmergencyNoticeRoute = createRoute({
  method: 'delete',
  path: '/emergency-notices/:id',
  tags: ['Admin - Settings'],
  summary: '撤回緊急公告',
  request: {
    params: z.object({
      id: z.string().min(1),
    }),
  },
  responses: {
    200: {
      description: '撤回成功',
      content: {
        'application/json': {
          schema: makeSuccessResponseSchema(z.object({ deleted: z.boolean() })),
        },
      },
    },
  },
});

export const settingsRouter = createRouter()
  .openapi(getBrandSettingsRoute, async (c) => {
    const services = getServices(c);
    const brand = await services.repos.settings.getBrandSettings();

    return c.json({
      success: true as const,
      data: brand,
      traceId: c.get('traceId'),
    });
  })
  .openapi(saveBrandSettingsRoute, async (c) => {
    const services = getServices(c);
    const body = c.req.valid('json');

    const operatorId = c.get('callerEmail') || 'admin@onesoul.com';
    await services.repos.settings.saveBrandSettings(body, operatorId);

    return c.json({
      success: true as const,
      data: body,
      traceId: c.get('traceId'),
    });
  })
  .openapi(listIntegrationsRoute, async (c) => {
    const services = getServices(c);
    const configs = await services.repos.settings.listIntegrationConfigs();

    return c.json({
      success: true as const,
      data: configs,
      traceId: c.get('traceId'),
    });
  })
  .openapi(saveIntegrationRoute, async (c) => {
    const services = getServices(c);
    const body = c.req.valid('json');

    await services.repos.settings.saveIntegrationConfig({
      key: body.key,
      value: body.value,
      description: body.description,
      isEnabled: body.isEnabled,
      updatedBy: c.get('callerEmail') || 'admin@onesoul.com',
    });

    return c.json({
      success: true as const,
      data: body,
      traceId: c.get('traceId'),
    });
  })
  .openapi(listEmergencyNoticesRoute, async (c) => {
    const services = getServices(c);
    const notices = await services.repos.settings.listEmergencyNotices(false);

    return c.json({
      success: true as const,
      data: notices,
      traceId: c.get('traceId'),
    });
  })
  .openapi(publishEmergencyNoticeRoute, async (c) => {
    const services = getServices(c);
    const body = c.req.valid('json');

    const notice = await services.repos.settings.publishEmergencyNotice({
      title: body.title,
      content: body.content,
      level: body.level,
      targetStoreIds: body.targetStoreIds,
      isActive: true,
      publisherEmail: c.get('callerEmail') || 'admin@onesoul.com',
      expiresAt: body.expiresAt,
    });

    return c.json(
      {
        success: true as const,
        data: notice,
        traceId: c.get('traceId'),
      },
      201
    );
  })
  .openapi(deleteEmergencyNoticeRoute, async (c) => {
    const services = getServices(c);
    const { id } = c.req.valid('param');

    await services.repos.settings.withdrawEmergencyNotice(id);

    return c.json({
      success: true as const,
      data: { deleted: true },
      traceId: c.get('traceId'),
    });
  });
