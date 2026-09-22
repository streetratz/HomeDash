# Data Model — Dashboard Duplication

**Feature**: 011-dashboard-duplication | **Date**: 2025-07-24

## Overview

Dashboard duplication does **not** introduce new entities or modify existing schemas. It creates new rows in the existing tables using the established entity hierarchy. This document describes the entities involved in the copy operation and the transformation rules applied during duplication.

## Entity Hierarchy

```
Dashboard (1)
 └── PlaceholderWidget (0..50)      — layout containers
      └── AppWidgetInstance (0..N)   — widget content
           └── LinksListItem (0..N)  — link entries (only for type='links_list')
```

All relationships use cascade delete (`onDelete: 'cascade'`).

## Entities Involved in Duplication

### Dashboard

| Field | Source → Copy Transformation |
|-------|------------------------------|
| `id` | New `crypto.randomUUID()` |
| `name` | Generated via copy-name algorithm (see research.md R-02) |
| `applicability` | Copied as-is |
| `backgroundType` | Copied as-is |
| `backgroundColor` | Copied as-is |
| `backgroundAssetId` | Copied as-is (shared reference to same asset) |
| `backgroundDisplayMode` | Copied as-is |
| `createdAt` | New timestamp (`new Date().toISOString()`) |
| `updatedAt` | New timestamp |

**Validation**: Name must be 1–128 characters. Copy-name algorithm truncates base name if suffix would exceed limit.

### PlaceholderWidget

| Field | Source → Copy Transformation |
|-------|------------------------------|
| `id` | New `crypto.randomUUID()` |
| `dashboardId` | Set to new dashboard's `id` |
| `stableKey` | New `crypto.randomUUID()` (required for layout diff/upsert) |
| `x`, `y`, `w`, `h` | Copied as-is (preserves layout grid positions) |
| `borderColor` | Copied as-is |
| `title` | Copied as-is |
| `opacity` | Copied as-is |
| `createdAt` | New timestamp |
| `updatedAt` | New timestamp |

### AppWidgetInstance

| Field | Source → Copy Transformation |
|-------|------------------------------|
| `id` | New `crypto.randomUUID()` |
| `placeholderId` | Set to new placeholder's `id` |
| `type` | Copied as-is |
| `orderIndex` | Copied as-is |
| `configJson` | Copied as-is (deep copy of JSON string) |
| `createdAt` | New timestamp |
| `updatedAt` | New timestamp |

### LinksListItem

| Field | Source → Copy Transformation |
|-------|------------------------------|
| `id` | New `crypto.randomUUID()` |
| `widgetInstanceId` | Set to new widget's `id` |
| `orderIndex` | Copied as-is |
| `title` | Copied as-is |
| `url` | Copied as-is |
| `iconKey` | Copied as-is |
| `iconOverrideKey` | Copied as-is |

### UploadedAsset (NOT duplicated)

Background assets are **referenced, not copied**. The `backgroundAssetId` FK on the new dashboard points to the same `uploadedAssets` row. Assets are immutable and content-addressed (`sha256`). The FK uses `onDelete: 'set null'`, so deleting an asset gracefully degrades both dashboards.

## State Transitions

```
[Admin clicks Duplicate]
        │
        ▼
   Dashboard: source
   Status: unchanged (FR-005)
        │
        ▼
   Dashboard: copy
   Status: created, immediately editable (FR-006)
        │
        ▼
   All child entities (placeholders, widgets, links):
   Status: created with new IDs, same content
```

There are no draft/pending states. The duplicate is fully realized in a single atomic transaction.

## Schema Changes

**None.** No new tables, columns, indexes, or migrations required. All operations use existing schema defined in `backend/src/db/schema/index.ts`.
