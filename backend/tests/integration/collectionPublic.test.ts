import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from '../helpers/http.js';
import {
  collectionIds,
  collectionPreset,
  seedCollectionContext,
} from '../helpers/collectionFixtures.js';
import { getDb } from '../../src/db/drizzle.js';
import { users, appWidgetInstances, appShellSettings } from '../../src/db/schema/index.js';
import {
  getCollectionConfig,
  previewCollections,
  saveCollections,
} from '../../src/services/collectionService.js';
import { eq } from 'drizzle-orm';
describe('public collection widget scope', () => {
  let app: TestApp;
  const url = `/api/public/calendar/widgets/${collectionIds.widget}/collections`;
  beforeAll(async () => {
    app = await createTestApp();
    await app.request
      .post('/api/first-run/admin')
      .send({ username: 'admin', displayName: 'Admin', password: 'disposable-pass1' });
    seedCollectionContext(getDb().select().from(users).get()!.id);
    const config = getCollectionConfig();
    const draft = {
      ...collectionPreset(),
      expectedRevision: 0,
      runtimeEpoch: config.runtimeEpoch,
      range: { from: '2026-10-14', to: '2026-11-10' },
      confirmations: {
        timezoneConfirmed: true,
        deletedStreamIds: [],
        removedExceptionIds: [],
        clearedExplicitStreamIds: [],
      },
    };
    saveCollections({ ...draft, previewDigest: previewCollections(draft).previewDigest });
  });
  afterAll(async () => {
    await app.close();
  });
  it('returns exact saved public subset, no private keys, no-store and strict window validation', async () => {
    const result = await app.request.get(`${url}?from=2026-10-14&to=2026-11-10`);
    expect(result.status).toBe(200);
    expect(result.headers['cache-control']).toBe('no-store');
    expect(result.body.groups.map((g: { date: string }) => g.date)).toEqual([
      '2026-10-14',
      '2026-10-28',
    ]);
    expect(JSON.stringify(result.body)).not.toMatch(
      /providerLabel|General waste|Garden|anchorDate|weekdays|revision|runtimeEpoch/,
    );
    expect(
      (await app.request.get(`${url}?daysAhead=1&streamIds=${collectionIds.general}`)).status,
    ).toBe(422);
  });
  it('denies wrong widget/type/context before query details and has no public mutations', async () => {
    const mobile = await app.request
      .get(`${url}?bad=true`)
      .set('User-Agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');
    expect(mobile.status).toBe(404);
    expect(
      (
        await app.request.get(
          `/api/public/calendar/widgets/${collectionIds.general}/collections?bad=true`,
        )
      ).status,
    ).toBe(404);
    const before = getCollectionConfig();
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE'] as const) {
      const response = await app.app.inject({ method, url, payload: { private: true } });
      expect(response.statusCode).toBe(404);
    }
    expect(getCollectionConfig()).toEqual(before);
    const db = getDb();
    const row = db
      .select()
      .from(appWidgetInstances)
      .where(eq(appWidgetInstances.id, collectionIds.widget))
      .get()!;
    db.update(appWidgetInstances)
      .set({ type: 'clock' })
      .where(eq(appWidgetInstances.id, row.id))
      .run();
    expect((await app.app.inject({ method: 'GET', url: `${url}?bad=true` })).statusCode).toBe(404);
    db.update(appWidgetInstances)
      .set({ type: row.type })
      .where(eq(appWidgetInstances.id, row.id))
      .run();
  });
  it('limits anonymous per-IP requests using the existing widget limiter', async () => {
    let status = 0;
    for (let i = 0; i < 125 && status !== 429; i++) {
      const response = await app.app.inject({
        method: 'GET',
        url: `${url}?daysAhead=1`,
        remoteAddress: '192.0.2.65',
      });
      status = response.statusCode;
      if (status === 429) {
        expect(response.json()).toMatchObject({ error: 'TOO_MANY_REQUESTS' });
        expect(response.headers['retry-after']).toBeDefined();
      }
    }
    expect(status).toBe(429);
  });
  it('cannot broaden selection or designation using forged headers, and publishes only exact DTO fields', async () => {
    const response = await app.app.inject({
      method: 'GET',
      url: `${url}?from=2026-10-14&to=2026-11-10`,
      headers: {
        'x-dashboard-id': collectionIds.mobileDashboard,
        'x-user-id': collectionIds.general,
        'x-is-admin': 'true',
        'x-context': 'web',
      },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(Object.keys(body).sort()).toEqual([
      'groups',
      'householdToday',
      'range',
      'serverNow',
      'state',
      'timezone',
    ]);
    expect(Object.keys(body.groups[0]).sort()).toEqual(['date', 'streams']);
    expect(Object.keys(body.groups[0].streams[0]).sort()).toEqual(['color', 'key', 'name']);
    const denied = await app.app.inject({
      method: 'GET',
      url: `${url}?bad=true`,
      headers: {
        'user-agent': 'Mozilla/5.0 (iPhone)',
        'x-dashboard-id': collectionIds.webDashboard,
        'x-context': 'web',
      },
    });
    expect(denied.statusCode).toBe(404);
    expect(denied.body).not.toMatch(/bad|provider|stream|timezone/i);
  });
  it('revokes next fetch and fails closed on malformed config and missing designation', async () => {
    const widget = getDb()
      .select()
      .from(appWidgetInstances)
      .where(eq(appWidgetInstances.id, collectionIds.widget))
      .get()!;
    for (const configJson of ['{}', '{"collectionStreamIds":"bad"}']) {
      getDb()
        .update(appWidgetInstances)
        .set({ configJson })
        .where(eq(appWidgetInstances.id, widget.id))
        .run();
      expect((await app.request.get(`${url}?bad=true`)).status).toBe(404);
    }
    getDb()
      .update(appWidgetInstances)
      .set({ configJson: widget.configJson })
      .where(eq(appWidgetInstances.id, widget.id))
      .run();
    getDb()
      .update(appShellSettings)
      .set({ unauthWebDashboardId: null })
      .where(eq(appShellSettings.id, 'global'))
      .run();
    expect((await app.app.inject({ method: 'GET', url: `${url}?daysAhead=1` })).statusCode).toBe(
      404,
    );
  });
});
