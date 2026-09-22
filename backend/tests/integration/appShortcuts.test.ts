/**
 * Integration tests for App Shortcuts widget CRUD (shortcuts, groups, reorder).
 *
 * Covers:
 * - Shortcut create / list / update / delete
 * - Group create / list / update / delete
 * - Reorder shortcuts & groups
 * - Validation errors (422)
 * - Auth guards (401 / 403)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createTestApp,
  extractCookies,
  extractCsrfToken,
  csrfHeader,
  type TestApp,
} from '../helpers/http.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

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

/** Create a dashboard + placeholder + app_shortcuts widget; return the widget instance ID. */
async function createAppShortcutsWidget(
  testApp: TestApp,
  sessionCookie: string,
  csrfToken: string,
): Promise<string> {
  // 1. Dashboard
  const dashRes = await testApp.request
    .post('/api/admin/dashboards')
    .set('Cookie', sessionCookie)
    .set(csrfHeader(csrfToken))
    .set('Content-Type', 'application/json')
    .send({ name: 'App Shortcuts Test' });
  const dashboardId = (dashRes.body as Record<string, unknown>)['id'] as string;

  // 2. Placeholder
  const phRes = await testApp.request
    .post(`/api/admin/dashboards/${dashboardId}/placeholders`)
    .set('Cookie', sessionCookie)
    .set(csrfHeader(csrfToken))
    .set('Content-Type', 'application/json')
    .send({ x: 0, y: 0, w: 6, h: 4 });
  const placeholderId = (phRes.body as Record<string, unknown>)['id'] as string;

  // 3. Widget
  const wRes = await testApp.request
    .post(`/api/admin/placeholders/${placeholderId}/widgets`)
    .set('Cookie', sessionCookie)
    .set(csrfHeader(csrfToken))
    .set('Content-Type', 'application/json')
    .send({ type: 'app_shortcuts', configJson: '{"columns":4}' });
  return (wRes.body as Record<string, unknown>)['id'] as string;
}

// ── Shortcut CRUD ────────────────────────────────────────────────────────────

describe('App Shortcut CRUD', () => {
  let testApp: TestApp;
  let sessionCookie: string;
  let csrf: string;
  let widgetId: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    await setupAdmin(testApp);
    const auth = await loginAdmin(testApp);
    sessionCookie = auth.sessionCookie;
    csrf = auth.csrfToken;
    widgetId = await createAppShortcutsWidget(testApp, sessionCookie, csrf);
  });

  afterAll(async () => {
    await testApp.close();
  });

  const shortcuts = () => `/api/admin/app-shortcuts/${widgetId}/shortcuts`;
  const shortcut = (id: string) => `${shortcuts()}/${id}`;

  it('GET shortcuts returns empty list initially', async () => {
    const res = await testApp.request
      .get(shortcuts())
      .set('Cookie', sessionCookie);
    expect(res.status).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body['shortcuts']).toEqual([]);
    expect(body['groups']).toEqual([]);
  });

  it('POST creates a shortcut', async () => {
    const res = await testApp.request
      .post(shortcuts())
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrf))
      .set('Content-Type', 'application/json')
      .send({ name: 'Portainer', url: 'https://portainer.local:9443' });
    expect(res.status).toBe(201);
    const body = res.body as Record<string, unknown>;
    expect(body['name']).toBe('Portainer');
    expect(body['url']).toBe('https://portainer.local:9443');
    expect(body['id']).toBeDefined();
    expect(body['orderIndex']).toBe(0);
  });

  it('POST rejects missing name', async () => {
    const res = await testApp.request
      .post(shortcuts())
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrf))
      .set('Content-Type', 'application/json')
      .send({ url: 'https://example.com' });
    expect(res.status).toBe(422);
  });

  it('POST rejects missing url', async () => {
    const res = await testApp.request
      .post(shortcuts())
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrf))
      .set('Content-Type', 'application/json')
      .send({ name: 'No URL' });
    expect(res.status).toBe(422);
  });

  it('GET shortcuts lists created shortcut', async () => {
    const res = await testApp.request
      .get(shortcuts())
      .set('Cookie', sessionCookie);
    expect(res.status).toBe(200);
    const items = (res.body as Record<string, unknown>)['shortcuts'] as unknown[];
    expect(items.length).toBeGreaterThanOrEqual(1);
    const first = items[0] as Record<string, unknown>;
    expect(first['name']).toBe('Portainer');
  });

  it('PUT updates a shortcut', async () => {
    // Create one to update
    const createRes = await testApp.request
      .post(shortcuts())
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrf))
      .set('Content-Type', 'application/json')
      .send({ name: 'Traefik', url: 'https://traefik.local' });
    const id = (createRes.body as Record<string, unknown>)['id'] as string;

    const res = await testApp.request
      .put(shortcut(id))
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrf))
      .set('Content-Type', 'application/json')
      .send({ name: 'Traefik v3', url: 'https://traefik.local:8080' });
    expect(res.status).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body['name']).toBe('Traefik v3');
    expect(body['url']).toBe('https://traefik.local:8080');
  });

  it('DELETE removes a shortcut', async () => {
    const createRes = await testApp.request
      .post(shortcuts())
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrf))
      .set('Content-Type', 'application/json')
      .send({ name: 'DeleteMe', url: 'https://delete.local' });
    const id = (createRes.body as Record<string, unknown>)['id'] as string;

    const res = await testApp.request
      .delete(shortcut(id))
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrf));
    expect(res.status).toBe(204);
  });

  it('DELETE non-existent shortcut returns 404', async () => {
    const res = await testApp.request
      .delete(shortcut('00000000-0000-0000-0000-000000000000'))
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrf));
    expect(res.status).toBe(404);
  });

  it('POST to non-existent widget returns 404', async () => {
    const fakeWidgetId = '00000000-0000-0000-0000-000000000000';
    const res = await testApp.request
      .post(`/api/admin/app-shortcuts/${fakeWidgetId}/shortcuts`)
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrf))
      .set('Content-Type', 'application/json')
      .send({ name: 'X', url: 'https://x.local' });
    expect(res.status).toBe(404);
  });
});

