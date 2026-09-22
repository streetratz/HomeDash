# Quickstart — Dashboard Duplication

**Feature**: 011-dashboard-duplication | **Date**: 2025-07-24

## Prerequisites

- Node.js 18+ and pnpm installed
- Repository cloned and on branch `011-dashboard-duplication`

## Setup

```bash
# Install dependencies
pnpm install

# Start backend (dev mode with live reload)
cd backend && pnpm dev

# In another terminal — start frontend (Vite dev server)
cd frontend && pnpm dev
```

## Files to Modify

### Backend (3 files modified, 1–3 test files added)

| File | Change |
|------|--------|
| `backend/src/services/dashboardService.ts` | Add `duplicateDashboard(sourceId)` method + `generateCopyName()` helper |
| `backend/src/api/adminDashboards.ts` | Add `POST /:dashboardId/duplicate` route |
| `backend/src/lib/validation.ts` | Add `DuplicateDashboardParamsSchema` (UUID path param validation — may be unnecessary if existing `UuidSchema` suffices) |
| `backend/tests/unit/dashboardDuplication.test.ts` | Unit tests for name generation logic |
| `backend/tests/integration/dashboardDuplication.test.ts` | Integration test: duplicate with real DB |
| `backend/tests/contract/dashboardDuplication.test.ts` | Contract test: endpoint request/response shapes |

### Frontend (2 files modified, 1 test file added)

| File | Change |
|------|--------|
| `frontend/src/state/adminDashboards.ts` | Add `useDuplicateDashboard()` mutation hook |
| `frontend/src/pages/DashboardManagementPage.tsx` | Add Duplicate button to dashboard card actions |
| `frontend/tests/e2e/dashboardDuplication.spec.ts` | E2E test: full duplicate flow |

## Key Implementation Notes

### Backend Service Method

The `duplicateDashboard()` method reuses the existing export/import pipeline:

1. Load full dashboard tree via `getDashboardWithChildren(sourceId)`
2. Generate copy name via `generateCopyName(sourceName, existingNames)`
3. Build import payload (preserving `backgroundAssetId` unlike export)
4. Delegate to `importDashboard()` with the generated name
5. Return newly created `DashboardListItem`

### Copy Name Algorithm

```
baseName = strip trailing " (Copy)" or " (Copy N)" from source name
candidate = baseName + " (Copy)"
if conflict → baseName + " (Copy 2)", " (Copy 3)", ...
truncate baseName if total > 128 chars
```

### Frontend Mutation Pattern

Follow the established pattern from `useCreateDashboard()`:

```typescript
export function useDuplicateDashboard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dashboardId: string) =>
      apiClient.post<DashboardListItem>(
        `/api/admin/dashboards/${dashboardId}/duplicate`
      ),
    onSuccess: (data) => {
      toast.success(`Dashboard "${data.name}" duplicated`);
      invalidateRelated(queryClient);
    },
    onError: (err: Error) => {
      toast.error(`Duplicate failed: ${err.message}`);
    },
  });
}
```

## Running Tests

```bash
# Backend unit tests
cd backend && pnpm test:unit

# Backend integration tests
cd backend && pnpm test:integration

# Backend contract tests
cd backend && pnpm test:contract

# All backend tests
cd backend && pnpm test

# Frontend E2E tests
cd frontend && pnpm test:e2e

# Type checking (both workspaces)
pnpm --filter backend typecheck
pnpm --filter frontend typecheck
```

## Verification Checklist

- [ ] Duplicate button visible on each dashboard card
- [ ] Clicking Duplicate creates a new dashboard with "(Copy)" suffix
- [ ] Duplicating again produces "(Copy 2)" (no name collision)
- [ ] All placeholders, widgets, links, and layout copied
- [ ] Background settings (including asset reference) preserved
- [ ] Original dashboard unchanged after duplication
- [ ] Button disabled while duplication is in progress
- [ ] Success toast shown after duplication
- [ ] Error toast shown if duplication fails
- [ ] New dashboard immediately editable
