import { describe, it, expect } from 'vitest';
import { buildApp } from '../../../app';

describe('Admin Migration API Endpoints', () => {
  it('GET /api/admin/migration/status should return current migration state', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/migration/status',
      headers: {
        'x-caller-email': 'admin@onesoul.com',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.status).toBeDefined();
  });

  it('POST /api/admin/migration/run should trigger dry-run migration successfully', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/migration/run',
      headers: {
        'x-caller-email': 'admin@onesoul.com',
      },
      payload: {
        dryRun: true,
        source: 'auto',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.success).toBe(true);
    expect(body.data.jobId).toBeDefined();
  });
});
