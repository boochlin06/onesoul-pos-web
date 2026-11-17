import { createRoute, z } from '@hono/zod-openapi';
import {
  VerifyAuditChainResponseSchema,
  makeSuccessResponseSchema,
} from '@onesoul/shared';
import { createRouter } from '../common';
import { getServices } from '../../di/container';

// 查詢審計日誌列表
const queryAuditLogsRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Admin - Audit'],
  summary: '調閱防篡改雜湊鏈審計日誌',
  request: {
    query: z.object({
      limit: z.coerce.number().int().min(1).max(200).default(50),
    }),
  },
  responses: {
    200: {
      description: '不可變審計日誌列表',
      content: {
        'application/json': {
          schema: makeSuccessResponseSchema(z.array(z.any())),
        },
      },
    },
  },
});

// 密碼學驗證審計日誌雜湊鏈之完整性
const verifyAuditChainRoute = createRoute({
  method: 'get',
  path: '/verify',
  tags: ['Admin - Audit'],
  summary: '密碼學驗證審計日誌雜湊鏈之線性完整性',
  responses: {
    200: {
      description: '雜湊鏈檢驗結果',
      content: {
        'application/json': {
          schema: makeSuccessResponseSchema(VerifyAuditChainResponseSchema),
        },
      },
    },
  },
});

export const auditRouter = createRouter()
  .openapi(queryAuditLogsRoute, async (c) => {
    const services = getServices(c);
    const { limit } = c.req.valid('query');

    const logs = await services.repos.audit.list(limit);

    return c.json({
      success: true as const,
      data: logs as any,
      traceId: c.get('traceId'),
    });
  })
  .openapi(verifyAuditChainRoute, async (c) => {
    const services = getServices(c);
    const result = await services.useCases.audit.verifyChain();

    if (result.success) {
      return c.json({
        success: true as const,
        data: {
          valid: result.data.valid,
          totalCount: result.data.totalCount,
          brokenAt: result.data.brokenAt,
          message: result.data.valid ? '審計日誌雜湊鏈完整無損' : '審計日誌雜湊鏈斷裂',
        },
        traceId: c.get('traceId'),
      });
    }

    return c.json({
      success: true as const,
      data: {
        valid: false,
        totalCount: 0,
        brokenAt: 'INITIAL_HASH_ERROR',
        message: '審計日誌驗證失敗',
      },
      traceId: c.get('traceId'),
    });
  });
