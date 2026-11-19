import { OpenAPIHono } from '@hono/zod-openapi';
import { swaggerUI } from '@hono/swagger-ui';
import type { AppContext } from './types/env';
import {
  traceMiddleware,
  loggerMiddleware,
  securityMiddleware,
  tenantMiddleware,
  accessAuthMiddleware,
  globalErrorHandler,
  notFoundHandler,
} from './middleware';
import { routes } from './routes';

export function createApp() {
  const app = new OpenAPIHono<AppContext>({
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json(
          {
            success: false as const,
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

  // 1. 全域鏈路追蹤與 Request ID
  app.use('*', traceMiddleware());

  // 2. CORS 與邊緣安全防護標頭
  app.use('*', securityMiddleware());

  // 3. 結構化邊緣日誌 (MASVS-STORAGE 脫敏)
  app.use('*', loggerMiddleware());

  // 4. OpenAPI 3.1 規格端點
  app.doc('/api/doc', {
    openapi: '3.1.0',
    info: {
      title: 'OneSoul Cloudflare Edge API Gateway',
      version: '1.0.0',
      description:
        'OneSoul 模型玩具一番賞門市管理與即時營運系統 - Cloudflare Workers 邊緣閘道與業務路由 (Pure-Stack Architecture)',
    },
    servers: [
      {
        url: '/',
        description: '當前邊緣閘道伺服器',
      },
    ],
  });

  // 5. Swagger UI 控制台
  app.get('/api/docs', swaggerUI({ url: '/api/doc' }));

  // 6. 租戶隔離與後台權限中介層 (管理路由強制優先驗證 Access JWT，通過後再校驗門市租戶)
  app.use('/api/v1/*', tenantMiddleware({ required: true }));
  app.use('/api/admin/*', accessAuthMiddleware());
  app.use('/api/admin/*', tenantMiddleware({ required: true }));

  // 7. 掛載全業務路由
  app.route('/', routes);

  // 8. 全域例外與 404 處理
  app.onError(globalErrorHandler);
  app.notFound(notFoundHandler);

  return app;
}

export const app = createApp();
export default app;
