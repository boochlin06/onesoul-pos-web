import { OpenAPIHono, z } from '@hono/zod-openapi';
import type { AppContext } from '../types/env';
import { StandardErrorResponseSchema, makeSuccessResponseSchema } from '@onesoul/shared';

export function createRouter() {
  return new OpenAPIHono<AppContext>({
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: '請求參數格式驗證失敗',
              details: result.error.flatten(),
            },
            traceId: c.get('traceId'),
          },
          400
        );
      }
      return;
    },
  });
}

export { StandardErrorResponseSchema, makeSuccessResponseSchema, z };
