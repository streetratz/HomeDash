/**
 * T040 (US1): Contract validation — verifies the OpenAPI spec is syntactically
 * valid and that key declared endpoints exist in the running server.
 *
 * Spec linting is covered by `pnpm openapi:lint`; this test focuses on:
 * 1. Spec file is parseable YAML.
 * 2. Required path declarations exist.
 * 3. Core US1 endpoints respond (not 404) with the declared HTTP methods.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import * as YAML from 'yaml';
import { createTestApp, type TestApp } from '../helpers/http.js';

const OPENAPI_PATH = path.resolve(
  __dirname,
  '../../../specs/001-homelab-dashboard/contracts/openapi.yaml',
);

// ─── Spec file validation ──────────────────────────────────────────────────────

describe('OpenAPI spec file', () => {
  it('exists at expected path', () => {
    expect(fs.existsSync(OPENAPI_PATH)).toBe(true);
  });

  it('is non-empty', () => {
    const content = fs.readFileSync(OPENAPI_PATH, 'utf8');
    expect(content.length).toBeGreaterThan(100);
  });

  it('contains expected path declarations', () => {
    const content = fs.readFileSync(OPENAPI_PATH, 'utf8');
    const requiredPaths = [
      '/api/public/bootstrap',
      '/api/first-run/admin',
      '/api/auth/login',
      '/api/auth/logout',
      '/api/auth/me',
      '/healthz',
      '/readyz',
    ];
    for (const p of requiredPaths) {
      expect(content).toContain(p);
    }
  });

  it('declares expected component schemas', () => {
    const content = fs.readFileSync(OPENAPI_PATH, 'utf8');
    const requiredSchemas = [
      'AuthMe',
      'PublicBootstrap',
      'LoginRequest',
      'FirstRunAdminCreateRequest',
    ];
    for (const s of requiredSchemas) {
      expect(content).toContain(s);
    }
  });
});

// ─── Docker path declarations (043 / FR-025) ─────────────────────────────────

describe('OpenAPI spec — Docker paths', () => {
  interface Operation {
    security?: { cookieAuth?: string[] }[];
    parameters?: ({ $ref?: string; name?: string; in?: string } | undefined)[];
  }
  type Doc = { paths: Record<string, Record<string, Operation>> };

  let doc: Doc;

  beforeAll(() => {
    doc = YAML.parse(fs.readFileSync(OPENAPI_PATH, 'utf8')) as Doc;
  });

  it.each([
    ['/api/docker/hosts', 'get'],
    ['/api/docker/containers', 'get'],
    ['/api/docker/action', 'post'],
    ['/api/admin/connections/docker-links', 'put'],
    ['/api/admin/connections/docker/test', 'post'],
    ['/api/admin/connections/docker/{id}/test', 'post'],
  ])('declares %s %s with cookie auth', (route, method) => {
    const operation = doc.paths[route]?.[method];
    expect(operation, `${method.toUpperCase()} ${route} is not declared`).toBeDefined();
    // Every Docker operation is guarded. A missing `security` block is how
    // #189 looked in the document: the route simply was not described.
    expect(operation!.security).toEqual([{ cookieAuth: [] }]);
  });

  it.each([
    ['/api/docker/action', 'post'],
    ['/api/admin/connections/docker-links', 'put'],
    ['/api/admin/connections/docker/test', 'post'],
    ['/api/admin/connections/docker/{id}/test', 'post'],
  ])('declares the CSRF header on %s %s', (route, method) => {
    const params = doc.paths[route]?.[method]?.parameters ?? [];
    expect(params.some((p) => p?.$ref === '#/components/parameters/CsrfToken')).toBe(true);
  });

  it('does not declare /api/docker/ping — the route no longer exists', () => {
    expect(Object.keys(doc.paths)).not.toContain('/api/docker/ping');
    expect(fs.readFileSync(OPENAPI_PATH, 'utf8')).not.toMatch(/^\s+\/api\/docker\/ping:/m);
  });

  it('does not declare a caller-supplied endpoint parameter on the listing route', () => {
    const params = doc.paths['/api/docker/containers']?.['get']?.parameters ?? [];
    const names = params.map((p) => p?.name);
    expect(names).toContain('widgetInstanceId');
    expect(names).toContain('connectionId');
    expect(names).not.toContain('url');
    expect(names).not.toContain('dockerUrl');
  });
});

// ─── Runtime contract spot-checks ─────────────────────────────────────────────

describe('Runtime contract spot-checks', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('GET /healthz responds 200 (declared in spec)', async () => {
    const res = await testApp.request.get('/healthz');
    expect(res.status).toBe(200);
  });

  it('GET /readyz responds 200 (declared in spec)', async () => {
    const res = await testApp.request.get('/readyz');
    expect(res.status).toBe(200);
  });

  it('GET /api/public/bootstrap responds 200 (declared in spec)', async () => {
    const res = await testApp.request.get('/api/public/bootstrap');
    expect(res.status).toBe(200);
    // Verify required fields from PublicBootstrap schema
    expect(res.body).toHaveProperty('firstRunRequired');
    expect(res.body).toHaveProperty('deviceContext');
    expect(['web', 'mobile']).toContain(res.body.deviceContext);
  });

  it('POST /api/first-run/admin with invalid body responds 422 (declared in spec)', async () => {
    const res = await testApp.request
      .post('/api/first-run/admin')
      .send({ username: '' })
      .set('Content-Type', 'application/json');
    expect([422, 409]).toContain(res.status); // 409 if already seeded with a user
  });

  it('POST /api/auth/login with missing body responds 401 or 422', async () => {
    const res = await testApp.request
      .post('/api/auth/login')
      .send({ username: 'nobody', password: 'wrongpass' })
      .set('Content-Type', 'application/json');
    expect(res.status).toBe(401);
  });

  it('GET /api/auth/me without session responds 401', async () => {
    const res = await testApp.request.get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('POST /api/auth/logout without session responds 401', async () => {
    const res = await testApp.request.post('/api/auth/logout');
    expect(res.status).toBe(401);
  });
});

// ─── Backup & restore endpoint spot-checks ────────────────────────────────────

describe('Backup & restore endpoint spot-checks', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('GET /api/admin/backup without session responds 401', async () => {
    const res = await testApp.request.get('/api/admin/backup');
    expect(res.status).toBe(401);
  });

  it('GET /api/admin/backup/database without session responds 401', async () => {
    const res = await testApp.request.get('/api/admin/backup/database');
    expect(res.status).toBe(401);
  });

  it('POST /api/admin/backup/preview without session responds 401', async () => {
    const res = await testApp.request
      .post('/api/admin/backup/preview')
      .send({})
      .set('Content-Type', 'application/json');
    expect(res.status).toBe(401);
  });

  it('POST /api/admin/backup/restore without session responds 401', async () => {
    const res = await testApp.request
      .post('/api/admin/backup/restore')
      .send({})
      .set('Content-Type', 'application/json');
    expect(res.status).toBe(401);
  });

  it('GET /api/admin/scheduled-jobs without session responds 401', async () => {
    const res = await testApp.request.get('/api/admin/scheduled-jobs');
    expect(res.status).toBe(401);
  });
});
