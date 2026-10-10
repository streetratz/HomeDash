import { z } from 'zod';
import { createHash, randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { getDb } from '../db/drizzle.js';
import {
  collectionHousehold, collectionStreams, collectionExplicitDates, collectionExceptions,
  appWidgetInstances, placeholderWidgets,
} from '../db/schema/index.js';
import { CalendarConfigSchema } from '../lib/validation.js';
import { AppError, ErrorCode, Errors } from '../lib/errors.js';
import { getAppLogger } from '../lib/logger.js';
import {
  parseDate, weekday, validateRange, exceptionBlockers, collectionDates, addDays,
} from './collectionDates.js';

const unique = <T>(values: T[]) => new Set(values).size === values.length;
const boundedText = (max: number) => z.string().trim().min(1).max(max)
  .refine(s => [...s].every(char => {
    const code = char.codePointAt(0)!;
    return code > 31 && (code < 127 || code > 159);
  }), 'Control characters are not allowed');
export const collectionDateSchema = z.string().refine(key => {
  try { parseDate(key); return true; } catch { return false; }
}, 'Use a valid Gregorian date from 1900 through 2199');
export const collectionTimezoneSchema = boundedText(100).refine(zone => {
  if (/^[+-]/.test(zone)) return false;
  try { new Intl.DateTimeFormat('en', { timeZone: zone }); return true; } catch { return false; }
}, 'Use a supported named timezone').transform(zone =>
  new Intl.DateTimeFormat('en', { timeZone: zone }).resolvedOptions().timeZone);
const uuid = z.string().uuid();
const ids = z.array(uuid).max(512).refine(unique, 'IDs must be unique');
const regularSchedule = z.object({
  mode: z.literal('regular'),
  weekdays: z.array(z.number().int().min(1).max(7)).min(1).max(7).refine(unique).transform(days => days.sort()),
  intervalWeeks: z.number().int().min(1).max(52),
  anchorDate: collectionDateSchema,
}).strict();
const explicitSchedule = z.object({
  mode: z.literal('explicit'),
  dates: z.array(collectionDateSchema).min(1).max(2048).refine(unique).transform(dates => dates.sort()),
}).strict();
const exceptionSchema = z.discriminatedUnion('kind', [
  z.object({ id: uuid, kind: z.literal('skip'), originalDate: collectionDateSchema }).strict(),
  z.object({ id: uuid, kind: z.literal('replace'), originalDate: collectionDateSchema, actualDate: collectionDateSchema }).strict(),
  z.object({ id: uuid, kind: z.literal('add'), actualDate: collectionDateSchema }).strict(),
]);
const streamFields = {
  id: uuid, name: boundedText(80), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).transform(c => c.toUpperCase()), enabled: z.boolean(),
};
export const collectionStreamSchema = z.union([
  z.object({ ...streamFields, schedule: regularSchedule, exceptions: z.array(exceptionSchema).max(512).refine(e => unique(e.map(row => row.id))).transform(e => e.sort((a, b) => a.id.localeCompare(b.id))) }).strict(),
  z.object({ ...streamFields, schedule: explicitSchedule }).strict(),
]);
export type CollectionStream = z.infer<typeof collectionStreamSchema>;
const aggregateFields = {
  timezone: collectionTimezoneSchema,
  providerLabel: boundedText(120).nullable(),
  streams: z.array(collectionStreamSchema).max(32).refine(s => unique(s.map(row => row.id))),
};
export const collectionAggregateSchema = z.object(aggregateFields).strict().superRefine((value, ctx) => {
  const entries = value.streams.reduce((n, s) => n + ('exceptions' in s ? s.exceptions.length : s.schedule.mode === 'explicit' ? s.schedule.dates.length : 0), 0);
  const exceptionIds = value.streams.flatMap(s => 'exceptions' in s ? s.exceptions.map(e => e.id) : []);
  if (entries > 8192 || !unique(exceptionIds)) ctx.addIssue({ code: 'custom', message: 'Aggregate limit or identity violation' });
});
const rangeSchema = z.object({ from: collectionDateSchema, to: collectionDateSchema }).strict().refine(r => {
  try { validateRange(r.from, r.to); return true; } catch { return false; }
}, 'Range must contain 1–731 days');
const draftBase = z.object({
  ...aggregateFields, expectedRevision: z.number().int().min(0), runtimeEpoch: uuid,
  range: rangeSchema,
  confirmations: z.object({
    timezoneConfirmed: z.boolean(), deletedStreamIds: ids, removedExceptionIds: ids, clearedExplicitStreamIds: ids,
  }).strict(),
}).strict();
export const collectionDraftSchema = draftBase.superRefine((value, ctx) => {
  const result = collectionAggregateSchema.safeParse({ timezone: value.timezone, providerLabel: value.providerLabel, streams: value.streams });
  if (!result.success) ctx.addIssue({ code: 'custom', message: 'Aggregate limit or identity violation', path: ['streams'] });
});
const saveSchema = draftBase.extend({ previewDigest: z.string().regex(/^[a-f0-9]{64}$/) }).superRefine((value, ctx) => {
  const result = collectionAggregateSchema.safeParse({ timezone: value.timezone, providerLabel: value.providerLabel, streams: value.streams });
  if (!result.success) ctx.addIssue({ code: 'custom', message: 'Aggregate limit or identity violation', path: ['streams'] });
});
export type CollectionDraft = z.infer<typeof collectionDraftSchema>;
export interface CollectionConfig {
  configured: boolean; revision: number; runtimeEpoch: string;
  timezone: string | null; providerLabel: string | null; streams: CollectionStream[];
}
export interface CollectionGroup {
  date: string; streams: { key: string; name: string; color: string }[];
}
export type CollectionState = 'unconfigured' | 'not_selected' | 'disabled' | 'no_dates_in_range' | 'exhausted' | 'ready' | 'no_dates';
export interface CollectionDisplay {
  timezone: string | null; householdToday: string | null; serverNow: string;
  range: { from: string; to: string }; state: CollectionState; groups: CollectionGroup[];
}
let runtimeEpoch = randomUUID();
export function invalidateCollectionEpoch(): void { runtimeEpoch = randomUUID(); }

