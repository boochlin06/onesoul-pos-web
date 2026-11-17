import { createRoute, z } from '@hono/zod-openapi';
import {
  StandardErrorResponseSchema,
  makeSuccessResponseSchema,
} from '@onesoul/shared';
import { createRouter } from '../common';
import { getServices } from '../../di/container';

// 搜尋與列表商品主檔
const listProductsRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Products'],
  summary: '搜尋商品主檔列表',
  request: {
    query: z.object({
      q: z.string().optional(),
      search: z.string().optional(),
      category: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: '商品主檔列表',
      content: {
        'application/json': {
          schema: makeSuccessResponseSchema(z.array(z.any())),
        },
      },
    },
    400: {
      description: '缺少租戶標頭或參數驗證錯誤',
      content: {
        'application/json': {
          schema: StandardErrorResponseSchema,
        },
      },
    },
  },
});

// 查詢門市現貨
const listStoreStocksRoute = createRoute({
  method: 'get',
  path: '/stocks',
  tags: ['Products'],
  summary: '查詢門市現貨矩陣清單',
  request: {
    query: z.object({
      lowStockOnly: z.enum(['true', 'false']).optional(),
    }),
  },
  responses: {
    200: {
      description: '門市現貨清單',
      content: {
        'application/json': {
          schema: makeSuccessResponseSchema(z.array(z.any())),
        },
      },
    },
  },
});

// 查詢盒玩盲盒列表
const listBlindBoxesRoute = createRoute({
  method: 'get',
  path: '/blindboxes',
  tags: ['Products'],
  summary: '查詢盒玩盲盒主檔列表',
  responses: {
    200: {
      description: '盒玩盲盒清單',
      content: {
        'application/json': {
          schema: makeSuccessResponseSchema(z.array(z.any())),
        },
      },
    },
  },
});

// 查詢商品主檔分類清單
const listCategoriesRoute = createRoute({
  method: 'get',
  path: '/categories',
  tags: ['Products'],
  summary: '查詢商品主檔分類清單',
  responses: {
    200: {
      description: '分類清單',
      content: {
        'application/json': {
          schema: makeSuccessResponseSchema(z.array(z.string())),
        },
      },
    },
  },
});

// 依貨號或條碼查詢單一商品主檔
const getProductRoute = createRoute({
  method: 'get',
  path: '/:id',
  tags: ['Products'],
  summary: '依貨號查詢商品主檔明細',
  request: {
    params: z.object({
      id: z.string().min(1),
    }),
  },
  responses: {
    200: {
      description: '商品主檔明細與門市現貨',
      content: {
        'application/json': {
          schema: makeSuccessResponseSchema(z.any()),
        },
      },
    },
    404: {
      description: '商品主檔不存在',
      content: {
        'application/json': {
          schema: StandardErrorResponseSchema,
        },
      },
    },
  },
});

export const productsRouter = createRouter()
  .openapi(listProductsRoute, async (c) => {
    const services = getServices(c);
    const { q, search, category } = c.req.valid('query');

    let products = await services.repos.inventory.findAllProducts();

    const keyword = q || search;
    if (keyword) {
      const query = keyword.toLowerCase();
      products = products.filter(
        (p) =>
          p.id.toLowerCase().includes(query) ||
          p.name.toLowerCase().includes(query) ||
          (p.barcode && p.barcode.toLowerCase().includes(query))
      );
    }

    if (category) {
      products = products.filter((p) => p.category === category);
    }

    return c.json(
      {
        success: true as const,
        data: products as any,
        traceId: c.get('traceId'),
      },
      200
    );
  })
  .openapi(listStoreStocksRoute, async (c) => {
    const services = getServices(c);
    const { lowStockOnly } = c.req.valid('query');

    let stocks = await services.repos.inventory.findAllByStore(services.tenant.storeId);
    if (lowStockOnly === 'true') {
      stocks = stocks.filter((s) => s.quantity <= s.safetyStock);
    }

    return c.json({
      success: true as const,
      data: stocks as any,
      traceId: c.get('traceId'),
    });
  })
  .openapi(listBlindBoxesRoute, async (c) => {
    const services = getServices(c);
    const products = await services.repos.inventory.findAllProducts();
    const blindboxes = products.filter(
      (p) => p.category === 'BLIND_BOX' || (p.category as string) === 'BLINDBOX' || (p.category as string) === '盒玩盲盒'
    );

    return c.json({
      success: true as const,
      data: blindboxes as any,
      traceId: c.get('traceId'),
    });
  })
  .openapi(listCategoriesRoute, async (c) => {
    const services = getServices(c);
    const products = await services.repos.inventory.findAllProducts();
    const categories = Array.from(new Set(products.map((p) => p.category).filter(Boolean)));

    return c.json({
      success: true as const,
      data: categories,
      traceId: c.get('traceId'),
    });
  })
  .openapi(getProductRoute, async (c) => {
    const services = getServices(c);
    const { id } = c.req.valid('param');

    const product = await services.repos.inventory.findProductById(id);
    if (!product) {
      return c.json(
        {
          success: false as const,
          error: {
            code: 'NOT_FOUND',
            message: `找不到商品主檔: ${id}`,
          },
          traceId: c.get('traceId'),
        },
        404
      );
    }

    const stock = await services.repos.inventory.findByStoreAndProduct(
      services.tenant.storeId,
      product.id
    );

    return c.json(
      {
        success: true as const,
        data: {
          ...(product as any),
          storeStock: stock ? (stock as any) : null,
        },
        traceId: c.get('traceId'),
      },
      200
    );
  });
