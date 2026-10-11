import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LEAF_ID,
  canAccessLeaf,
  getLeaf,
  getVisibleGroups,
  resolveLeafId,
  SETTINGS_GROUPS,
} from '../settingsNavConfig.js';

describe('settingsNavConfig', () => {
  describe('getLeaf', () => {
    it('returns the leaf for a known id', () => {
      expect(getLeaf('integrations')?.label).toBe('Integrations');
    });

    it('returns undefined for unknown, empty, or nullish ids', () => {
      expect(getLeaf('nope')).toBeUndefined();
      expect(getLeaf('')).toBeUndefined();
      expect(getLeaf(null)).toBeUndefined();
      expect(getLeaf(undefined)).toBeUndefined();
    });
  });

  describe('canAccessLeaf', () => {
    it('allows everyone on non-admin leaves', () => {
      const general = getLeaf('general')!;
      expect(canAccessLeaf(general, false)).toBe(true);
      expect(canAccessLeaf(general, true)).toBe(true);
    });

    it('restricts admin-only leaves to admins', () => {
      const branding = getLeaf('branding')!;
      expect(canAccessLeaf(branding, true)).toBe(true);
      expect(canAccessLeaf(branding, false)).toBe(false);
    });
  });

  describe('resolveLeafId', () => {
    it('resolves a valid permitted leaf to itself', () => {
      expect(resolveLeafId('integrations', true)).toBe('integrations');
      expect(resolveLeafId('about', false)).toBe('about');
    });

    it('falls back to the default for unknown, empty, or nullish tabs', () => {
      expect(resolveLeafId('appearance', true)).toBe(DEFAULT_LEAF_ID);
      expect(resolveLeafId('system', true)).toBe(DEFAULT_LEAF_ID);
      expect(resolveLeafId('unknown', true)).toBe(DEFAULT_LEAF_ID);
      expect(resolveLeafId('', true)).toBe(DEFAULT_LEAF_ID);
      expect(resolveLeafId(null, true)).toBe(DEFAULT_LEAF_ID);
      expect(resolveLeafId(undefined, true)).toBe(DEFAULT_LEAF_ID);
    });

    it('denies admin-only leaves to non-admins and falls back to default', () => {
      expect(resolveLeafId('branding', false)).toBe(DEFAULT_LEAF_ID);
      expect(resolveLeafId('users', false)).toBe(DEFAULT_LEAF_ID);
      expect(resolveLeafId('branding', true)).toBe('branding');
    });
  });

  describe('getVisibleGroups', () => {
    it('shows every group and leaf to admins', () => {
      const groups = getVisibleGroups(true);
      const total = SETTINGS_GROUPS.flatMap((g) => g.leaves).length;
      const visible = groups.flatMap((g) => g.leaves).length;
      expect(visible).toBe(total);
    });

    it('hides admin-only leaves and empty groups from non-admins', () => {
      const groups = getVisibleGroups(false);
      const leafIds = groups.flatMap((g) => g.leaves.map((l) => l.id));
      expect(leafIds).toEqual(expect.arrayContaining(['general', 'about']));
      expect(leafIds).not.toContain('branding');
      expect(leafIds).not.toContain('integrations');
      // Appearance / System groups are admin-only and should disappear entirely.
      expect(groups.map((g) => g.id)).not.toContain('appearance');
      expect(groups.map((g) => g.id)).not.toContain('system');
    });
  });
});