// ── Group CRUD ───────────────────────────────────────────────────────────────

describe('App Shortcut Group CRUD', () => {
  let testApp: TestApp;
  let sessionCookie: string;
  let csrf: string;
  let widgetId: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    await setupAdmin(testApp);
    const auth = await loginAdmin(testApp);
    sessionCookie = auth.sessionCookie;
    csrf = auth.csrfToken;
    widgetId = await createAppShortcutsWidget(testApp, sessionCookie, csrf);
  });

  afterAll(async () => {
    await testApp.close();
  });

  const groups = () => `/api/admin/app-shortcuts/${widgetId}/groups`;
  const group = (id: string) => `${groups()}/${id}`;

  it('GET groups returns empty list initially', async () => {
    const res = await testApp.request
      .get(groups())
      .set('Cookie', sessionCookie);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('POST creates a group', async () => {
    const res = await testApp.request
      .post(groups())
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrf))
      .set('Content-Type', 'application/json')
      .send({ name: 'Media' });
    expect(res.status).toBe(201);
    const body = res.body as Record<string, unknown>;
    expect(body['name']).toBe('Media');
    expect(body['id']).toBeDefined();
    expect(body['orderIndex']).toBe(0);
  });

  it('POST rejects missing name', async () => {
    const res = await testApp.request
      .post(groups())
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrf))
      .set('Content-Type', 'application/json')
      .send({});
    expect(res.status).toBe(422);
  });

  it('POST rejects name exceeding 50 chars', async () => {
    const res = await testApp.request
      .post(groups())
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrf))
      .set('Content-Type', 'application/json')
      .send({ name: 'x'.repeat(51) });
    expect(res.status).toBe(422);
  });

  it('GET groups lists created group', async () => {
    const res = await testApp.request
      .get(groups())
      .set('Cookie', sessionCookie);
    expect(res.status).toBe(200);
    const items = res.body as unknown[];
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect((items[0] as Record<string, unknown>)['name']).toBe('Media');
  });

  it('PUT updates a group name', async () => {
    const createRes = await testApp.request
      .post(groups())
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrf))
      .set('Content-Type', 'application/json')
      .send({ name: 'Infra' });
    const id = (createRes.body as Record<string, unknown>)['id'] as string;

    const res = await testApp.request
      .put(group(id))
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrf))
      .set('Content-Type', 'application/json')
      .send({ name: 'Infrastructure' });
    expect(res.status).toBe(200);
    expect((res.body as Record<string, unknown>)['name']).toBe('Infrastructure');
  });

  it('DELETE removes a group', async () => {
    const createRes = await testApp.request
      .post(groups())
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrf))
      .set('Content-Type', 'application/json')
      .send({ name: 'RemoveMe' });
    const id = (createRes.body as Record<string, unknown>)['id'] as string;

    const res = await testApp.request
      .delete(group(id))
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrf));
    expect(res.status).toBe(204);
  });

  it('DELETE non-existent group returns 404', async () => {
    const res = await testApp.request
      .delete(group('00000000-0000-0000-0000-000000000000'))
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrf));
    expect(res.status).toBe(404);
  });
});

