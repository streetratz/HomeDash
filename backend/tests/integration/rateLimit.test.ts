/**
 * T120 (US1): Integration test — repeated failed logins trigger 429 (rate limit).
 *
 * Note: This test exercises the rate limiting configuration directly.
 * The actual rate limit threshold is 10 attempts per 15 minutes; in tests we
 * verify that exceeding the limit returns 429. Because the rate limiter uses
 * an in-memory store keyed by IP, the test uses many requests in a tight loop.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, type TestApp } from '../helpers/http.js';

describe('Rate limiting — login endpoint', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();

    // Create an admin so the login route is "live" (not gated by first-run)
    await testApp.request
      .post('/api/first-run/admin')
      .send({ username: 'admin', displayName: 'Admin', password: 'strongpassword1' })
      .set('Content-Type', 'application/json');
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('returns 429 after exceeding login rate limit', async () => {
    // The limit is 10 per 15 min; send 12 failed attempts
    const attempts = 12;
    const responses: number[] = [];

    for (let i = 0; i < attempts; i++) {
      const res = await testApp.request
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'wrongpassword' })
        .set('Content-Type', 'application/json');
      responses.push(res.status);
    }

    const has429 = responses.includes(429);
    expect(has429).toBe(true);
  });
});

describe('Rate limiting — first-run endpoint', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('returns 429 after exceeding first-run rate limit', async () => {
    // The limit is 5 per hour; send 7 attempts
    const attempts = 7;
    const responses: number[] = [];

    for (let i = 0; i < attempts; i++) {
      const res = await testApp.request
        .post('/api/first-run/admin')
        .send({ username: `admin${i}`, displayName: 'Admin', password: 'strongpassword1' })
        .set('Content-Type', 'application/json');
      responses.push(res.status);
    }

    const has429 = responses.includes(429);
    expect(has429).toBe(true);
  });
});
