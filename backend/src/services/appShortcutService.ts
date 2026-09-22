/**
 * 013-app-shortcuts: App Shortcut & Group CRUD service.
 * Provides shortcut/group management with Zod validation.
 */

import { eq, and, asc } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../db/drizzle.js';
import { appShortcuts, shortcutGroups, appWidgetInstances } from '../db/schema/index.js';
import { Errors } from '../lib/errors.js';
import { invalidatePublicWidgetSnapshot } from './publicWidgetSnapshotCache.js';

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

export const CreateShortcutSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().min(1).max(2048),
  groupId: z.string().uuid().nullable().optional(),
  pingEnabled: z.boolean().optional(),
  iconKey: z.string().nullable().optional(),
});

export const UpdateShortcutSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  url: z.string().min(1).max(2048).optional(),
  groupId: z.string().uuid().nullable().optional(),
  pingEnabled: z.boolean().optional(),
  iconKey: z.string().nullable().optional(),
});

export const CreateGroupSchema = z.object({
  name: z.string().min(1).max(50),
});

export const UpdateGroupSchema = z.object({
  name: z.string().min(1).max(50).optional(),
});

export const ReorderSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1),
});

export const AppShortcutsConfigSchema = z
  .object({
    columns: z.number().int().min(2).max(8).default(4),
  })
  .strict();

// ─── Types ───────────────────────────────────────────────────────────────────

export type CreateShortcutInput = z.infer<typeof CreateShortcutSchema>;
export type UpdateShortcutInput = z.infer<typeof UpdateShortcutSchema>;
export type CreateGroupInput = z.infer<typeof CreateGroupSchema>;
export type UpdateGroupInput = z.infer<typeof UpdateGroupSchema>;
export type ReorderInput = z.infer<typeof ReorderSchema>;

export interface ShortcutRow {
  id: string;
  widgetInstanceId: string;
  groupId: string | null;
  name: string;
  url: string;
  iconKey: string | null;
  iconAssetId: string | null;
  iconOverrideAssetId: string | null;
  pingEnabled: number;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
}

export interface GroupRow {
  id: string;
  widgetInstanceId: string;
  name: string;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
}

