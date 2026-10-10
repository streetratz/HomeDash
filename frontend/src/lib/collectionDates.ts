/** Household labels never use the visitor's initial wall clock. */
export function householdToday(serverNow: string, timezone: string, elapsedMs = 0): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: timezone,
    calendar: 'gregory',
    numberingSystem: 'latn',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(Date.parse(serverNow) + Math.max(0, elapsedMs)));
  const part = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function addCollectionDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
export function collectionDateLabel(date: string, today: string): string {
  const full = new Intl.DateTimeFormat('en', {
    timeZone: 'UTC',
    calendar: 'gregory',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(`${date}T00:00:00Z`));
  const relative =
    date === today ? 'Today' : date === addCollectionDays(today, 1) ? 'Tomorrow' : null;
  return relative ? `${relative} · ${full}` : full;
}
