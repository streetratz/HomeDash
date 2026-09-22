function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * Date-only calendar events are persisted at UTC midnight. Use UTC components for
 * those events so a browser west of UTC never renders the previous day.
 */
export function toCalendarDateKey(startAt: string, isAllDay: boolean): string {
  const date = new Date(startAt);
  const year = isAllDay ? date.getUTCFullYear() : date.getFullYear();
  const month = isAllDay ? date.getUTCMonth() + 1 : date.getMonth() + 1;
  const day = isAllDay ? date.getUTCDate() : date.getDate();
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function toLocalDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
