import { describe, expect, it } from 'vitest';
import { toCalendarDateKey } from './calendarDates.js';

describe('toCalendarDateKey', () => {
  it('keeps all-day birthdays on their UTC date without timezone shifting', () => {
    expect(toCalendarDateKey('2026-10-03T00:00:00.000Z', true)).toBe('2026-10-03');
  });
});
