/**
 * T023 (012-RBAC, US2): Group service — CRUD operations for user groups.
 *
 * Built-in groups (Administrators, Users, Viewers) cannot be deleted.
 * Administrators group permissions cannot be modified.
 * Group names must be unique.
 */

import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/drizzle.js';
import { groups, groupPermissions, userGroupMemberships } from '../db/schema/index.js';
import { BUILT_IN_GROUP_SLUGS } from '../lib/permissions.js';
import { Errors } from '../lib/errors.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GroupRow {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  isBuiltIn: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GroupWithPermissions extends GroupRow {
  permissions: Array<{ category: string; level: string }>;
  memberCount: number;
}

export interface CreateGroupInput {
  name: string;
  description?: string;
  permissions?: Array<{ category: string; level: string }>;
}

export interface UpdateGroupInput {
  name?: string;
  description?: string | null;
  permissions?: Array<{ category: string; level: string }>;
}

// ─── Service ─────────────────────────────────────────────────────────────────

/**
 * List all groups with their permissions and member counts.
 */
export function listGroups(): GroupWithPermissions[] {
  const db = getDb();

  const allGroups = db.select().from(groups).orderBy(groups.name).all();

  return allGroups.map((g) => {
    const perms = db
      .select({ category: groupPermissions.category, level: groupPermissions.level })
      .from(groupPermissions)
      .where(eq(groupPermissions.groupId, g.id))
      .all();

    const memberCount = db
      .select({ id: userGroupMemberships.id })
      .from(userGroupMemberships)
      .where(eq(userGroupMemberships.groupId, g.id))
      .all().length;

    return { ...g, permissions: perms, memberCount };
  });
}

/**
 * Get a single group by ID with permissions and member count.
 */
export function getGroup(groupId: string): GroupWithPermissions {
  const db = getDb();

  const group = db.select().from(groups).where(eq(groups.id, groupId)).get();
  if (!group) throw Errors.notFound('Group not found');

  const perms = db
    .select({ category: groupPermissions.category, level: groupPermissions.level })
    .from(groupPermissions)
    .where(eq(groupPermissions.groupId, groupId))
    .all();

  const memberCount = db
    .select({ id: userGroupMemberships.id })
    .from(userGroupMemberships)
    .where(eq(userGroupMemberships.groupId, groupId))
    .all().length;

  return { ...group, permissions: perms, memberCount };
}

/**
 * Create a new custom group with optional permissions.
 */
export function createGroup(input: CreateGroupInput): GroupWithPermissions {
  const db = getDb();
  const now = new Date().toISOString();
  const groupId = crypto.randomUUID();

  db.transaction((tx) => {
    tx.insert(groups)
      .values({
        id: groupId,
        name: input.name,
        slug: null,
        description: input.description ?? null,
        isBuiltIn: false,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    if (input.permissions && input.permissions.length > 0) {
      for (const perm of input.permissions) {
        tx.insert(groupPermissions)
          .values({
            id: crypto.randomUUID(),
            groupId,
            category: perm.category,
            level: perm.level,
          })
          .run();
      }
    }
  });

  return getGroup(groupId);
}

/**
 * Update an existing group. Built-in constraints enforced:
 * - Administrators group permissions cannot be changed
 * - Built-in groups cannot have their slug changed
 */
export function updateGroup(groupId: string, input: UpdateGroupInput): GroupWithPermissions {
  const db = getDb();
  const now = new Date().toISOString();

  const existing = db.select().from(groups).where(eq(groups.id, groupId)).get();
  if (!existing) throw Errors.notFound('Group not found');

  // Prevent modifying Administrators group permissions
  if (existing.slug === BUILT_IN_GROUP_SLUGS.ADMINISTRATORS && input.permissions !== undefined) {
    throw Errors.forbidden('Cannot modify Administrators group permissions');
  }

  db.transaction((tx) => {
    // Update group metadata
    tx.update(groups)
      .set({
        updatedAt: now,
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
      })
      .where(eq(groups.id, groupId))
      .run();

    // Replace permissions if provided (delete + re-insert)
    if (input.permissions !== undefined) {
      tx.delete(groupPermissions).where(eq(groupPermissions.groupId, groupId)).run();

      for (const perm of input.permissions) {
        tx.insert(groupPermissions)
          .values({
            id: crypto.randomUUID(),
            groupId,
            category: perm.category,
            level: perm.level,
          })
          .run();
      }
    }
  });

  return getGroup(groupId);
}

/**
 * Delete a group. Built-in groups cannot be deleted.
 */
export function deleteGroup(groupId: string): void {
  const db = getDb();

  const existing = db.select().from(groups).where(eq(groups.id, groupId)).get();
  if (!existing) throw Errors.notFound('Group not found');

  if (existing.isBuiltIn) {
    throw Errors.forbidden('Built-in groups cannot be deleted');
  }

  // Cascade delete handles memberships and permissions via FK constraints
  db.delete(groups).where(eq(groups.id, groupId)).run();
}
