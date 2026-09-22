/**
 * #100: a logged-in non-admin must be able to *read* widget data.
 *
 * The rule this locks in: for integration widgets, reading data is an
 * authenticated action and only configuration or destructive control is an
 * admin action. #189 put the Docker routes behind auth and it would be easy
 * for a later change to reach for `requireAdmin` on a data route by reflex —
 * that would silently blank every widget for standard users.
 *
 * `/api/sonos/status` and `/api/sonos/households` are covered only for the
 * anonymous case: authenticated calls fall through to live device discovery,
 * which has nothing to find here and blocks until it gives up.
 *
 * The three config/list reads are here because each one gated a widget's
 * entire render: Pi-hole and UniFi both bail out to "not configured" without
 * them, and the shortcuts widget renders an empty list. They were admin-only,
 * so all three widgets were blank for standard users.
 *
 * The assertions are deliberately negative-space: these tests run without a
 * real Pi-hole, UniFi controller, Sonos household or quote provider, so a data
 * route is expected to fail with "not configured" or an upstream error. What
 * matters is that it never fails with 401/403 for a standard user, and that
 * admin routes always do.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, type TestApp } from '../helpers/http.js';
import { setupAdmin, createStandardUser, type Session } from './dockerFixtures.js';

/** Any widget id — resolution happens after the guard, so it need not exist. */
const WIDGET_ID = '00000000-0000-4000-8000-0000000000aa';

interface RouteCase {
  method: 'get' | 'post' | 'put' | 'delete';
  path: string;
  body?: Record<string, unknown>;
}

/**
 * Data routes: a standard user must get *past* the guard. Pi-hole and UniFi
 * stats, Sonos playback state and transport control, stock quotes.
 */
const DATA_ROUTES: RouteCase[] = [
  { method: 'get', path: `/api/pihole/config/${WIDGET_ID}` },
  { method: 'get', path: `/api/unifi/config/${WIDGET_ID}` },
  { method: 'get', path: `/api/app-shortcuts/${WIDGET_ID}/shortcuts` },
  { method: 'get', path: `/api/pihole/stats/${WIDGET_ID}` },
  { method: 'get', path: `/api/pihole/system/${WIDGET_ID}` },
  { method: 'get', path: `/api/unifi/stats/${WIDGET_ID}` },
  { method: 'get', path: '/api/sonos/mode' },
  { method: 'get', path: '/api/sonos/service-labels' },
  { method: 'get', path: '/api/spotify/library/albums?limit=1&offset=0' },
  { method: 'get', path: `/api/stocks/${WIDGET_ID}/quotes` },
  { method: 'get', path: `/api/stocks/${WIDGET_ID}/market-status` },
];

/**
 * The anonymous matrix can include the discovery-backed Sonos routes: the
 * guard rejects before any device lookup happens.
 */
const ANON_ROUTES: RouteCase[] = [
  ...DATA_ROUTES,
  { method: 'get', path: '/api/sonos/status' },
  { method: 'get', path: '/api/sonos/households' },
  { method: 'get', path: '/api/sonos/services' },
];

/** Configuration and destructive control: admin only. */
const ADMIN_ROUTES: RouteCase[] = [
  { method: 'post', path: `/api/pihole/blocking/${WIDGET_ID}`, body: { blocked: true } },
  { method: 'get', path: `/api/unifi/debug/${WIDGET_ID}` },
  { method: 'get', path: `/api/admin/app-shortcuts/${WIDGET_ID}/shortcuts` },
  { method: 'get', path: '/api/sonos/config' },
  { method: 'put', path: '/api/sonos/mode', body: { mode: 'local' } },
  { method: 'post', path: '/api/sonos/groups/group-1/reset' },
];

const PUBLIC_WIDGET_CONTROL_ROUTES: RouteCase[] = [
  { method: 'post', path: `/api/pihole/blocking/${WIDGET_ID}`, body: { action: 'enable' } },
  { method: 'post', path: '/api/sonos/groups/group-1/play' },
  { method: 'post', path: '/api/sonos/groups/group-1/pause' },
  { method: 'post', path: '/api/sonos/groups/group-1/next' },
  { method: 'post', path: '/api/sonos/groups/group-1/previous' },
  { method: 'post', path: '/api/sonos/groups/group-1/volume', body: { volume: 20 } },
  { method: 'post', path: '/api/sonos/groups/group-1/mute', body: { muted: true } },
  { method: 'post', path: '/api/sonos/players/player-1/volume', body: { volume: 20 } },
  { method: 'post', path: '/api/sonos/players/player-1/mute', body: { muted: true } },
  { method: 'post', path: '/api/sonos/groups/modify', body: { groupId: 'group-1' } },
  {
    method: 'post',
    path: '/api/sonos/groups/group-1/favorites',
    body: { favoriteId: 'favorite-1' },
  },
  { method: 'delete', path: '/api/sonos/groups/group-1/queue' },
  {
    method: 'post',
    path: '/api/sonos/groups/group-1/queue/play',
    body: { trackNumber: 1 },
  },
  {
    method: 'post',
    path: '/api/sonos/groups/group-1/queue/add',
    body: { uri: 'x-test://track' },
  },
  {
    method: 'post',
    path: '/api/sonos/groups/group-1/queue/next',
    body: { uri: 'x-test://track' },
  },
  {
    method: 'post',
    path: '/api/sonos/groups/group-1/queue/add-container',
    body: { objectId: 'container-1' },
  },
  {
    method: 'post',
    path: '/api/sonos/groups/group-1/queue/replace',
    body: { objectId: 'container-1' },
  },
  {
    method: 'put',
    path: '/api/sonos/groups/group-1/playmode',
    body: { repeat: false, repeatOne: false, crossfade: false, shuffle: false },
  },
  {
    method: 'post',
    path: '/api/sonos/groups/group-1/play-uri',
    body: { uri: 'x-test://track' },
  },
  {
    method: 'post',
    path: `/api/admin/app-shortcuts/${WIDGET_ID}/shortcuts`,
    body: { name: 'Shortcut', url: 'https://example.com' },
  },
  {
    method: 'post',
    path: `/api/admin/app-shortcuts/${WIDGET_ID}/shortcuts/reorder`,
    body: { orderedIds: [] },
  },
];

