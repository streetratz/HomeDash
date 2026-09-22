/**
 * T041 (US1): Integration tests for first-run gating.
 *
 * Scenarios:
 * - 0 users in DB → POST /api/first-run/admin creates admin and returns session.
 * - Invalid request body → 422 (validated BEFORE user-count check).
 * - >=1 users in DB → returns 409 FIRST_RUN_COMPLETE.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, extractCookies, type TestApp } from '../helpers/http.js';
import { SESSION_COOKIE_NAME } from '../../src/auth/sessionStore.js';

// ─── Validation tests (no users needed) ──────────────────────────────────────

describe('POST /api/first-run/admin — validation (no users)', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('returns 422 for invalid username (empty string)', async () => {
    const res = await testApp.request
      .post('/api/first-run/admin')
      .send({ username: '', displayName: 'Admin', password: 'securepassword123' })
      .set('Content-Type', 'application/json');
    expect(res.status).toBe(422);
  });

  it('returns 422 for too-short password', async () => {
    const res = await testApp.request
      .post('/api/first-run/admin')
      .send({ username: 'admin', displayName: 'Admin', password: 'short' })
      .set('Content-Type', 'application/json');
    expect(res.status).toBe(422);
  });

  it('returns 422 for missing fields', async () => {
    const res = await testApp.request
      .post('/api/first-run/admin')
      .send({})
      .set('Content-Type', 'application/json');
    expect(res.status).toBe(422);
  });
});

// ─── Happy path + 409 gating ─────────────────────────────────────────────────

describe('POST /api/first-run/admin — happy path and gating', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('succeeds with 201 and sets session cookie when no users exist', async () => {
    const res = await testApp.request
      .post('/api/first-run/admin')
      .send({ username: 'admin', displayName: 'Admin User', password: 'securepassword123' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('user');
    expect(res.body.user).toMatchObject({
      username: 'admin',
      displayName: 'Admin User',
      role: 'admin',
    });
    expect(res.body.user).toHaveProperty('id');
    expect(typeof res.body.user.id).toBe('string');
    expect(res.body).toHaveProperty('csrfToken');
    expect(typeof res.body.csrfToken).toBe('string');

    // Verify session cookie is set
    const cookies = extractCookies(res.headers);
    expect(cookies).toContain(SESSION_COOKIE_NAME);
  });

  it('returns 409 when a user already exists', async () => {
    // Admin was already created in the previous test in this block
    const res = await testApp.request
      .post('/api/first-run/admin')
      .send({ username: 'admin2', displayName: 'Another', password: 'securepassword456' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('FIRST_RUN_COMPLETE');
  });
});

