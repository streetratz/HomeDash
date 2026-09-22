/**
 * T007: Integration tests for GET /api/admin/dashboards/:id/export.
 *
 * Covers:
 * - 401 when not authenticated
 * - 404 for non-existent dashboard ID
 * - 200 with correct headers and export shape
 * - Dashboard with zero placeholders
 * - Full nested data (placeholders, widgets, links)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createTestApp,
  extractCookies,
  extractCsrfToken,
  csrfHeader,
  type TestApp,
} from '../helpers/http.js';

// ── Test helpers ──────────────────────────────────────────────────────────────

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

// ── Dashboard Export ──────────────────────────────────────────────────────────

describe('Dashboard Export', () => {
  let testApp: TestApp;
  let sessionCookie: string;
  let csrfToken: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    await setupAdmin(testApp);
    const auth = await loginAdmin(testApp);
    sessionCookie = auth.sessionCookie;
    csrfToken = auth.csrfToken;
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('returns 401 when not authenticated', async () => {
    const res = await testApp.request.get(
      '/api/admin/dashboards/00000000-0000-0000-0000-000000000000/export',
    );
    expect(res.status).toBe(401);
  });

  it('returns 404 for non-existent dashboard ID', async () => {
    const res = await testApp.request
      .get('/api/admin/dashboards/00000000-0000-0000-0000-000000000099/export')
      .set('Cookie', sessionCookie);
    expect(res.status).toBe(404);
  });

  it('returns 200 with correct Content-Type and Content-Disposition headers', async () => {
    // Create a dashboard
    const createRes = await testApp.request
      .post('/api/admin/dashboards')
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrfToken))
      .set('Content-Type', 'application/json')
      .send({ name: 'Export Test' });
    const dashboardId = (createRes.body as { id: string }).id;

    const res = await testApp.request
      .get(`/api/admin/dashboards/${dashboardId}/export`)
      .set('Cookie', sessionCookie);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.headers['content-disposition']).toBe(
      'attachment; filename="Export_Test-export.json"',
    );
  });

  it('returns export body with version=1 and dashboard fields', async () => {
    const createRes = await testApp.request
      .post('/api/admin/dashboards')
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrfToken))
      .set('Content-Type', 'application/json')
      .send({ name: 'My Dash', applicability: 'web' });
    const dashboardId = (createRes.body as { id: string }).id;

    const res = await testApp.request
      .get(`/api/admin/dashboards/${dashboardId}/export`)
      .set('Cookie', sessionCookie);

    const body = res.body as Record<string, unknown>;
    expect(body['version']).toBe(2);
    const dash = body['dashboard'] as Record<string, unknown>;
    expect(dash['name']).toBe('My Dash');
    expect(dash['applicability']).toBe('web');
    expect(dash['backgroundType']).toBe('solid');
    expect(dash).toHaveProperty('backgroundColor');
    expect(dash).toHaveProperty('backgroundDisplayMode');
    // Should NOT have internal ids or timestamps
    expect(dash).not.toHaveProperty('id');
    expect(dash).not.toHaveProperty('createdAt');
    expect(dash).not.toHaveProperty('updatedAt');
    expect(dash).not.toHaveProperty('backgroundAssetId');
  });

  it('returns empty placeholders array for dashboard with no placeholders', async () => {
    const createRes = await testApp.request
      .post('/api/admin/dashboards')
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrfToken))
      .set('Content-Type', 'application/json')
      .send({ name: 'Empty Dash' });
    const dashboardId = (createRes.body as { id: string }).id;

    const res = await testApp.request
      .get(`/api/admin/dashboards/${dashboardId}/export`)
      .set('Cookie', sessionCookie);

    const body = res.body as { placeholders: unknown[] };
    expect(body.placeholders).toEqual([]);
  });

  it('exports full nested data (placeholders, widgets, links)', async () => {
    // 1. Create dashboard
    const createRes = await testApp.request
      .post('/api/admin/dashboards')
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrfToken))
      .set('Content-Type', 'application/json')
      .send({ name: 'Full Export' });
    const dashboardId = (createRes.body as { id: string }).id;

    // 2. Create placeholder
    const phRes = await testApp.request
      .post(`/api/admin/dashboards/${dashboardId}/placeholders`)
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrfToken))
      .set('Content-Type', 'application/json')
      .send({ x: 0, y: 0, w: 6, h: 4 });
    expect(phRes.status).toBe(201);
    const ph = phRes.body as { id: string; stableKey: string };

    // 3. Create widget (links_list type)
    const wRes = await testApp.request
      .post(`/api/admin/placeholders/${ph.id}/widgets`)
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrfToken))
      .set('Content-Type', 'application/json')
      .send({ type: 'links_list', orderIndex: 0, configJson: '{"columns":2}' });
    expect(wRes.status).toBe(201);
    const widget = wRes.body as { id: string };

    // 4. Create link
    const linkRes = await testApp.request
      .post(`/api/admin/widgets/${widget.id}/links`)
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrfToken))
      .set('Content-Type', 'application/json')
      .send({ title: 'GitHub', url: 'https://github.com', iconKey: 'github' });
    expect(linkRes.status).toBe(201);

    // 5. Export and verify
    const res = await testApp.request
      .get(`/api/admin/dashboards/${dashboardId}/export`)
      .set('Cookie', sessionCookie);

    expect(res.status).toBe(200);
    const body = res.body as {
      version: number;
      dashboard: { name: string };
      placeholders: Array<{
        stableKey: string;
        x: number;
        y: number;
        w: number;
        h: number;
        borderColor: string;
        title: string | null;
        opacity: number;
        widgets: Array<{
          type: string;
          orderIndex: number;
          configJson: string;
          links?: Array<{
            title: string;
            url: string;
            iconKey: string | null;
            iconOverrideKey: string | null;
            orderIndex: number;
          }>;
        }>;
        links?: Array<{
          title: string;
          url: string;
          iconKey: string | null;
          iconOverrideKey: string | null;
          orderIndex: number;
        }>;
      }>;
    };

    expect(body.version).toBe(2);
    expect(body.dashboard.name).toBe('Full Export');
    expect(JSON.stringify(body)).not.toContain('publicVisibility');
    expect(JSON.stringify(body)).not.toContain('publicSourceUserId');

    // Placeholders
    expect(body.placeholders).toHaveLength(1);
    const expPh = body.placeholders[0]!;
    expect(expPh.stableKey).toBe(ph.stableKey);
    expect(expPh.x).toBe(0);
    expect(expPh.y).toBe(0);
    expect(expPh.w).toBe(6);
    expect(expPh.h).toBe(4);
    expect(expPh).not.toHaveProperty('id');
    expect(expPh).not.toHaveProperty('dashboardId');
    expect(expPh).not.toHaveProperty('createdAt');

    // Widgets
    expect(expPh.widgets).toHaveLength(1);
    const expW = expPh.widgets[0]!;
    expect(expW.type).toBe('links_list');
    expect(expW.orderIndex).toBe(0);
    expect(expW.configJson).toBe('{"columns":2}');
    expect(expW).not.toHaveProperty('id');
    expect(expW).not.toHaveProperty('placeholderId');

    // Links (v2: attached per-widget, not per-placeholder)
    expect(expW.links).toHaveLength(1);
    const expL = expW.links![0]!;
    expect(expL.title).toBe('GitHub');
    expect(expL.url).toBe('https://github.com');
    expect(expL.iconKey).toBe('github');
    expect(expL.iconOverrideKey).toBeNull();
    expect(expL.orderIndex).toBe(0);
    expect(expL).not.toHaveProperty('id');
    expect(expL).not.toHaveProperty('widgetInstanceId');
  });

  it('duplicates widgets as hidden without exporting the source principal', async () => {
    const createRes = await testApp.request
      .post('/api/admin/dashboards')
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrfToken))
      .set('Content-Type', 'application/json')
      .send({ name: 'Visibility Duplicate Source' });
    const dashboardId = (createRes.body as { id: string }).id;

    const phRes = await testApp.request
      .post(`/api/admin/dashboards/${dashboardId}/placeholders`)
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrfToken))
      .set('Content-Type', 'application/json')
      .send({ x: 0, y: 0, w: 4, h: 3 });
    const placeholderId = (phRes.body as { id: string }).id;

    const widgetRes = await testApp.request
      .post(`/api/admin/placeholders/${placeholderId}/widgets`)
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrfToken))
      .set('Content-Type', 'application/json')
      .send({ type: 'clock', publicVisibility: 'visible' });
    expect(widgetRes.status).toBe(201);

    const duplicateRes = await testApp.request
      .post(`/api/admin/dashboards/${dashboardId}/duplicate`)
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrfToken));
    expect(duplicateRes.status).toBe(201);
    const duplicateId = (duplicateRes.body as { id: string }).id;

    const detailRes = await testApp.request
      .get(`/api/admin/dashboards/${duplicateId}`)
      .set('Cookie', sessionCookie);
    const detail = detailRes.body as {
      placeholders: Array<{
        widgets: Array<{ publicVisibility: string; publicSourceUserId?: string }>;
      }>;
    };
    expect(detail.placeholders[0]!.widgets[0]!.publicVisibility).toBe('hidden');
    expect(detail.placeholders[0]!.widgets[0]).not.toHaveProperty('publicSourceUserId');
  });

  it('sanitizes special characters in filename', async () => {
    const createRes = await testApp.request
      .post('/api/admin/dashboards')
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrfToken))
      .set('Content-Type', 'application/json')
      .send({ name: 'My Dashboard (v2)' });
    const dashboardId = (createRes.body as { id: string }).id;

    const res = await testApp.request
      .get(`/api/admin/dashboards/${dashboardId}/export`)
      .set('Cookie', sessionCookie);

    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toBe(
      'attachment; filename="My_Dashboard__v2_-export.json"',
    );
  });
});
