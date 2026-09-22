# Phase 5 — US2: Account Label Management (T030–T037)

## Summary
Implemented full CRUD for Sonos account labels — users can name streaming accounts
(e.g. "Dad's Spotify") and those names appear on now-playing provider badges.

## Tasks Completed
| Task | Title | Status |
|------|-------|--------|
| T030 | TDD tests — GET response shape | ✅ |
| T031 | TDD tests — Zod validation | ✅ |
| T032 | TDD tests — admin enforcement | ✅ |
| T033 | GET /api/sonos/service-labels route | ✅ |
| T034 | PUT /api/sonos/service-labels route | ✅ |
| T035 | Frontend hooks (useServiceLabels, useUpdateServiceLabels) | ✅ |
| T036 | Account label management UI in IntegrationsTab | ✅ |
| T037 | Default placeholder format + empty state | ✅ |

## Key Decisions
- Labels stored in `integration_configs` table as JSON string (no migration needed)
- Key format: `sn:<number>` — maps Sonos account serial to friendly name
- 50-entry max enforced via Zod `.refine()` on route schema
- UI shows inline-editable fields with save/cancel, strips empty values on save
- Empty state prompts: "Play music from different accounts to discover them"

## Files Changed
- `backend/src/api/sonos.ts` — added GET/PUT service-labels endpoints + Zod refine
- `backend/tests/unit/sonosLabels.test.ts` — 11 TDD tests (NEW)
- `frontend/src/hooks/useSonos.ts` — added useServiceLabels + useUpdateServiceLabels
- `frontend/src/components/settings/IntegrationsTab.tsx` — account label management card

## Test Results
- 39 tests passing (22 detectService + 6 discovery + 11 labels)
- `pnpm typecheck` clean
- `npm run build` (frontend) clean
