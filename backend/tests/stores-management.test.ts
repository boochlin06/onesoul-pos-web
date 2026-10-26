import { describe, it, expect, beforeAll } from 'vitest';
import { buildApp } from '../src/app';
import type { FastifyInstance } from 'fastify';

describe('門市主檔管理與自適應擴增 API (Stores & Brand Management)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  it('1. 取得門市主檔清單: 應正確回傳當前門市、isSingleStore 與上限狀態', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/settings/stores',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta.maxStores).toBe(5);
  });

  it('2. 門市擴增限制: 最多允許擴增至 5 間，達到 5 間後再新增應被嚴格阻擋 (400)', async () => {
    // 依序新增至 5 間
    const resInitial = await app.inject({ method: 'GET', url: '/api/admin/settings/stores' });
    const currentCount = resInitial.json().data.length;

    for (let i = currentCount + 1; i <= 5; i++) {
      const resAdd = await app.inject({
        method: 'POST',
        url: '/api/admin/settings/stores',
        payload: {
          name: `測試分店 ${i} 號店`,
          code: `STORE_${i}`,
        },
      });
      expect(resAdd.statusCode).toBe(201);
    }

    // 嘗試新增第 6 間門市，應被拒絕
    const resExceeded = await app.inject({
      method: 'POST',
      url: '/api/admin/settings/stores',
      payload: {
        name: '第 6 間違規超額店鋪',
        code: 'STORE_6',
      },
    });

    expect(resExceeded.statusCode).toBe(400);
    expect(resExceeded.json().message).toContain('上限為 5 間');
  });

  it('3. 店家品牌客製設定: 應可修改店名與副標題，方便推廣給其他店家開箱即用', async () => {
    const brandPayload = {
      brandName: '西門町極限玩具一番賞',
      brandSubtitle: '旗艦門市營運系統',
      logoText: 'XM',
      supportPhone: '02-2345-6789',
    };

    const resPut = await app.inject({
      method: 'PUT',
      url: '/api/admin/settings/brand',
      payload: brandPayload,
    });

    expect(resPut.statusCode).toBe(200);
    expect(resPut.json().data.brandName).toBe('西門町極限玩具一番賞');

    const resGet = await app.inject({
      method: 'GET',
      url: '/api/admin/settings/brand',
    });
    expect(resGet.json().data.brandName).toBe('西門町極限玩具一番賞');
  });

  it('4. 門市刪除保護: 允許刪除分店，但僅剩 1 間門市時應嚴格禁止刪除 (400 防呆)', async () => {
    const listRes = await app.inject({ method: 'GET', url: '/api/admin/settings/stores' });
    const stores = listRes.json().data;

    // 刪除多餘門市直到只剩 1 間
    for (let i = stores.length - 1; i >= 1; i--) {
      const delRes = await app.inject({
        method: 'DELETE',
        url: `/api/admin/settings/stores/${stores[i].id}`,
      });
      expect(delRes.statusCode).toBe(200);
    }

    // 當前僅剩 1 間門市
    const singleRes = await app.inject({ method: 'GET', url: '/api/admin/settings/stores' });
    const remainingStores = singleRes.json().data;
    expect(remainingStores.length).toBe(1);
    expect(singleRes.json().meta.isSingleStore).toBe(true);

    // 嘗試刪除最後僅存門市，應被拒絕
    const delLastRes = await app.inject({
      method: 'DELETE',
      url: `/api/admin/settings/stores/${remainingStores[0].id}`,
    });
    expect(delLastRes.statusCode).toBe(400);
    expect(delLastRes.json().message).toContain('至少保留 1 間主要門市');
  });
});

