/**
 * T121 (US1): Integration tests — GET /api/public/bootstrap.
 *
 * Covers:
 * - Returns 200 with required PublicBootstrap fields.
 * - firstRunRequired is true when no users exist.
 * - firstRunRequired is false when users exist.
 * - dashboard is null when no default has been configured.
 * - Returns correct deviceContext based on User-Agent.
 * - Shell fields match seeded shell settings defaults.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, type TestApp } from '../helpers/http.js';

describe('GET /api/public/bootstrap', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('returns 200', async () => {
    const res = await testApp.request.get('/api/public/bootstrap');
    expect(res.status).toBe(200);
  });

  it('includes firstRunRequired=true when no users exist', async () => {
    const res = await testApp.request.get('/api/public/bootstrap');
    expect(res.body.firstRunRequired).toBe(true);
  });

  it('includes firstRunRequired=false after admin is created', async () => {
    const { request, close } = await createTestApp();

    await request
      .post('/api/first-run/admin')
      .send({ username: 'admin', displayName: 'Admin', password: 'securepass1234' })
      .set('Content-Type', 'application/json');

    const res = await request.get('/api/public/bootstrap');
    expect(res.body.firstRunRequired).toBe(false);

    await close();
  });

  it('includes shell object with required fields', async () => {
    const res = await testApp.request.get('/api/public/bootstrap');
    expect(res.body.shell).toMatchObject({
      titleText: 'HomeDash',
      headerHeightPx: expect.any(Number),
      clockStripEnabled: expect.any(Boolean),
    });
    expect(Array.isArray(res.body.shell.clocks)).toBe(true);
  });

  it('dashboard is null when no public default is configured', async () => {
    const res = await testApp.request.get('/api/public/bootstrap');
    // No admin configured a default dashboard, so it should be null
    expect(res.body.dashboard).toBeNull();
  });

  it('deviceContext is "web" for a desktop user agent', async () => {
    const res = await testApp.request
      .get('/api/public/bootstrap')
      .set('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

    expect(res.body.deviceContext).toBe('web');
  });

  it('deviceContext is "mobile" for a mobile user agent', async () => {
    const res = await testApp.request
      .get('/api/public/bootstrap')
      .set('User-Agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15');

    expect(res.body.deviceContext).toBe('mobile');
  });

  it('response shape has all expected top-level fields', async () => {
    const res = await testApp.request.get('/api/public/bootstrap');
    expect(res.body).toHaveProperty('firstRunRequired');
    expect(res.body).toHaveProperty('shell');
    expect(res.body).toHaveProperty('deviceContext');
    expect(res.body).toHaveProperty('dashboard');
  });
});
