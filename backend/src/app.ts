import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import { config } from './config';
import { prisma } from './plugins/prisma';
import { storeRoutes } from './modules/stores/routes';
import { memberRoutes } from './modules/members/routes';
import { productRoutes } from './modules/products/routes';
import { luckyBagRoutes } from './modules/luckybags/routes';
import { sessionRoutes } from './modules/sessions/routes';
import { orderRoutes } from './modules/orders/routes';
import { stocktakeRoutes } from './modules/stocktakes/routes';
import { operationRoutes } from './modules/operations/routes';
import { notificationRoutes } from './modules/notifications/routes';
import { dashboardRoutes } from './modules/dashboard/routes';
import { adminPlugin } from './modules/admin';

export function buildApp(): FastifyInstance {
  const app = Fastify({
    bodyLimit: 10 * 1024 * 1024, // 10MB: 容納 Base64 編碼後的自訂品牌 Logo (<= 2MB 原圖約 2.7MB)
    logger: {
      level: config.NODE_ENV === 'production' ? 'info' : 'debug',
      // MASVS-STORAGE / PII: 日誌全面脫敏防護，禁止印出電話、Token 等敏感個資
      redact: [
        'req.headers.authorization',
        'req.headers["x-caller-email"]',
        'body.password',
        'body.token',
        'body.customer.phone',
        'body.phone',
      ],
    },
    trustProxy: true,
  });

  // 安全外掛
  app.register(sensible);

  // MASVS-NETWORK: 嚴格安全標頭防護
  app.register(helmet, {
    contentSecurityPolicy: false, // 供 API 模式使用
  });

  // MASVS-NETWORK: CORS 白名單隔離
  app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:[0-9]+)?$/.test(origin);
      const isAllowed =
        isLocalhost ||
        config.corsOriginsList.some(
          (allowed) => origin === allowed
        );
      if (isAllowed) {
        cb(null, true);
      } else {
        cb(null, false);
      }
    },
    credentials: true,
  });

  // MASVS-NETWORK: 速率限制防護 (Rate Limiting)
  app.register(rateLimit, {
    max: 120,
    timeWindow: '1 minute',
  });

  // 系統健康檢查與後端介面
  app.register(dashboardRoutes);
  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // 註冊 v1 業務路由
  app.register(storeRoutes, { prefix: '/api/v1/stores' });
  app.register(memberRoutes, { prefix: '/api/v1/members' });
  app.register(productRoutes, { prefix: '/api/v1/products' });
  app.register(luckyBagRoutes, { prefix: '/api/v1/luckybags' });
  app.register(sessionRoutes, { prefix: '/api/v1/sessions' });
  app.register(orderRoutes, { prefix: '/api/v1/orders' });
  app.register(stocktakeRoutes, { prefix: '/api/v1/stocktakes' });
  app.register(operationRoutes, { prefix: '/api/v1/operations' });
  app.register(notificationRoutes, { prefix: '/api/v1/notifications' });

  // 公開業務路由：取得店家品牌與 Logo 資訊 (供 POS 前台、顧客端或未登入頁面展示)
  app.get('/api/v1/brand', async (_request, reply) => {
    const brandConfig = await prisma.integrationConfig.findUnique({
      where: { key: 'STORE_BRAND_INFO' },
    });

    const defaultBrand = {
      brandName: 'OneSoul 模型玩具一番賞',
      brandSubtitle: '門市管理與即時營運系統',
      logoText: 'OS',
      supportPhone: '0912-345-678',
      blindBoxPointsValue: 10,
      pointRateTwd: 20,
      smallPrizePointsValue: 1,
      logoHorizontal: null as string | null,
      logoSquare: null as string | null,
    };

    let brandData = { ...defaultBrand };
    if (brandConfig?.value) {
      try {
        const parsed = typeof brandConfig.value === 'string'
          ? JSON.parse(brandConfig.value)
          : (brandConfig.value as any);
        brandData = { ...defaultBrand, ...parsed };
      } catch {
        brandData = { ...defaultBrand };
      }
    }

    const defaultHorizontal = '/logo-horizontal.png';
    const defaultSquare = '/logo-square.png';

    return reply.send({
      success: true,
      data: {
        brandName: brandData.brandName,
        brandSubtitle: brandData.brandSubtitle,
        logoText: brandData.logoText,
        supportPhone: brandData.supportPhone,
        blindBoxPointsValue: brandData.blindBoxPointsValue,
        pointRateTwd: brandData.pointRateTwd,
        smallPrizePointsValue: brandData.smallPrizePointsValue,
        logoHorizontal: brandData.logoHorizontal || defaultHorizontal,
        logoSquare: brandData.logoSquare || defaultSquare,
        hasCustomHorizontalLogo: !!brandData.logoHorizontal,
        hasCustomSquareLogo: !!brandData.logoSquare,
        defaultLogos: {
          horizontal: defaultHorizontal,
          square: defaultSquare,
        },
      },
    });
  });

  // 註冊 Admin ERP 旗艦後台專屬管理路由
  app.register(adminPlugin, { prefix: '/api/admin' });

  return app;
}
