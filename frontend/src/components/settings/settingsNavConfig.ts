/**
 * Single source of truth for the Settings navigation.
 *
 * Groups contain leaves; a leaf is the smallest navigable unit and maps 1:1 to
 * the `?tab=<leaf>` URL parameter. The group is derived from the leaf and never
 * appears in the URL. A leaf may own an in-leaf sub-panel selector, driven by an
 * opaque, leaf-interpreted `?panel=<sub>` parameter (currently Integrations;
 * reserved for Widgets per #20).
 */

import {
  Settings2,
  Type,
  Ruler,
  Clock,
  MonitorPlay,
  LayoutDashboard,
  Puzzle,
  Plug,
  UserCog,
  Users,
  Globe,
  CalendarClock,
  DatabaseBackup,
  Info,
  type LucideIcon,
} from 'lucide-react';

export interface SettingsLeaf {
  id: string;
  label: string;
  icon: LucideIcon;
  adminOnly: boolean;
  /** True when the leaf owns an in-leaf `?panel=` selector. */
  usesPanel?: boolean;
}

export interface SettingsGroup {
  id: string;
  label: string;
  leaves: readonly SettingsLeaf[];
}

export const SETTINGS_GROUPS: readonly SettingsGroup[] = [
  {
    id: 'account',
    label: 'Account',
    leaves: [{ id: 'general', label: 'General', icon: Settings2, adminOnly: false }],
  },
  {
    id: 'appearance',
    label: 'Appearance',
    leaves: [
      { id: 'branding', label: 'Branding', icon: Type, adminOnly: true },
      { id: 'header-footer', label: 'Header & Footer', icon: Ruler, adminOnly: true },
      { id: 'clock-strip', label: 'Clock Strip', icon: Clock, adminOnly: true },
      { id: 'screensaver', label: 'Screensaver', icon: MonitorPlay, adminOnly: true },
    ],
  },
  {
    id: 'content',
    label: 'Content',
    leaves: [
      { id: 'dashboards', label: 'Dashboards', icon: LayoutDashboard, adminOnly: true },
      { id: 'widgets', label: 'Widgets', icon: Puzzle, adminOnly: true },
      { id: 'integrations', label: 'Integrations', icon: Plug, adminOnly: true, usesPanel: true },
    ],
  },
  {
    id: 'access',
    label: 'Access',
    leaves: [
      { id: 'users', label: 'Users', icon: UserCog, adminOnly: true },
      { id: 'groups', label: 'Groups & Access', icon: Users, adminOnly: true },
    ],
  },
  {
    id: 'system',
    label: 'System',
    leaves: [
      { id: 'timezone', label: 'Timezone', icon: Globe, adminOnly: true },
      { id: 'scheduled-jobs', label: 'Scheduled Jobs', icon: CalendarClock, adminOnly: true },
      { id: 'backup', label: 'Backup & Restore', icon: DatabaseBackup, adminOnly: true },
    ],
  },
  {
    id: 'about',
    label: 'About',
    leaves: [{ id: 'about', label: 'About', icon: Info, adminOnly: false }],
  },
];

/** The leaf shown when no (or an unresolvable) tab is requested. */
export const DEFAULT_LEAF_ID = 'general';

const LEAVES_BY_ID = new Map<string, SettingsLeaf>(
  SETTINGS_GROUPS.flatMap((group) => group.leaves.map((leaf) => [leaf.id, leaf] as const)),
);

export function getLeaf(id: string | null | undefined): SettingsLeaf | undefined {
  if (!id) return undefined;
  return LEAVES_BY_ID.get(id);
}

/** True when the given user role may view the leaf. */
export function canAccessLeaf(leaf: SettingsLeaf, isAdmin: boolean): boolean {
  return !leaf.adminOnly || isAdmin;
}

/**
 * Resolve a requested `?tab=` value to a valid, permitted leaf id. Unknown,
 * empty, retired, or access-denied values fall back to the default leaf.
 */
export function resolveLeafId(tabParam: string | null | undefined, isAdmin: boolean): string {
  const leaf = getLeaf(tabParam);
  if (leaf && canAccessLeaf(leaf, isAdmin)) return leaf.id;
  return DEFAULT_LEAF_ID;
}

/** Groups with their leaves filtered to those the role may access. */
export function getVisibleGroups(isAdmin: boolean): SettingsGroup[] {
  return SETTINGS_GROUPS.map((group) => ({
    ...group,
    leaves: group.leaves.filter((leaf) => canAccessLeaf(leaf, isAdmin)),
  })).filter((group) => group.leaves.length > 0);
}