function parse<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw Errors.validationError('Correct the collection fields', result.error.issues.map(issue => ({ path: issue.path, message: 'Invalid or out-of-bounds value' })));
  return result.data;
}
function safeOperation<T>(operation: string, work: () => T): T {
  const started = performance.now();
  try { return work(); }
  catch (error) {
    getAppLogger().warn({ component: 'collections', operation, reason: error instanceof AppError ? error.code : 'storage_failure', durationMs: Math.round(performance.now() - started) }, 'Collection operation failed');
    if (error instanceof AppError) throw error;
    throw new AppError(ErrorCode.INTERNAL, `Unable to ${operation} collections; retry the request`, 500);
  }
}

export function getCollectionConfig(): CollectionConfig {
  return safeOperation('read', () => {
    const db = getDb();
    const household = db.select().from(collectionHousehold).get();
    if (!household) return { configured: false, revision: 0, runtimeEpoch, timezone: null, providerLabel: null, streams: [] };
    const rows = db.select().from(collectionStreams).all().sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
    const dates = db.select().from(collectionExplicitDates).all();
    const exceptions = db.select().from(collectionExceptions).all();
    const streams = rows.map(row => persistedStream(row, dates.filter(d => d.streamId === row.id), exceptions.filter(e => e.streamId === row.id)));
    return { configured: true, revision: household.revision, runtimeEpoch, timezone: household.timezone, providerLabel: household.providerLabel, streams };
  });
}
function persistedStream(
  row: typeof collectionStreams.$inferSelect,
  dates: (typeof collectionExplicitDates.$inferSelect)[],
  exceptions: (typeof collectionExceptions.$inferSelect)[],
): CollectionStream {
  const common = { id: row.id, name: row.name, color: row.color, enabled: row.enabled };
  return parse(collectionStreamSchema, row.scheduleMode === 'explicit'
    ? { ...common, schedule: { mode: 'explicit', dates: dates.map(d => d.date) } }
    : { ...common, schedule: { mode: 'regular', weekdays: Array.from({ length: 7 }, (_, i) => i + 1).filter(d => (row.weekdaysMask ?? 0) & (1 << (d - 1))), intervalWeeks: row.intervalWeeks, anchorDate: row.anchorDate },
      exceptions: exceptions.map(e => ({ id: e.id, kind: e.kind, ...(e.originalDate !== null ? { originalDate: e.originalDate } : {}), ...(e.actualDate !== null ? { actualDate: e.actualDate } : {}) })) });
}
interface Blocker { path: (string | number)[]; code: string; message: string }
function semanticBlockers(streams: CollectionStream[]): Blocker[] {
  return streams.flatMap((s, index) => {
    if (s.schedule.mode !== 'regular' || !('exceptions' in s)) return [];
    const codes = exceptionBlockers(s.schedule, s.exceptions);
    if (!s.schedule.weekdays.includes(weekday(parseDate(s.schedule.anchorDate)))) codes.push('anchor_weekday');
    return codes.map(code => ({ path: ['streams', index, 'schedule'], code, message: code === 'anchor_weekday' ? 'Normal anchor must match a selected weekday' : 'Resolve exception origins and duplicate actual dates' }));
  });
}
function confirmedBlockers(draft: CollectionDraft, current: CollectionConfig): Blocker[] {
  const expectedDeleted = current.streams.filter(s => !draft.streams.some(next => next.id === s.id)).map(s => s.id);
  const expectedRemoved: string[] = [];
  const expectedCleared: string[] = [];
  const blocked: Blocker[] = [];
  for (const old of current.streams) {
    const next = draft.streams.find(s => s.id === old.id);
    if (!next) continue;
    if (old.schedule.mode === 'explicit' && next.schedule.mode === 'regular') expectedCleared.push(old.id);
    if ('exceptions' in old) for (const e of old.exceptions) {
      if (!('exceptions' in next) || !next.exceptions.some(n => n.id === e.id)) expectedRemoved.push(e.id);
    }
  }
  for (const next of draft.streams) if ('exceptions' in next) for (const e of next.exceptions) {
    if (current.streams.some(old => old.id !== next.id && 'exceptions' in old && old.exceptions.some(n => n.id === e.id))) {
      blocked.push({ path: ['streams'], code: 'exception_owner', message: 'Existing exception identity cannot be moved between streams' });
    }
  }
  for (const [field, expected] of [
    ['deletedStreamIds', expectedDeleted], ['removedExceptionIds', expectedRemoved], ['clearedExplicitStreamIds', expectedCleared],
  ] as const) {
    if (JSON.stringify([...draft.confirmations[field]].sort()) !== JSON.stringify(expected.sort())) {
      blocked.push({ path: ['confirmations', field], code: 'destructive_confirmation', message: 'Confirm exactly the listed destructive changes' });
    }
  }
  if (current.timezone !== draft.timezone && !draft.confirmations.timezoneConfirmed) blocked.push({ path: ['confirmations', 'timezoneConfirmed'], code: 'timezone_confirmation', message: 'Explicitly confirm household timezone' });
  return blocked;
}
function checkVersion(draft: CollectionDraft, current: CollectionConfig): void {
  if (draft.expectedRevision !== current.revision || draft.runtimeEpoch !== runtimeEpoch) throw Errors.conflict('Collection configuration changed; reload and deliberately rebase your draft');
}
export function collectionGroups(streams: CollectionStream[], range: { from: string; to: string }): CollectionGroup[] {
  const groups = new Map<string, CollectionGroup>();
  for (const s of streams.filter(s => s.enabled)) {
    for (const date of collectionDates(s.schedule, 'exceptions' in s ? s.exceptions : [], range.from, range.to)) {
      let group = groups.get(date);
      if (!group) { group = { date, streams: [] }; groups.set(date, group); }
      group.streams.push({ key: `collection:${s.id}:${date}`, name: s.name, color: s.color });
    }
  }
  return [...groups.values()].sort((a, b) => a.date.localeCompare(b.date));
}
function digest(draft: CollectionDraft): string {
  return createHash('sha256').update(JSON.stringify({ engine: 1, ...draft })).digest('hex');
}
export function previewCollections(raw: unknown) {
  return safeOperation('preview', () => {
    const draft = parse(collectionDraftSchema, raw);
    const current = getCollectionConfig();
    checkVersion(draft, current);
    const blockers = [...semanticBlockers(draft.streams), ...confirmedBlockers(draft, current)];
    return { canSave: blockers.length === 0, expectedRevision: draft.expectedRevision, runtimeEpoch,
      previewDigest: digest(draft), range: draft.range, groups: blockers.length ? [] : collectionGroups(draft.streams, draft.range),
      blockers, warnings: [] as string[] };
  });
}

