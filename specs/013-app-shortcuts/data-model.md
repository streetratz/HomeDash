# Data Model — App Shortcuts Widget

**Feature**: 013-app-shortcuts | **Date**: 2025-07-14

## Table of Contents

- [Entity Relationship Diagram](#entity-relationship-diagram)
- [Tables](#tables)
  - [shortcut_groups](#shortcut_groups)
  - [app_shortcuts](#app_shortcuts)
  - [shortcut_ping_results](#shortcut_ping_results)
- [Existing Tables Referenced](#existing-tables-referenced)
- [Validation Rules](#validation-rules)
- [State Transitions](#state-transitions)
- [Migration Notes](#migration-notes)

---

## Entity Relationship Diagram

```
┌──────────────────────┐       ┌──────────────────────────┐
│  app_widget_instances │       │     uploaded_assets      │
│  (EXISTING)          │       │     (EXISTING)           │
│  ─────────────────── │       │  ──────────────────────  │
│  id (PK)             │       │  id (PK)                 │
│  type: 'app_shortcuts│       │  kind, storagePath, ...  │
│  configJson          │       └──────────┬───────────────┘
│  placeholderId (FK)  │                  │
└─────────┬────────────┘                  │
          │ 1                             │
          │                               │
          ├──────────────────┐            │
          │ N                │ N          │
┌─────────┴────────┐  ┌─────┴────────────┴───────────────┐
│  shortcut_groups  │  │        app_shortcuts              │
│  ───────────────  │  │  ─────────────────────────────── │
│  id (PK)         │  │  id (PK)                          │
│  widgetInstanceId │  │  widgetInstanceId (FK → widget)   │
│   (FK → widget)  │  │  groupId (FK → groups, nullable)  │
│  name            │  │  name, url                        │
│  orderIndex      │  │  iconAssetId (FK → assets)        │
│  createdAt       │  │  iconOverrideAssetId (FK → assets)│
│  updatedAt       │  │  pingEnabled                      │
└──────────────────┘  │  orderIndex                       │
          ▲           │  createdAt, updatedAt              │
          │ 0..1      └──────────┬────────────────────────┘
          │                      │ 1
          └── groupId (nullable) │
                                 │
                        ┌────────┴──────────────┐
                        │ shortcut_ping_results  │
                        │ ───────────────────── │
                        │ shortcutId (PK, FK)    │
                        │ status: up|down|unknown│
                        │ responseTimeMs         │
                        │ checkedAt              │
                        │ error                  │
                        └────────────────────────┘
```

---

## Tables

### shortcut_groups

Groups for organising shortcuts within a widget instance.

| Column            | Type    | Constraints                          | Description                          |
|-------------------|---------|--------------------------------------|--------------------------------------|
| `id`              | TEXT    | PK, UUID                            | Unique group identifier              |
| `widgetInstanceId`| TEXT    | FK → app_widget_instances.id, CASCADE DELETE, NOT NULL | Parent widget |
| `name`            | TEXT    | NOT NULL                             | Display name (e.g., "Media")         |
| `orderIndex`      | INTEGER | NOT NULL, DEFAULT 0                  | Display order within widget          |
| `createdAt`       | TEXT    | NOT NULL, ISO 8601                   | Creation timestamp                   |
| `updatedAt`       | TEXT    | NOT NULL, ISO 8601                   | Last update timestamp                |

**Drizzle definition**:
```typescript
export const shortcutGroups = sqliteTable('shortcut_groups', {
  id:               text('id').primaryKey(),
  widgetInstanceId: text('widget_instance_id')
                      .notNull()
                      .references(() => appWidgetInstances.id, { onDelete: 'cascade' }),
  name:             text('name').notNull(),
  orderIndex:       integer('order_index').notNull().default(0),
  createdAt:        text('created_at').notNull(),
  updatedAt:        text('updated_at').notNull(),
});
```

### app_shortcuts

Individual application shortcuts within a widget instance.

| Column                | Type    | Constraints                          | Description                          |
|-----------------------|---------|--------------------------------------|--------------------------------------|
| `id`                  | TEXT    | PK, UUID                            | Unique shortcut identifier           |
| `widgetInstanceId`    | TEXT    | FK → app_widget_instances.id, CASCADE DELETE, NOT NULL | Parent widget |
| `groupId`             | TEXT    | FK → shortcut_groups.id, SET NULL, nullable | Assigned group (null = ungrouped) |
| `name`                | TEXT    | NOT NULL                             | Display name (e.g., "Plex")          |
| `url`                 | TEXT    | NOT NULL                             | Target URL (opened on click)         |
| `iconAssetId`         | TEXT    | FK → uploaded_assets.id, SET NULL, nullable | Auto-fetched favicon asset     |
| `iconOverrideAssetId` | TEXT    | FK → uploaded_assets.id, SET NULL, nullable | User-uploaded custom icon      |
| `pingEnabled`         | INTEGER | NOT NULL, DEFAULT 0                  | 0 = disabled, 1 = enabled           |
| `orderIndex`          | INTEGER | NOT NULL, DEFAULT 0                  | Display order within group           |
| `createdAt`           | TEXT    | NOT NULL, ISO 8601                   | Creation timestamp                   |
| `updatedAt`           | TEXT    | NOT NULL, ISO 8601                   | Last update timestamp                |

**Drizzle definition**:
```typescript
export const appShortcuts = sqliteTable('app_shortcuts', {
  id:                   text('id').primaryKey(),
  widgetInstanceId:     text('widget_instance_id')
                          .notNull()
                          .references(() => appWidgetInstances.id, { onDelete: 'cascade' }),
  groupId:              text('group_id')
                          .references(() => shortcutGroups.id, { onDelete: 'set null' }),
  name:                 text('name').notNull(),
  url:                  text('url').notNull(),
  iconAssetId:          text('icon_asset_id')
                          .references(() => uploadedAssets.id, { onDelete: 'set null' }),
  iconOverrideAssetId:  text('icon_override_asset_id')
                          .references(() => uploadedAssets.id, { onDelete: 'set null' }),
  pingEnabled:          integer('ping_enabled').notNull().default(0),
  orderIndex:           integer('order_index').notNull().default(0),
  createdAt:            text('created_at').notNull(),
  updatedAt:            text('updated_at').notNull(),
});
```

### shortcut_ping_results

Cached health check results for shortcuts with ping enabled. One row per shortcut (upsert on each check cycle).

| Column          | Type    | Constraints                          | Description                          |
|-----------------|---------|--------------------------------------|--------------------------------------|
| `shortcutId`    | TEXT    | PK, FK → app_shortcuts.id, CASCADE DELETE | Parent shortcut              |
| `status`        | TEXT    | NOT NULL, CHECK('up','down','unknown') | Last known status                  |
| `responseTimeMs`| INTEGER | nullable                             | Response time in milliseconds        |
| `checkedAt`     | TEXT    | NOT NULL, ISO 8601                   | Timestamp of last check              |
| `error`         | TEXT    | nullable                             | Error message if status != 'up'      |

**Drizzle definition**:
```typescript
export const shortcutPingResults = sqliteTable('shortcut_ping_results', {
  shortcutId:     text('shortcut_id')
                    .primaryKey()
                    .references(() => appShortcuts.id, { onDelete: 'cascade' }),
  status:         text('status', { enum: ['up', 'down', 'unknown'] }).notNull(),
  responseTimeMs: integer('response_time_ms'),
  checkedAt:      text('checked_at').notNull(),
  error:          text('error'),
});
```

---

## Existing Tables Referenced

| Table                   | Relationship                           | Notes                                   |
|-------------------------|----------------------------------------|-----------------------------------------|
| `app_widget_instances`  | Parent of shortcuts and groups         | `type = 'app_shortcuts'`; `configJson` stores `{ columns: 4 }` |
| `uploaded_assets`       | Referenced by icon FK columns          | Reuse existing upload flow; kind = `'shortcut_icon'` |
| `placeholder_widgets`   | Grandparent (layout grid position)     | Unchanged — widget sits inside placeholder as usual |

---

## Validation Rules

### Shortcut

| Field    | Rule                                                                 |
|----------|----------------------------------------------------------------------|
| `name`   | Required, non-empty, max 100 characters                             |
| `url`    | Required, valid URL format (http/https), max 2048 characters        |
| `icon`   | Upload: PNG, JPEG, SVG, ICO, WebP only; max 512 KB; magic-byte validated |
| `orderIndex` | Non-negative integer                                            |

### Group

| Field    | Rule                                                                 |
|----------|----------------------------------------------------------------------|
| `name`   | Required, non-empty, max 50 characters                              |
| `orderIndex` | Non-negative integer                                            |

### Widget Config (`configJson`)

| Field     | Rule                                                                |
|-----------|---------------------------------------------------------------------|
| `columns` | Integer, min 2, max 8, default 4 (FR-009)                         |

---

## State Transitions

### Shortcut Icon State

```
[No Icon] ──(shortcut created)──> [Fetching Favicon]
                                        │
                        ┌────────────────┼────────────────┐
                        ▼                ▼                ▼
                  [Favicon Found]  [Fetch Failed]    [Timeout]
                        │                │                │
                        ▼                ▼                ▼
                  [iconAssetId set] [Placeholder]    [Placeholder]
                        │                │                │
                        └───────┬────────┘                │
                                │                         │
                    (user uploads custom icon)             │
                                │                         │
                                ▼                         │
                  [iconOverrideAssetId set] ◄─────────────┘
                                │
                    (user removes custom icon)
                                │
                                ▼
                  [iconOverrideAssetId = NULL]
                  (falls back to iconAssetId or placeholder)
```

### Ping Status State

```
[Disabled] ──(user enables ping)──> [Unknown]
                                        │
                                   (check cycle)
                                        │
                              ┌─────────┼──────────┐
                              ▼                    ▼
                           [Up]                 [Down]
                              │                    │
                         (next cycle)         (next cycle)
                              │                    │
                              ├──> [Up]            ├──> [Up]
                              └──> [Down]          └──> [Down]

[Any] ──(user disables ping)──> [Disabled] (row deleted from ping_results)
```

---

## Migration Notes

- **New tables**: `shortcut_groups`, `app_shortcuts`, `shortcut_ping_results` — all additive; no existing table modifications.
- **Drizzle migration**: Generate via `pnpm drizzle-kit generate` after adding table definitions to schema.
- **Rollback**: Drop the three new tables. No existing data is affected.
- **Data seeding**: None required — tables start empty. Widget type registered in frontend code only.
