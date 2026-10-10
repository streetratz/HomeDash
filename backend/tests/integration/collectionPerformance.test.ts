import { performance } from 'node:perf_hooks';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from '../helpers/http.js';
import { collectionDates, type RegularSchedule } from '../../src/services/collectionDates.js';
import {
  getCollectionConfig,
  previewCollections,
  readCollectionDisplay,
  saveCollections,
} from '../../src/services/collectionService.js';

describe('independent collection oracle and bounded measurement', () => {
  let app: TestApp;
  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it('matches a week-enumerating independent oracle for 24 months including leap day', () => {
    const from = '2027-01-01';
    const to = '2028-12-31';
    for (const intervalWeeks of [1, 2, 4, 52]) {
      const schedule: RegularSchedule = {
        mode: 'regular',
        weekdays: [1, 3, 7],
        intervalWeeks,
        anchorDate: '2026-12-30',
      };
      // Independent reference enumerates active Monday weeks, not production day predicates.
      const monday = new Date('2026-12-28T00:00:00Z');
      const expected: string[] = [];
      while (monday.toISOString().slice(0, 10) <= to) {
        for (const offset of [0, 2, 6]) {
          const day = new Date(monday);
          day.setUTCDate(day.getUTCDate() + offset);
          const key = day.toISOString().slice(0, 10);
          if (key >= from && key <= to) expected.push(key);
        }
        monday.setUTCDate(monday.getUTCDate() + 7 * intervalWeeks);
      }
      expect(collectionDates(schedule, [], from, to)).toEqual(expected);
    }
  });

  it('measures warm 90-day p95 and max-32-stream 731-day display without truncation', () => {
    const config = getCollectionConfig();
    const streams = Array.from({ length: 32 }, (_, i) => ({
      id: crypto.randomUUID(),
      name: `Synthetic ${i + 1}`,
      color: '#123456',
      enabled: true,
      schedule: {
        mode: 'regular' as const,
        weekdays: [1, 2, 3, 4, 5, 6, 7],
        intervalWeeks: 1,
        anchorDate: '2026-10-12',
      },
      exceptions: [],
    }));
    const draft = {
      expectedRevision: config.revision,
      runtimeEpoch: config.runtimeEpoch,
      timezone: 'Australia/Sydney',
      providerLabel: null,
      streams,
      range: { from: '2026-10-10', to: '2026-11-10' },
      confirmations: {
        timezoneConfirmed: true,
        deletedStreamIds: [],
        removedExceptionIds: [],
        clearedExplicitStreamIds: [],
      },
    };
    saveCollections({ ...draft, previewDigest: previewCollections(draft).previewDigest });
    const ids = streams.map((s) => s.id);
    const now = new Date('2026-10-10T00:00:00Z');
    for (let i = 0; i < 5; i++) readCollectionDisplay(ids, { daysAhead: '90' }, false, now);
    const samples = Array.from({ length: 30 }, () => {
      const start = performance.now();
      const display = readCollectionDisplay(ids, { daysAhead: '90' }, false, now);
      expect(display.groups.every((g) => g.streams.length === 32)).toBe(true);
      return performance.now() - start;
    }).sort((a, b) => a - b);
    const p95 = samples[Math.ceil(samples.length * 0.95) - 1]!;
    const start = performance.now();
    const max = readCollectionDisplay(ids, { from: '2027-01-01', to: '2028-12-31' }, false, now);
    const maxMs = performance.now() - start;
    expect(max.groups).toHaveLength(731);
    expect(max.groups.every((g) => g.streams.length === 32)).toBe(true);
    process.stdout.write(
      `Collection display service: warm 90-day p95=${p95.toFixed(2)}ms; 32-stream/731-day=${maxMs.toFixed(2)}ms; 30 samples; HTTP/browser overhead excluded\n`,
    );
    expect(p95).toBeLessThan(200);
  });
});
