import type { CalendarEvent } from './calendar-types.js';

export const MAX_BIRTHDAY_CSV_BYTES = 1024 * 1024;
export const MAX_BIRTHDAY_CSV_ROWS = 5000;

export interface BirthdayInput {
  firstName: string;
  lastName: string | null;
  month: number;
  day: number;
  birthYear: number | null;
  notes: string | null;
}

export interface BirthdayRecord extends BirthdayInput {
  id: string;
  sourceId: string;
  createdAt: string;
  updatedAt: string;
}

export interface BirthdayCsvRow extends BirthdayInput {
  rowNumber: number;
}

export interface BirthdayCsvError {
  rowNumber: number;
  message: string;
}

export interface BirthdayCsvPreview {
  rows: BirthdayCsvRow[];
  errors: BirthdayCsvError[];
  validCount: number;
  invalidCount: number;
}

interface ParsedCsvRow {
  rowNumber: number;
  cells: string[];
}

const CSV_HEADERS = ['first_name', 'last_name', 'month', 'day', 'birth_year', 'notes'] as const;
const FORMULA_PREFIX = /^[=+\-@]/;

function parseCsv(content: string): { rows: ParsedCsvRow[]; error?: BirthdayCsvError } {
  const rows: ParsedCsvRow[] = [];
  let cells: string[] = [];
  let field = '';
  let inQuotes = false;
  let rowNumber = 1;
  let rowStart = 1;

  const finishRow = () => {
    cells.push(field);
    field = '';
    if (cells.some((cell) => cell.trim() !== '')) {
      rows.push({ rowNumber: rowStart, cells });
    }
    cells = [];
  };

  for (let index = 0; index < content.length; index++) {
    const char = content[index]!;

    if (char === '"') {
      if (inQuotes && content[index + 1] === '"') {
        field += '"';
        index++;
      } else if (inQuotes || field.length === 0) {
        inQuotes = !inQuotes;
      } else {
        return {
          rows,
          error: { rowNumber, message: 'Unexpected quote in unquoted field' },
        };
      }
      continue;
    }

    if (!inQuotes && char === ',') {
      cells.push(field);
      field = '';
      continue;
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      finishRow();
      if (char === '\r' && content[index + 1] === '\n') index++;
      rowNumber++;
      rowStart = rowNumber;
      continue;
    }

    field += char;
  }

  if (inQuotes) {
    return { rows, error: { rowNumber: rowStart, message: 'Unclosed quoted field' } };
  }
  if (field.length > 0 || cells.length > 0) finishRow();

  return { rows };
}

function isValidMonthDay(month: number, day: number): boolean {
  const date = new Date(Date.UTC(2000, month - 1, day));
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function parseBirthdayCsv(content: string): BirthdayCsvPreview {
  const byteLength = Buffer.byteLength(content, 'utf8');
  if (byteLength > MAX_BIRTHDAY_CSV_BYTES) {
    return {
      rows: [],
      errors: [{ rowNumber: 1, message: 'CSV must be 1 MiB or smaller' }],
      validCount: 0,
      invalidCount: 1,
    };
  }

  const parsed = parseCsv(content.replace(/^\uFEFF/, ''));
  if (parsed.error) {
    return { rows: [], errors: [parsed.error], validCount: 0, invalidCount: 1 };
  }
  if (parsed.rows.length === 0) {
    return {
      rows: [],
      errors: [{ rowNumber: 1, message: 'CSV is empty' }],
      validCount: 0,
      invalidCount: 1,
    };
  }

  const [header, ...dataRows] = parsed.rows;
  const normalizedHeaders = header!.cells.map((cell) => cell.trim().toLowerCase());
  const headerMatches =
    normalizedHeaders.length === CSV_HEADERS.length &&
    CSV_HEADERS.every((expected, index) => normalizedHeaders[index] === expected);
  if (!headerMatches) {
    return {
      rows: [],
      errors: [
        {
          rowNumber: header!.rowNumber,
          message: `Header must be exactly: ${CSV_HEADERS.join(',')}`,
        },
      ],
      validCount: 0,
      invalidCount: 1,
    };
  }

  if (dataRows.length === 0) {
    return {
      rows: [],
      errors: [{ rowNumber: header!.rowNumber + 1, message: 'CSV contains no birthday rows' }],
      validCount: 0,
      invalidCount: 1,
    };
  }

  if (dataRows.length > MAX_BIRTHDAY_CSV_ROWS) {
    return {
      rows: [],
      errors: [
        {
          rowNumber: dataRows[MAX_BIRTHDAY_CSV_ROWS]!.rowNumber,
          message: `CSV may contain at most ${MAX_BIRTHDAY_CSV_ROWS} birthday rows`,
        },
      ],
      validCount: 0,
      invalidCount: 1,
    };
  }

  const rows: BirthdayCsvRow[] = [];
  const errors: BirthdayCsvError[] = [];
  const seen = new Set<string>();
  const maxYear = new Date().getUTCFullYear();

  for (const row of dataRows) {
    if (row.cells.length !== CSV_HEADERS.length) {
      errors.push({ rowNumber: row.rowNumber, message: 'Row must contain exactly 5 columns' });
      continue;
    }

    const [rawFirstName, rawLastName, rawMonth, rawDay, rawYear, rawNotes] = row.cells;
    const firstName = rawFirstName!.trim();
    const lastName = rawLastName!.trim() || null;
    const month = Number(rawMonth!.trim());
    const day = Number(rawDay!.trim());
    const birthYear = rawYear!.trim() === '' ? null : Number(rawYear!.trim());
    const notes = rawNotes!.trim() || null;

    const rowErrors: string[] = [];
    if (!firstName || firstName.length > 100) {
      rowErrors.push('first_name must be 1-100 characters');
    }
    if (lastName && lastName.length > 100) {
      rowErrors.push('last_name must be 100 characters or fewer');
    }
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      rowErrors.push('month must be an integer from 1-12');
    }
    if (!Number.isInteger(day) || day < 1 || day > 31 || !isValidMonthDay(month, day)) {
      rowErrors.push('day is not valid for the selected month');
    }
    if (
      birthYear !== null &&
      (!Number.isInteger(birthYear) || birthYear < 1800 || birthYear > maxYear)
    ) {
      rowErrors.push(`birth_year must be empty or an integer from 1800-${maxYear}`);
    }
    if (notes && notes.length > 500) rowErrors.push('notes must be 500 characters or fewer');

    const duplicateKey = `${firstName.toLocaleLowerCase()}\u0000${lastName?.toLocaleLowerCase() ?? ''}\u0000${month}\u0000${day}\u0000${birthYear ?? ''}`;
    if (seen.has(duplicateKey)) rowErrors.push('duplicate birthday in CSV');
    seen.add(duplicateKey);

    if (rowErrors.length > 0) {
      errors.push({ rowNumber: row.rowNumber, message: rowErrors.join('; ') });
      continue;
    }

    rows.push({ rowNumber: row.rowNumber, firstName, lastName, month, day, birthYear, notes });
  }

  return { rows, errors, validCount: rows.length, invalidCount: errors.length };
}

