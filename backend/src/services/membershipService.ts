/**
 * T034 (012-RBAC, US3): Membership service — assign/remove users from groups.
 *
 * Enforces:
 * - Cannot remove the last member of the Administrators group (admin lockout prevention)
 * - Duplicate memberships are rejected gracefully
 */

import crypto from 'node:crypto';
import { eq, and, count } from 'drizzle-orm';
import { getDb } from '../db/drizzle.js';
import { groups, users, userGroupMemberships } from '../db/schema/index.js';
import { BUILT_IN_GROUP_SLUGS } from '../lib/permissions.js';
import { Errors } from '../lib/errors.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MemberRow {
  userId: string;
  username: string;
  displayName: string;
  joinedAt: string;
}

export interface UserGroupRow {
  groupId: string;
  groupName: string;
  groupSlug: string | null;
  isBuiltIn: boolean;
}

// ─── Service ─────────────────────────────────────────────────────────────────

/**
 * List all members of a group.
 */
export function listGroupMembers(groupId: string): MemberRow[] {
  const db = getDb();

  // Verify group exists
  const group = db.select({ id: groups.id }).from(groups).where(eq(groups.id, groupId)).get();
  if (!group) throw Errors.notFound('Group not found');

  return db
    .select({
      userId: users.id,
      username: users.username,
      displayName: users.displayName,
      joinedAt: userGroupMemberships.createdAt,
    })
    .from(userGroupMemberships)
    .innerJoin(users, eq(userGroupMemberships.userId, users.id))
    .where(eq(userGroupMemberships.groupId, groupId))
    .orderBy(users.username)
    .all();
}

/**
 * Add a user to a group. Throws if already a member.
 */
export function addGroupMember(groupId: string, userId: string): void {
  const db = getDb();

  // Verify group exists
  const group = db.select({ id: groups.id }).from(groups).where(eq(groups.id, groupId)).get();
  if (!group) throw Errors.notFound('Group not found');

  // Verify user exists
  const user = db.select({ id: users.id }).from(users).where(eq(users.id, userId)).get();
  if (!user) throw Errors.notFound('User not found');

  // Check for duplicate
  const existing = db
    .select({ id: userGroupMemberships.id })
    .from(userGroupMemberships)
    .where(and(eq(userGroupMemberships.userId, userId), eq(userGroupMemberships.groupId, groupId)))
    .get();

  if (existing) {
    throw Errors.conflict('User is already a member of this group');
  }

  db.insert(userGroupMemberships)
    .values({
      id: crypto.randomUUID(),
      userId,
      groupId,
      createdAt: new Date().toISOString(),
    })
    .run();
}

/**
 * Remove a user from a group.
 * Prevents removing the last member of the Administrators group.
 */
export function removeGroupMember(groupId: string, userId: string): void {
  const db = getDb();

  // Verify group exists and check if it's the Administrators group
  const group = db
    .select({ id: groups.id, slug: groups.slug })
    .from(groups)
    .where(eq(groups.id, groupId))
    .get();
  if (!group) throw Errors.notFound('Group not found');

  // Admin lockout prevention
  if (group.slug === BUILT_IN_GROUP_SLUGS.ADMINISTRATORS) {
    const memberCountResult = db
      .select({ value: count() })
      .from(userGroupMemberships)
      .where(eq(userGroupMemberships.groupId, groupId))
      .get();

    if (memberCountResult && memberCountResult.value <= 1) {
      throw Errors.forbidden('Cannot remove the last member of the Administrators group');
    }
  }

  // Verify membership exists
  const membership = db
    .select({ id: userGroupMemberships.id })
    .from(userGroupMemberships)
    .where(and(eq(userGroupMemberships.userId, userId), eq(userGroupMemberships.groupId, groupId)))
    .get();

  if (!membership) {
    throw Errors.notFound('User is not a member of this group');
  }

  db.delete(userGroupMemberships).where(eq(userGroupMemberships.id, membership.id)).run();
}

/**
 * List all groups a user belongs to.
 */
export function listUserGroups(userId: string): UserGroupRow[] {
  const db = getDb();

  // Verify user exists
  const user = db.select({ id: users.id }).from(users).where(eq(users.id, userId)).get();
  if (!user) throw Errors.notFound('User not found');

  return db
    .select({
      groupId: groups.id,
      groupName: groups.name,
      groupSlug: groups.slug,
      isBuiltIn: groups.isBuiltIn,
    })
    .from(userGroupMemberships)
    .innerJoin(groups, eq(userGroupMemberships.groupId, groups.id))
    .where(eq(userGroupMemberships.userId, userId))
    .orderBy(groups.name)
    .all();
}
