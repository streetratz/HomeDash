// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { householdToday } from '../../src/lib/collectionDates.js';
describe('household elapsed clock context', () => {
  it('Sydney midnight after monotonic elapsed is independent of visitor date/DST', () => {
    expect(householdToday('2026-10-14T12:59:50Z', 'Australia/Sydney', 0)).toBe('2026-10-14');
    expect(householdToday('2026-10-14T12:59:50Z', 'Australia/Sydney', 15_000)).toBe('2026-10-15');
    expect(householdToday('2026-09-26T11:59:50Z', 'Pacific/Auckland', 20_000)).toBe('2026-09-27');
  });
});
