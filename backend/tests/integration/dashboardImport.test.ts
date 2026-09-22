/**
 * T012: Integration tests for POST /api/admin/dashboards/import.
 *
 * Covers:
 * - 401 without auth
 * - 403 without CSRF
 * - 400 on malformed JSON / invalid version
 * - 409 on name conflict
 * - 201 on successful import
 * - 201 with overrideName resolving conflict
 * - Imported dashboard has correct children (placeholders, widgets, links)
 * - Background image type downgraded to solid
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

function validExportPayload(name = 'Imported Dashboard') {
  return {
    version: 1,
    dashboard: {
      name,
      applicability: 'both' as const,
      backgroundType: 'solid' as const,
      backgroundColor: '#ffffff',
      backgroundDisplayMode: null,
    },
    placeholders: [],
  };
}

function fullExportPayload(name = 'Full Import') {
  const stableKey = '11111111-1111-1111-1111-111111111111';
  return {
    version: 1,
    dashboard: {
      name,
      applicability: 'web' as const,
      backgroundType: 'solid' as const,
      backgroundColor: '#000000',
      backgroundDisplayMode: null,
    },
    placeholders: [
      {
        stableKey,
        x: 0,
        y: 0,
        w: 6,
        h: 4,
        borderColor: '#aabbcc',
        title: 'Test Placeholder',
        opacity: 0.9,
        widgets: [
          {
            type: 'links_list',
            orderIndex: 0,
            configJson: '{"columns":2}',
          },
          {
            type: 'clock',
            orderIndex: 1,
            configJson: '{}',
          },
        ],
        links: [
          {
            title: 'GitHub',
            url: 'https://github.com',
            iconKey: 'github',
            iconOverrideKey: null,
            orderIndex: 0,
          },
          {
            title: 'Google',
            url: 'https://google.com',
            iconKey: null,
            iconOverrideKey: null,
            orderIndex: 1,
          },
        ],
      },
    ],
  };
}

// ── Dashboard Import ─────────────────────────────────────────────────────────

describe('Dashboard Import', () => {
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
    const res = await testApp.request
      .post('/api/admin/dashboards/import')
      .set('Content-Type', 'application/json')
      .send(validExportPayload());
    expect(res.status).toBe(401);
  });

  it('returns 403 without CSRF token', async () => {
    const res = await testApp.request
      .post('/api/admin/dashboards/import')
      .set('Cookie', sessionCookie)
      .set('Content-Type', 'application/json')
      .send(validExportPayload());
    expect(res.status).toBe(403);
  });

  it('returns 422 on empty body', async () => {
    const res = await testApp.request
      .post('/api/admin/dashboards/import')
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrfToken))
      .set('Content-Type', 'application/json')
      .send({});
    expect(res.status).toBe(422);
  });

  it('returns 422 when version is wrong', async () => {
    const res = await testApp.request
      .post('/api/admin/dashboards/import')
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrfToken))
      .set('Content-Type', 'application/json')
      .send({ ...validExportPayload(), version: 99 });
    expect(res.status).toBe(422);
  });

  it('returns 422 when dashboard.name is missing', async () => {
    const payload = validExportPayload();
    const broken = {
      ...payload,
      dashboard: { ...payload.dashboard, name: '' },
    };
    const res = await testApp.request
      .post('/api/admin/dashboards/import')
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrfToken))
      .set('Content-Type', 'application/json')
      .send(broken);
    expect(res.status).toBe(422);
  });

  it('returns 409 when dashboard name already exists', async () => {
    // Create existing dashboard
    await testApp.request
      .post('/api/admin/dashboards')
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrfToken))
      .set('Content-Type', 'application/json')
      .send({ name: 'Conflict Dash' });

    const res = await testApp.request
      .post('/api/admin/dashboards/import')
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrfToken))
      .set('Content-Type', 'application/json')
      .send(validExportPayload('Conflict Dash'));

    expect(res.status).toBe(409);
    const body = res.body as { error: string; existingName: string };
    expect(body.error).toBe('RESOURCE_CONFLICT');
    expect(body.existingName).toBe('Conflict Dash');
  });

  it('returns 201 on successful import', async () => {
    const res = await testApp.request
      .post('/api/admin/dashboards/import')
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrfToken))
      .set('Content-Type', 'application/json')
      .send(validExportPayload('Fresh Import'));

    expect(res.status).toBe(201);
    const body = res.body as { id: string; name: string; applicability: string };
    expect(body.name).toBe('Fresh Import');
    expect(body.applicability).toBe('both');
    expect(body.id).toBeDefined();
  });

  it('returns 201 with overrideName resolving conflict', async () => {
    // "Conflict Dash" already exists from a previous test
    const res = await testApp.request
      .post('/api/admin/dashboards/import')
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrfToken))
      .set('Content-Type', 'application/json')
      .send({ ...validExportPayload('Conflict Dash'), overrideName: 'Conflict Dash Copy' });

    expect(res.status).toBe(201);
    const body = res.body as { name: string };
    expect(body.name).toBe('Conflict Dash Copy');
  });

  it('imports full nested data (placeholders, widgets, links)', async () => {
    const payload = fullExportPayload('Nested Import');

    const importRes = await testApp.request
      .post('/api/admin/dashboards/import')
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrfToken))
      .set('Content-Type', 'application/json')
      .send(payload);

    expect(importRes.status).toBe(201);
    const dashboardId = (importRes.body as { id: string }).id;

    // Fetch dashboard details
    const detailRes = await testApp.request
      .get(`/api/admin/dashboards/${dashboardId}`)
      .set('Cookie', sessionCookie);

    expect(detailRes.status).toBe(200);

    const detail = detailRes.body as {
      name: string;
      applicability: string;
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
          publicVisibility: string;
          links: Array<{
            title: string;
            url: string;
            iconKey: string | null;
            orderIndex: number;
          }>;
        }>;
      }>;
    };

    expect(detail.name).toBe('Nested Import');
    expect(detail.applicability).toBe('web');

    // Placeholders
    expect(detail.placeholders).toHaveLength(1);
    const ph = detail.placeholders[0]!;
    expect(ph.x).toBe(0);
    expect(ph.y).toBe(0);
    expect(ph.w).toBe(6);
    expect(ph.h).toBe(4);
    expect(ph.borderColor).toBe('#aabbcc');
    expect(ph.title).toBe('Test Placeholder');
    expect(ph.opacity).toBe(0.9);

    // Widgets
    expect(ph.widgets).toHaveLength(2);
    const linksWidget = ph.widgets.find((w) => w.type === 'links_list');
    expect(linksWidget).toBeDefined();
    const clockWidget = ph.widgets.find((w) => w.type === 'clock');
    expect(clockWidget).toBeDefined();
    expect(ph.widgets.every((widget) => widget.publicVisibility === 'hidden')).toBe(true);

    // Links (on the links_list widget)
    expect(linksWidget!.links).toHaveLength(2);
    expect(linksWidget!.links[0]!.title).toBe('GitHub');
    expect(linksWidget!.links[0]!.url).toBe('https://github.com');
    expect(linksWidget!.links[1]!.title).toBe('Google');
  });

  it('downgrades backgroundType image to solid on import', async () => {
    const payload = {
      ...validExportPayload('Image Downgrade'),
      dashboard: {
        name: 'Image Downgrade',
        applicability: 'both' as const,
        backgroundType: 'image' as const,
        backgroundColor: '#112233',
        backgroundDisplayMode: 'fill' as const,
      },
    };

    const res = await testApp.request
      .post('/api/admin/dashboards/import')
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrfToken))
      .set('Content-Type', 'application/json')
      .send(payload);

    expect(res.status).toBe(201);
    const body = res.body as { backgroundType: string; backgroundDisplayMode: string | null };
    expect(body.backgroundType).toBe('solid');
    expect(body.backgroundDisplayMode).toBeNull();
  });

  it('creates links_list widget when links exist but no links_list widget', async () => {
    const stableKey = '22222222-2222-2222-2222-222222222222';
    const payload = {
      version: 1,
      dashboard: {
        name: 'Auto Links Widget',
        applicability: 'both' as const,
        backgroundType: 'solid' as const,
        backgroundColor: '#ffffff',
        backgroundDisplayMode: null,
      },
      placeholders: [
        {
          stableKey,
          x: 0,
          y: 0,
          w: 4,
          h: 3,
          borderColor: '#000000',
          title: null,
          opacity: 1,
          widgets: [
            { type: 'clock', orderIndex: 0, configJson: '{}' },
          ],
          links: [
            {
              title: 'Test Link',
              url: 'https://example.com',
              iconKey: null,
              iconOverrideKey: null,
              orderIndex: 0,
            },
          ],
        },
      ],
    };

    const importRes = await testApp.request
      .post('/api/admin/dashboards/import')
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrfToken))
      .set('Content-Type', 'application/json')
      .send(payload);

    expect(importRes.status).toBe(201);
    const dashboardId = (importRes.body as { id: string }).id;

    const detailRes = await testApp.request
      .get(`/api/admin/dashboards/${dashboardId}`)
      .set('Cookie', sessionCookie);

    const detail = detailRes.body as {
      placeholders: Array<{
        widgets: Array<{
          type: string;
          links: Array<{ title: string }>;
        }>;
      }>;
    };

    const ph = detail.placeholders[0]!;
    // Should have 2 widgets: original clock + auto-created links_list
    expect(ph.widgets).toHaveLength(2);
    const linksWidget = ph.widgets.find((w) => w.type === 'links_list');
    expect(linksWidget).toBeDefined();
    expect(linksWidget!.links).toHaveLength(1);
    expect(linksWidget!.links[0]!.title).toBe('Test Link');
  });
});

// ── T024: Security audit integration tests ──────────────────────────────────
//
// Security findings summary:
//
// 1. Auth & CSRF: The import endpoint (POST /api/admin/dashboards/import) is
//    protected by requireAdmin() (→ 401) and assertCsrf() (→ 403). Verified
//    by existing tests above.
//
// 2. Export auth: GET /api/admin/dashboards/:id/export requires authentication
//    via requireAdmin(). Verified in dashboardExport.test.ts.
//
// 3. XSS via string fields: Imported strings (dashboard name, link title,
//    placeholder title) are stored as plain text. React auto-escapes all
//    rendered text content, so script injection in string fields is not a
//    vulnerability. Tests below confirm that script tags are stored verbatim.
//
// 4. configJson: Stored as a raw string column (TEXT). The frontend parses it
//    with JSON.parse, never eval. The backend validates it per widget type via
//    Zod schemas. No server-side eval or template interpolation.
//
// 5. URL validation: Link URLs are validated via HttpUrlSchema, which requires
//    http:// or https:// prefix. JavaScript: and data: URIs are rejected.
//
// 6. Length limits enforced by Zod:
//    - dashboard.name: 1-128 chars
//    - link.title: 1-15 chars
//    - placeholder.title: 0-64 chars
//    - configJson: max 100,000 chars
//    - placeholders array: max 50 items
//    - widgets array: max 100 per placeholder
//    - links array: max 200 per placeholder
//

describe('Dashboard Import — Security (T024)', () => {
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

  it('stores script tags in dashboard name as plain text (no sanitization needed)', async () => {
    const xssName = '<script>alert("xss")</script>';
    const payload = {
      ...validExportPayload(xssName),
    };

    const res = await testApp.request
      .post('/api/admin/dashboards/import')
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrfToken))
      .set('Content-Type', 'application/json')
      .send(payload);

    expect(res.status).toBe(201);
    const body = res.body as { id: string; name: string };
    // The script tag is stored verbatim — no stripping or encoding
    expect(body.name).toBe(xssName);

    // Verify via detail endpoint
    const detailRes = await testApp.request
      .get(`/api/admin/dashboards/${body.id}`)
      .set('Cookie', sessionCookie);
    expect(detailRes.status).toBe(200);
    expect((detailRes.body as { name: string }).name).toBe(xssName);
  });

  it('stores script tags in link title as plain text', async () => {
    const stableKey = '33333333-3333-3333-3333-333333333333';
    const xssTitle = '<img onerror=1>';
    const payload = {
      version: 1,
      dashboard: {
        name: 'XSS Link Test',
        applicability: 'both' as const,
        backgroundType: 'solid' as const,
        backgroundColor: '#ffffff',
        backgroundDisplayMode: null,
      },
      placeholders: [
        {
          stableKey,
          x: 0,
          y: 0,
          w: 4,
          h: 3,
          borderColor: '#000000',
          title: null,
          opacity: 1,
          widgets: [
            { type: 'links_list', orderIndex: 0, configJson: '{}' },
          ],
          links: [
            {
              title: xssTitle,
              url: 'https://example.com',
              iconKey: null,
              iconOverrideKey: null,
              orderIndex: 0,
            },
          ],
        },
      ],
    };

    const res = await testApp.request
      .post('/api/admin/dashboards/import')
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrfToken))
      .set('Content-Type', 'application/json')
      .send(payload);

    expect(res.status).toBe(201);
    const dashboardId = (res.body as { id: string }).id;

    const detailRes = await testApp.request
      .get(`/api/admin/dashboards/${dashboardId}`)
      .set('Cookie', sessionCookie);

    const detail = detailRes.body as {
      placeholders: Array<{
        widgets: Array<{
          type: string;
          links: Array<{ title: string }>;
        }>;
      }>;
    };

    const linksWidget = detail.placeholders[0]!.widgets.find(
      (w) => w.type === 'links_list',
    );
    expect(linksWidget).toBeDefined();
    // Stored as plain text — React will auto-escape on render
    expect(linksWidget!.links[0]!.title).toBe(xssTitle);
  });

  it('accepts import with large configJson (just under 100KB limit)', async () => {
    const stableKey = '44444444-4444-4444-4444-444444444444';
    // Generate a JSON string just under the 100,000 char limit
    const largeContent = 'x'.repeat(99_000);
    const largeConfigJson = JSON.stringify({ content: largeContent });

    const payload = {
      version: 1,
      dashboard: {
        name: 'Large Config Import',
        applicability: 'both' as const,
        backgroundType: 'solid' as const,
        backgroundColor: '#ffffff',
        backgroundDisplayMode: null,
      },
      placeholders: [
        {
          stableKey,
          x: 0,
          y: 0,
          w: 4,
          h: 3,
          borderColor: '#000000',
          title: null,
          opacity: 1,
          widgets: [
            { type: 'markdown', orderIndex: 0, configJson: largeConfigJson },
          ],
          links: [],
        },
      ],
    };

    const res = await testApp.request
      .post('/api/admin/dashboards/import')
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrfToken))
      .set('Content-Type', 'application/json')
      .send(payload);

    expect(res.status).toBe(201);
  });

  it('rejects import with too many placeholders (51 > max 50)', async () => {
    const placeholders = Array.from({ length: 51 }, (_, i) => ({
      stableKey: `${String(i).padStart(8, '0')}-0000-0000-0000-000000000000`,
      x: 0,
      y: i,
      w: 4,
      h: 1,
      borderColor: '#000000',
      title: null,
      opacity: 1,
      widgets: [],
      links: [],
    }));

    const payload = {
      version: 1,
      dashboard: {
        name: 'Too Many Placeholders',
        applicability: 'both' as const,
        backgroundType: 'solid' as const,
        backgroundColor: '#ffffff',
        backgroundDisplayMode: null,
      },
      placeholders,
    };

    const res = await testApp.request
      .post('/api/admin/dashboards/import')
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrfToken))
      .set('Content-Type', 'application/json')
      .send(payload);

    expect(res.status).toBe(422);
  });

  it('rejects import with javascript: URL scheme', async () => {
    const stableKey = '55555555-5555-5555-5555-555555555555';
    const payload = {
      version: 1,
      dashboard: {
        name: 'JS URL Test',
        applicability: 'both' as const,
        backgroundType: 'solid' as const,
        backgroundColor: '#ffffff',
        backgroundDisplayMode: null,
      },
      placeholders: [
        {
          stableKey,
          x: 0,
          y: 0,
          w: 4,
          h: 3,
          borderColor: '#000000',
          title: null,
          opacity: 1,
          widgets: [
            { type: 'links_list', orderIndex: 0, configJson: '{}' },
          ],
          links: [
            {
              title: 'Evil',
              url: 'javascript:alert(1)',
              iconKey: null,
              iconOverrideKey: null,
              orderIndex: 0,
            },
          ],
        },
      ],
    };

    const res = await testApp.request
      .post('/api/admin/dashboards/import')
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrfToken))
      .set('Content-Type', 'application/json')
      .send(payload);

    expect(res.status).toBe(422);
  });

  it('rejects import with oversized dashboard name (>128 chars)', async () => {
    const longName = 'A'.repeat(129);
    const payload = validExportPayload(longName);

    const res = await testApp.request
      .post('/api/admin/dashboards/import')
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrfToken))
      .set('Content-Type', 'application/json')
      .send(payload);

    expect(res.status).toBe(422);
  });
});

// ── Import/Export Round-Trip (T018 + T019) ────────────────────────────────────

describe('Import/Export Round-Trip', () => {
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

  // Helper to send authenticated mutations
  function post(url: string) {
    return testApp.request
      .post(url)
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrfToken))
      .set('Content-Type', 'application/json');
  }
  function get(url: string) {
    return testApp.request.get(url).set('Cookie', sessionCookie);
  }
  function del(url: string) {
    return testApp.request
      .delete(url)
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrfToken));
  }

  // ── T018: Full round-trip ─────────────────────────────────────────────────

  it('full round-trip: create → export → delete → import → verify', async () => {
    // 1. Create dashboard
    const dashRes = await post('/api/admin/dashboards').send({
      name: 'RoundTrip Dash',
      applicability: 'web',
    });
    expect(dashRes.status).toBe(201);
    const dashId = (dashRes.body as { id: string }).id;

    // 2. Update background
    await testApp.request
      .put(`/api/admin/dashboards/${dashId}`)
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrfToken))
      .set('Content-Type', 'application/json')
      .send({ backgroundType: 'solid', backgroundColor: '#abcdef' });

    // 3. Create placeholder
    const phRes = await post(`/api/admin/dashboards/${dashId}/placeholders`).send({
      x: 1, y: 2, w: 8, h: 5, borderColor: '#112233', title: 'My Panel', opacity: 0.75,
    });
    expect(phRes.status).toBe(201);
    const phId = (phRes.body as { id: string }).id;

    // 4. Create widgets
    const w1Res = await post(`/api/admin/placeholders/${phId}/widgets`).send({
      type: 'links_list', orderIndex: 0, configJson: '{"columns":3}',
    });
    expect(w1Res.status).toBe(201);
    const linksWidgetId = (w1Res.body as { id: string }).id;

    const w2Res = await post(`/api/admin/placeholders/${phId}/widgets`).send({
      type: 'clock', orderIndex: 1, configJson: '{}',
    });
    expect(w2Res.status).toBe(201);

    // 5. Create links on the links_list widget
    const l1Res = await post(`/api/admin/widgets/${linksWidgetId}/links`).send({
      title: 'GitHub', url: 'https://github.com', iconKey: 'github', iconOverrideKey: null, orderIndex: 0,
    });
    expect(l1Res.status).toBe(201);

    const l2Res = await post(`/api/admin/widgets/${linksWidgetId}/links`).send({
      title: 'Reddit', url: 'https://reddit.com', iconKey: null, iconOverrideKey: 'custom-reddit', orderIndex: 1,
    });
    expect(l2Res.status).toBe(201);

    // 6. Export
    const exportRes = await get(`/api/admin/dashboards/${dashId}/export`);
    expect(exportRes.status).toBe(200);
    const exported = exportRes.body as {
      version: number;
      dashboard: {
        name: string; applicability: string;
        backgroundType: string; backgroundColor: string | null; backgroundDisplayMode: string | null;
      };
      placeholders: Array<{
        stableKey: string; x: number; y: number; w: number; h: number;
        borderColor: string; title: string | null; opacity: number;
        widgets: Array<{ type: string; orderIndex: number; configJson: string; links?: Array<{ title: string; url: string; iconKey: string | null; iconOverrideKey: string | null; orderIndex: number }> }>;
        links?: Array<{ title: string; url: string; iconKey: string | null; iconOverrideKey: string | null; orderIndex: number }>;
      }>;
    };

    expect(exported.version).toBe(2);
    expect(exported.dashboard.name).toBe('RoundTrip Dash');

    // 7. Delete original
    const delRes = await del(`/api/admin/dashboards/${dashId}`);
    expect(delRes.status).toBe(200);

    // 8. Import the exported JSON
    const importRes = await post('/api/admin/dashboards/import').send(exported);
    expect(importRes.status).toBe(201);
    const importedId = (importRes.body as { id: string }).id;

    // 9. Fetch imported dashboard
    const viewRes = await get(`/api/admin/dashboards/${importedId}`);
    expect(viewRes.status).toBe(200);

    const view = viewRes.body as {
      name: string; applicability: string;
      backgroundType: string; backgroundColor: string | null; backgroundDisplayMode: string | null;
      placeholders: Array<{
        x: number; y: number; w: number; h: number;
        borderColor: string; title: string | null; opacity: number;
        widgets: Array<{
          type: string; orderIndex: number;
          config: Record<string, unknown>;
          links: Array<{ title: string; url: string; iconKey: string | null; iconOverrideKey: string | null; orderIndex: number }>;
        }>;
      }>;
    };

    // 10. Verify dashboard-level fields
    expect(view.name).toBe(exported.dashboard.name);
    expect(view.applicability).toBe(exported.dashboard.applicability);
    expect(view.backgroundType).toBe(exported.dashboard.backgroundType);
    expect(view.backgroundColor).toBe(exported.dashboard.backgroundColor);
    expect(view.backgroundDisplayMode).toBe(exported.dashboard.backgroundDisplayMode);

    // 11. Verify placeholders
    expect(view.placeholders).toHaveLength(exported.placeholders.length);
    const viewPh = view.placeholders[0]!;
    const expPh = exported.placeholders[0]!;
    expect(viewPh.x).toBe(expPh.x);
    expect(viewPh.y).toBe(expPh.y);
    expect(viewPh.w).toBe(expPh.w);
    expect(viewPh.h).toBe(expPh.h);
    expect(viewPh.borderColor).toBe(expPh.borderColor);
    expect(viewPh.title).toBe(expPh.title);
    expect(viewPh.opacity).toBe(expPh.opacity);

    // 12. Verify widgets (sorted by orderIndex for stable comparison)
    const sortedExpWidgets = [...expPh.widgets].sort((a, b) => a.orderIndex - b.orderIndex);
    const sortedViewWidgets = [...viewPh.widgets].sort((a, b) => a.orderIndex - b.orderIndex);
    expect(sortedViewWidgets).toHaveLength(sortedExpWidgets.length);

    for (let i = 0; i < sortedExpWidgets.length; i++) {
      expect(sortedViewWidgets[i]!.type).toBe(sortedExpWidgets[i]!.type);
      expect(sortedViewWidgets[i]!.orderIndex).toBe(sortedExpWidgets[i]!.orderIndex);
      // DashboardView returns parsed config; export returns configJson string
      const expectedConfig = JSON.parse(sortedExpWidgets[i]!.configJson);
      expect(sortedViewWidgets[i]!.config).toEqual(expectedConfig);
    }

    // 13. Verify links (on the links_list widget)
    const viewLinksWidget = sortedViewWidgets.find((w) => w.type === 'links_list')!;
    const sortedViewLinks = [...viewLinksWidget.links].sort((a, b) => a.orderIndex - b.orderIndex);
    // In v2, links are on the widget object, not the placeholder
    const expLinksWidget = sortedExpWidgets.find((w) => w.type === 'links_list')!;
    const sortedExpLinks = [...(expLinksWidget.links ?? [])].sort((a, b) => a.orderIndex - b.orderIndex);
    expect(sortedViewLinks).toHaveLength(sortedExpLinks.length);

    for (let i = 0; i < sortedExpLinks.length; i++) {
      expect(sortedViewLinks[i]!.title).toBe(sortedExpLinks[i]!.title);
      expect(sortedViewLinks[i]!.url).toBe(sortedExpLinks[i]!.url);
      expect(sortedViewLinks[i]!.iconKey).toBe(sortedExpLinks[i]!.iconKey);
      expect(sortedViewLinks[i]!.iconOverrideKey).toBe(sortedExpLinks[i]!.iconOverrideKey);
      expect(sortedViewLinks[i]!.orderIndex).toBe(sortedExpLinks[i]!.orderIndex);
    }
  });

  // ── T019: Edge-case integration tests ─────────────────────────────────────

  it('import with minimal data: zero placeholders', async () => {
    const payload = {
      version: 1,
      dashboard: {
        name: 'Minimal Dash',
        applicability: 'both' as const,
        backgroundType: 'solid' as const,
        backgroundColor: null,
        backgroundDisplayMode: null,
      },
      placeholders: [],
    };

    const res = await post('/api/admin/dashboards/import').send(payload);
    expect(res.status).toBe(201);

    const body = res.body as { id: string; name: string; backgroundType: string };
    expect(body.name).toBe('Minimal Dash');
    expect(body.backgroundType).toBe('solid');

    // Verify the imported dashboard has no placeholders
    const viewRes = await get(`/api/admin/dashboards/${body.id}`);
    expect(viewRes.status).toBe(200);
    const view = viewRes.body as { placeholders: unknown[] };
    expect(view.placeholders).toHaveLength(0);
  });

  it('import with all optional fields null', async () => {
    const stableKey = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const payload = {
      version: 1,
      dashboard: {
        name: 'Nulls Dash',
        applicability: 'both' as const,
        backgroundType: 'solid' as const,
        backgroundColor: null,
        backgroundDisplayMode: null,
      },
      placeholders: [
        {
          stableKey,
          x: 0, y: 0, w: 4, h: 3,
          borderColor: '#ffffff',
          title: null,
          opacity: 0.5,
          widgets: [
            { type: 'links_list', orderIndex: 0, configJson: '{}' },
          ],
          links: [
            {
              title: 'Null Icons',
              url: 'https://example.com',
              iconKey: null,
              iconOverrideKey: null,
              orderIndex: 0,
            },
          ],
        },
      ],
    };

    const res = await post('/api/admin/dashboards/import').send(payload);
    expect(res.status).toBe(201);
    const dashId = (res.body as { id: string }).id;

    const viewRes = await get(`/api/admin/dashboards/${dashId}`);
    expect(viewRes.status).toBe(200);
    const view = viewRes.body as {
      backgroundColor: string | null;
      backgroundDisplayMode: string | null;
      placeholders: Array<{
        title: string | null;
        widgets: Array<{
          type: string;
          links: Array<{ title: string; iconKey: string | null; iconOverrideKey: string | null }>;
        }>;
      }>;
    };

    expect(view.backgroundColor).toBeNull();
    expect(view.backgroundDisplayMode).toBeNull();
    expect(view.placeholders[0]!.title).toBeNull();

    const linksWidget = view.placeholders[0]!.widgets.find((w) => w.type === 'links_list')!;
    expect(linksWidget.links[0]!.iconKey).toBeNull();
    expect(linksWidget.links[0]!.iconOverrideKey).toBeNull();
  });

  it('unicode in name and titles is preserved', async () => {
    const stableKey = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    const payload = {
      version: 1,
      dashboard: {
        name: '🏠 Home',
        applicability: 'both' as const,
        backgroundType: 'solid' as const,
        backgroundColor: null,
        backgroundDisplayMode: null,
      },
      placeholders: [
        {
          stableKey,
          x: 0, y: 0, w: 6, h: 4,
          borderColor: '#000000',
          title: '日本語パネル',
          opacity: 1,
          widgets: [
            { type: 'links_list', orderIndex: 0, configJson: '{}' },
          ],
          links: [
            {
              title: '🔗 Ссылка',
              url: 'https://example.com',
              iconKey: null,
              iconOverrideKey: null,
              orderIndex: 0,
            },
            {
              title: '中文链接',
              url: 'https://example.cn',
              iconKey: null,
              iconOverrideKey: null,
              orderIndex: 1,
            },
          ],
        },
      ],
    };

    const res = await post('/api/admin/dashboards/import').send(payload);
    expect(res.status).toBe(201);
    const body = res.body as { id: string; name: string };
    expect(body.name).toBe('🏠 Home');

    const viewRes = await get(`/api/admin/dashboards/${body.id}`);
    expect(viewRes.status).toBe(200);
    const view = viewRes.body as {
      name: string;
      placeholders: Array<{
        title: string | null;
        widgets: Array<{
          type: string;
          links: Array<{ title: string }>;
        }>;
      }>;
    };

    expect(view.name).toBe('🏠 Home');
    expect(view.placeholders[0]!.title).toBe('日本語パネル');

    const linksWidget = view.placeholders[0]!.widgets.find((w) => w.type === 'links_list')!;
    const sortedLinks = [...linksWidget.links].sort(
      (a, b) => (a as unknown as { orderIndex: number }).orderIndex - (b as unknown as { orderIndex: number }).orderIndex,
    );
    expect(sortedLinks[0]!.title).toBe('🔗 Ссылка');
    expect(sortedLinks[1]!.title).toBe('中文链接');
  });

  it('re-import after conflict resolution: 409 then overrideName → 201', async () => {
    // Create "Foo" dashboard
    const createRes = await post('/api/admin/dashboards').send({ name: 'Foo' });
    expect(createRes.status).toBe(201);

    const importPayload = {
      version: 1,
      dashboard: {
        name: 'Foo',
        applicability: 'both' as const,
        backgroundType: 'solid' as const,
        backgroundColor: null,
        backgroundDisplayMode: null,
      },
      placeholders: [],
    };

    // First attempt → 409
    const conflictRes = await post('/api/admin/dashboards/import').send(importPayload);
    expect(conflictRes.status).toBe(409);
    const conflictBody = conflictRes.body as { error: string; existingName: string };
    expect(conflictBody.error).toBe('RESOURCE_CONFLICT');
    expect(conflictBody.existingName).toBe('Foo');

    // Re-import with overrideName → 201
    const retryRes = await post('/api/admin/dashboards/import').send({
      ...importPayload,
      overrideName: 'Foo Copy',
    });
    expect(retryRes.status).toBe(201);
    const retryBody = retryRes.body as { name: string };
    expect(retryBody.name).toBe('Foo Copy');

    // Verify both dashboards exist
    const listRes = await get('/api/admin/dashboards');
    expect(listRes.status).toBe(200);
    const dashboards = listRes.body as Array<{ name: string }>;
    const names = dashboards.map((d) => d.name);
    expect(names).toContain('Foo');
    expect(names).toContain('Foo Copy');
  });
});
