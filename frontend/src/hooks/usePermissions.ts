/**
 * T009 (012-RBAC): Permission hooks and PermissionGate component.
 *
 * Provides a React hook and component to gate UI elements based on the
 * current user's effective permissions from their RBAC group memberships.
 */

import { type ReactNode, useMemo } from 'react';
import { useBootstrap } from '../state/bootstrap.js';

// ─── Permission types (mirror backend) ───────────────────────────────────────

export type PermissionCategory =
  | 'dashboards'
  | 'widgets'
  | 'settings'
  | 'users'
  | 'integrations';

export type PermissionLevel = 'view' | 'manage';

// ─── Hook ────────────────────────────────────────────────────────────────────

export interface UsePermissionsResult {
  /** The raw permission string set (e.g. 'dashboards:manage'). */
  permissions: Set<string>;
  /** Whether the user is an admin (bypasses all permission checks). */
  isAdmin: boolean;
  /** Check if the user has a specific permission. Admins always return true. */
  hasPermission: (category: PermissionCategory, level: PermissionLevel) => boolean;
  /** Whether auth data has loaded yet. */
  isLoaded: boolean;
}

/**
 * Access the current user's effective permissions.
 * Admins bypass all checks. Returns `{ hasPermission, isAdmin, permissions, isLoaded }`.
 */
export function usePermissions(): UsePermissionsResult {
  const { user, isAuthenticated } = useBootstrap();

  const permissions = useMemo(
    () => new Set(user?.permissions ?? []),
    [user?.permissions],
  );

  const isAdmin = user?.isAdmin ?? false;

  const hasPermission = useMemo(
    () => (category: PermissionCategory, level: PermissionLevel): boolean => {
      if (isAdmin) return true;
      // 'manage' implies 'view' — backend materializes both, so simple .has() works
      return permissions.has(`${category}:${level}`);
    },
    [isAdmin, permissions],
  );

  return { permissions, isAdmin, hasPermission, isLoaded: isAuthenticated };
}

// ─── Gate component ──────────────────────────────────────────────────────────

export interface PermissionGateProps {
  category: PermissionCategory;
  level: PermissionLevel;
  /** Content to show when the user has the required permission. */
  children: ReactNode;
  /** Optional fallback to show when permission is denied (default: nothing). */
  fallback?: ReactNode;
}

/**
 * Conditionally renders children based on the user's permission.
 * Admins always see the children.
 */
export function PermissionGate({
  category,
  level,
  children,
  fallback = null,
}: PermissionGateProps): ReactNode {
  const { hasPermission, isLoaded } = usePermissions();

  if (!isLoaded) return fallback;
  if (!hasPermission(category, level)) return fallback;

  return children;
}
