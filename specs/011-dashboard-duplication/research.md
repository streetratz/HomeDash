# Research — Dashboard Duplication

**Feature**: 011-dashboard-duplication | **Date**: 2025-07-24

## Table of Contents

- [R-01: Reuse Export/Import vs. New Duplication Pipeline](#r-01-reuse-exportimport-vs-new-duplication-pipeline)
- [R-02: Copy Name Generation Strategy](#r-02-copy-name-generation-strategy)
- [R-03: Background Asset Handling](#r-03-background-asset-handling)
- [R-04: Atomicity & Transaction Scope](#r-04-atomicity--transaction-scope)
- [R-05: Concurrency & Debounce Strategy](#r-05-concurrency--debounce-strategy)

---

## R-01: Reuse Export/Import vs. New Duplication Pipeline

**Decision**: Reuse the existing `exportDashboard()` → `importDashboard()` pipeline from `dashboardService.ts` as the internal implementation of `duplicateDashboard()`.

**Rationale**: The export/import pipeline (lines 392–593 of `dashboardService.ts`) already:
1. Reads the full dashboard tree (placeholders → widgets → links)
2. Regenerates all UUIDs (dashboard, placeholders, widgets, links)
3. Regenerates `stableKey` for placeholders
4. Wraps the entire import in a SQLite transaction
5. Auto-creates `links_list` widgets when links exist without a parent widget
6. Accepts an `overrideName` parameter

The only gap is that `exportDashboard()` deliberately downgrades `backgroundType` from `image` to `solid` (line ~450) to avoid exporting binary assets. For duplication within the same instance, we can reference the same `backgroundAssetId` directly.

**Alternatives considered**:
- **Direct SQL clone**: Writing raw INSERT…SELECT statements. Rejected because it duplicates logic already in `importDashboard()` and is harder to maintain.
- **New from-scratch service method**: Rejected because 95% of logic overlaps with existing import pipeline.

**Implementation approach**: Create `duplicateDashboard(sourceId: string)` that:
1. Calls `getDashboardWithChildren(sourceId)` to load the full tree
2. Builds a `DashboardExport`-like payload but preserves `backgroundAssetId`
3. Delegates to `importDashboard()` (or an internal variant) with the generated copy name
4. Returns the newly created dashboard

---

## R-02: Copy Name Generation Strategy

**Decision**: Use the pattern `"[Original Name] (Copy)"` with automatic numeric suffix for conflicts: `"(Copy 2)"`, `"(Copy 3)"`, etc. Strip existing `(Copy N)` suffixes from the base name before appending.

**Rationale**: 
- FR-004 requires `"[Original Name] (Copy)"` with conflict resolution.
- The import dialog already uses `name + ' (Copy)'` as a suggestion (line 126 of `DashboardImportDialog.tsx`).
- Dashboard names are limited to 128 characters (`z.string().min(1).max(128)` in validation schema).

**Algorithm**:
```
1. Extract baseName by stripping trailing " (Copy)" or " (Copy N)" from source name
2. candidateName = baseName + " (Copy)"
3. Query existing dashboard names
4. If candidateName exists, try baseName + " (Copy 2)", " (Copy 3)", ... up to a reasonable limit
5. Truncate baseName if baseName + " (Copy NNN)" would exceed 128 chars
```

**Alternatives considered**:
- **Timestamp suffix** (e.g., "Dashboard 2025-07-24"): Rejected — less readable, doesn't match spec requirement.
- **Prompt user for name**: Rejected — spec requires immediate duplication without extra steps (FR-006). Name can be changed after via existing edit flow.

---

## R-03: Background Asset Handling

**Decision**: Copy the `backgroundAssetId` reference (not the file). The duplicate dashboard points to the same uploaded asset row.

**Rationale**: 
- `uploadedAssets` are content-addressed (have `sha256` column) and immutable once created.
- The FK is `onDelete: 'set null'` — if the asset is deleted, both dashboards gracefully fall back to no background.
- The existing `exportDashboard()` drops background assets because they can't be serialized to JSON for file transfer. Within the same instance, no serialization is needed.
- Duplicating the binary file would waste disk space with no benefit.

**Alternatives considered**:
- **Deep-copy the asset file**: Rejected — wastes storage, asset is immutable and content-addressed.
- **Drop to solid color** (like export does): Rejected — spec requires copying background settings (FR-003).

---

## R-04: Atomicity & Transaction Scope

**Decision**: Wrap the entire duplication in a single SQLite transaction using `getSqliteDb().transaction()`.

**Rationale**:
- FR-007 requires atomicity: no partial dashboards on failure.
- `importDashboard()` already wraps its work in a transaction (line 503 of `dashboardService.ts`).
- SQLite transactions are synchronous with better-sqlite3, so the entire operation completes or rolls back before the function returns.
- WAL mode + `busy_timeout = 5000` handles any concurrent read contention.

**Alternatives considered**:
- **No transaction (rely on cascade delete for cleanup)**: Rejected — would require error handling to delete partial data, which itself could fail.

---

## R-05: Concurrency & Debounce Strategy

**Decision**: Frontend debounce via `disabled={mutation.isPending}` on the Duplicate button. No backend-level idempotency key needed.

**Rationale**:
- Edge case in spec: "rapidly clicks Duplicate multiple times."
- TanStack Query's `useMutation` provides `isPending` state that disables the button while a request is in flight.
- The backend operation is fast (single transaction, < 100ms for typical dashboards) so the window for double-clicks is very small.
- A backend idempotency key would add complexity without proportional benefit for a single-admin LAN app.

**Alternatives considered**:
- **Backend idempotency token**: Rejected — overengineered for single-admin, LAN-only context.
- **Frontend setTimeout debounce**: Rejected — `isPending` from TanStack Query is more reliable and already the established pattern.
