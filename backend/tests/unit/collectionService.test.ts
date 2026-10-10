import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from '../helpers/http.js';
import { collectionPreset, collectionIds, presetExpected } from '../helpers/collectionFixtures.js';
import {
  collectionDraftSchema,
  getCollectionConfig,
  previewCollections,
  saveCollections,
  invalidateCollectionEpoch,
  readCollectionDisplay,
  resolveCollectionWidget,
} from '../../src/services/collectionService.js';
import { getDb } from '../../src/db/drizzle.js';
import { collectionExceptions, collectionStreams } from '../../src/db/schema/index.js';
import { eq } from 'drizzle-orm';
import { getSqliteDb } from '../../src/db/sqlite.js';
import { seedCollectionContext } from '../helpers/collectionFixtures.js';
import { users } from '../../src/db/schema/index.js';
import { resolvePublicCollectionWidget } from '../../src/services/publicVisibility.js';
import { setAppLogger } from '../../src/lib/logger.js';
import pino from 'pino';

describe('strict collection aggregate and atomic diff', () => {
  let app: TestApp;
  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(async () => {
    await app.close();
  });
  const draft = () => ({
    ...collectionPreset(),
    expectedRevision: getCollectionConfig().revision,
    runtimeEpoch: getCollectionConfig().runtimeEpoch,
    range: { from: '2026-10-14', to: '2026-11-10' },
    confirmations: {
      timezoneConfirmed: true,
      deletedStreamIds: [],
      removedExceptionIds: [],
      clearedExplicitStreamIds: [],
    },
  });
  it('rejects unknown fields/coercions/invalid text/timezone/colour/limits', () => {
    const confirmationIds = Array.from({ length: 8192 }, () => crypto.randomUUID());
    expect(
      collectionDraftSchema.safeParse({
        ...draft(),
        confirmations: { ...draft().confirmations, removedExceptionIds: confirmationIds },
      }).success,
    ).toBe(true);
    expect(
      collectionDraftSchema.safeParse({
        ...draft(),
        confirmations: {
          ...draft().confirmations,
          removedExceptionIds: [...confirmationIds, crypto.randomUUID()],
        },
      }).success,
    ).toBe(false);
    for (const patch of [
      { unknown: true },
      { timezone: '+10:00' },
      { timezone: 'not/a-zone' },
      { providerLabel: 'control\u0000label' },
      { expectedRevision: '0' },
      { streams: Array.from({ length: 33 }, () => collectionPreset().streams[0]) },
    ])
      expect(collectionDraftSchema.safeParse({ ...draft(), ...patch }).success).toBe(false);
    const base = draft();
    for (const patch of [
      { color: 'red' },
      { name: '' },
      { name: 'x'.repeat(81) },
      { enabled: 'true' },
      { schedule: { mode: 'regular', weekdays: [], intervalWeeks: 2, anchorDate: '2026-10-14' } },
      {
        schedule: { mode: 'regular', weekdays: [3, 3], intervalWeeks: 2, anchorDate: '2026-10-14' },
      },
      { schedule: { mode: 'regular', weekdays: [3], intervalWeeks: 0, anchorDate: '2026-10-14' } },
    ]) {
      expect(
        collectionDraftSchema.safeParse({ ...base, streams: [{ ...base.streams[0], ...patch }] })
          .success,
      ).toBe(false);
    }
    const explicit = { ...base.streams[0], schedule: { mode: 'explicit', dates: ['2026-10-14'] } };
    expect(collectionDraftSchema.safeParse({ ...base, streams: [explicit] }).success).toBe(false); // regular exceptions forbidden
    const first = base.streams[0]!;
    const common = {
      id: first.id,
      name: first.name,
      color: first.color,
      icon: first.icon,
      enabled: first.enabled,
    };
    for (const dates of [
      [],
      ['2026-10-14', '2026-10-14'],
      Array.from({ length: 2049 }, (_, i) =>
        new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
      ),
    ]) {
      expect(
        collectionDraftSchema.safeParse({
          ...base,
          streams: [{ ...common, schedule: { mode: 'explicit', dates } }],
        }).success,
      ).toBe(false);
    }
    const dates = Array.from({ length: 2048 }, (_, i) =>
      new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
    );
    const makeExplicit = (i: number) => ({
      ...common,
      id: `06500000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      schedule: { mode: 'explicit', dates },
    });
    expect(
      collectionDraftSchema.safeParse({
        ...base,
        streams: Array.from({ length: 4 }, (_, i) => makeExplicit(i)),
      }).success,
    ).toBe(true);
    expect(
      collectionDraftSchema.safeParse({
        ...base,
        streams: Array.from({ length: 5 }, (_, i) => makeExplicit(i)),
      }).success,
    ).toBe(false);
    expect(
      collectionDraftSchema.safeParse({
        ...base,
        streams: [
          {
            ...base.streams[0],
            exceptions: Array.from({ length: 513 }, (_, i) => ({
              id: `06500000-0000-4000-8000-${String(i).padStart(12, '0')}`,
              kind: 'add',
              actualDate: dates[i],
            })),
          },
        ],
      }).success,
    ).toBe(false);
  });
  it('previews the four-Wednesday oracle without writes, saves and rejects stale/digest edits', () => {
    const before = getCollectionConfig();
    const input = draft();
    const preview = previewCollections(input);
    expect(preview.canSave).toBe(true);
    expect(preview.groups.map((g) => [g.date, g.streams.map((s) => s.name)])).toEqual(
      presetExpected,
    );
    expect(getCollectionConfig()).toEqual(before);
    const saved = saveCollections({ ...input, previewDigest: preview.previewDigest });
    expect(saved.revision).toBe(1);
    expect(() => saveCollections({ ...input, previewDigest: preview.previewDigest })).toThrow(
      /changed/i,
    );
    const edited = draft();
    const valid = previewCollections(edited);
    expect(() =>
      saveCollections({ ...edited, providerLabel: 'edited', previewDigest: valid.previewDigest }),
    ).toThrow(/preview/i);
  });
  it('validates disabled schedules and complete exception collisions outside preview', () => {
    const input = draft();
    input.streams[0]!.enabled = false;
    const invalid = {
      ...input,
      streams: [
        {
          ...input.streams[0],
          schedule: {
            mode: 'regular',
            weekdays: [3],
            intervalWeeks: 1,
            anchorDate: '2026-10-15',
          },
          exceptions: [],
        },
      ],
    };
    expect(previewCollections(invalid).canSave).toBe(false);
    const colliding = {
      ...input,
      streams: [
        {
          ...input.streams[0],
          exceptions: [{ id: collectionIds.exceptionA, kind: 'add', actualDate: '2028-01-05' }],
        },
      ],
    };
    expect(previewCollections(colliding).canSave).toBe(false);
  });
  it('permits valid destination swaps while preserving IDs/createdAt and unchanged streams', () => {
    const input = draft();
    const withExceptions = {
      ...input,
      streams: input.streams.map((s, i) =>
        i
          ? s
          : {
              ...s,
              exceptions: [
                {
                  id: collectionIds.exceptionA,
                  kind: 'replace',
                  originalDate: '2026-10-14',
                  actualDate: '2026-10-15',
                },
                {
                  id: collectionIds.exceptionB,
                  kind: 'replace',
                  originalDate: '2026-10-21',
                  actualDate: '2026-10-22',
                },
              ],
            },
      ),
    };
    const first = previewCollections(withExceptions);
    expect(first.canSave).toBe(true);
    saveCollections({ ...withExceptions, previewDigest: first.previewDigest });
    const before = getDb().select().from(collectionExceptions).all();
    const other = getDb()
      .select()
      .from(collectionStreams)
      .where(eq(collectionStreams.id, collectionIds.garden))
      .get();
    const current = getCollectionConfig();
    const swapped = {
      ...draft(),
      streams: current.streams.map((s) =>
        'exceptions' in s && s.id === collectionIds.general
          ? {
              ...s,
              exceptions: s.exceptions.map((e) =>
                e.kind === 'replace'
                  ? {
                      ...e,
                      actualDate: e.id === collectionIds.exceptionA ? '2026-10-22' : '2026-10-15',
                    }
                  : e,
              ),
            }
          : s,
      ),
    };
    const second = previewCollections(swapped);
    expect(second.canSave).toBe(true);
    saveCollections({ ...swapped, previewDigest: second.previewDigest });
    const after = getDb().select().from(collectionExceptions).all();
    expect(after.map((e) => [e.id, e.createdAt])).toEqual(before.map((e) => [e.id, e.createdAt]));
    expect(
      getDb()
        .select()
        .from(collectionStreams)
        .where(eq(collectionStreams.id, collectionIds.garden))
        .get(),
    ).toEqual(other);
    const noOp = { ...draft(), streams: getCollectionConfig().streams };
    const noOpPreview = previewCollections(noOp);
    getSqliteDb().exec(
      "CREATE TEMP TRIGGER unchanged_exception BEFORE DELETE ON collection_exceptions BEGIN SELECT RAISE(ABORT, 'unchanged rows must not be deleted'); END",
    );
    try {
      saveCollections({ ...noOp, previewDigest: noOpPreview.previewDigest });
      expect(getDb().select().from(collectionExceptions).all()).toEqual(after);
    } finally {
      getSqliteDb().exec('DROP TRIGGER unchanged_exception');
    }
  });
  it('rolls back injected insertion failure and sanitizes private SQL values', () => {
    const before = getCollectionConfig();
    const input = { ...draft(), streams: before.streams, providerLabel: 'private-sentinel' };
    const preview = previewCollections(input);
    const logs: string[] = [];
    setAppLogger(
      pino(
        { level: 'trace' },
        {
          write: (text) => {
            logs.push(text);
          },
        },
      ),
    );
    getSqliteDb().exec(
      "CREATE TEMP TRIGGER collection_failure BEFORE UPDATE ON collection_household BEGIN SELECT RAISE(ABORT, 'private-sentinel bind parameters'); END",
    );
    try {
      expect(() => saveCollections({ ...input, previewDigest: preview.previewDigest })).toThrow(
        'Unable to save collections',
      );
      expect(getCollectionConfig()).toEqual(before);
      expect(logs.join(' ')).not.toMatch(/private-sentinel|bind parameters/);
      expect(logs.join(' ')).toContain('storage_failure');
    } finally {
      getSqliteDb().exec('DROP TRIGGER collection_failure');
      setAppLogger(pino({ level: 'silent' }));
    }
  });
  it('requires exact destructive confirmations and rejects pre-restore epoch', () => {
    const input = { ...draft(), streams: [] };
    expect(previewCollections(input).canSave).toBe(false);
    const before = getCollectionConfig();
    const confirmed = {
      ...input,
      confirmations: { ...input.confirmations, deletedStreamIds: before.streams.map((s) => s.id) },
    };
    const preview = previewCollections(confirmed);
    expect(preview.canSave).toBe(true);
    invalidateCollectionEpoch();
    expect(() => saveCollections({ ...confirmed, previewDigest: preview.previewDigest })).toThrow(
      /changed/i,
    );
    expect(getCollectionConfig().streams).toEqual(before.streams);
  });
  it('resolves actual Calendar/designated context and emits only allowlisted selected groups', async () => {
    await app.request
      .post('/api/first-run/admin')
      .send({ username: 'admin', displayName: 'Admin', password: 'synthetic-pass1' });
    seedCollectionContext(getDb().select().from(users).get()!.id);
    expect(resolveCollectionWidget(collectionIds.widget)?.config.sourceIds).toEqual([
      collectionIds.provider,
      collectionIds.birthday,
    ]);
    expect(resolveCollectionWidget(collectionIds.general)).toBeNull();
    expect(resolvePublicCollectionWidget('web', collectionIds.widget)?.streamIds).toEqual([
      collectionIds.recycling,
    ]);
    expect(resolvePublicCollectionWidget('mobile', collectionIds.widget)).toBeNull();
    const display = readCollectionDisplay(
      [collectionIds.recycling],
      { daysAhead: '28' },
      true,
      new Date('2026-10-13T13:00:00Z'),
    );
    expect(display.householdToday).toBe('2026-10-14');
    expect(display.groups.flatMap((g) => g.streams.map((s) => s.name))).toEqual([
      'Recycling',
      'Recycling',
      'Recycling',
    ]);
    expect(JSON.stringify(display)).not.toMatch(
      /providerLabel|runtimeEpoch|revision|anchorDate|weekdays|exceptions|Synthetic private/,
    );
    expect(readCollectionDisplay([], { daysAhead: '1' }).state).toBe('not_selected');
    expect(readCollectionDisplay([], { daysAhead: '1' }, true).state).toBe('no_dates');
    for (const input of [
      { daysAhead: '0' },
      { daysAhead: '91' },
      { daysAhead: 1 },
      { daysAhead: '1', streamIds: [] },
      { from: '2026-01-01', to: '2028-01-02' },
    ])
      expect(() => readCollectionDisplay([], input)).toThrow();
  });
});
