import { createRoute, z } from '@hono/zod-openapi';
import {
  OpenSessionPayloadSchema,
  CloseSessionPayloadSchema,
  StandardErrorResponseSchema,
  makeSuccessResponseSchema,
} from '@onesoul/shared';
import { createRouter } from '../common';
import { getServices, handleResult } from '../../di/container';

// 查詢當前門市開啟中之收銀班次
const getCurrentSessionRoute = createRoute({
  method: 'get',
  path: '/current',
  tags: ['Sessions'],
  summary: '查詢當前開啟中之收銀班次',
  responses: {
    200: {
      description: '當前開啟中之收銀班次明細',
      content: {
        'application/json': {
          schema: makeSuccessResponseSchema(z.any()),
        },
      },
    },
  },
});

// 快速檢查門市是否有收銀班次開啟中
const getActiveSessionRoute = createRoute({
  method: 'get',
  path: '/active',
  tags: ['Sessions'],
  summary: '快速檢查門市是否有收銀班次進行中',
  responses: {
    200: {
      description: '是否有活躍收銀班次',
      content: {
        'application/json': {
          schema: makeSuccessResponseSchema(
            z.object({
              active: z.boolean(),
              sessionId: z.string().nullable().optional(),
            })
          ),
        },
      },
    },
  },
});

// POS 收銀開班 (輸入零錢備金開箱)
const openSessionRoute = createRoute({
  method: 'post',
  path: '/open',
  tags: ['Sessions'],
  summary: 'POS 開啟收銀班次',
  request: {
    body: {
      content: {
        'application/json': {
          schema: OpenSessionPayloadSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: '收銀班次開啟成功',
      content: {
        'application/json': {
          schema: makeSuccessResponseSchema(z.any()),
        },
      },
    },
    400: {
      description: '開班失敗（例如已有開啟中之收銀班次）',
      content: {
        'application/json': {
          schema: StandardErrorResponseSchema,
        },
      },
    },
  },
});

// POS 收銀交班關帳 (實盤現金、溢短計算、固化 Z-Report 快照)
const closeSessionRoute = createRoute({
  method: 'post',
  path: '/close',
  tags: ['Sessions'],
  summary: 'POS 結束收銀班次與日結關帳',
  request: {
    body: {
      content: {
        'application/json': {
          schema: CloseSessionPayloadSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: '收銀班次關帳成功，固化日結關帳報表快照',
      content: {
        'application/json': {
          schema: makeSuccessResponseSchema(z.any()),
        },
      },
    },
    400: {
      description: '關帳失敗（例如無進行中之收銀班次）',
      content: {
        'application/json': {
          schema: StandardErrorResponseSchema,
        },
      },
    },
  },
});

// 查詢歷史收銀班次清單
const listSessionsRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Sessions'],
  summary: '查詢門市歷史收銀班次清單',
  responses: {
    200: {
      description: '收銀班次列表',
      content: {
        'application/json': {
          schema: makeSuccessResponseSchema(z.array(z.any())),
        },
      },
    },
  },
});

export const sessionsRouter = createRouter()
  .openapi(getCurrentSessionRoute, async (c) => {
    const services = getServices(c);
    const session = await services.repos.session.findActiveByStore(services.tenant.storeId);

    return c.json({
      success: true as const,
      data: session ? (session as any) : null,
      traceId: c.get('traceId'),
    });
  })
  .openapi(getActiveSessionRoute, async (c) => {
    const services = getServices(c);
    const session = await services.repos.session.findActiveByStore(services.tenant.storeId);

    return c.json({
      success: true as const,
      data: {
        active: !!session,
        sessionId: session ? session.id : null,
      },
      traceId: c.get('traceId'),
    });
  })
  .openapi(openSessionRoute, async (c) => {
    const services = getServices(c);
    const body = c.req.valid('json');

    const result = await services.useCases.session.openSession({
      storeId: services.tenant.storeId,
      openedBy: body.openedBy,
      openingCash: body.openingCash,
    });

    return handleResult(c, result, 201);
  })
  .openapi(closeSessionRoute, async (c) => {
    const services = getServices(c);
    const body = c.req.valid('json');

    const active = await services.repos.session.findActiveByStore(services.tenant.storeId);
    if (!active) {
      return c.json(
        {
          success: false as const,
          error: {
            code: 'NOT_FOUND',
            message: '當前門市無進行中之收銀班次，無法執行關帳日結。',
          },
          traceId: c.get('traceId'),
        },
        400
      );
    }

    const result = await services.useCases.session.closeSession({
      sessionId: active.id,
      actualCash: body.actualCash,
      closedBy: body.closedBy,
      note: body.note,
    });

    return handleResult(c, result, 200);
  })
  .openapi(listSessionsRoute, async (c) => {
    const services = getServices(c);
    const active = await services.repos.session.findActiveByStore(services.tenant.storeId);
    const items = active ? [active] : [];

    return c.json({
      success: true as const,
      data: items as any,
      traceId: c.get('traceId'),
    });
  });
