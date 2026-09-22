# 016 — Settings Reorganization: Implementation Plan

## Approach

Pure frontend refactor — no backend changes needed. All existing APIs remain unchanged. The work is decomposing existing components, moving them into the new tab structure, and wiring up routing.

Work is ordered to keep the app functional after each phase. Each phase ends with a passing typecheck + lint + test cycle.

## Phase 1: Scaffold new tab structure

**Goal:** Replace the 3-tab layout with the 5-tab layout. Stub content for new tabs.

1. Update `SettingsPage.tsx`:
   - Change TAB_IDS to `['general', 'appearance', 'dashboards', 'groups', 'integrations']`
   - Add tab triggers for Dashboards and Groups & Access
   - Rename Shell & Appearance → Appearance, Customization → Integrations
   - Stub `DashboardsTab` and `GroupsTab` with placeholder content
   - Remove old `ShellTab` and `IntegrationsTab` references temporarily

2. Update `router.tsx`:
   - Add redirects: `/admin/dashboards` → `/settings?tab=dashboards`
   - Add redirects: `/admin/groups` → `/settings?tab=groups`
   - Keep old routes working via `<Navigate>` components

3. Create stub files:
   - `frontend/src/components/settings/AppearanceTab.tsx` — placeholder
   - `frontend/src/components/settings/DashboardsTab.tsx` — placeholder
   - `frontend/src/components/settings/GroupsTab.tsx` — placeholder

4. Rename `IntegrationsTab.tsx` — remove Clock Strip and Screensaver panels, keep only integrations

**Verify:** typecheck ✓, lint ✓, test ✓

## Phase 2: Appearance tab (sidebar layout)

**Goal:** Build the full Appearance tab with 4 sidebar items.

1. Create `AppearanceTab.tsx` with sidebar layout:
   - Groups: Layout (Branding, Header & Clock, Footer), Behavior (Screensaver)
   - Default selection: Branding

2. **BrandingPanel**: Extract from GeneralTab (logo) + ShellTab (title, font, font size)
   - Own save button, merges with current shell settings
   - Move `AdminLogoSection` from GeneralTab into this panel

3. **HeaderClockPanel**: Extract from ShellTab (header height) + old ClockStripPanel
   - Already have ClockStripPanel logic — extend with header height
   - Own save button, merges with current shell settings

4. **FooterPanel**: Extract from ShellTab (footer text, repo URL)
   - Own save button, merges with current shell settings

5. **ScreensaverPanel**: Adapt from existing ScreensaverTab
   - Remove photo source CRUD section
   - Add source picker dropdown (select from existing sources)
   - Keep: enable, idle timeout, transition, interval, clock format, weather

6. Simplify `GeneralTab.tsx`:
   - Remove logo upload section (moved to Appearance > Branding)
   - Keep: theme toggle, my dashboard prefs

7. Delete `ShellTab.tsx` (all content redistributed)
   - Keep exported helpers (`AlignmentPicker`, `ClockDisplayConfigPicker`, `TimezoneCombobox`, `ExtraTimezoneRow`) — move to a shared file `frontend/src/components/settings/shell-helpers.tsx`

**Verify:** typecheck ✓, lint ✓, test ✓

## Phase 3: Dashboards tab

**Goal:** Move dashboard management into Settings.

1. Create `DashboardsTab.tsx`:
   - Import and render the core content from `DashboardManagementPage.tsx`
   - Extract the dashboard list/CRUD logic into a reusable component if not already
   - Add "Public Defaults" section (move unauthenticated dashboard pickers from ShellTab)

2. Simplify `DashboardManagementPage.tsx`:
   - Either redirect to `/settings?tab=dashboards` or keep as thin wrapper

**Verify:** typecheck ✓, lint ✓, test ✓

## Phase 4: Groups & Access tab

**Goal:** Move group management into Settings.

1. Create `GroupsTab.tsx`:
   - Import and render the core content from `GroupManagementPage.tsx`
   - Extract the group list/CRUD/membership/permissions into a reusable component

2. Simplify `GroupManagementPage.tsx`:
   - Either redirect to `/settings?tab=groups` or keep as thin wrapper

**Verify:** typecheck ✓, lint ✓, test ✓

## Phase 5: Integrations tab cleanup + Photo Sources

**Goal:** Add Photo Sources to Integrations, clean up.

1. Create `PhotoSourcesPanel` in IntegrationsTab:
   - Extract photo source CRUD from `ScreensaverTab.tsx` (add folder, delete, rescan)
   - Reuse existing `usePhotoSources` hook or create shared version

2. Add to Integrations sidebar:
   - Media group: Photo Sources (new), Spotify (existing)

3. Remove old `ScreensaverTab.tsx` (content split between Appearance > Screensaver and Integrations > Photo Sources)

4. Final cleanup:
   - Remove dead imports across all files
   - Update `PhotoFrameConfigForm.tsx` help text ("Add sources in Settings → Integrations → Photo Sources")
   - Verify all `?tab=` deep links work
   - Verify old route redirects work

**Verify:** typecheck ✓, lint ✓, test ✓

## Phase 6: Polish and commit

1. Update file/component doc comments
2. Final full verify: typecheck ✓, lint ✓, test ✓
3. Commit, push, update PR

## File Impact Summary

### New files
- `frontend/src/components/settings/AppearanceTab.tsx`
- `frontend/src/components/settings/DashboardsTab.tsx`
- `frontend/src/components/settings/GroupsTab.tsx`
- `frontend/src/components/settings/shell-helpers.tsx` (extracted shared components)

### Major modifications
- `frontend/src/pages/SettingsPage.tsx` — New 5-tab structure
- `frontend/src/app/router.tsx` — Route redirects
- `frontend/src/components/settings/IntegrationsTab.tsx` — Remove appearance items, add Photo Sources
- `frontend/src/components/settings/GeneralTab.tsx` — Remove logo section

### Deleted
- `frontend/src/components/settings/ShellTab.tsx` — Content redistributed
- `frontend/src/components/settings/ScreensaverTab.tsx` — Content split into Appearance + Integrations

### Potentially simplified
- `frontend/src/pages/DashboardManagementPage.tsx` — Redirect or thin wrapper
- `frontend/src/pages/GroupManagementPage.tsx` — Redirect or thin wrapper
