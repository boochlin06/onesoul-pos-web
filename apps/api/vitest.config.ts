import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: {
      '@onesoul/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@onesoul/shared/*': path.resolve(__dirname, '../../packages/shared/src/*'),
      '@onesoul/db/schema': path.resolve(__dirname, '../../packages/db/src/schema/index.ts'),
      '@onesoul/db/relations': path.resolve(__dirname, '../../packages/db/src/relations.ts'),
      '@onesoul/db/client': path.resolve(__dirname, '../../packages/db/src/client.ts'),
      '@onesoul/db': path.resolve(__dirname, '../../packages/db/src/index.ts'),
      '@onesoul/db/*': path.resolve(__dirname, '../../packages/db/src/*'),

    },
  },
});
