import path from 'path';

export default {
  test: {
    globals: true,
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/onesoul_dev?schema=public',
      AUDIT_SECRET: 'onesoul-audit-key-2026',
    },
    include: [path.resolve(__dirname, './**/*.test.ts')],
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      '@backend': path.resolve(__dirname, '../../backend/src'),
    },
  },
};
