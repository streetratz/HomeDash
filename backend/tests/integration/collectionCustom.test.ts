import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from '../helpers/http.js';
import {
  getCollectionConfig,
  previewCollections,
  saveCollections,
} from '../../src/services/collectionService.js';
import { seedCollectionContext, collectionIds } from '../helpers/collectionFixtures.js';
import { getDb } from '../../src/db/drizzle.js';
import {
  appWidgetInstances,
  calendarSources,
  collectionStreams,
  users,
} from '../../src/db/schema/index.js';
import { eq } from 'drizzle-orm';
describe('independent custom stream lifecycle', () => {
  let app: TestApp;
  beforeAll(async () => {
    app = await createTestApp();
    await app.request
      .post('/api/first-run/admin')
      .send({ username: 'admin', displayName: 'Admin', password: 'disposable-pass1' });
    seedCollectionContext(getDb().select().from(users).get()!.id);
  });
  afterAll(async () => {
    await app.close();
  });
  const draft = () => {
    const config = getCollectionConfig();
    return {
      expectedRevision: config.revision,
      runtimeEpoch: config.runtimeEpoch,
      timezone: 'Australia/Sydney',
      providerLabel: null,
      streams: config.streams,
      range: { from: '2026-12-28', to: '2027-01-31' },
      confirmations: {
        timezoneConfirmed: true,
        deletedStreamIds: [] as string[],
        removedExceptionIds: [],
        clearedExplicitStreamIds: [],
      },
    };
  };
  it('enumerates Monday+Thursday weekly and Thursday fortnightly across year, permits same names/colours', () => {
    const input = draft();
    input.streams = [
      {
        id: collectionIds.general,
        name: 'Same name',
        color: '#123456',
        icon: 'Trash2',
        enabled: true,
        schedule: { mode: 'regular', weekdays: [1, 4], intervalWeeks: 1, anchorDate: '2026-12-31' },
        exceptions: [],
      },
      {
        id: collectionIds.recycling,
        name: 'Same name',
        color: '#123456',
        icon: 'Trash2',
        enabled: true,
        schedule: { mode: 'regular', weekdays: [4], intervalWeeks: 2, anchorDate: '2026-12-31' },
        exceptions: [],
      },
    ];
    const preview = previewCollections(input);
    expect(preview.canSave).toBe(true);
    expect(preview.groups.map((g) => [g.date, g.streams.length])).toEqual([
      ['2026-12-28', 1],
      ['2026-12-31', 2],
      ['2027-01-04', 1],
      ['2027-01-07', 1],
      ['2027-01-11', 1],
      ['2027-01-14', 2],
      ['2027-01-18', 1],
      ['2027-01-21', 1],
      ['2027-01-25', 1],
      ['2027-01-28', 2],
    ]);
    saveCollections({ ...input, previewDigest: preview.previewDigest });
  });
  it('rename/recolour/reorder/disable/re-enable preserves other rows and all recurrence dates', () => {
    const before = getDb()
      .select()
      .from(collectionStreams)
      .where(eq(collectionStreams.id, collectionIds.recycling))
      .get();
    const oldDates = previewCollections(draft()).groups.map((g) => g.date);
    const input = draft();
    input.streams[0] = { ...input.streams[0]!, name: 'Renamed', color: '#ABCDEF', enabled: false };
    saveCollections({ ...input, previewDigest: previewCollections(input).previewDigest });
    expect(
      getDb()
        .select()
        .from(collectionStreams)
        .where(eq(collectionStreams.id, collectionIds.recycling))
        .get(),
    ).toEqual(before);
    const enable = draft();
    enable.streams[0] = { ...enable.streams[0]!, enabled: true };
    expect(previewCollections(enable).groups.map((g) => g.date)).toEqual(oldDates);
    enable.streams.reverse();
    saveCollections({ ...enable, previewDigest: previewCollections(enable).previewDigest });
    expect(getCollectionConfig().streams.map((s) => s.id)).toEqual([
      collectionIds.recycling,
      collectionIds.general,
    ]);
  });
  it('requires exact removal confirmation and prunes only removed IDs, tolerating unrelated malformed widgets', () => {
    const providers = getDb().select().from(calendarSources).all();
    const before = getCollectionConfig();
    const input = draft();
    input.streams = input.streams.filter((s) => s.id !== collectionIds.general);
    expect(previewCollections(input).canSave).toBe(false);
    expect(getCollectionConfig()).toEqual(before);
    input.confirmations.deletedStreamIds = [collectionIds.general];
    saveCollections({ ...input, previewDigest: previewCollections(input).previewDigest });
    const widget = getDb().select().from(appWidgetInstances).get()!;
    const config = JSON.parse(widget.configJson) as {
      sourceIds: string[];
      collectionStreamIds: string[];
      publicCollectionStreamIds: string[];
    };
    expect(config.collectionStreamIds).not.toContain(collectionIds.general);
    expect(config.publicCollectionStreamIds).toEqual([collectionIds.recycling]);
    expect(config.sourceIds).toEqual([collectionIds.provider, collectionIds.birthday]);
    expect(getDb().select().from(calendarSources).all()).toEqual(providers);
    getDb()
      .update(appWidgetInstances)
      .set({ configJson: '{malformed' })
      .where(eq(appWidgetInstances.id, widget.id))
      .run();
    const last = draft();
    last.streams = [];
    last.confirmations.deletedStreamIds = [collectionIds.recycling];
    expect(() =>
      saveCollections({ ...last, previewDigest: previewCollections(last).previewDigest }),
    ).not.toThrow();
    expect(getCollectionConfig().configured).toBe(true);
    expect(getCollectionConfig().streams).toEqual([]);
  });
  it('matches hand-enumerated all-seven, three-weekday, four-week and 52-week calendars', () => {
    const input = draft();
    const regular = (weekdays: number[], intervalWeeks: number) => ({
      id: collectionIds.general,
      name: 'Independent',
      color: '#123456',
      icon: 'Trash2' as const,
      enabled: true,
      schedule: { mode: 'regular' as const, weekdays, intervalWeeks, anchorDate: '2026-12-28' },
      exceptions: [],
    });
    input.range = { from: '2026-12-28', to: '2027-01-03' };
    input.streams = [regular([1, 2, 3, 4, 5, 6, 7], 1)];
    expect(previewCollections(input).groups.map((g) => g.date)).toEqual([
      '2026-12-28',
      '2026-12-29',
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
      '2027-01-03',
    ]);
    input.streams = [regular([1, 3, 5], 1)];
    expect(previewCollections(input).groups.map((g) => g.date)).toEqual([
      '2026-12-28',
      '2026-12-30',
      '2027-01-01',
    ]);
    input.range = { from: '2026-12-28', to: '2027-02-28' };
    input.streams = [regular([1], 4)];
    expect(previewCollections(input).groups.map((g) => g.date)).toEqual([
      '2026-12-28',
      '2027-01-25',
      '2027-02-22',
    ]);
    input.range = { from: '2026-12-28', to: '2027-12-27' };
    input.streams = [regular([1], 52)];
    expect(previewCollections(input).groups.map((g) => g.date)).toEqual([
      '2026-12-28',
      '2027-12-27',
    ]);
  });
});
