import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from '../helpers/http.js';
import {
  getCollectionConfig,
  previewCollections,
  saveCollections,
} from '../../src/services/collectionService.js';
import { collectionIds } from '../helpers/collectionFixtures.js';
describe('irregular aggregate acceptance', () => {
  let app: TestApp;
  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(async () => {
    await app.close();
  });
  const input = () => {
    const config = getCollectionConfig();
    return {
      expectedRevision: config.revision,
      runtimeEpoch: config.runtimeEpoch,
      timezone: 'Australia/Sydney',
      providerLabel: null,
      streams: config.streams,
      range: { from: '2026-12-24', to: '2027-01-08' },
      confirmations: {
        timezoneConfirmed: true,
        deletedStreamIds: [],
        removedExceptionIds: [] as string[],
        clearedExplicitStreamIds: [] as string[],
      },
    };
  };
  it('weekly and fortnightly holiday moves preserve subsequent cycles, actual dates and finite explicit list', () => {
    const draft = input();
    draft.streams = [
      {
        id: collectionIds.general,
        name: 'Weekly',
        color: '#123456',
        icon: 'Trash2',
        enabled: true,
        schedule: { mode: 'regular', weekdays: [5], intervalWeeks: 1, anchorDate: '2026-12-25' },
        exceptions: [
          {
            id: collectionIds.exceptionA,
            kind: 'replace',
            originalDate: '2026-12-25',
            actualDate: '2026-12-26',
          },
        ],
      },
      {
        id: collectionIds.recycling,
        name: 'Fortnightly',
        color: '#123456',
        icon: 'Trash2',
        enabled: true,
        schedule: { mode: 'regular', weekdays: [5], intervalWeeks: 2, anchorDate: '2026-12-25' },
        exceptions: [
          {
            id: collectionIds.exceptionB,
            kind: 'replace',
            originalDate: '2026-12-25',
            actualDate: '2026-12-24',
          },
        ],
      },
      {
        id: collectionIds.garden,
        name: 'Explicit',
        color: '#123456',
        icon: 'Trash2',
        enabled: true,
        schedule: { mode: 'explicit', dates: ['2026-12-14', '2027-01-18', '2027-02-15'] },
      },
    ];
    const preview = previewCollections(draft);
    expect(preview.canSave).toBe(true);
    expect(preview.groups.map((g) => [g.date, g.streams.map((s) => s.name)])).toEqual([
      ['2026-12-24', ['Fortnightly']],
      ['2026-12-26', ['Weekly']],
      ['2027-01-01', ['Weekly']],
      ['2027-01-08', ['Weekly', 'Fortnightly']],
    ]);
    saveCollections({ ...draft, previewDigest: preview.previewDigest });
    const targetOnly = { ...input(), range: { from: '2026-12-26', to: '2026-12-26' } };
    expect(previewCollections(targetOnly).groups.map((g) => g.streams[0]?.name)).toEqual([
      'Weekly',
    ]);
    const explicit = {
      ...input(),
      range: { from: '2027-01-09', to: '2027-02-28' },
      streams: getCollectionConfig().streams.filter((s) => s.id === collectionIds.garden),
    };
    explicit.confirmations.deletedStreamIds = [];
    // Read-only date computation: preview aggregate must retain other configured streams.
    const all = previewCollections({ ...input(), range: explicit.range });
    expect(
      all.groups.filter((g) => g.streams.some((s) => s.name === 'Explicit')).map((g) => g.date),
    ).toEqual(['2027-01-18', '2027-02-15']);
  });
  it('rejects collisions/orphans even disabled/outside range, and restores base on confirmed removal', () => {
    const original = getCollectionConfig();
    const bad = input();
    const weekly = bad.streams[0]!;
    if (!('exceptions' in weekly)) throw new Error('Fixture must be regular');
    bad.streams[0] = {
      ...weekly,
      enabled: false,
      exceptions: [
        ...weekly.exceptions,
        { id: crypto.randomUUID(), kind: 'add', actualDate: '2028-01-07' },
      ],
    };
    expect(previewCollections(bad).canSave).toBe(false);
    expect(getCollectionConfig()).toEqual(original);
    const orphan = input();
    const first = orphan.streams[0]!;
    if (!('exceptions' in first)) throw new Error('Fixture must be regular');
    orphan.streams[0] = {
      ...first,
      exceptions: [{ id: collectionIds.exceptionA, kind: 'skip', originalDate: '2026-12-24' }],
    };
    expect(previewCollections(orphan).canSave).toBe(false);
    const removed = input();
    const stream = removed.streams[0]!;
    if (!('exceptions' in stream)) throw new Error('Fixture must be regular');
    removed.streams[0] = { ...stream, exceptions: [] };
    expect(previewCollections(removed).canSave).toBe(false);
    removed.confirmations.removedExceptionIds = [collectionIds.exceptionA];
    expect(
      previewCollections(removed)
        .groups.find((g) => g.date === '2026-12-25')
        ?.streams.map((s) => s.name),
    ).toEqual(['Weekly']);
    saveCollections({ ...removed, previewDigest: previewCollections(removed).previewDigest });
  });
  it('requires explicit-mode clear confirmation and atomically replaces only that schedule', () => {
    const draft = input();
    const explicit = draft.streams.find((s) => s.id === collectionIds.garden)!;
    draft.streams = draft.streams.map((s) =>
      s.id === explicit.id
        ? {
            id: s.id,
            name: s.name,
            color: s.color,
            icon: s.icon,
            enabled: s.enabled,
            schedule: {
              mode: 'regular',
              weekdays: [1],
              intervalWeeks: 4,
              anchorDate: '2026-12-14',
            },
            exceptions: [],
          }
        : s,
    );
    expect(previewCollections(draft).canSave).toBe(false);
    draft.confirmations.clearedExplicitStreamIds = [explicit.id];
    const before = getCollectionConfig().streams.filter((s) => s.id !== explicit.id);
    saveCollections({ ...draft, previewDigest: previewCollections(draft).previewDigest });
    expect(getCollectionConfig().streams.filter((s) => s.id !== explicit.id)).toEqual(before);
  });
  it('permits suppressed-base targets but rejects removing the skip until all restoration conflicts are resolved together', () => {
    const draft = input();
    const skipId = crypto.randomUUID();
    const moveId = crypto.randomUUID();
    draft.streams[0] = {
      id: collectionIds.general,
      name: 'Twice weekly',
      color: '#123456',
      icon: 'Trash2',
      enabled: true,
      schedule: { mode: 'regular', weekdays: [1, 4], intervalWeeks: 1, anchorDate: '2026-12-28' },
      exceptions: [
        { id: skipId, kind: 'skip', originalDate: '2026-12-28' },
        { id: moveId, kind: 'replace', originalDate: '2026-12-31', actualDate: '2026-12-28' },
      ],
    };
    expect(previewCollections(draft).canSave).toBe(true);
    saveCollections({ ...draft, previewDigest: previewCollections(draft).previewDigest });
    const before = getCollectionConfig();
    const remove = input();
    const current = remove.streams[0]!;
    if (!('exceptions' in current)) throw new Error('Fixture must be regular');
    remove.streams[0] = {
      ...current,
      exceptions: current.exceptions.filter((e) => e.id !== skipId),
    };
    remove.confirmations.removedExceptionIds = [skipId];
    expect(previewCollections(remove).canSave).toBe(false);
    expect(getCollectionConfig()).toEqual(before);
    const resolving = remove.streams[0];
    if (!('exceptions' in resolving)) throw new Error('Fixture must be regular');
    remove.streams[0] = {
      ...resolving,
      exceptions: [
        { id: moveId, kind: 'replace', originalDate: '2026-12-31', actualDate: '2026-12-29' },
      ],
    };
    expect(previewCollections(remove).canSave).toBe(true);
    saveCollections({ ...remove, previewDigest: previewCollections(remove).previewDigest });
    expect(getCollectionConfig().streams[1]).toEqual(before.streams[1]);
  });
});
