# Data Model: Shortcuts Widget Improvements & Single-Link Widget

**Feature**: 030-shortcuts-single-link
**Date**: 2025-07-17

## Table of Contents

- [Existing Entities (Modified)](#existing-entities-modified)
- [New Entities](#new-entities)
- [Entity Relationships](#entity-relationships)
- [Validation Rules](#validation-rules)

---

## Existing Entities (Modified)

### AppShortcutsConfig

**Location**: `frontend/src/state/dashboards.ts`
**Change**: No schema change. Existing interface is sufficient.

```typescript
// EXISTING — no changes needed
export interface AppShortcutsConfig {
  columns: number;        // 2–8, grid max columns
  iconSize: 'sm' | 'md' | 'lg';  // icon pixel size
  showLabels: boolean;    // show text labels below icons
}
```

**Note**: The `columns` field semantics shift slightly — it becomes the *maximum* columns rather than exact count, since icons now wrap based on available width. This is backwards-compatible: existing configs with e.g. `columns: 4` will show up to 4 icons per row.

### ShortcutView

**Location**: `frontend/src/state/dashboards.ts`
**Change**: No modification.

```typescript
// EXISTING — no changes needed
export interface ShortcutView {
  id: string;
  widgetInstanceId: string;
  groupId: string | null;
  name: string;
  url: string;
  iconKey: string | null;
  iconUrl: string | null;
  pingEnabled: boolean;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
}
```

### WidgetView

**Location**: `frontend/src/state/dashboards.ts`
**Change**: No modification. The `config: unknown` field stores type-specific config as JSON.

---

## New Entities

### SingleLinkConfig

**Location**: `frontend/src/state/dashboards.ts` (new interface)
**Purpose**: Configuration for a Single-Link widget instance, stored as JSON in the existing widget `config` column.

```typescript
export interface SingleLinkConfig {
  url: string;                       // Required — target URL
  label: string;                     // Required — primary display text
  iconKey: string | null;            // Required — icon identifier (Lucide key or CDN icon)
  subtitle: string | null;           // Optional — secondary text below label
  background: string | null;         // Optional — hex colour (#rrggbb) or gradient preset name
}
```

**Default config** (for registry):

```typescript
{
  url: '',
  label: '',
  iconKey: null,
  subtitle: null,
  background: null,
}
```

### GradientPreset (derived constant, not stored)

**Location**: `frontend/src/components/widgets/SingleLinkWidget.tsx` (or shared constants file)
**Purpose**: Maps gradient preset names to CSS gradient strings. Not persisted — used at render time.

```typescript
const GRADIENT_PRESETS: Record<string, string> = {
  'gradient-blue':   'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'gradient-green':  'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
  'gradient-orange': 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'gradient-dark':   'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
  'gradient-sunset': 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'gradient-ocean':  'linear-gradient(135deg, #2193b0 0%, #6dd5ed 100%)',
};
```

---

## Entity Relationships

```
PlaceholderView (existing)
  └── WidgetView[] (existing, via widgets array)
        ├── type: 'app_shortcuts'
        │     └── config → AppShortcutsConfig (existing)
        │           └── fetches ShortcutView[] via useShortcuts(widgetId) (existing)
        │
        └── type: 'single_link' (NEW)
              └── config → SingleLinkConfig (NEW)
                    └── self-contained, no external data fetching
```

**Key points**:
- Single-Link widget is fully self-contained — all data is in the config JSON, no backend API calls at render time.
- App Shortcuts widget continues to use the existing `useShortcuts` hook for shortcut data.
- Both widget types are hosted inside `PlaceholderView` → `WidgetRenderer` → type-specific component.

---

## Validation Rules

### SingleLinkConfig

| Field | Rule | Error |
|-------|------|-------|
| `url` | Required, non-empty, valid URL (parseable by `new URL()`) | "Please enter a valid URL" |
| `label` | Required, non-empty, max 100 chars | "Label is required" |
| `iconKey` | Required, non-null | "Please select an icon" |
| `subtitle` | Optional, max 200 chars when provided | (silently truncated) |
| `background` | Optional. If present: valid hex (`#rrggbb`) OR key in `GRADIENT_PRESETS` | "Invalid colour value" |

### AppShortcutsConfig (unchanged)

| Field | Rule | Error |
|-------|------|-------|
| `columns` | Integer, 2–8 | Clamped to range |
| `iconSize` | One of `'sm'`, `'md'`, `'lg'` | Falls back to `'md'` |
| `showLabels` | Boolean | Falls back to `true` |

### Display Validation (runtime, not config)

| Scenario | Behaviour |
|----------|-----------|
| Single-Link with empty URL | Tile renders but is not clickable; shows "Configure URL" hint |
| Single-Link with no icon | Shows fallback globe icon |
| Shortcut with broken icon image | Shows fallback globe icon (existing behaviour) |
| Shortcuts widget with 0 shortcuts | Shows empty state (existing behaviour) |
