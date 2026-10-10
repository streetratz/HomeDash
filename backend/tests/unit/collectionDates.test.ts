import { describe, expect, it } from 'vitest';
import {
  collectionDates,
  dateKey,
  parseDate,
  type RegularSchedule,
} from '../../src/services/collectionDates.js';

const schedule = (
  weekdays: number[],
  intervalWeeks: number,
  anchorDate = '2027-01-04',
): RegularSchedule => ({ mode: 'regular', weekdays, intervalWeeks, anchorDate });

/** Independent oracle: repeat literal active-week offsets from a known Monday.
 * No production helper, annual parity or modulo used to derive expectations.
 */
function oracle(weekdays: number[], interval: number) {
  const expected: string[] = [];
  const block = new Date('2027-01-04T12:00:00Z');
  const end = new Date('2028-12-31T12:00:00Z');
  while (block <= end) {
    for (const weekday of weekdays) {
      const date = new Date(block);
      date.setUTCDate(date.getUTCDate() + weekday - 1);
      if (date <= end) expected.push(date.toISOString().slice(0, 10));
    }
    block.setUTCDate(block.getUTCDate() + 7 * interval);
  }
  return expected;
}

describe('strict civil dates and anchored active weeks', () => {
  it.each([1, 2, 4, 52])('matches a 24-month oracle at interval %i', (interval) => {
    for (const weekdays of [[1], [1, 3, 7], [1, 2, 3, 4, 5, 6, 7]]) {
      expect(collectionDates(schedule(weekdays, interval), [], '2027-01-04', '2028-12-31')).toEqual(
        oracle(weekdays, interval),
      );
    }
  });
  it('handles before/after anchor and Monday/Sunday boundaries', () => {
    expect(
      collectionDates(schedule([1, 7], 2, '2027-01-04'), [], '2026-12-20', '2027-01-17'),
    ).toEqual(['2026-12-21', '2026-12-27', '2027-01-04', '2027-01-10']);
    expect(collectionDates(schedule([4], 2, '2026-12-31'), [], '2027-01-01', '2027-01-31')).toEqual(
      ['2027-01-14', '2027-01-28'],
    );
  });
  it('roundtrips bounds and leap day, rejects invalid and normalized dates', () => {
    for (const key of ['1900-01-01', '2199-12-31', '2028-02-29'])
      expect(dateKey(parseDate(key))).toBe(key);
    for (const key of [
      '1899-12-31',
      '2200-01-01',
      '1900-02-29',
      '2027-02-29',
      '2026-04-31',
      '2026-1-01',
      '2026-01-01T00:00:00Z',
    ]) {
      expect(() => parseDate(key)).toThrow();
    }
  });
  it('includes moved-in destinations outside origin range without shifting phase', () => {
    const exceptions = [
      {
        id: 'move',
        kind: 'replace' as const,
        originalDate: '2026-12-25',
        actualDate: '2027-01-02',
      },
    ];
    expect(
      collectionDates(schedule([5], 2, '2026-12-25'), exceptions, '2027-01-01', '2027-01-31'),
    ).toEqual(['2027-01-02', '2027-01-08', '2027-01-22']);
  });
});
