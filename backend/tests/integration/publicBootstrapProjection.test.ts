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

describe('GET /api/public/bootstrap widget projection', () => {
  let testApp: TestApp;
  let sessionCookie: string;
  let csrfToken: string;
  let webDashboardId: string;
  let mobileDashboardId: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    await testApp.request
      .post('/api/first-run/admin')
      .send({ username: 'admin', displayName: 'Admin', password: 'securepass1234' });
    const login = await testApp.request
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'securepass1234' });
    sessionCookie = extractCookies(login.headers);
    csrfToken = extractCsrfToken(login.body as Record<string, unknown>);

    async function createDashboard(name: string, widgetType: string): Promise<string> {
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
      const placeholderId = (placeholder.body as { id: string }).id;
      await testApp.request
        .post(`/api/admin/placeholders/${placeholderId}/widgets`)
        .set('Cookie', sessionCookie)
        .set(csrfHeader(csrfToken))
        .send({ type: widgetType, publicVisibility: 'visible' });
      return dashboardId;
    }

    webDashboardId = await createDashboard('Public Web', 'clock');
    mobileDashboardId = await createDashboard('Public Mobile', 'weather');

    const webDetail = await testApp.request
      .get(`/api/admin/dashboards/${webDashboardId}`)
      .set('Cookie', sessionCookie);
    const webPlaceholderId = (
      webDetail.body as { placeholders: Array<{ id: string }> }
    ).placeholders[0]!.id;
    for (const widget of [
      { type: 'pihole', publicVisibility: 'hidden' },
      { type: 'unifi', publicVisibility: 'read-only' },
      { type: 'docker', publicVisibility: 'visible' },
    ]) {
      await testApp.request
        .post(`/api/admin/placeholders/${webPlaceholderId}/widgets`)
        .set('Cookie', sessionCookie)
        .set(csrfHeader(csrfToken))
        .send({
          ...widget,
          configJson: JSON.stringify({
            showWan: true,
            password: 'must-not-leak',
            apiToken: 'must-not-leak',
            nested: {
              access_token: 'must-not-leak',
              clientSecret: 'must-not-leak',
              apiKey: 'must-not-leak',
            },
            connectionId: crypto.randomUUID(),
          }),
        });
    }

    const emptyPlaceholder = await testApp.request
      .post(`/api/admin/dashboards/${webDashboardId}/placeholders`)
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrfToken))
      .send({ x: 4, y: 0, w: 4, h: 3 });
    await testApp.request
      .post(`/api/admin/placeholders/${(emptyPlaceholder.body as { id: string }).id}/widgets`)
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrfToken))
      .send({ type: 'todo', publicVisibility: 'visible' });

    getDb()
      .update(appShellSettings)
      .set({
        unauthWebDashboardId: webDashboardId,
        unauthMobileDashboardId: mobileDashboardId,
      })
      .where(eq(appShellSettings.id, 'global'))
      .run();
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('keeps intrinsic and exposed widgets while pruning hidden, Docker and empty placeholders', async () => {
    const response = await testApp.request
      .get('/api/public/bootstrap')
      .set('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X)');
    expect(response.headers['cache-control']).toBe('no-store');
    const dashboard = response.body.dashboard as {
      id: string;
      placeholders: Array<{ widgets: Array<Record<string, unknown>> }>;
    };

    expect(dashboard.id).toBe(webDashboardId);
    expect(dashboard.placeholders).toHaveLength(1);
    expect(dashboard.placeholders[0]!.widgets.map((widget) => widget['type'])).toEqual([
      'clock',
      'unifi',
    ]);
    for (const widget of dashboard.placeholders[0]!.widgets) {
      expect(widget).not.toHaveProperty('publicVisibility');
      expect(widget).not.toHaveProperty('publicSourceUserId');
    }
    expect(JSON.stringify(dashboard)).not.toContain('must-not-leak');
    expect(JSON.stringify(dashboard)).not.toContain('connectionId');
  });

  it('uses the independently selected mobile dashboard', async () => {
    const response = await testApp.request
      .get('/api/public/bootstrap')
      .set('User-Agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');
    expect((response.body.dashboard as { id: string }).id).toBe(mobileDashboardId);
  });

  it('keeps authenticated dashboard views complete', async () => {
    const response = await testApp.request
      .get(`/api/admin/dashboards/${webDashboardId}`)
      .set('Cookie', sessionCookie);
    const types = (
      response.body as {
        placeholders: Array<{ widgets: Array<{ type: string }> }>;
      }
    ).placeholders.flatMap((placeholder) => placeholder.widgets.map((widget) => widget.type));
    expect(types).toEqual(expect.arrayContaining(['clock', 'pihole', 'unifi', 'docker', 'todo']));
  });
});
