/** Strict Gregorian civil dates. UTC is numeric arithmetic, not pickup time. */
export interface RegularSchedule {
  mode: 'regular';
  weekdays: number[];
  intervalWeeks: number;
  anchorDate: string;
}
export interface ExplicitSchedule { mode: 'explicit'; dates: string[] }
export type CollectionSchedule = RegularSchedule | ExplicitSchedule;
export type CollectionException =
  | { id: string; kind: 'skip'; originalDate: string }
  | { id: string; kind: 'replace'; originalDate: string; actualDate: string }
  | { id: string; kind: 'add'; actualDate: string };
const DAY = 86_400_000;
export function parseDate(key: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || key < '1900-01-01' || key > '2199-12-31') {
    throw new RangeError('Use a Gregorian date from 1900-01-01 through 2199-12-31');
  }
  const time = Date.parse(`${key}T00:00:00.000Z`);
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== key) {
    throw new RangeError('Invalid Gregorian date');
  }
  return time / DAY;
}
export function dateKey(ordinal: number): string {
  if (!Number.isInteger(ordinal)) throw new RangeError('Invalid civil ordinal');
  const key = new Date(ordinal * DAY).toISOString().slice(0, 10);
  parseDate(key);
  return key;
}
export function addDays(key: string, days: number): string { return dateKey(parseDate(key) + days); }
export function weekday(ordinal: number): number { return ((ordinal + 3) % 7 + 7) % 7 + 1; }
export function isBaseDate(schedule: RegularSchedule, key: string): boolean {
  const day = parseDate(key);
  const anchor = parseDate(schedule.anchorDate);
  const weeks = ((day - weekday(day) + 1) - (anchor - weekday(anchor) + 1)) / 7;
  return schedule.weekdays.includes(weekday(day)) &&
    ((weeks % schedule.intervalWeeks) + schedule.intervalWeeks) % schedule.intervalWeeks === 0;
}
export function validateRange(from: string, to: string): void {
  const length = parseDate(to) - parseDate(from) + 1;
  if (length < 1 || length > 731) throw new RangeError('Range must contain 1–731 days');
}
export function exceptionBlockers(schedule: RegularSchedule, exceptions: CollectionException[]): string[] {
  const errors: string[] = [];
  const suppressed = new Set<string>();
  const targets = new Set<string>();
  for (const entry of exceptions) {
    if (entry.kind !== 'add') {
      if (!isBaseDate(schedule, entry.originalDate)) errors.push('orphan_origin');
      if (suppressed.has(entry.originalDate)) errors.push('duplicate_origin');
      suppressed.add(entry.originalDate);
    }
  }
  for (const entry of exceptions) {
    if (entry.kind === 'skip') continue;
    if (entry.kind === 'replace' && entry.originalDate === entry.actualDate) errors.push('unchanged_move');
    if (targets.has(entry.actualDate) ||
        (isBaseDate(schedule, entry.actualDate) && !suppressed.has(entry.actualDate))) errors.push('duplicate_actual_date');
    targets.add(entry.actualDate);
  }
  return errors;
}
export function collectionDates(
  schedule: CollectionSchedule, exceptions: CollectionException[], from: string, to: string,
): string[] {
  validateRange(from, to);
  if (schedule.mode === 'explicit') return schedule.dates.filter(key => key >= from && key <= to).sort();
  if (exceptionBlockers(schedule, exceptions).length) throw new RangeError('Collection exceptions conflict');
  const suppressed = new Set(exceptions.flatMap(e => e.kind === 'add' ? [] : [e.originalDate]));
  const dates: string[] = [];
  for (let day = parseDate(from), end = parseDate(to); day <= end; day++) {
    const key = dateKey(day);
    if (isBaseDate(schedule, key) && !suppressed.has(key)) dates.push(key);
  }
  for (const entry of exceptions) {
    if (entry.kind !== 'skip' && entry.actualDate >= from && entry.actualDate <= to) dates.push(entry.actualDate);
  }
  return dates.sort();
}
