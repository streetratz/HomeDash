/**
 * T029 (US5): Integration tests for scheduled job CRUD API.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createTestApp,
  extractCookies,
  extractCsrfToken,
  csrfHeader,
  type TestApp,
} from '../helpers/http.js';

async function setupAdminAndLogin(testApp: TestApp) {
  await testApp.request
    .post('/api/first-run/admin')
    .send({ username: 'admin', displayName: 'Admin', password: 'supersecurepass1' })
    .set('Content-Type', 'application/json');

  const loginRes = await testApp.request
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'supersecurepass1' })
    .set('Content-Type', 'application/json');

  return {
    cookie: extractCookies(loginRes.headers),
    csrf: extractCsrfToken(loginRes.body as Record<string, unknown>),
  };
}

describe('Scheduled Jobs API', () => {
  let testApp: TestApp;
  let cookie: string;
  let csrf: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    const session = await setupAdminAndLogin(testApp);
    cookie = session.cookie;
    csrf = session.csrf;
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('GET returns seeded system jobs (at least 3)', async () => {
    const res = await testApp.request
      .get('/api/admin/scheduled-jobs')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    const jobs = (res.body as { jobs: Array<{ name: string; isSystem: number }> }).jobs;
    expect(jobs.length).toBeGreaterThanOrEqual(3);

    const names = jobs.map((j) => j.name);
    expect(names).toContain('Calendar Sync');
    expect(names).toContain('Database Backup');
    expect(names).toContain('Portable Backup');
  });

  it('GET returns 401 for unauthenticated user', async () => {
    const res = await testApp.request.get('/api/admin/scheduled-jobs');
    expect(res.status).toBe(401);
  });

  it('POST creates a job and returns 201', async () => {
    const res = await testApp.request
      .post('/api/admin/scheduled-jobs')
      .set('Cookie', cookie)
      .set(csrfHeader(csrf))
      .set('Content-Type', 'application/json')
      .send({
        name: 'Test Job',
        actionType: 'calendar_sync',
        cronExpression: '0 */6 * * *',
      });

    expect(res.status).toBe(201);
    const body = res.body as { id: string; name: string; actionType: string };
    expect(body.id).toBeDefined();
    expect(body.name).toBe('Test Job');
    expect(body.actionType).toBe('calendar_sync');
  });

  it('POST with invalid cron returns 400/422', async () => {
    const res = await testApp.request
      .post('/api/admin/scheduled-jobs')
      .set('Cookie', cookie)
      .set(csrfHeader(csrf))
      .set('Content-Type', 'application/json')
      .send({
        name: 'Bad Cron Job',
        actionType: 'calendar_sync',
        cronExpression: 'bad',
      });

    expect([400, 422]).toContain(res.status);
  });

  it('POST with empty name returns 400/422', async () => {
    const res = await testApp.request
      .post('/api/admin/scheduled-jobs')
      .set('Cookie', cookie)
      .set(csrfHeader(csrf))
      .set('Content-Type', 'application/json')
      .send({
        name: '',
        actionType: 'calendar_sync',
        cronExpression: '0 */6 * * *',
      });

    expect([400, 422]).toContain(res.status);
  });

  it('PUT on a system job allows toggling enabled', async () => {
    const listRes = await testApp.request
      .get('/api/admin/scheduled-jobs')
      .set('Cookie', cookie);

    const jobs = (listRes.body as { jobs: Array<{ id: string; isSystem: number }> }).jobs;
    const systemJob = jobs.find((j) => j.isSystem === 1);
    expect(systemJob).toBeDefined();

    const res = await testApp.request
      .put(`/api/admin/scheduled-jobs/${systemJob!.id}`)
      .set('Cookie', cookie)
      .set(csrfHeader(csrf))
      .set('Content-Type', 'application/json')
      .send({ enabled: false });

    expect(res.status).toBe(200);
    const body = res.body as { enabled: number };
    expect(body.enabled).toBe(0);
  });

  it('DELETE on a user-created job returns 204', async () => {
    // Create a user job first
    const createRes = await testApp.request
      .post('/api/admin/scheduled-jobs')
      .set('Cookie', cookie)
      .set(csrfHeader(csrf))
      .set('Content-Type', 'application/json')
      .send({
        name: 'Deletable Job',
        actionType: 'calendar_sync',
        cronExpression: '0 */6 * * *',
      });

    const jobId = (createRes.body as { id: string }).id;

    const res = await testApp.request
      .delete(`/api/admin/scheduled-jobs/${jobId}`)
      .set('Cookie', cookie)
      .set(csrfHeader(csrf));

    expect(res.status).toBe(204);
  });

  it('DELETE on a system job returns 403', async () => {
    const listRes = await testApp.request
      .get('/api/admin/scheduled-jobs')
      .set('Cookie', cookie);

    const jobs = (listRes.body as { jobs: Array<{ id: string; isSystem: number }> }).jobs;
    const systemJob = jobs.find((j) => j.isSystem === 1);
    expect(systemJob).toBeDefined();

    const res = await testApp.request
      .delete(`/api/admin/scheduled-jobs/${systemJob!.id}`)
      .set('Cookie', cookie)
      .set(csrfHeader(csrf));

    expect(res.status).toBe(403);
  });
});
