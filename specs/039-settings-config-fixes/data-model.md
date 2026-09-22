# Data Model: Settings & Config Fixes

**Feature**: 039-settings-config-fixes  
**Date**: 2026-06-22

## Overview

No new entities or migrations are required. This feature fixes the wiring between existing data and its consumers. All columns already exist in the database schema.

## Existing Entities (relevant subset)

### AppShellSettings (singleton row, id='global')

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `titleText` | TEXT NOT NULL | 'HomeDash' | Displayed in header |
| `titleFont` | TEXT NOT NULL | 'system' | **Currently stored but not exposed publicly** |
| `titleFontSizePx` | INTEGER NOT NULL | 20 | **Currently stored but not exposed publicly** |
| `headerHeightPx` | INTEGER NOT NULL | 56 | Header height |
| `logoAssetId` | TEXT | null | FK → uploaded_assets.id |
| `clockStripEnabled` | INTEGER (bool) | 0 | Show clock strip |
| `clockStripAlignment` | TEXT | 'center' | left/center/right |
| `homeTimezone` | TEXT | null | IANA timezone for home clock |
| `homeClockConfig` | TEXT (JSON) | null | ClockDisplayConfig JSON |
| `timezonesJson` | TEXT (JSON) | '[]' | Extra clock entries |
| `footerText` | TEXT | null | Footer text |
| `repoUrl` | TEXT | null | Repository URL for footer link |
| `headerStyle` | TEXT | 'none' | Header animation style |
| `headerStyleTarget` | TEXT | 'background' | **To remove from public API** |
| `headerGlassEffect` | INTEGER (bool) | 0 | Glass effect toggle |
| `headerTitleStyle` | TEXT | 'none' | Title animation style |
| `screensaverEnabled` | INTEGER (bool) | 0 | Screensaver toggle |
| `screensaverClockFormat` | TEXT | '12h' | 12h or 24h |
| `updatedAt` | TEXT | ISO timestamp | Last modification |

### ClockDisplayConfig (JSON structure, stored in homeClockConfig)

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `label` | string | 'Home' | Custom clock label |
| `layout` | 'column' \| 'row' | 'column' | Clock item layout direction |
| `showOffset` | boolean | false | Show UTC±XX offset |
| `homeIconSide` | 'left' \| 'right' | 'left' | Home icon position (row layout) |
| `dayNightSide` | 'left' \| 'right' | 'right' | Day/night icon position (row layout) |

## Data Flow Changes

### Current Flow (broken)

```
Admin saves titleFont/titleFontSizePx
  → PUT /api/admin/shell → DB ✅
  → GET /api/public/bootstrap → shellPayload (MISSING titleFont, titleFontSizePx) ❌
  → ShellLayout renders title with static class ❌
```

### Fixed Flow

```
Admin saves titleFont/titleFontSizePx
  → PUT /api/admin/shell → DB ✅
  → GET /api/public/bootstrap → shellPayload (includes titleFont, titleFontSizePx) ✅
  → ShellLayout renders title with dynamic inline styles ✅
```

### Clock Config Flow (current — broken)

```
homeClockConfig in DB → exposed ONLY as .config on home clock entry in bootstrap
  → ClockStrip derives globalCfg from clocks.find(c => c.isHome)?.config
  → If no home clock: globalCfg = {} ❌ (all display settings lost)
```

### Clock Config Flow (fixed)

```
homeClockConfig in DB → exposed as top-level clockDisplayConfig in bootstrap
  → ClockStrip receives clockDisplayConfig as prop
  → Works regardless of home clock existence ✅
```

## Font Family Mapping

| Config Value | CSS `font-family` Stack |
|-------------|------------------------|
| `system` | (no inline style — uses Tailwind default) |
| `Inter` | `'Inter', sans-serif` |
| `Roboto` | `'Roboto', sans-serif` |
| `Segoe UI` | `'Segoe UI', sans-serif` |
| `monospace` | `'SFMono-Regular', 'Menlo', 'Consolas', monospace` |
| `serif` | `'Georgia', 'Times New Roman', serif` |

## Validation Rules

| Field | Rule | Location |
|-------|------|----------|
| `titleFont` | Must be one of: system, Inter, Roboto, Segoe UI, monospace, serif | Admin API (existing) |
| `titleFontSizePx` | Integer, 12–72 range | Admin API (existing) |
| `repoUrl` | Must start with `http://` or `https://` (or be null) | Frontend rendering guard |
| Timezone | Must be valid IANA identifier or 'UTC' | `isValidTimezone()` |

## State Transitions

N/A — no state machines in this feature. All changes are immediate reads from singleton config.