// ── Reorder ──────────────────────────────────────────────────────────────────

describe('App Shortcut Reorder', () => {
  let testApp: TestApp;
  let sessionCookie: string;
  let csrf: string;
  let widgetId: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    await setupAdmin(testApp);
    const auth = await loginAdmin(testApp);
    sessionCookie = auth.sessionCookie;
    csrf = auth.csrfToken;
    widgetId = await createAppShortcutsWidget(testApp, sessionCookie, csrf);
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('POST reorder shortcuts swaps order', async () => {
    const base = `/api/admin/app-shortcuts/${widgetId}/shortcuts`;

    const a = await testApp.request
      .post(base)
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrf))
      .set('Content-Type', 'application/json')
      .send({ name: 'A', url: 'https://a.local' });
    const aId = (a.body as Record<string, unknown>)['id'] as string;

    const b = await testApp.request
      .post(base)
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrf))
      .set('Content-Type', 'application/json')
      .send({ name: 'B', url: 'https://b.local' });
    const bId = (b.body as Record<string, unknown>)['id'] as string;

    const res = await testApp.request
      .post(`${base}/reorder`)
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrf))
      .set('Content-Type', 'application/json')
      .send({ orderedIds: [bId, aId] });
    expect(res.status).toBe(200);
    const items = (res.body as Record<string, unknown>)['shortcuts'] as Array<Record<string, unknown>>;
    expect(items[0]!['id']).toBe(bId);
    expect(items[1]!['id']).toBe(aId);
  });

  it('POST reorder groups swaps order', async () => {
    const base = `/api/admin/app-shortcuts/${widgetId}/groups`;

    const g1 = await testApp.request
      .post(base)
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrf))
      .set('Content-Type', 'application/json')
      .send({ name: 'First' });
    const g1Id = (g1.body as Record<string, unknown>)['id'] as string;

    const g2 = await testApp.request
      .post(base)
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrf))
      .set('Content-Type', 'application/json')
      .send({ name: 'Second' });
    const g2Id = (g2.body as Record<string, unknown>)['id'] as string;

    const res = await testApp.request
      .post(`${base}/reorder`)
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrf))
      .set('Content-Type', 'application/json')
      .send({ orderedIds: [g2Id, g1Id] });
    expect(res.status).toBe(200);
    const items = res.body as Array<Record<string, unknown>>;
    expect(items[0]!['id']).toBe(g2Id);
    expect(items[1]!['id']).toBe(g1Id);
  });
});

// ── Auth Guards ──────────────────────────────────────────────────────────────

describe('App Shortcut Auth Guards', () => {
  let testApp: TestApp;
  let sessionCookie: string;
  let csrf: string;
  let widgetId: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    await setupAdmin(testApp);
    const auth = await loginAdmin(testApp);
    sessionCookie = auth.sessionCookie;
    csrf = auth.csrfToken;
    widgetId = await createAppShortcutsWidget(testApp, sessionCookie, csrf);
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('GET shortcuts returns 401 without session', async () => {
    const res = await testApp.request
      .get(`/api/admin/app-shortcuts/${widgetId}/shortcuts`);
    expect(res.status).toBe(401);
  });

  it('POST shortcut returns 401 without session', async () => {
    const res = await testApp.request
      .post(`/api/admin/app-shortcuts/${widgetId}/shortcuts`)
      .set('Content-Type', 'application/json')
      .send({ name: 'X', url: 'https://x.local' });
    expect(res.status).toBe(401);
  });

  it('POST shortcut returns 403 without CSRF', async () => {
    const res = await testApp.request
      .post(`/api/admin/app-shortcuts/${widgetId}/shortcuts`)
      .set('Cookie', sessionCookie)
      .set('Content-Type', 'application/json')
      .send({ name: 'X', url: 'https://x.local' });
    expect(res.status).toBe(403);
  });

  it('GET groups returns 401 without session', async () => {
    const res = await testApp.request
      .get(`/api/admin/app-shortcuts/${widgetId}/groups`);
    expect(res.status).toBe(401);
  });

  it('POST group returns 403 without CSRF', async () => {
    const res = await testApp.request
      .post(`/api/admin/app-shortcuts/${widgetId}/groups`)
      .set('Cookie', sessionCookie)
      .set('Content-Type', 'application/json')
      .send({ name: 'Nope' });
    expect(res.status).toBe(403);
  });
});