export function saveCollections(raw: unknown): CollectionConfig {
  return safeOperation('save', () => {
    const { previewDigest, ...draft } = parse(saveSchema, raw);
    if (digest(draft) !== previewDigest) throw Errors.conflict('Preview again after editing the draft');
    const db = getDb();
    db.transaction(tx => {
      const current = getCollectionConfig();
      checkVersion(draft, current);
      if (semanticBlockers(draft.streams).length || confirmedBlockers(draft, current).length) throw Errors.conflict('Resolve schedule conflicts and confirm destructive changes before saving');
      const now = new Date().toISOString();
      const household = tx.select().from(collectionHousehold).get();
      const oldStreams = tx.select().from(collectionStreams).all();
      const oldExceptions = tx.select().from(collectionExceptions).all();
      const oldDates = tx.select().from(collectionExplicitDates).all();
      if (household) tx.update(collectionHousehold).set({ timezone: draft.timezone, providerLabel: draft.providerLabel, revision: household.revision + 1, updatedAt: now }).where(eq(collectionHousehold.id, 'global')).run();
      else tx.insert(collectionHousehold).values({ id: 'global', timezone: draft.timezone, providerLabel: draft.providerLabel, revision: 1, createdAt: now, updatedAt: now }).run();
      const removed = oldStreams.filter(s => !draft.streams.some(n => n.id === s.id)).map(s => s.id);
      for (const id of removed) tx.delete(collectionStreams).where(eq(collectionStreams.id, id)).run();
      const nextExceptions: (typeof collectionExceptions.$inferInsert)[] = [];
      draft.streams.forEach((s, index) => {
        const old = oldStreams.find(o => o.id === s.id);
        const regular = s.schedule.mode === 'regular' ? s.schedule : null;
        const values = { householdId: 'global', name: s.name, color: s.color, enabled: s.enabled, sortOrder: index,
          scheduleMode: s.schedule.mode, weekdaysMask: regular ? regular.weekdays.reduce((mask, d) => mask | (1 << (d - 1)), 0) : null,
          intervalWeeks: regular?.intervalWeeks ?? null, anchorDate: regular?.anchorDate ?? null };
        if (!old) tx.insert(collectionStreams).values({ id: s.id, ...values, createdAt: now, updatedAt: now }).run();
        else if (Object.entries(values).some(([key, value]) => Reflect.get(old, key) !== value)) tx.update(collectionStreams).set({ ...values, updatedAt: now }).where(eq(collectionStreams.id, s.id)).run();
        const dates = s.schedule.mode === 'explicit' ? s.schedule.dates : [];
        for (const entry of oldDates.filter(d => d.streamId === s.id && !dates.includes(d.date))) tx.delete(collectionExplicitDates).where(and(eq(collectionExplicitDates.streamId, s.id), eq(collectionExplicitDates.date, entry.date))).run();
        for (const date of dates) if (!oldDates.some(d => d.streamId === s.id && d.date === date)) tx.insert(collectionExplicitDates).values({ streamId: s.id, date }).run();
        if ('exceptions' in s) for (const e of s.exceptions) {
          const oldException = oldExceptions.find(o => o.id === e.id);
          const values = { id: e.id, streamId: s.id, kind: e.kind, originalDate: e.kind === 'add' ? null : e.originalDate, actualDate: e.kind === 'skip' ? null : e.actualDate };
          const changed = !oldException || Object.entries(values).some(([key, value]) => Reflect.get(oldException, key) !== value);
          nextExceptions.push({ ...values, createdAt: oldException?.createdAt ?? now, updatedAt: changed ? now : oldException.updatedAt });
        }
      });
      // Delete every changed/removed exception first, then insert. Immediate
      // destination indexes must not reject a valid aggregate destination swap.
      const changedIds = new Set(nextExceptions.filter(n => {
        const old = oldExceptions.find(o => o.id === n.id);
        return !old || Object.entries(n).some(([key, value]) => Reflect.get(old, key) !== value);
      }).map(n => n.id));
      for (const old of oldExceptions) if (changedIds.has(old.id) || !nextExceptions.some(n => n.id === old.id)) tx.delete(collectionExceptions).where(eq(collectionExceptions.id, old.id)).run();
      for (const next of nextExceptions) if (changedIds.has(next.id)) tx.insert(collectionExceptions).values(next).run();
      if (removed.length) for (const widget of tx.select().from(appWidgetInstances).all()) {
        if (widget.type !== 'calendar') continue;
        const config = parseCalendarSelection(widget.configJson);
        if (!config) { getAppLogger().warn({ component: 'collections', reason: 'malformed_widget_config' }, 'Selection pruning skipped'); continue; }
        const next = { ...config, collectionStreamIds: config.collectionStreamIds.filter(id => !removed.includes(id)), publicCollectionStreamIds: config.publicCollectionStreamIds.filter(id => !removed.includes(id)) };
        if (JSON.stringify(next) !== JSON.stringify(config)) tx.update(appWidgetInstances).set({ configJson: JSON.stringify(next), updatedAt: now }).where(eq(appWidgetInstances.id, widget.id)).run();
      }
    }, { behavior: 'immediate' });
    return getCollectionConfig();
  });
}

