import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  createTestApp,
  csrfHeader,
  extractCookies,
  extractCsrfToken,
  type TestApp,
} from '../helpers/http.js';
import { getDb } from '../../src/db/drizzle.js';
import { appShellSettings, appShortcuts } from '../../src/db/schema/index.js';
import { clearPublicWidgetSnapshotCache } from '../../src/services/publicWidgetSnapshotCache.js';

const FORBIDDEN_KEYS = [
  'token',
  'password',
  'secret',
  'credential',
  'baseUrl',
  'endpoint',
  'connectionId',
  'oauthAccountId',
  'publicSourceUserId',
];

function assertNoForbiddenKeys(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) assertNoForbiddenKeys(item);
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    expect(FORBIDDEN_KEYS.map((candidate) => candidate.toLowerCase())).not.toContain(
      key.toLowerCase(),
    );
    assertNoForbiddenKeys(child);
  }
}

describe('GET /api/public/widgets/:widgetId', () => {
  let testApp: TestApp;
  let sessionCookie: string;
  let csrfToken: string;
  let publicDashboardId: string;
  let publicPlaceholderId: string;
  let privatePlaceholderId: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    await testApp.request
      .post('/api/first-run/admin')
      .send({ username: 'admin', displayName: 'Admin', password: 'supersecurepass1' });
    const login = await testApp.request
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'supersecurepass1' });
    sessionCookie = extractCookies(login.headers);
    csrfToken = extractCsrfToken(login.body as Record<string, unknown>);

    async function makeDashboard(name: string) {
      const dashboard = await testApp.request
        .post('/api/admin/dashboards')
        .set('Cookie', sessionCookie)
        .set(csrfHeader(csrfToken))
        .send({ name });
      const dashboardId = (dashboard.body as { id: string }).id;
      const placeholder = await testApp.request
        .post(`/api/admin/dashboards/${dashboardId}/placeholders`)
        .set('Cookie', sessionCookie)
        .set(csrfHeader(csrfToken))
        .send({ x: 0, y: 0, w: 4, h: 3 });
      return {
        dashboardId,
        placeholderId: (placeholder.body as { id: string }).id,
      };
    }

    const publicDashboard = await makeDashboard('Public Widget Data');
    publicDashboardId = publicDashboard.dashboardId;
    publicPlaceholderId = publicDashboard.placeholderId;
    privatePlaceholderId = (await makeDashboard('Private Widget Data')).placeholderId;

    getDb()
      .update(appShellSettings)
      .set({ unauthWebDashboardId: publicDashboardId })
      .where(eq(appShellSettings.id, 'global'))
      .run();
  });

  beforeEach(() => {
    clearPublicWidgetSnapshotCache();
  });

  afterAll(async () => {
    await testApp.close();
  });

  async function createWidget(
    placeholderId: string,
    type: string,
    publicVisibility: 'hidden' | 'visible',
  ): Promise<string> {
    const response = await testApp.request
      .post(`/api/admin/placeholders/${placeholderId}/widgets`)
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrfToken))
      .send({ type, publicVisibility });
    return (response.body as { id: string }).id;
  }

  it('returns an allowlisted app-shortcut snapshot without authentication', async () => {
    const widgetId = await createWidget(publicPlaceholderId, 'app_shortcuts', 'visible');
    const now = new Date().toISOString();
    getDb()
      .insert(appShortcuts)
      .values({
        id: crypto.randomUUID(),
        widgetInstanceId: widgetId,
        name: 'Home Assistant',
        url: 'https://home.local',
        iconKey: 'home',
        pingEnabled: 1,
        orderIndex: 0,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const response = await testApp.request.get(`/api/public/widgets/${widgetId}`);
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toMatchObject({
      widgetId,
      type: 'app_shortcuts',
      data: {
        shortcuts: [
          {
            name: 'Home Assistant',
            url: 'https://home.local',
            iconKey: 'home',
            orderIndex: 0,
          },
        ],
      },
    });
    assertNoForbiddenKeys(response.body);
    expect(JSON.stringify(response.body)).not.toContain('pingEnabled');
  });

  it('returns one constant 404 for malformed, missing, hidden, private and Docker widgets', async () => {
    const hiddenId = await createWidget(publicPlaceholderId, 'app_shortcuts', 'hidden');
    const privateId = await createWidget(privatePlaceholderId, 'app_shortcuts', 'visible');
    const dockerId = await createWidget(publicPlaceholderId, 'docker', 'visible');
    const paths = [
      '/api/public/widgets/not-a-uuid',
      `/api/public/widgets/${crypto.randomUUID()}`,
      `/api/public/widgets/${hiddenId}`,
      `/api/public/widgets/${privateId}`,
      `/api/public/widgets/${dockerId}`,
    ];

    for (const path of paths) {
      const response = await testApp.request.get(path);
      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: 'NOT_FOUND',
        message: 'Public widget not found',
      });
    }
  });

  it('rate limits the public widget route per IP', async () => {
    let limited = false;
    for (let attempt = 0; attempt < 125; attempt += 1) {
      const response = await testApp.request.get('/api/public/widgets/not-a-uuid');
      if (response.status === 429) {
        limited = true;
        break;
      }
    }
    expect(limited).toBe(true);
  });
});
