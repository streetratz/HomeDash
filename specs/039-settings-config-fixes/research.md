# Research: Settings & Config Fixes

**Feature**: 039-settings-config-fixes  
**Date**: 2026-06-22

## Table of Contents

- [R1: Font Fields Missing from Bootstrap](#r1-font-fields-missing-from-bootstrap)
- [R2: Logo Upload Cache Invalidation](#r2-logo-upload-cache-invalidation)
- [R3: Clock Display Config Derivation](#r3-clock-display-config-derivation)
- [R4: Repository Link Rendering](#r4-repository-link-rendering)
- [R5: headerStyleTarget Removal from Public API](#r5-headerstyletarget-removal-from-public-api)
- [R6: UTC Timezone Validation Test Coverage](#r6-utc-timezone-validation-test-coverage)
- [R7: Screensaver Mutation Divergence](#r7-screensaver-mutation-divergence)

---

## R1: Font Fields Missing from Bootstrap

**Question**: Why are `titleFont` and `titleFontSizePx` saved but never applied?

**Finding**: The fields exist in:
- DB schema (`backend/src/db/schema/index.ts` lines 71–72): `title_font TEXT DEFAULT 'system'`, `title_font_size_px INTEGER DEFAULT 20`
- Admin service (`backend/src/services/shellSettingsService.ts` lines 181–182): returned in `ShellSettingsData`
- Admin PUT endpoint: accepted in `UpdateShellSettingsInput` (lines 229–231)

**Gap identified**: `backend/src/api/public.ts` (the bootstrap endpoint) constructs `shellPayload` at lines 72–95 but **omits** `titleFont` and `titleFontSizePx`. The frontend `ShellSettings` type in `frontend/src/state/bootstrap.ts` also lacks these fields. `ShellLayout.tsx` renders the title with a static CSS class (`text-lg font-semibold`) and never applies dynamic font styles.

**Decision**: Add `titleFont` and `titleFontSizePx` to bootstrap response and `ShellSettings` type; apply via inline `style` on the title `<span>` in `ShellLayout.tsx`.

**Rationale**: Inline styles are the simplest approach for two dynamic values. No CSS-in-JS library needed. Falls back gracefully when font isn't available (browser font stack behaviour).

**Alternatives considered**:
- CSS custom properties on `:root` — overkill for two values only used in one element
- Google Fonts dynamic loading — spec explicitly limits to system/local fonts; no external dependencies per constitution (LAN-only)

---

## R2: Logo Upload Cache Invalidation

**Question**: Why doesn't the logo update immediately after upload?

**Finding**: In `AppearanceTab.tsx` line 241, after successful logo upload:
```ts
void queryClient.invalidateQueries({ queryKey: ['admin-shell'] });
```

This invalidates only the **admin** shell settings query. The **public bootstrap** query (key: `['public-bootstrap']`) is NOT invalidated. The public dashboard reads logo URL from bootstrap data, so it remains stale until the next natural refetch (60s staleTime).

**Decision**: Add `queryClient.invalidateQueries({ queryKey: ['public-bootstrap'] })` after logo upload success.

**Rationale**: This is the same pattern used by `useUpdateShellSettings()` in `frontend/src/state/settings.ts` (line 163). Consistent, minimal change.

**Alternatives considered**:
- Reduce bootstrap staleTime to 0 — wasteful for all users; logo upload is rare
- Optimistic URL update — complex; the asset URL isn't known until server responds

---

## R3: Clock Display Config Derivation

**Question**: Why do clock display preferences (layout, showOffset) disappear when no home clock is configured?

**Finding**: In `ClockStrip.tsx` line 271:
```ts
const globalCfg: ClockDisplayConfig = clocks.find((c) => c.isHome)?.config ?? {};
```

When no home clock exists (`homeTimezone` is null in DB), the clocks array contains only extras — none with `isHome: true`. The `?.config` evaluates to `undefined`, so `globalCfg` becomes `{}`, losing all display preferences.

Additionally, the `homeClockConfig` JSON in the DB stores both the home clock's per-clock config AND the global display settings (layout, showOffset, homeIconSide, dayNightSide). In the bootstrap response, this config is only attached to the home clock entry — if there's no home clock entry, the config isn't exposed at all.

**Decision**: Expose `clockDisplayConfig` as a dedicated top-level field in the bootstrap `shellPayload`, read from `homeClockConfig` regardless of whether `homeTimezone` is set. In `ClockStrip.tsx`, accept this as a prop from `ShellLayout` and use it as `globalCfg` instead of deriving from the home clock entry.

**Rationale**: Separates "global display config" from "home clock existence". The config already exists in the DB; it just needs a separate exposure path.

**Alternatives considered**:
- Store display config in a separate DB column — requires migration; overkill since `homeClockConfig` already holds it
- Always include a synthetic home clock entry — confusing if user explicitly doesn't want a home clock displayed

---

## R4: Repository Link Rendering

**Question**: How should the repoUrl be rendered and what validation is needed?

**Finding**: `repoUrl` is already:
- Stored in DB (column exists in schema)
- Returned from admin API (in `ShellSettingsData`)
- Exposed in bootstrap response (`public.ts` line 80: `repoUrl: shell.repoUrl ?? null`)
- Present in frontend `ShellSettings` type (line 47: `repoUrl: string | null`)

**Gap**: `ShellLayout.tsx` footer section (lines 289–301) only renders `footerText` and version link. No rendering of `repoUrl`.

**Decision**: Add a conditional "Repository" link in the footer, between `footerText` and the version link. Validate URL scheme client-side (only render for `http://` or `https://`). Use `target="_blank" rel="noopener noreferrer"`.

**Rationale**: Footer is the conventional location for such links. Client-side scheme validation is defence-in-depth (admin-only input, but protects against `javascript:` etc.).

**Alternatives considered**:
- Server-side URL validation on save — good additional defence but not blocking for this fix (admin-only input)
- Render in header — too prominent; footer matches conventional placement

---

## R5: headerStyleTarget Removal from Public API

**Question**: Is it safe to remove `headerStyleTarget` from the public bootstrap?

**Finding**: 
- `headerStyleTarget` is in the bootstrap response (`public.ts` line 92)
- The frontend `ShellSettings` type includes it (line 56)
- `ShellLayout.tsx` does NOT reference `headerStyleTarget` anywhere
- No `grep` hit for `headerStyleTarget` in any frontend component consuming bootstrap data

**Decision**: Remove from `public.ts` shellPayload, remove from `ShellSettings` type. Keep in admin API (`ShellSettingsData` and update input) for potential future use.

**Rationale**: Dead code in public API increases payload and confuses future developers. No frontend consumer means removal is non-breaking.

**Alternatives considered**:
- Keep and document as "reserved for future use" — pollutes public API; can re-add when needed

---

## R6: UTC Timezone Validation Test Coverage

**Question**: What test coverage is needed for the UTC fix?

**Finding**: `isValidTimezone` in `shellSettingsService.ts` (line 342–344):
```ts
export function isValidTimezone(tz: string): boolean {
  if (tz === 'UTC') return true;
  return getTimezoneList().includes(tz);
}
```

The fix is already in place. No existing test file was found for this function.

**Decision**: Create a unit test file `backend/tests/unit/shellSettingsService.test.ts` testing:
1. `isValidTimezone('UTC')` → true
2. `isValidTimezone('America/New_York')` → true
3. `isValidTimezone('Invalid/Timezone')` → false
4. `isValidTimezone('')` → false

**Rationale**: Constitution V requires test coverage. Simple unit test, no mocking needed (the function uses Intl API internally).

**Alternatives considered**:
- Integration test via API endpoint — heavier setup; unit test is sufficient for a pure function

---

## R7: Screensaver Mutation Divergence

**Question**: How does the screensaver save path diverge and what's the fix?

**Finding**: In `AppearanceTab.tsx` (lines 987–997), the screensaver panel defines its own inline `useMutation`:
```ts
const saveSettings = useMutation({
  mutationFn: async (updates) => {
    await apiClient.put('/api/admin/shell', updates);
  },
  onSuccess: () => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'shellSettings'] });
    void queryClient.invalidateQueries({ queryKey: ['public-bootstrap'] });
    ...
  },
});
```

Meanwhile, the shared hook `useUpdateShellSettings()` from `frontend/src/state/settings.ts` invalidates:
```ts
queryKey: settingsKeys.adminShell  // which is ['admin-shell']
queryKey: ['public-bootstrap']
```

**Problem**: The screensaver mutation invalidates `['admin', 'shellSettings']` but the admin query uses key `['admin-shell']` (from `settingsKeys.adminShell`). This means after screensaver save, the admin settings cache is NOT properly invalidated — it invalidates a wrong key.

**Decision**: Replace the inline `useMutation` in the screensaver panel with `useUpdateShellSettings()`. This ensures correct cache invalidation and consistent behaviour.

**Rationale**: DRY principle; single source of truth for shell settings mutation logic.

**Alternatives considered**:
- Fix just the query key in the inline mutation — still divergent; same logic duplicated in two places