export interface ShortcutView {
  id: string;
  widgetInstanceId: string;
  groupId: string | null;
  name: string;
  url: string;
  iconKey: string | null;
  iconUrl: string | null;
  pingEnabled: boolean;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function assertWidgetExists(widgetId: string): void {
  const db = getDb();
  const widget = db
    .select()
    .from(appWidgetInstances)
    .where(eq(appWidgetInstances.id, widgetId))
    .get();
  if (!widget) throw Errors.notFound('Widget instance not found');
}

function toShortcutView(row: ShortcutRow): ShortcutView {
  const iconId = row.iconOverrideAssetId ?? row.iconAssetId;
  return {
    id: row.id,
    widgetInstanceId: row.widgetInstanceId,
    groupId: row.groupId,
    name: row.name,
    url: row.url,
    iconKey: row.iconKey,
    iconUrl: iconId ? `/api/assets/${iconId}` : null,
    pingEnabled: row.pingEnabled === 1,
    orderIndex: row.orderIndex,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ─── Shortcut CRUD ───────────────────────────────────────────────────────────

export function listShortcuts(widgetId: string): ShortcutView[] {
  const db = getDb();
  const rows = db
    .select()
    .from(appShortcuts)
    .where(eq(appShortcuts.widgetInstanceId, widgetId))
    .orderBy(asc(appShortcuts.orderIndex))
    .all();
  return rows.map(toShortcutView);
}

export function getShortcut(shortcutId: string): ShortcutView {
  const db = getDb();
  const row = db.select().from(appShortcuts).where(eq(appShortcuts.id, shortcutId)).get();
  if (!row) throw Errors.notFound('Shortcut not found');
  return toShortcutView(row);
}

export function createShortcut(widgetId: string, input: CreateShortcutInput): ShortcutView {
  assertWidgetExists(widgetId);
  const db = getDb();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  // Determine next orderIndex
  const existing = db
    .select()
    .from(appShortcuts)
    .where(eq(appShortcuts.widgetInstanceId, widgetId))
    .all();
  const maxOrder = existing.reduce((max, r) => Math.max(max, r.orderIndex), -1);

  db.insert(appShortcuts)
    .values({
      id,
      widgetInstanceId: widgetId,
      name: input.name,
      url: input.url,
      ...(input.groupId != null ? { groupId: input.groupId } : {}),
      ...(input.iconKey !== undefined ? { iconKey: input.iconKey ?? null } : {}),
      ...(input.pingEnabled != null ? { pingEnabled: input.pingEnabled ? 1 : 0 } : {}),
      orderIndex: maxOrder + 1,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  invalidatePublicWidgetSnapshot(widgetId);
  return getShortcut(id);
}

export function updateShortcut(shortcutId: string, input: UpdateShortcutInput): ShortcutView {
  const db = getDb();
  const existing = db.select().from(appShortcuts).where(eq(appShortcuts.id, shortcutId)).get();
  if (!existing) throw Errors.notFound('Shortcut not found');

  const now = new Date().toISOString();
  db.update(appShortcuts)
    .set({
      ...(input.name != null ? { name: input.name } : {}),
      ...(input.url != null ? { url: input.url } : {}),
      ...(input.groupId !== undefined ? { groupId: input.groupId ?? null } : {}),
      ...(input.iconKey !== undefined ? { iconKey: input.iconKey ?? null } : {}),
      ...(input.pingEnabled != null ? { pingEnabled: input.pingEnabled ? 1 : 0 } : {}),
      updatedAt: now,
    })
    .where(eq(appShortcuts.id, shortcutId))
    .run();

  invalidatePublicWidgetSnapshot(existing.widgetInstanceId);
  return getShortcut(shortcutId);
}

export function deleteShortcut(shortcutId: string): void {
  const db = getDb();
  const existing = db.select().from(appShortcuts).where(eq(appShortcuts.id, shortcutId)).get();
  if (!existing) throw Errors.notFound('Shortcut not found');
  db.delete(appShortcuts).where(eq(appShortcuts.id, shortcutId)).run();
  invalidatePublicWidgetSnapshot(existing.widgetInstanceId);
}

// ─── Group CRUD ──────────────────────────────────────────────────────────────

export function listGroups(widgetId: string): GroupRow[] {
  const db = getDb();
  return db
    .select()
    .from(shortcutGroups)
    .where(eq(shortcutGroups.widgetInstanceId, widgetId))
    .orderBy(asc(shortcutGroups.orderIndex))
    .all();
}

export function createGroup(widgetId: string, input: CreateGroupInput): GroupRow {
  assertWidgetExists(widgetId);
  const db = getDb();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  const existing = db
    .select()
    .from(shortcutGroups)
    .where(eq(shortcutGroups.widgetInstanceId, widgetId))
    .all();
  const maxOrder = existing.reduce((max, r) => Math.max(max, r.orderIndex), -1);

  db.insert(shortcutGroups)
    .values({
      id,
      widgetInstanceId: widgetId,
      name: input.name,
      orderIndex: maxOrder + 1,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  invalidatePublicWidgetSnapshot(widgetId);
  const row = db.select().from(shortcutGroups).where(eq(shortcutGroups.id, id)).get();
  return row!;
}

export function updateGroup(groupId: string, input: UpdateGroupInput): GroupRow {
  const db = getDb();
  const existing = db.select().from(shortcutGroups).where(eq(shortcutGroups.id, groupId)).get();
  if (!existing) throw Errors.notFound('Group not found');

  const now = new Date().toISOString();
  db.update(shortcutGroups)
    .set({
      ...(input.name != null ? { name: input.name } : {}),
      updatedAt: now,
    })
    .where(eq(shortcutGroups.id, groupId))
    .run();

  invalidatePublicWidgetSnapshot(existing.widgetInstanceId);
  return db.select().from(shortcutGroups).where(eq(shortcutGroups.id, groupId)).get()!;
}

export function deleteGroup(groupId: string): void {
  const db = getDb();
  const existing = db.select().from(shortcutGroups).where(eq(shortcutGroups.id, groupId)).get();
  if (!existing) throw Errors.notFound('Group not found');
  // Shortcuts with this groupId will have groupId set to null via FK onDelete: 'set null'
  db.delete(shortcutGroups).where(eq(shortcutGroups.id, groupId)).run();
  invalidatePublicWidgetSnapshot(existing.widgetInstanceId);
}

// ─── Reorder ─────────────────────────────────────────────────────────────────

export function reorderShortcuts(widgetId: string, orderedIds: string[]): ShortcutView[] {
  const db = getDb();
  for (let i = 0; i < orderedIds.length; i++) {
    db.update(appShortcuts)
      .set({ orderIndex: i })
      .where(and(eq(appShortcuts.id, orderedIds[i]!), eq(appShortcuts.widgetInstanceId, widgetId)))
      .run();
  }
  invalidatePublicWidgetSnapshot(widgetId);
  return listShortcuts(widgetId);
}

export function reorderGroups(widgetId: string, orderedIds: string[]): GroupRow[] {
  const db = getDb();
  for (let i = 0; i < orderedIds.length; i++) {
    db.update(shortcutGroups)
      .set({ orderIndex: i })
      .where(
        and(eq(shortcutGroups.id, orderedIds[i]!), eq(shortcutGroups.widgetInstanceId, widgetId)),
      )
      .run();
  }
  invalidatePublicWidgetSnapshot(widgetId);
  return listGroups(widgetId);
}
