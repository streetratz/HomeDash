/**
 * Custom Calendar Events refactor: offline icon identity, inclusive first/end
 * date bounds, one-off (Repeat Off) events, additive preset isolation and the
 * public allowlisted-icon projection. Every expected date is hand enumerated.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from '../helpers/http.js';
import {
  getCollectionConfig,
  previewCollections,
  saveCollections,
  collectionDraftSchema,
} from '../../src/services/collectionService.js';
import { seedCollectionContext, collectionIds } from '../helpers/collectionFixtures.js';
import { getDb } from '../../src/db/drizzle.js';
import { collectionStreams, users } from '../../src/db/schema/index.js';
import { eq } from 'drizzle-orm';

describe('custom calendar events', () => {
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
      providerLabel: null as string | null,
      streams: config.streams,
      range: { from: '2026-12-28', to: '2027-01-31' },
      confirmations: {
        timezoneConfirmed: true,
        deletedStreamIds: [] as string[],
        removedExceptionIds: [] as string[],
        clearedExplicitStreamIds: [] as string[],
      },
    };
  };

  /**
   * Derive the destructive-change confirmations required to replace the whole
   * configured set with `streams`, so each test is independent of prior state:
   * confirm deletions of dropped ids and explicit→regular clears on reused ids.
   */
  const autoConfirm = (input: ReturnType<typeof draft>) => {
    const config = getCollectionConfig();
    const nextIds = new Set(input.streams.map((s) => s.id));
    input.confirmations.deletedStreamIds = config.streams
      .filter((s) => !nextIds.has(s.id))
      .map((s) => s.id);
    input.confirmations.clearedExplicitStreamIds = config.streams
      .filter((s) => s.schedule.mode === 'explicit')
      .filter((s) => {
        const next = input.streams.find((n) => n.id === s.id);
        return next != null && next.schedule.mode === 'regular';
      })
      .map((s) => s.id);
    return input;
  };

  const save = (input: ReturnType<typeof draft>) =>
    saveCollections({ ...input, previewDigest: previewCollections(input).previewDigest });

  it('persists a one-off (Repeat Off) event with its title, offline icon and colour unchanged', () => {
    const input = draft();
    input.range = { from: '2026-12-28', to: '2027-01-31' };
    input.streams = [
      {
        id: collectionIds.general,
        name: 'Dentist',
        color: '#2563EB',
        icon: 'CalendarCheck',
        enabled: true,
        schedule: { mode: 'explicit', dates: ['2027-01-15'] },
      },
    ];
    expect(previewCollections(input).groups.map((g) => [g.date, g.streams.length])).toEqual([
      ['2027-01-15', 1],
    ]);
    save(input);
    const row = getDb()
      .select()
      .from(collectionStreams)
      .where(eq(collectionStreams.id, collectionIds.general))
      .get()!;
    expect([row.name, row.color, row.icon, row.scheduleMode]).toEqual([
      'Dentist',
      '#2563EB',
      'CalendarCheck',
      'explicit',
    ]);
    const stored = getCollectionConfig().streams.find((s) => s.id === collectionIds.general)!;
    expect(stored.icon).toBe('CalendarCheck');
  });

  it('edits a one-off title/icon/colour without altering its date', () => {
    const input = draft();
    const existing = getCollectionConfig().streams.find((s) => s.id === collectionIds.general)!;
    input.streams = getCollectionConfig().streams.map((s) =>
      s.id === collectionIds.general
        ? { ...s, name: 'Dental checkup', color: '#7C3AED', icon: 'Stethoscope' }
        : s,
    );
    save(input);
    const row = getDb()
      .select()
      .from(collectionStreams)
      .where(eq(collectionStreams.id, collectionIds.general))
      .get()!;
    expect([row.name, row.color, row.icon]).toEqual(['Dental checkup', '#7C3AED', 'Stethoscope']);
    expect(row.scheduleMode).toBe(existing.schedule.mode);
  });

  it('honours inclusive first and end date bounds and suppresses earlier or later occurrences', () => {
    const input = draft();
    input.range = { from: '2026-12-01', to: '2027-02-28' };
    input.streams = [
      {
        id: collectionIds.general,
        name: 'Bounded weekly',
        color: '#DC2626',
        icon: 'Trash2',
        enabled: true,
        schedule: {
          mode: 'regular',
          weekdays: [1],
          intervalWeeks: 1,
          anchorDate: '2026-12-28',
          startDate: '2026-12-28',
          endDate: '2027-01-18',
        },
        exceptions: [],
      },
    ];
    expect(previewCollections(autoConfirm(input)).groups.map((g) => g.date)).toEqual([
      '2026-12-28',
      '2027-01-04',
      '2027-01-11',
      '2027-01-18',
    ]);
  });

  it('includes a leap day inside bounds and the exact end date', () => {
    const input = draft();
    input.range = { from: '2028-02-01', to: '2028-03-31' };
    input.streams = [
      {
        id: collectionIds.general,
        name: 'Leap bounded',
        color: '#DC2626',
        icon: 'Trash2',
        enabled: true,
        schedule: {
          mode: 'regular',
          weekdays: [2],
          intervalWeeks: 1,
          anchorDate: '2028-02-01',
          startDate: '2028-02-15',
          endDate: '2028-02-29',
        },
        exceptions: [],
      },
    ];
    expect(previewCollections(autoConfirm(input)).groups.map((g) => g.date)).toEqual([
      '2028-02-15',
      '2028-02-22',
      '2028-02-29',
    ]);
  });

  it('rejects an end date earlier than the first date at schema validation', () => {
    const parsed = collectionDraftSchema.safeParse({
      ...draft(),
      streams: [
        {
          id: collectionIds.general,
          name: 'Reversed',
          color: '#DC2626',
          icon: 'Trash2',
          enabled: true,
          schedule: {
            mode: 'regular',
            weekdays: [1],
            intervalWeeks: 1,
            anchorDate: '2026-12-28',
            startDate: '2027-01-18',
            endDate: '2026-12-28',
          },
          exceptions: [],
        },
      ],
    });
    expect(parsed.success).toBe(false);
  });

  it('blocks a move whose destination falls outside the bounds before any write', () => {
    const input = draft();
    input.range = { from: '2026-12-01', to: '2027-02-28' };
    input.streams = [
      {
        id: collectionIds.general,
        name: 'Bounded with move',
        color: '#DC2626',
        icon: 'Trash2',
        enabled: true,
        schedule: {
          mode: 'regular',
          weekdays: [1],
          intervalWeeks: 1,
          anchorDate: '2026-12-28',
          startDate: '2026-12-28',
          endDate: '2027-01-18',
        },
        exceptions: [
          {
            id: collectionIds.exceptionA,
            kind: 'replace',
            originalDate: '2027-01-18',
            actualDate: '2027-01-25',
          },
        ],
      },
    ];
    expect(previewCollections(input).canSave).toBe(false);
    expect(() => save(input)).toThrow();
  });

  it('blocks a skip whose origin falls outside the bounds before any write', () => {
    const input = draft();
    input.streams = [
      {
        id: collectionIds.general,
        name: 'Bounded with skip',
        color: '#DC2626',
        icon: 'Trash2',
        enabled: true,
        schedule: {
          mode: 'regular',
          weekdays: [1],
          intervalWeeks: 1,
          anchorDate: '2026-12-28',
          startDate: '2026-12-28',
          endDate: '2027-01-11',
        },
        exceptions: [{ id: collectionIds.exceptionA, kind: 'skip', originalDate: '2027-01-18' }],
      },
    ];
    expect(previewCollections(input).canSave).toBe(false);
  });

  it('rejects an icon outside the offline allowlist', () => {
    const parsed = collectionDraftSchema.safeParse({
      ...draft(),
      streams: [
        {
          id: collectionIds.general,
          name: 'Bad icon',
          color: '#DC2626',
          icon: 'NotARealIcon',
          enabled: true,
          schedule: { mode: 'explicit', dates: ['2027-01-15'] },
        },
      ],
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects an external icon URL as a non-allowlisted icon', () => {
    const parsed = collectionDraftSchema.safeParse({
      ...draft(),
      streams: [
        {
          id: collectionIds.general,
          name: 'URL icon',
          color: '#DC2626',
          icon: 'https://cdn.example.com/icon.svg',
          enabled: true,
          schedule: { mode: 'explicit', dates: ['2027-01-15'] },
        },
      ],
    });
    expect(parsed.success).toBe(false);
  });

  it('round-trips a disabled then re-enabled event preserving every occurrence', () => {
    const input = draft();
    input.range = { from: '2026-12-28', to: '2027-01-25' };
    input.streams = [
      {
        id: collectionIds.general,
        name: 'Toggleable',
        color: '#DC2626',
        icon: 'Trash2',
        enabled: true,
        schedule: { mode: 'regular', weekdays: [1], intervalWeeks: 1, anchorDate: '2026-12-28' },
        exceptions: [],
      },
    ];
    autoConfirm(input);
    const enabledDates = previewCollections(input).groups.map((g) => g.date);
    save(input);
    const disabled = draft();
    disabled.range = { from: '2026-12-28', to: '2027-01-25' };
    disabled.streams = getCollectionConfig().streams.map((s) => ({ ...s, enabled: false }));
    save(disabled);
    const disabledCheck = draft();
    disabledCheck.range = { from: '2026-12-28', to: '2027-01-25' };
    expect(previewCollections(disabledCheck).groups).toEqual([]);
    const reEnabled = draft();
    reEnabled.range = { from: '2026-12-28', to: '2027-01-25' };
    reEnabled.streams = getCollectionConfig().streams.map((s) => ({ ...s, enabled: true }));
    expect(previewCollections(reEnabled).groups.map((g) => g.date)).toEqual(enabledDates);
  });

  it('projects the allowlisted icon on the authenticated DTO without rules or bounds', () => {
    const input = draft();
    input.range = { from: '2026-12-28', to: '2027-01-11' };
    input.streams = [
      {
        id: collectionIds.general,
        name: 'Projected',
        color: '#DC2626',
        icon: 'Recycle',
        enabled: true,
        schedule: {
          mode: 'regular',
          weekdays: [1],
          intervalWeeks: 1,
          anchorDate: '2026-12-28',
          startDate: '2026-12-28',
          endDate: '2027-01-11',
        },
        exceptions: [],
      },
    ];
    const groups = previewCollections(autoConfirm(input)).groups;
    const streamDto = groups[0]!.streams[0]!;
    expect(Object.keys(streamDto).sort()).toEqual(['color', 'icon', 'key', 'name']);
    expect(streamDto.icon).toBe('Recycle');
  });
});
