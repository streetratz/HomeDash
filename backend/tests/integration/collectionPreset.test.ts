import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from '../helpers/http.js';
import {
  collectionPreset,
  presetExpected,
  seedCollectionContext,
} from '../helpers/collectionFixtures.js';
import {
  getCollectionConfig,
  previewCollections,
  saveCollections,
} from '../../src/services/collectionService.js';
import { getDb, _resetDbCache } from '../../src/db/drizzle.js';
import { closeSqliteDb, getSqliteDb } from '../../src/db/sqlite.js';
import {
  users,
  calendarSources,
  calendarBirthdays,
  appWidgetInstances,
} from '../../src/db/schema/index.js';

describe('offline preset persistence and provider isolation', () => {
  let app: TestApp;
  beforeAll(async () => {
    app = await createTestApp();
    await app.request
      .post('/api/first-run/admin')
      .send({ username: 'admin', displayName: 'Admin', password: 'disposable-pass1' });
  });
  afterAll(async () => {
    await app.close();
  });
  it('rejects Thursday and persists exact four Wednesdays through closing/reopening SQLite', () => {
    const user = getDb().select().from(users).get()!;
    seedCollectionContext(user.id);
    const beforeProviders = getDb().select().from(calendarSources).all();
    const beforeBirthdays = getDb().select().from(calendarBirthdays).all();
    const beforeWidgets = getDb().select().from(appWidgetInstances).all();
    const initial = getCollectionConfig();
    const input = {
      ...collectionPreset(),
      expectedRevision: initial.revision,
      runtimeEpoch: initial.runtimeEpoch,
      range: { from: '2026-10-14', to: '2026-11-10' },
      confirmations: {
        timezoneConfirmed: true,
        deletedStreamIds: [],
        removedExceptionIds: [],
        clearedExplicitStreamIds: [],
      },
    };
    const bad = structuredClone(input);
    bad.streams[1]!.schedule.anchorDate = '2026-10-15';
    expect(previewCollections(bad).canSave).toBe(false);
    expect(getCollectionConfig()).toEqual(initial);
    const preview = previewCollections(input);
    expect(preview.groups.map((g) => [g.date, g.streams.map((s) => s.name)])).toEqual(
      presetExpected,
    );
    expect(getCollectionConfig()).toEqual(initial);
    const saved = saveCollections({ ...input, previewDigest: preview.previewDigest });
    expect(getCollectionConfig()).toEqual(saved);
    closeSqliteDb();
    _resetDbCache();
    expect(getCollectionConfig()).toEqual(saved);
    expect(getDb().select().from(calendarSources).all()).toEqual(beforeProviders);
    expect(getDb().select().from(calendarBirthdays).all()).toEqual(beforeBirthdays);
    expect(getDb().select().from(appWidgetInstances).all()).toEqual(beforeWidgets);
    expect(getSqliteDb().pragma('foreign_key_check')).toEqual([]);
  });
});
