import { describe, it, expect, beforeEach } from 'vitest';
import { createOneSoulClient } from '../src/client';
import { createTestApp, type TestAppInstance } from './helpers/test-app';

describe('Type-Safe Client RPC Tests (Code-as-Contract)', () => {
  let harness: TestAppInstance;

  beforeEach(() => {
    harness = createTestApp();
  });

  it('使用 createOneSoulClient 呼叫健康檢查端點', async () => {
    const client = createOneSoulClient('http://localhost', {
      fetch: (input, init) => {
        const url = typeof input === 'string' ? input : 'url' in input ? input.url : input.toString();
        const path = new URL(url).pathname;
        return harness.request(path, init, '');
      },
      getStoreId: () => 'chupei',
    });

    const res = await client.health.$get();
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.timestamp).toBeDefined();
  });

  it('Client RPC 自動注入 X-Store-Id 標頭並成功查詢在架一番賞套組清單', async () => {
    const client = createOneSoulClient('http://localhost', {
      fetch: (input, init) => {
        const url = typeof input === 'string' ? input : 'url' in input ? input.url : input.toString();
        const path = new URL(url).pathname;
        return harness.request(path, init, 'chupei');
      },
      getStoreId: () => 'chupei',
    });

    const res = await client.api.v1.luckybags.$get();
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
  });

  it('Client RPC 呼叫商品分類查詢端點', async () => {
    const client = createOneSoulClient('http://localhost', {
      fetch: (input, init) => {
        const url = typeof input === 'string' ? input : 'url' in input ? input.url : input.toString();
        const path = new URL(url).pathname;
        return harness.request(path, init, 'chupei');
      },
      getStoreId: () => 'chupei',
    });

    const res = await client.api.v1.products.categories.$get();
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
  });
});