export function parseCalendarSelection(raw: string) {
  try {
    const result = CalendarConfigSchema.safeParse(JSON.parse(raw) as unknown);
    return result.success ? result.data : null;
  } catch { return null; } // Invalid saved JSON is explicitly fail-closed.
}
export function resolveCollectionWidget(widgetId: string) {
  if (!uuid.safeParse(widgetId).success) return null;
  const row = getDb().select({ id: appWidgetInstances.id, type: appWidgetInstances.type, configJson: appWidgetInstances.configJson, dashboardId: placeholderWidgets.dashboardId })
    .from(appWidgetInstances).innerJoin(placeholderWidgets, eq(appWidgetInstances.placeholderId, placeholderWidgets.id)).where(eq(appWidgetInstances.id, widgetId)).get();
  if (!row || row.type !== 'calendar') return null;
  const config = parseCalendarSelection(row.configJson);
  return config ? { ...row, config } : null;
}
export function householdDate(now: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en', { timeZone: timezone, calendar: 'gregory', numberingSystem: 'latn', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const value = (type: string) => parts.find(p => p.type === type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}
export const collectionWindowSchema = z.union([
  z.object({ daysAhead: z.string().regex(/^(?:[1-9]|[1-8][0-9]|90)$/).transform(Number) }).strict(),
  rangeSchema,
]);
export function readCollectionDisplay(selectedIds: string[], rawWindow: unknown, publicRead = false, now = new Date()): CollectionDisplay {
  return safeOperation('read', () => {
    const window = parse(collectionWindowSchema, rawWindow);
    const config = getCollectionConfig();
    const today = config.timezone ? householdDate(now, config.timezone) : null;
    const range = 'daysAhead' in window ? { from: today ?? householdDate(now, 'UTC'), to: addDays(today ?? householdDate(now, 'UTC'), window.daysAhead) } : window;
    const selected = config.streams.filter(s => selectedIds.includes(s.id));
    const groups = collectionGroups(selected, range);
    const enabled = selected.filter(s => s.enabled);
    const exhausted = enabled.length > 0 && enabled.every(s => s.schedule.mode === 'explicit' && s.schedule.dates.every(date => date < (today ?? range.from)));
    let state: CollectionState = !config.configured ? 'unconfigured' : selected.length === 0 ? 'not_selected' : enabled.length === 0 ? 'disabled' : groups.length ? 'ready' : exhausted ? 'exhausted' : 'no_dates_in_range';
    if (publicRead && state !== 'ready') state = 'no_dates';
    return { timezone: config.timezone, householdToday: today, serverNow: now.toISOString(), range, state, groups };
  });
}

const timestamp = z.string().datetime();
const householdRowSchema = z.object({
  id: z.literal('global'), timezone: collectionTimezoneSchema, providerLabel: boundedText(120).nullable(),
  revision: z.number().int().min(1), createdAt: timestamp, updatedAt: timestamp,
}).strict();
const streamRowSchema = z.object({
  ...streamFields, householdId: z.literal('global'), sortOrder: z.number().int().min(0).max(31),
  scheduleMode: z.enum(['regular', 'explicit']), weekdaysMask: z.number().int().min(1).max(127).nullable(),
  intervalWeeks: z.number().int().min(1).max(52).nullable(), anchorDate: collectionDateSchema.nullable(),
  createdAt: timestamp, updatedAt: timestamp,
}).strict().refine(s => s.scheduleMode === 'regular'
  ? s.weekdaysMask !== null && s.intervalWeeks !== null && s.anchorDate !== null
  : s.weekdaysMask === null && s.intervalWeeks === null && s.anchorDate === null);
const explicitRowSchema = z.object({ streamId: uuid, date: collectionDateSchema }).strict();
const exceptionRowSchema = z.object({
  id: uuid, streamId: uuid, kind: z.enum(['skip', 'replace', 'add']),
  originalDate: collectionDateSchema.nullable(), actualDate: collectionDateSchema.nullable(),
  createdAt: timestamp, updatedAt: timestamp,
}).strict().refine(e => e.kind === 'skip' ? e.originalDate !== null && e.actualDate === null :
  e.kind === 'add' ? e.originalDate === null && e.actualDate !== null :
  e.originalDate !== null && e.actualDate !== null && e.originalDate !== e.actualDate);
export const collectionBackupRowsSchema = z.object({
  collectionHousehold: z.array(householdRowSchema).max(1),
  collectionStreams: z.array(streamRowSchema).max(32),
  collectionExplicitDates: z.array(explicitRowSchema).max(8192),
  collectionExceptions: z.array(exceptionRowSchema).max(8192),
});
/** Called before any full-replacement deletion, including direct service restores. */
export function validateCollectionBackup(data: {
  collectionHousehold: Record<string, unknown>[];
  collectionStreams: Record<string, unknown>[];
  collectionExplicitDates: Record<string, unknown>[];
  collectionExceptions: Record<string, unknown>[];
  appWidgetInstances: Record<string, unknown>[];
}): void {
  const rows = parse(collectionBackupRowsSchema, data);
  const streamIds = rows.collectionStreams.map(s => s.id);
  if (!unique(streamIds) || !unique(rows.collectionExceptions.map(e => e.id)) ||
      !unique(rows.collectionExplicitDates.map(d => `${d.streamId}:${d.date}`)) ||
      (!rows.collectionHousehold.length && rows.collectionStreams.length) ||
      rows.collectionStreams.some(s => s.householdId !== rows.collectionHousehold[0]?.id) ||
      [...rows.collectionExplicitDates, ...rows.collectionExceptions].some(e => !streamIds.includes(e.streamId))) {
    throw Errors.validationError('Collection backup references or identities are invalid');
  }
  const ordered = rows.collectionStreams.sort((a, b) => a.sortOrder - b.sortOrder);
  if (ordered.some((s, i) => s.sortOrder !== i)) throw Errors.validationError('Collection backup ordering is invalid');
  const streams = ordered.map(s => {
    const dates = rows.collectionExplicitDates.filter(d => d.streamId === s.id);
    const exceptions = rows.collectionExceptions.filter(e => e.streamId === s.id);
    if ((s.scheduleMode === 'regular' && dates.length) || (s.scheduleMode === 'explicit' && exceptions.length)) throw Errors.validationError('Collection backup schedule children are invalid');
    return persistedStream(s, dates, exceptions);
  });
  if (rows.collectionHousehold.length) parse(collectionAggregateSchema, { timezone: rows.collectionHousehold[0]!.timezone, providerLabel: rows.collectionHousehold[0]!.providerLabel, streams });
  if (semanticBlockers(streams).length) throw Errors.validationError('Collection backup schedules conflict');
  for (const row of data.appWidgetInstances) {
    if (row['type'] !== 'calendar') continue;
    if (typeof row['configJson'] !== 'string') throw Errors.validationError('Calendar backup config is invalid');
    const config = parseCalendarSelection(row['configJson']);
    if (!config || config.collectionStreamIds.some(id => !streamIds.includes(id))) throw Errors.validationError('Calendar backup collection selection is invalid');
  }
}
