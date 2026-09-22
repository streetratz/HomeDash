import { describe, expect, it } from 'vitest';
import {
  buildBirthdayEvents,
  exportBirthdaysCsv,
  exportBirthdaysIcs,
  parseBirthdayCsv,
  type BirthdayRecord,
} from '../../src/services/birthday-calendar-service.js';

function record(overrides: Partial<BirthdayRecord> = {}): BirthdayRecord {
  return {
    id: 'birthday-1',
    sourceId: 'source-1',
    firstName: 'Alex',
    lastName: 'Rivera',
    month: 10,
    day: 3,
    birthYear: 1990,
    notes: 'Likes cake',
    createdAt: '2026-09-20T00:00:00.000Z',
    updatedAt: '2026-09-20T00:00:00.000Z',
    ...overrides,
  };
}

describe('birthday CSV', () => {
  it('parses quoted editable rows without converting date-only values', () => {
    const preview = parseBirthdayCsv(
      'first_name,last_name,month,day,birth_year,notes\r\nAlex,"Rivera, Jr.",10,3,1990,"Calls it ""cake day"""\r\n',
    );

    expect(preview.errors).toEqual([]);
    expect(preview.rows).toEqual([
      {
        rowNumber: 2,
        firstName: 'Alex',
        lastName: 'Rivera, Jr.',
        month: 10,
        day: 3,
        birthYear: 1990,
        notes: 'Calls it "cake day"',
      },
    ]);
  });

  it('reports invalid dates and duplicate rows before import', () => {
    const preview = parseBirthdayCsv(
      'first_name,last_name,month,day,birth_year,notes\nAlex,Rivera,2,30,,\nAlex,Rivera,2,30,,\n',
    );

    expect(preview.validCount).toBe(0);
    expect(preview.errors).toHaveLength(2);
    expect(preview.errors[0]!.message).toContain('day is not valid');
    expect(preview.errors[1]!.message).toContain('duplicate birthday');
  });

  it('requires the documented header and at least one row', () => {
    expect(parseBirthdayCsv('name,birthday\nAlex,10/3\n').errors[0]!.message).toContain(
      'Header must be exactly',
    );
    expect(
      parseBirthdayCsv('first_name,last_name,month,day,birth_year,notes\n').errors[0]!.message,
    ).toContain('no birthday rows');
  });
});

describe('birthday event generation', () => {
  it('creates UTC all-day events on the exact month and day', () => {
    const events = buildBirthdayEvents(
      [record()],
      'Family Birthdays',
      '2026-09-01T00:00:00.000Z',
      '2026-12-31T23:59:59.999Z',
    );

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      providerEventId: 'birthday:birthday-1:2026',
      title: "Alex Rivera's Birthday",
      description: 'Likes cake',
      startAt: '2026-10-03T00:00:00.000Z',
      endAt: '2026-10-04T00:00:00.000Z',
      isAllDay: true,
      calendarName: 'Family Birthdays',
    });
  });

  it('does not shift February 29 into March in non-leap years', () => {
    const events = buildBirthdayEvents(
      [record({ month: 2, day: 29 })],
      'Birthdays',
      '2025-01-01T00:00:00.000Z',
      '2025-12-31T23:59:59.999Z',
    );
    expect(events).toEqual([]);
  });
});

describe('birthday exports', () => {
  it('exports documented CSV and neutralizes spreadsheet formulas', () => {
    const csv = exportBirthdaysCsv([
      record({ firstName: '=2+2', lastName: '@unsafe', notes: '+note' }),
    ]);
    expect(csv).toContain('first_name,last_name,month,day,birth_year,notes');
    expect(csv).toContain(`"'=2+2","'@unsafe",10,3,1990,"'+note"`);
  });

  it('exports a yearly all-day ICS event', () => {
    const ics = exportBirthdaysIcs(
      [record()],
      'Family Birthdays',
      new Date('2026-09-20T12:00:00.000Z'),
    );
    expect(ics).toContain('DTSTART;VALUE=DATE:19901003');
    expect(ics).toContain('RRULE:FREQ=YEARLY');
    expect(ics).toContain("SUMMARY:Alex Rivera's Birthday");
    expect(ics).toContain('X-HOMEDASH-BIRTH-YEAR:1990');
  });

  it('folds long ICS content lines', () => {
    const ics = exportBirthdaysIcs(
      [record({ notes: 'A'.repeat(100) })],
      'Family Birthdays',
      new Date('2026-09-20T12:00:00.000Z'),
    );
    expect(ics).toContain(`DESCRIPTION:${'A'.repeat(63)}\r\n ${'A'.repeat(37)}`);
  });
});
