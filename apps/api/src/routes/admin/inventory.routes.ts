import { createRoute, z } from '@hono/zod-openapi';
import {
  AdjustStockPayloadSchema,
  StandardErrorResponseSchema,
  makeSuccessResponseSchema,
} from '@onesoul/shared';
import { createRouter } from '../common';
import { getServices, handleResult } from '../../di/container';
import { Product } from '../../core/entities/Product';

// 查詢門市現貨總覽看板
const getInventorySummaryRoute = createRoute({
  method: 'get',
  path: '/summary',
  tags: ['Admin - Inventory'],
  summary: '查詢商品主檔與門市現貨總覽',
  request: {
    query: z.object({
      category: z.string().optional(),
      lowStockOnly: z.enum(['true', 'false']).optional(),
      q: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: '門市現貨總覽',
      content: {
        'application/json': {
          schema: makeSuccessResponseSchema(z.array(z.any())),
        },
      },
    },
  },
});

// 智慧推薦可用貨號
const suggestProductsRoute = createRoute({
  method: 'get',
  path: '/suggest',
  tags: ['Admin - Inventory'],
  summary: '智慧推薦可用商品主檔貨號',
  request: {
    query: z.object({
      q: z.string().optional(),
      prefix: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: '推薦清單',
      content: {
        'application/json': {
          schema: makeSuccessResponseSchema(z.array(z.any())),
        },
      },
    },
  },
});

// 查詢全部分類
const getCategoriesRoute = createRoute({
  method: 'get',
  path: '/categories',
  tags: ['Admin - Inventory'],
  summary: '取得商品主檔全部分類',
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

// 新增單件商品主檔
const createProductRoute = createRoute({
  method: 'post',
  path: '/products',
  tags: ['Admin - Inventory'],
  summary: '新增單件商品主檔',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            id: z.string().min(1),
            name: z.string().min(1),
            category: z.string().min(1),
            costPrice: z.number().int().min(0).default(0),
            sellingPrice: z.number().int().min(0).default(0),
            suggestedPoints: z.number().int().min(0).default(0),
            barcode: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: '商品主檔新增成功',
      content: {
        'application/json': {
          schema: makeSuccessResponseSchema(z.any()),
        },
      },
    },
    400: {
      description: '新增失敗',
      content: {
        'application/json': {
          schema: StandardErrorResponseSchema,
        },
      },
    },
  },
});

// 修改商品主檔
const updateProductRoute = createRoute({
  method: 'put',
  path: '/products/:id',
  tags: ['Admin - Inventory'],
  summary: '修改單件商品主檔資訊',
  request: {
    params: z.object({
      id: z.string().min(1),
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            name: z.string().optional(),
            category: z.string().optional(),
            costPrice: z.number().int().min(0).optional(),
            sellingPrice: z.number().int().min(0).optional(),
            suggestedPoints: z.number().int().min(0).optional(),
            barcode: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: '商品主檔修改成功',
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

// 手動調整門市現貨 (調帳，附強制作業審計日誌)
const adjustStockRoute = createRoute({
  method: 'post',
  path: '/adjust-stock',
  tags: ['Admin - Inventory'],
  summary: '手動門市現貨調帳',
  request: {
    body: {
      content: {
        'application/json': {
          schema: AdjustStockPayloadSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: '門市現貨調整成功',
      content: {
        'application/json': {
          schema: makeSuccessResponseSchema(z.any()),
        },
      },
    },
    400: {
      description: '調帳失敗',
      content: {
        'application/json': {
          schema: StandardErrorResponseSchema,
        },
      },
    },
  },
});

// 批次原地更新商品主檔與現貨
const batchUpdateRoute = createRoute({
  method: 'post',
  path: '/batch-update',
  tags: ['Admin - Inventory'],
  summary: '批次原地更新商品主檔與門市現貨',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            items: z.array(
              z.object({
                id: z.string().min(1),
                name: z.string().optional(),
                sellingPrice: z.number().int().optional(),
                suggestedPoints: z.number().int().optional(),
              })
            ),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: '批次更新成功',
      content: {
        'application/json': {
          schema: makeSuccessResponseSchema(z.object({ updatedCount: z.number() })),
        },
      },
    },
  },
});

export const inventoryRouter = createRouter()
  .openapi(getInventorySummaryRoute, async (c) => {
    const services = getServices(c);
    const { category, lowStockOnly, q } = c.req.valid('query');

    const products = await services.repos.inventory.findAllProducts();
    const stocks = await services.repos.inventory.findAllByStore(services.tenant.storeId);
    const stockMap = new Map(stocks.map((s) => [s.productId, s]));

    let summary = products.map((p) => {
      const s = stockMap.get(p.id);
      const quantity = s ? s.quantity : 0;
      const safetyStock = s ? s.safetyStock : 5;
      const isLowStock = quantity <= safetyStock;
      return {
        id: p.id,
        name: p.name,
        category: p.category,
        costPrice: p.costPrice,
        sellingPrice: p.sellingPrice,
        suggestedPoints: p.suggestedPoints,
        barcode: p.barcode,
        stockQuantity: quantity,
        safetyStock,
        isLowStock,
      };
    });

    if (category) {
      summary = summary.filter((it) => it.category === category);
    }
    if (lowStockOnly === 'true') {
      summary = summary.filter((it) => it.isLowStock);
    }
    if (q) {
      const query = q.toLowerCase();
      summary = summary.filter(
        (it) => it.id.toLowerCase().includes(query) || it.name.toLowerCase().includes(query)
      );
    }

    return c.json({
      success: true as const,
      data: summary,
      traceId: c.get('traceId'),
    });
  })
  .openapi(suggestProductsRoute, async (c) => {
    const services = getServices(c);
    const { q, prefix } = c.req.valid('query');

    let products = await services.repos.inventory.findAllProducts();

    if (prefix) {
      products = products.filter((p) => p.id.startsWith(prefix));
    }
    if (q) {
      const query = q.toLowerCase();
      products = products.filter(
        (p) => p.id.toLowerCase().includes(query) || p.name.toLowerCase().includes(query)
      );
    }

    return c.json({
      success: true as const,
      data: products.slice(0, 20).map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        sellingPrice: p.sellingPrice,
      })),
      traceId: c.get('traceId'),
    });
  })
  .openapi(getCategoriesRoute, async (c) => {
    const services = getServices(c);
    const products = await services.repos.inventory.findAllProducts();
    const categories = Array.from(new Set(products.map((p) => p.category).filter(Boolean)));

    return c.json({
      success: true as const,
      data: categories,
      traceId: c.get('traceId'),
    });
  })
  .openapi(createProductRoute, async (c) => {
    const services = getServices(c);
    const body = c.req.valid('json');

    const existing = await services.repos.inventory.findProductById(body.id);
    if (existing) {
      return c.json(
        {
          success: false as const,
          error: {
            code: 'CONFLICT',
            message: `商品貨號已存在: ${body.id}`,
          },
          traceId: c.get('traceId'),
        },
        400
      );
    }

    const product = new Product({
      id: body.id,
      name: body.name,
      category: body.category as any,
      costPrice: body.costPrice,
      sellingPrice: body.sellingPrice,
      suggestedPoints: body.suggestedPoints,
      barcode: body.barcode,
    });

    await services.repos.inventory.saveProduct(product);

    return c.json(
      {
        success: true as const,
        data: product as any,
        traceId: c.get('traceId'),
      },
      201
    );
  })
  .openapi(updateProductRoute, async (c) => {
    const services = getServices(c);
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');

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

    if (body.name !== undefined) (product as any).name = body.name;
    if (body.category !== undefined) (product as any).category = body.category;
    if (body.costPrice !== undefined) (product as any).costPrice = body.costPrice;
    if (body.sellingPrice !== undefined) (product as any).sellingPrice = body.sellingPrice;
    if (body.suggestedPoints !== undefined) (product as any).suggestedPoints = body.suggestedPoints;
    if (body.barcode !== undefined) (product as any).barcode = body.barcode;

    await services.repos.inventory.saveProduct(product);

    return c.json(
      {
        success: true as const,
        data: product as any,
        traceId: c.get('traceId'),
      },
      200
    );
  })
  .openapi(adjustStockRoute, async (c) => {
    const services = getServices(c);
    const body = c.req.valid('json');

    const operator = body.operator || c.get('callerEmail') || 'admin@onesoul.com';
    const result = await services.useCases.inventory.adjustStock({
      storeId: services.tenant.storeId,
      productId: body.productId,
      delta: body.delta,
      reason: body.reason,
      operator,
    });

    return handleResult(c, result, 200);
  })
  .openapi(batchUpdateRoute, async (c) => {
    const services = getServices(c);
    const body = c.req.valid('json');

    let updatedCount = 0;
    for (const it of body.items) {
      const prod = await services.repos.inventory.findProductById(it.id);
      if (prod) {
        if (it.name !== undefined) (prod as any).name = it.name;
        if (it.sellingPrice !== undefined) (prod as any).sellingPrice = it.sellingPrice;
        if (it.suggestedPoints !== undefined) (prod as any).suggestedPoints = it.suggestedPoints;
        await services.repos.inventory.saveProduct(prod);
        updatedCount++;
      }
    }

    return c.json({
      success: true as const,
      data: { updatedCount },
      traceId: c.get('traceId'),
    });
  });
