/**
 * T030 (US7): Integration tests for POST /api/admin/status-check.
 *
 * Covers:
 * - 401 without auth
 * - 403 without admin role (if non-admin existed — tested as 401 no-session)
 * - 400 on invalid body (empty services, missing url, invalid expectedStatus)
 * - 200 with results array
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createTestApp,
  extractCookies,
  extractCsrfToken,
  csrfHeader,
  type TestApp,
} from '../helpers/http.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function setupAdmin(testApp: TestApp) {
  await testApp.request
    .post('/api/first-run/admin')
    .send({ username: 'admin', displayName: 'Admin', password: 'supersecurepass1' })
    .set('Content-Type', 'application/json');
}

async function loginAdmin(testApp: TestApp) {
  const res = await testApp.request
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'supersecurepass1' })
    .set('Content-Type', 'application/json');
  return {
    sessionCookie: extractCookies(res.headers),
    csrfToken: extractCsrfToken(res.body as Record<string, unknown>),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/admin/status-check', () => {
  let testApp: TestApp;
  let sessionCookie: string;
  let csrfToken: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    await setupAdmin(testApp);
    const creds = await loginAdmin(testApp);
    sessionCookie = creds.sessionCookie;
    csrfToken = creds.csrfToken;
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('returns 401 without auth', async () => {
    const res = await testApp.request
      .post('/api/admin/status-check')
      .send({ services: [] })
      .set('Content-Type', 'application/json');
    expect(res.status).toBe(401);
  });

  it('returns 422 on empty services array', async () => {
    const res = await testApp.request
      .post('/api/admin/status-check')
      .send({ services: [] })
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrfToken))
      .set('Content-Type', 'application/json');
    expect(res.status).toBe(422);
  });

  it('returns 422 on missing url in service entry', async () => {
    const res = await testApp.request
      .post('/api/admin/status-check')
      .send({
        services: [{ name: 'test' }],
      })
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrfToken))
      .set('Content-Type', 'application/json');
    expect(res.status).toBe(422);
  });

  it('returns 422 on invalid expectedStatus', async () => {
    const res = await testApp.request
      .post('/api/admin/status-check')
      .send({
        services: [{ name: 'test', url: 'http://localhost:9999', expectedStatus: 999 }],
      })
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrfToken))
      .set('Content-Type', 'application/json');
    expect(res.status).toBe(422);
  });

  it('returns 200 with results for reachable URL', async () => {
    // Start the server listening so we can make a self-referential health check
    const address = await testApp.app.listen({ port: 0, host: '127.0.0.1' });
    const res = await testApp.request
      .post('/api/admin/status-check')
      .send({
        services: [
          { name: 'self', url: `${address}/healthz`, expectedStatus: 200, timeoutSeconds: 5 },
        ],
      })
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrfToken))
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    const body = res.body as { results: Array<Record<string, unknown>> };
    expect(body.results).toHaveLength(1);
    expect(body.results[0]).toMatchObject({
      name: 'self',
      status: 'up',
    });
    expect(typeof body.results[0]!['responseTimeMs']).toBe('number');
    expect(typeof body.results[0]!['checkedAt']).toBe('string');
  });

  it('returns down status for unreachable URL', async () => {
    const res = await testApp.request
      .post('/api/admin/status-check')
      .send({
        services: [
          { name: 'unreachable', url: 'http://127.0.0.1:1', expectedStatus: 200, timeoutSeconds: 2 },
        ],
      })
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrfToken))
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    const body = res.body as { results: Array<Record<string, unknown>> };
    expect(body.results).toHaveLength(1);
    expect(body.results[0]).toMatchObject({
      name: 'unreachable',
      status: 'down',
    });
    expect(typeof body.results[0]!['error']).toBe('string');
  });

  it('returns down when status code does not match expected', async () => {
    // Server should already be listening from the previous test
    const addr = testApp.app.server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    const baseUrl = `http://127.0.0.1:${port}`;
    const res = await testApp.request
      .post('/api/admin/status-check')
      .send({
        services: [
          { name: 'wrong-status', url: `${baseUrl}/healthz`, expectedStatus: 404, timeoutSeconds: 5 },
        ],
      })
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrfToken))
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    const body = res.body as { results: Array<Record<string, unknown>> };
    expect(body.results[0]).toMatchObject({
      name: 'wrong-status',
      status: 'down',
    });
  });
});
