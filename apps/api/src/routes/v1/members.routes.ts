import { createRoute, z } from '@hono/zod-openapi';
import {
  CreateMemberSchema,
  StandardErrorResponseSchema,
  makeSuccessResponseSchema,
} from '@onesoul/shared';
import { createRouter } from '../common';
import { getServices, handleResult } from '../../di/container';

// 搜尋會員列表
const searchMembersRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Members'],
  summary: '收銀台快速查詢會員電話清單',
  request: {
    query: z.object({
      q: z.string().optional(),
      search: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: '會員搜尋結果',
      content: {
        'application/json': {
          schema: makeSuccessResponseSchema(z.array(z.any())),
        },
      },
    },
  },
});

// 依電話查詢單一會員明細與點數
const getMemberByPhoneRoute = createRoute({
  method: 'get',
  path: '/:phone',
  tags: ['Members'],
  summary: '依電話號碼查詢會員資訊與點數餘額',
  request: {
    params: z.object({
      phone: z.string().min(1),
    }),
  },
  responses: {
    200: {
      description: '會員詳細資訊',
      content: {
        'application/json': {
          schema: makeSuccessResponseSchema(z.any()),
        },
      },
    },
    404: {
      description: '會員不存在',
      content: {
        'application/json': {
          schema: StandardErrorResponseSchema,
        },
      },
    },
  },
});

// 新增註冊會員 (現場建檔)
const createMemberRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Members'],
  summary: 'POS 現場快速新增會員註冊',
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateMemberSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: '會員建立成功',
      content: {
        'application/json': {
          schema: makeSuccessResponseSchema(z.any()),
        },
      },
    },
    400: {
      description: '散客代碼阻斷或參數無效',
      content: {
        'application/json': {
          schema: StandardErrorResponseSchema,
        },
      },
    },
  },
});

// 查詢會員歷史消費與點數流水
const getMemberHistoryRoute = createRoute({
  method: 'get',
  path: '/:phone/history',
  tags: ['Members'],
  summary: '查詢會員歷史銷售訂單與點數異動流水',
  request: {
    params: z.object({
      phone: z.string().min(1),
    }),
  },
  responses: {
    200: {
      description: '歷史明細',
      content: {
        'application/json': {
          schema: makeSuccessResponseSchema(z.any()),
        },
      },
    },
    404: {
      description: '會員不存在',
      content: {
        'application/json': {
          schema: StandardErrorResponseSchema,
        },
      },
    },
  },
});

export const membersRouter = createRouter()
  .openapi(searchMembersRoute, async (c) => {
    const services = getServices(c);
    const query = c.req.valid('query');
    const keyword = query.q || query.search;

    let members: any[] = [];
    if (keyword) {
      const member = await services.repos.member.findByPhone(keyword);
      if (member) {
        members = [member];
      }
    }

    return c.json({
      success: true as const,
      data: members as any,
      traceId: c.get('traceId'),
    });
  })
  .openapi(getMemberByPhoneRoute, async (c) => {
    const services = getServices(c);
    const { phone } = c.req.valid('param');

    const result = await services.useCases.member.findByPhone(phone);
    return handleResult(c, result, 200);
  })
  .openapi(createMemberRoute, async (c) => {
    const services = getServices(c);
    const body = c.req.valid('json');

    const result = await services.useCases.member.createMember(body);
    return handleResult(c, result, 201);
  })
  .openapi(getMemberHistoryRoute, async (c) => {
    const services = getServices(c);
    const { phone } = c.req.valid('param');

    const result = await services.useCases.member.getMemberHistory(phone);
    return handleResult(c, result, 200);
  });
