import { describe, expect, it } from 'vitest';
import { householdToday, collectionDateLabel } from '../../src/lib/collectionDates.js';

describe('server-clock household civil labels', () => {
  it.each(['UTC', 'Australia/Sydney', 'Pacific/Auckland', 'America/Los_Angeles'])(
    'ignores visitor timezone %s',
    (visitor) => {
      const original = process.env['TZ'];
      process.env['TZ'] = visitor;
      try {
        expect(householdToday('2026-10-10T12:59:50Z', 'Australia/Sydney')).toBe('2026-10-10');
        expect(householdToday('2026-10-10T12:59:50Z', 'Australia/Sydney', 15_000)).toBe(
          '2026-10-11',
        );
        expect(collectionDateLabel('2026-10-11', '2026-10-10')).toBe(
          'Tomorrow · Sunday, October 11, 2026',
        );
      } finally {
        process.env['TZ'] = original;
      }
    },
  );
  it('covers DST, Auckland and leap/year boundaries without changing civil keys', () => {
    expect(householdToday('2026-09-26T14:00:00Z', 'Pacific/Auckland')).toBe('2026-09-27');
    expect(householdToday('2028-02-28T13:00:00Z', 'Australia/Sydney')).toBe('2028-02-29');
    expect(householdToday('2026-12-31T13:00:00Z', 'Australia/Sydney')).toBe('2027-01-01');
    expect(collectionDateLabel('2028-02-29', '2028-02-29')).toMatch(/^Today · Tuesday/);
  });
});