describe('Widget data is readable by non-admins (#100)', () => {
  let testApp: TestApp;
  let admin: Session;
  let user: Session;

  beforeAll(async () => {
    testApp = await createTestApp();
    admin = await setupAdmin(testApp);
    user = await createStandardUser(testApp, admin, 'widgetreader');
  });

  afterAll(async () => {
    await testApp.close();
  });

  function call(route: RouteCase, session: Session | null) {
    let req = testApp.request[route.method](route.path);
    if (session) {
      req = req.set('Cookie', session.cookie).set('X-CSRF-Token', session.csrfToken);
    }
    if (route.body) {
      req = req.send(route.body).set('Content-Type', 'application/json');
    }
    return req;
  }

  describe('data routes', () => {
    it.each(DATA_ROUTES)('$method $path is not an admin-only route', async (route) => {
      const res = await call(route, user);
      expect([401, 403]).not.toContain(res.status);
    });

    it.each(ANON_ROUTES)('$method $path still rejects anonymous callers', async (route) => {
      const res = await call(route, null);
      expect(res.status).toBe(401);
    });

    it('treats a standard user the same as an admin', async () => {
      // Same route, same absent integration — the status must not depend on
      // who is asking. This is the assertion that fails the moment someone
      // swaps requireAuth for requireAdmin on a data route.
      for (const route of DATA_ROUTES) {
        const asAdmin = await call(route, admin);
        const asUser = await call(route, user);
        expect(asUser.status, `${route.method.toUpperCase()} ${route.path} differed by role`).toBe(
          asAdmin.status,
        );
      }
    });
  });

  describe('readable config carries no secrets', () => {
    // The reason these reads could be opened up at all. If a token, password
    // or API key ever joins the payload, this fails and the guard has to go
    // back to admin-only.
    const FORBIDDEN = ['apiToken', 'apiTokenEncrypted', 'password', 'token', 'secret'];

    it.each([`/api/pihole/config/${WIDGET_ID}`, `/api/unifi/config/${WIDGET_ID}`])(
      '%s exposes no credential fields',
      async (path) => {
        const res = await call({ method: 'get', path }, user);
        expect(res.status).toBe(200);
        const body = JSON.stringify(res.body);
        for (const field of FORBIDDEN) {
          expect(body.toLowerCase()).not.toContain(field.toLowerCase());
        }
      },
    );
  });

  describe('admin routes', () => {
    it.each(ADMIN_ROUTES)('$method $path rejects a standard user', async (route) => {
      const res = await call(route, user);
      expect(res.status).toBe(403);
    });

    it.each(ADMIN_ROUTES)('$method $path rejects an anonymous caller', async (route) => {
      const res = await call(route, null);
      expect([401, 403]).toContain(res.status);
    });
  });

  describe('publicly exposable widget controls', () => {
    it.each(PUBLIC_WIDGET_CONTROL_ROUTES)(
      '$method $path rejects an anonymous caller',
      async (route) => {
        const res = await call(route, null);
        expect([401, 403]).toContain(res.status);
      },
    );

    it.each([
      '/api/sonos/groups/group-1/queue/add-container',
      '/api/sonos/groups/group-1/queue/replace',
    ])('%s accepts only the objectId contract', async (path) => {
      const missing = await call({ method: 'post', path, body: {} }, user);
      expect(missing.status).toBe(400);
      expect(missing.body.message).toBe('A valid objectId is required');

      const legacy = await call(
        {
          method: 'post',
          path,
          body: { uri: 'x-test://container', objectId: 'container-1' },
        },
        user,
      );
      expect(legacy.status).toBe(400);
      expect(legacy.body.message).toBe('A valid objectId is required');
    });

    it.each([
      '/api/sonos/groups/group-1/queue/add-container',
      '/api/sonos/groups/group-1/queue/replace',
    ])('%s rejects cloud mode without reporting success', async (path) => {
      const setCloud = await call(
        { method: 'put', path: '/api/sonos/mode', body: { mode: 'cloud' } },
        admin,
      );
      expect(setCloud.status).toBe(200);

      try {
        const response = await call(
          { method: 'post', path, body: { objectId: 'container-1' } },
          user,
        );
        expect(response.status).toBe(400);
        expect(response.body.message).toBe(
          'Container queue mutations are available in local mode only',
        );
      } finally {
        const setLocal = await call(
          { method: 'put', path: '/api/sonos/mode', body: { mode: 'local' } },
          admin,
        );
        expect(setLocal.status).toBe(200);
      }
    });
  });
});
