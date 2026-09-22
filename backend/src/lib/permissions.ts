/**
 * T001 (012-RBAC): Permission constants, types, and helpers.
 *
 * Categories × levels define the full permission space.
 * Effective permissions are the additive union across all a user's groups,
 * where 'manage' supersedes 'view' for the same category.
 */

// ─── Constants ───────────────────────────────────────────────────────────────

export const PERMISSION_CATEGORIES = [
  'dashboards',
  'widgets',
  'settings',
  'users',
  'integrations',
] as const;

export type PermissionCategory = (typeof PERMISSION_CATEGORIES)[number];

export const PERMISSION_LEVELS = ['view', 'manage'] as const;
export type PermissionLevel = (typeof PERMISSION_LEVELS)[number];

/** e.g. 'dashboards:manage', 'settings:view' */
export type PermissionString = `${PermissionCategory}:${PermissionLevel}`;

/** Immutable slugs for built-in groups — identity that survives renames. */
export const BUILT_IN_GROUP_SLUGS = {
  ADMINISTRATORS: 'administrators',
  USERS: 'users',
  VIEWERS: 'viewers',
} as const;

export type BuiltInGroupSlug = (typeof BUILT_IN_GROUP_SLUGS)[keyof typeof BUILT_IN_GROUP_SLUGS];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Compute the effective permission set from a flat list of (category, level) rows.
 * For each category, 'manage' supersedes 'view' (additive union per R-03).
 *
 * The returned Set includes **both** 'category:manage' and 'category:view'
 * when manage is granted, so consumers can do a simple `.has()` check.
 */
export function computeEffectivePermissions(
  rows: ReadonlyArray<{ category: string; level: string }>,
): Set<PermissionString> {
  const best = new Map<string, PermissionLevel>();

  for (const { category, level } of rows) {
    if (!isPermissionCategory(category) || !isPermissionLevel(level)) continue;
    const current = best.get(category);
    if (!current || level === 'manage') {
      best.set(category, level);
    }
  }

  const result = new Set<PermissionString>();
  for (const [category, level] of best) {
    result.add(`${category as PermissionCategory}:${level}`);
    // 'manage' implies 'view' — materialize both for simple .has() checks
    if (level === 'manage') {
      result.add(`${category as PermissionCategory}:view`);
    }
  }

  return result;
}

/**
 * Check whether a permission set grants the given (category, level).
 */
export function hasPermission(
  permissions: ReadonlySet<string>,
  category: PermissionCategory,
  level: PermissionLevel,
): boolean {
  return permissions.has(`${category}:${level}`);
}

// ─── Type guards ─────────────────────────────────────────────────────────────

export function isPermissionCategory(value: string): value is PermissionCategory {
  return (PERMISSION_CATEGORIES as readonly string[]).includes(value);
}

export function isPermissionLevel(value: string): value is PermissionLevel {
  return (PERMISSION_LEVELS as readonly string[]).includes(value);
}
