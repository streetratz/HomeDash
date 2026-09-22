/**
 * T061 (US2): Integration tests for user preferences GET/PUT + CSRF enforcement.
 *
 * Covers:
 * - GET /api/user/preferences returns 401 when not authenticated.
 * - GET /api/user/preferences returns preferences for authenticated user.
 * - PUT /api/user/preferences returns 401 when not authenticated.
 * - PUT /api/user/preferences returns 403 when CSRF token is missing.
 * - PUT /api/user/preferences updates themeMode and returns updated prefs.
 * - PUT /api/user/preferences updates webDashboardId.
 * - PUT /api/user/preferences rejects unknown fields (strict mode).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createTestApp,
  extractCookies,
  extractCsrfToken,
  csrfHeader,
  type TestApp,
} from '../helpers/http.js';

/** One-time admin creation — call from beforeAll only. */
async function setupAdmin(testApp: TestApp) {
  await testApp.request
    .post('/api/first-run/admin')
    .send({ username: 'admin', displayName: 'Admin User', password: 'supersecurepass1' })
    .set('Content-Type', 'application/json');
}

/** Login and return a fresh admin session (call per-test). */
async function loginAdmin(testApp: TestApp) {
  const res = await testApp.request
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'supersecurepass1' })
    .set('Content-Type', 'application/json');

  const sessionCookie = extractCookies(res.headers);
  const csrfToken = extractCsrfToken(res.body as Record<string, unknown>);
  return { sessionCookie, csrfToken };
}

describe('GET /api/user/preferences', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
    await setupAdmin(testApp);
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('returns 401 when not authenticated', async () => {
    const res = await testApp.request.get('/api/user/preferences');
    expect(res.status).toBe(401);
  });

  it('returns preferences for authenticated user', async () => {
    const { sessionCookie } = await loginAdmin(testApp);

    const res = await testApp.request
      .get('/api/user/preferences')
      .set('Cookie', sessionCookie);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      themeMode: 'dark',
      webDashboardId: null,
      mobileDashboardId: null,
    });
  });
});

describe('PUT /api/user/preferences', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
    await setupAdmin(testApp);
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('returns 401 when not authenticated', async () => {
    const res = await testApp.request
      .put('/api/user/preferences')
      .send({ themeMode: 'light' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(401);
  });

  it('returns 403 when CSRF token is missing', async () => {
    const { sessionCookie } = await loginAdmin(testApp);

    const res = await testApp.request
      .put('/api/user/preferences')
      .send({ themeMode: 'light' })
      .set('Content-Type', 'application/json')
      .set('Cookie', sessionCookie);

    expect(res.status).toBe(403);
  });

  it('returns 403 with invalid CSRF token', async () => {
    const { sessionCookie } = await loginAdmin(testApp);

    const res = await testApp.request
      .put('/api/user/preferences')
      .send({ themeMode: 'light' })
      .set('Content-Type', 'application/json')
      .set('Cookie', sessionCookie)
      .set('x-csrf-token', 'invalid-token');

    expect(res.status).toBe(403);
  });

  it('updates themeMode to light', async () => {
    const { sessionCookie, csrfToken } = await loginAdmin(testApp);

    const res = await testApp.request
      .put('/api/user/preferences')
      .send({ themeMode: 'light' })
      .set('Content-Type', 'application/json')
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrfToken));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ themeMode: 'light' });
  });

  it('persists preference change between GET and PUT', async () => {
    const { sessionCookie, csrfToken } = await loginAdmin(testApp);

    // Set to light
    await testApp.request
      .put('/api/user/preferences')
      .send({ themeMode: 'light' })
      .set('Content-Type', 'application/json')
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrfToken));

    // Verify via GET
    const getRes = await testApp.request
      .get('/api/user/preferences')
      .set('Cookie', sessionCookie);

    expect(getRes.status).toBe(200);
    expect(getRes.body.themeMode).toBe('light');

    // Set back to dark
    await testApp.request
      .put('/api/user/preferences')
      .send({ themeMode: 'dark' })
      .set('Content-Type', 'application/json')
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrfToken));

    const getRes2 = await testApp.request
      .get('/api/user/preferences')
      .set('Cookie', sessionCookie);
    expect(getRes2.body.themeMode).toBe('dark');
  });

  it('rejects unknown fields (strict schema)', async () => {
    const { sessionCookie, csrfToken } = await loginAdmin(testApp);

    const res = await testApp.request
      .put('/api/user/preferences')
      .send({ themeMode: 'dark', unknownField: 'bad' })
      .set('Content-Type', 'application/json')
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrfToken));

    expect(res.status).toBe(422);
  });

  it('rejects invalid themeMode values', async () => {
    const { sessionCookie, csrfToken } = await loginAdmin(testApp);

    const res = await testApp.request
      .put('/api/user/preferences')
      .send({ themeMode: 'purple' })
      .set('Content-Type', 'application/json')
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrfToken));

    expect(res.status).toBe(422);
  });

  it('accepts partial update (only themeMode)', async () => {
    const { sessionCookie, csrfToken } = await loginAdmin(testApp);

    const res = await testApp.request
      .put('/api/user/preferences')
      .send({ themeMode: 'light' })
      .set('Content-Type', 'application/json')
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrfToken));

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('themeMode', 'light');
    // mobileDashboardId should still be null
    expect(res.body).toHaveProperty('mobileDashboardId', null);
  });

  it('accepts setting webDashboardId to null', async () => {
    const { sessionCookie, csrfToken } = await loginAdmin(testApp);

    const res = await testApp.request
      .put('/api/user/preferences')
      .send({ webDashboardId: null })
      .set('Content-Type', 'application/json')
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrfToken));

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('webDashboardId', null);
  });
});
