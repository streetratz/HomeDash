import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  createTestApp,
  csrfHeader,
  extractCookies,
  extractCsrfToken,
  type TestApp,
} from '../helpers/http.js';
import { getDb } from '../../src/db/drizzle.js';
import { appShellSettings } from '../../src/db/schema/index.js';
import {
  isWidgetVisibleInPublicBootstrap,
  resolvePublicWidget,
} from '../../src/services/publicVisibility.js';

describe('public widget authorization', () => {
  let testApp: TestApp;
  let sessionCookie: string;
  let csrfToken: string;
  let publicDashboardId: string;
  let privateDashboardId: string;
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

    async function createDashboard(name: string): Promise<{ dashboardId: string; placeholderId: string }> {
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

    const publicDashboard = await createDashboard('Public Resolution');
    publicDashboardId = publicDashboard.dashboardId;
    publicPlaceholderId = publicDashboard.placeholderId;
    const privateDashboard = await createDashboard('Private Resolution');
    privateDashboardId = privateDashboard.dashboardId;
    privatePlaceholderId = privateDashboard.placeholderId;

    getDb()
      .update(appShellSettings)
      .set({ unauthWebDashboardId: publicDashboardId })
      .where(eq(appShellSettings.id, 'global'))
      .run();
  });

  afterAll(async () => {
    await testApp.close();
  });

  async function createWidget(
    placeholderId: string,
    type: string,
    publicVisibility: 'hidden' | 'read-only' | 'visible',
  ): Promise<string> {
    const response = await testApp.request
      .post(`/api/admin/placeholders/${placeholderId}/widgets`)
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrfToken))
      .send({ type, publicVisibility, configJson: '{"safe":true}' });
    return (response.body as { id: string }).id;
  }

  it('resolves read-only and visible supported widgets on the selected dashboard', async () => {
    const readOnlyId = await createWidget(publicPlaceholderId, 'pihole', 'read-only');
    const visibleId = await createWidget(publicPlaceholderId, 'stocks', 'visible');

    expect(resolvePublicWidget('web', readOnlyId)).toMatchObject({
      id: readOnlyId,
      type: 'pihole',
      publicVisibility: 'read-only',
      config: { safe: true },
    });
    expect(resolvePublicWidget('web', visibleId)).toMatchObject({
      id: visibleId,
      type: 'stocks',
      publicVisibility: 'visible',
    });
  });

  it('returns the same null outcome for hidden, missing, private and unsupported widgets', async () => {
    const hiddenId = await createWidget(publicPlaceholderId, 'pihole', 'hidden');
    const privateId = await createWidget(privatePlaceholderId, 'pihole', 'visible');
    const dockerId = await createWidget(publicPlaceholderId, 'docker', 'visible');

    expect(resolvePublicWidget('web', hiddenId)).toBeNull();
    expect(resolvePublicWidget('web', crypto.randomUUID())).toBeNull();
    expect(resolvePublicWidget('web', privateId)).toBeNull();
    expect(resolvePublicWidget('web', dockerId)).toBeNull();
  });

  it('immediately follows a changed public dashboard designation', async () => {
    const oldId = await createWidget(publicPlaceholderId, 'unifi', 'visible');
    const newId = await createWidget(privatePlaceholderId, 'unifi', 'visible');

    expect(resolvePublicWidget('web', oldId)).not.toBeNull();
    getDb()
      .update(appShellSettings)
      .set({ unauthWebDashboardId: privateDashboardId })
      .where(eq(appShellSettings.id, 'global'))
      .run();
    expect(resolvePublicWidget('web', oldId)).toBeNull();
    expect(resolvePublicWidget('web', newId)).not.toBeNull();
  });

  it('defaults unknown widget types to never public', () => {
    expect(isWidgetVisibleInPublicBootstrap('clock', 'hidden')).toBe(true);
    expect(isWidgetVisibleInPublicBootstrap('pihole', 'hidden')).toBe(false);
    expect(isWidgetVisibleInPublicBootstrap('pihole', 'visible')).toBe(true);
    expect(isWidgetVisibleInPublicBootstrap('docker', 'visible')).toBe(false);
    expect(isWidgetVisibleInPublicBootstrap('future_widget', 'visible')).toBe(false);
  });
});
