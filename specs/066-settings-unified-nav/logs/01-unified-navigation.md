# 01 — Unified Navigation

[<- Back to Logs Index](readme.md)

## Overview

**Phase**: 01 — Unified Navigation
**Task range**: T001–T016
**Date/Time**: 2026-10-11
**Purpose**: Replace the Settings page's mixed navigation metaphors with one
grouped rail (desktop) + slide-in drawer (mobile), flatten Appearance and
System sub-panels into first-class leaves, keep Integrations as the one leaf
with a leaf-interpreted `?panel=` selector, and encode the active leaf/sub-panel
in `?tab=`/`?panel=` so refresh and shared links restore the exact panel.

## What changed

- Added `settingsNavConfig.ts`: single source of truth (`SETTINGS_GROUPS`),
  resolver helpers (`getLeaf`, `canAccessLeaf`, `resolveLeafId`,
  `getVisibleGroups`), `DEFAULT_LEAF_ID='general'`. Integrations leaf carries
  `usesPanel: true`; Widgets leaf is reserved for the `?panel=` seam (#20).
- Added `SettingsNav.tsx`: grouped non-collapsing rail (`hidden lg:block`) plus a
  mobile slide-in `Sheet` drawer (`lg:hidden`), 44px touch targets, `aria-current`.
- Rewrote `SettingsPage.tsx` to own `?tab=`/`?panel=`, admin gating, a normalize
  effect (strips stray tab/panel), a visited-leaf mount cache (preserves form
  state), and a leaf router. Appearance panels and the former System tab children
  are now first-class leaves.
- `AppearanceTab.tsx` exports `AppearancePanelContent` / `AppearancePanelId`; its
  internal sidebar + wrapper were removed (nav now lives in `SettingsNav`).
- `IntegrationsTab.tsx` now takes URL-driven `panel`/`onPanelChange` props while
  keeping its in-leaf sub-nav + `MobileSectionSelect`.
- Deleted `SystemTab.tsx` (its children became `timezone`/`scheduled-jobs`/`backup`).

## Commands Run

```
pnpm typecheck                     # clean (backend + frontend)
pnpm --filter frontend test:unit   # 191 passed (45 files)
pnpm lint                          # eslint . --max-warnings=0 — clean (Node 24)
pnpm version:bump-main             # 3.2.15 -> 3.2.16 (+ README blue badge)
```

Added tests:
- `settingsNavConfig.test.ts` — `getLeaf`, `canAccessLeaf`, `resolveLeafId`,
  `getVisibleGroups` with positive **and** negative admin-gating coverage.
- `SettingsNav.test.tsx` — rail renders, active leaf marked, selection reported,
  admin-only leaves hidden from non-admins.
- Updated e2e: `settingsNavigation.spec.ts`, `settingsNavigation.mobile.spec.ts`,
  `shellSettings.spec.ts`, `scheduledJobsResponsive.mobile.spec.ts` to the new
  grouped rail / drawer and flattened leaf ids.

## Errors & Fixes

- **Filename case collision** (macOS case-insensitive FS): `SettingsNav.tsx` vs
  `settingsNav.ts` confused TS module resolution → `git mv` config to
  `settingsNavConfig.ts`; updated imports.
- **`noPropertyAccessFromIndexSignature`**: building the normalized query object
  with dynamic `obj.panel = …` failed typecheck → construct the object literal
  directly (`{ tab, panel }`).
- **Retired tab ids in e2e** (`appearance`, `system`): old deep links no longer
  resolve → pointed specs at flattened leaves (`branding`, `clock-strip`,
  `scheduled-jobs`) and the new rail/drawer roles.
- **Unit test env/cleanup**: new component test needed the `@vitest-environment
  jsdom` directive and explicit `afterEach(cleanup)`; jest-dom matchers are not
  globally registered, so used plain `getAttribute`/`queryByRole` assertions.

## Phase Checkpoint

✅ Complete. Typecheck, unit tests (191), and lint (zero warnings, Node 24) all
pass. Version bumped. No push or PR this session per the user's instruction; the
mandatory pre-PR gate skills are deferred until a PR is requested.