export function buildBirthdayEvents(
  records: BirthdayRecord[],
  sourceName: string,
  startDate: string,
  endDate: string,
): CalendarEvent[] {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const events: CalendarEvent[] = [];

  for (const record of records) {
    for (let year = start.getUTCFullYear(); year <= end.getUTCFullYear(); year++) {
      if (record.birthYear !== null && year < record.birthYear) continue;
      if (!isValidMonthDay(record.month, record.day)) continue;

      const occurrence = new Date(Date.UTC(year, record.month - 1, record.day));
      if (
        occurrence.getUTCFullYear() !== year ||
        occurrence.getUTCMonth() !== record.month - 1 ||
        occurrence.getUTCDate() !== record.day
      ) {
        continue;
      }
      if (occurrence < start || occurrence > end) continue;

      const nextDay = new Date(occurrence);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      events.push({
        providerEventId: `birthday:${record.id}:${year}`,
        title: `${[record.firstName, record.lastName].filter(Boolean).join(' ')}'s Birthday`,
        description: record.notes,
        location: null,
        startAt: occurrence.toISOString(),
        endAt: nextDay.toISOString(),
        startTz: null,
        endTz: null,
        isAllDay: true,
        isPrivate: false,
        calendarName: sourceName,
        rawJson: null,
      });
    }
  }

  return events.sort((left, right) => left.startAt.localeCompare(right.startAt));
}

function escapeCsv(value: string | number | null): string {
  let text = value === null ? '' : String(value);
  if (FORMULA_PREFIX.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function exportBirthdaysCsv(records: BirthdayRecord[]): string {
  const lines = [CSV_HEADERS.join(',')];
  for (const record of records) {
    lines.push(
      [
        escapeCsv(record.firstName),
        escapeCsv(record.lastName),
        record.month,
        record.day,
        record.birthYear ?? '',
        escapeCsv(record.notes),
      ].join(','),
    );
  }
  return `${lines.join('\r\n')}\r\n`;
}

function escapeIcs(value: string): string {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('\r\n', '\\n')
    .replaceAll('\n', '\\n')
    .replaceAll(',', '\\,')
    .replaceAll(';', '\\;');
}

function dateValue(year: number, month: number, day: number): string {
  return `${year.toString().padStart(4, '0')}${month.toString().padStart(2, '0')}${day
    .toString()
    .padStart(2, '0')}`;
}

function foldIcsLine(line: string): string[] {
  const folded: string[] = [];
  let current = '';
  let limit = 75;

  for (const char of line) {
    if (Buffer.byteLength(current + char, 'utf8') > limit) {
      folded.push(current);
      current = ` ${char}`;
      limit = 75;
    } else {
      current += char;
    }
  }
  folded.push(current);
  return folded;
}

export function exportBirthdaysIcs(
  records: BirthdayRecord[],
  sourceName: string,
  now = new Date(),
): string {
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//HomeDash//Local Birthdays//EN',
    `X-WR-CALNAME:${escapeIcs(sourceName)}`,
    'CALSCALE:GREGORIAN',
  ];

  for (const record of records) {
    const startYear = record.birthYear ?? 2000;
    lines.push(
      'BEGIN:VEVENT',
      `UID:birthday-${record.id}@homedash`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${dateValue(startYear, record.month, record.day)}`,
      'RRULE:FREQ=YEARLY',
      `SUMMARY:${escapeIcs(
        `${[record.firstName, record.lastName].filter(Boolean).join(' ')}'s Birthday`,
      )}`,
    );
    if (record.notes) lines.push(`DESCRIPTION:${escapeIcs(record.notes)}`);
    if (record.birthYear !== null) lines.push(`X-HOMEDASH-BIRTH-YEAR:${record.birthYear}`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return `${lines.flatMap(foldIcsLine).join('\r\n')}\r\n`;
}
