import { createApp } from '../../src/app';
import { createTestD1Database, type TestD1Instance } from '../d1-test-harness';
import type { WorkerEnv } from '../../src/types/env';

export interface TestAppInstance {
  app: ReturnType<typeof createApp>;
  env: WorkerEnv;
  databases: {
    chupei: TestD1Instance;
    jinshan: TestD1Instance;
    warehouse: TestD1Instance;
    coordinator: TestD1Instance;
  };
  request: (path: string, init?: RequestInit, storeId?: string) => Promise<Response>;
}

export function createTestApp(options?: { seedData?: boolean }): TestAppInstance {
  const chupei = createTestD1Database();
  const jinshan = createTestD1Database();
  const warehouse = createTestD1Database();
  const coordinator = createTestD1Database();

  if (options?.seedData !== false) {
    chupei.seedCommonData();
    jinshan.seedCommonData();
    warehouse.seedCommonData();
    coordinator.seedCommonData();
  }

  const env: WorkerEnv = {
    DB_CHUPEI: chupei.d1,
    DB_JINSHAN: jinshan.d1,
    DB_WAREHOUSE: warehouse.d1,
    DB_COORDINATOR: coordinator.d1,
  };

  const app = createApp();

  return {
    app,
    env,
    databases: { chupei, jinshan, warehouse, coordinator },
    request: async (path: string, init?: RequestInit, storeId: string = 'chupei') => {
      const headers = new Headers(init?.headers);
      if (!headers.has('X-Store-Id') && storeId) {
        headers.set('X-Store-Id', storeId);
      }
      return await app.request(path, { ...init, headers }, env);
    },
  };
}
