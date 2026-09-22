import { describe, it, expect } from 'vitest';

// Import only the timezone functions (the module may trigger DB-related imports)
// but the functions themselves are pure and don't use DB
import { isValidTimezone, getTimezoneList } from '../../src/services/shellSettingsService.js';

describe('isValidTimezone', () => {
  it('returns a non-empty timezone list', () => {
    const list = getTimezoneList();
    expect(list.length).toBeGreaterThan(100);
  });

  it('accepts standard IANA timezones', () => {
    expect(isValidTimezone('Australia/Sydney')).toBe(true);
    expect(isValidTimezone('America/New_York')).toBe(true);
    expect(isValidTimezone('Europe/London')).toBe(true);
  });

  it('accepts UTC as a valid timezone', () => {
    expect(isValidTimezone('UTC')).toBe(true);
  });

  it('rejects invalid timezone strings', () => {
    expect(isValidTimezone('')).toBe(false);
    expect(isValidTimezone('Invalid/Timezone')).toBe(false);
    expect(isValidTimezone('AEST')).toBe(false);
  });
});
