# Tasks: Pi-hole DNS Controls Widget

**Input**: Design documents from `/specs/014-pihole-widget/`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

## Phase 1: Setup & Logging Infrastructure

**Purpose**: Branch creation, log scaffolding per constitution

- [ ] T001 Create feature branch `014-pihole-widget` from `main`
- [ ] T002 Create `specs/014-pihole-widget/logs/readme.md` with empty phases table
- [ ] T003 [P] Create `specs/014-pihole-widget/checklists/requirements.md` with FR/NFR/SC checklist

---

## Phase 2: Foundational — Database & Backend Service

**Purpose**: Core infrastructure that all user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Add `piholeInstances` table to `backend/src/db/schema/index.ts` per data-model.md
- [ ] T005 Generate Drizzle migration (`npx drizzle-kit generate` in `backend/`)
- [ ] T006 Run migration (`pnpm db:migrate` in `backend/`)
- [ ] T007 Add `PiholeConfigSchema` and `PiholeBlockingSchema` to `backend/src/lib/validation.ts`
- [ ] T008 Create `backend/src/services/pihole-service.ts`:
  - `savePiholeConfig(widgetInstanceId, baseUrl, apiToken, pollInterval)` — encrypt token, upsert row
  - `getPiholeConfig(widgetInstanceId)` — return config (no token in response)
  - `deletePiholeConfig(widgetInstanceId)` — cleanup
  - `testConnection(baseUrl, apiToken)` — verify reachable + valid token + v6 check
  - `fetchStats(widgetInstanceId)` — decrypt token, call Pi-hole `/api/stats/summary` + `/api/dns/blocking`
  - `fetchSystemHealth(widgetInstanceId)` — decrypt token, call Pi-hole `/api/info/system`
  - `setBlocking(widgetInstanceId, action, duration?)` — decrypt token, POST `/api/dns/blocking`
- [ ] T009 [P] Write unit tests for pihole-service in `backend/tests/unit/pihole-service.test.ts` (mock HTTP calls)
- [ ] T010 Create `backend/src/api/pihole.ts` with routes per contracts/pihole-proxy.md:
  - `GET /api/pihole/config/:widgetInstanceId` (requireAuth)
  - `PUT /api/pihole/config/:widgetInstanceId` (requireAdmin + assertCsrf)
  - `POST /api/pihole/config/:widgetInstanceId/test` (requireAdmin + assertCsrf)
  - `GET /api/pihole/stats/:widgetInstanceId` (requireAuth)
  - `GET /api/pihole/system/:widgetInstanceId` (requireAuth)
  - `POST /api/pihole/blocking/:widgetInstanceId` (requireAdmin + assertCsrf)
- [ ] T011 Register pihole routes in `backend/src/api/index.ts`
- [ ] T012 [P] Write integration tests for pihole API routes in `backend/tests/integration/pihole-api.test.ts`

**Checkpoint**: Backend fully functional — can config, fetch stats, control blocking via API

---

## Phase 3: User Story 1 — View Pi-hole Statistics (P1) 🎯 MVP

**Goal**: Widget displays live DNS stats (total queries, blocked, percentage, clients, blocklist domains)

**Independent Test**: Add widget, enter Pi-hole URL + token, see stats matching Pi-hole admin

### Implementation

- [ ] T013 Create `frontend/src/state/piholeHooks.ts`:
  - `usePiholeConfig(widgetInstanceId)` — fetch config
  - `usePiholeStats(widgetInstanceId, pollInterval)` — auto-refreshing stats query
  - `useSavePiholeConfig()` — mutation for saving config
  - `useTestPiholeConnection()` — mutation for testing connection
- [ ] T014 Create `frontend/src/components/widgets/PiholeConfigForm.tsx`:
  - URL input, API token input (password field), poll interval slider
  - "Test Connection" button with success/failure feedback
  - Save button
- [ ] T015 Create `frontend/src/components/widgets/PiholeWidget.tsx`:
  - Stats cards: Total Queries, Blocked Queries, % Blocked, Domains on Blocklist, Unique Clients
  - Blocking status indicator (enabled/disabled badge)
  - Error state: connection error, auth error, unreachable
  - Loading state: skeleton cards
- [ ] T016 Register `pihole` widget type in `frontend/src/components/widgets/registry.tsx`
- [ ] T017 Add `PiholeDisplayConfigSchema` to `backend/src/lib/validation.ts` `widgetConfigSchemas` map
- [ ] T018 Run typecheck + lint + tests to verify

**Checkpoint**: User can add Pi-hole widget, configure connection, see live DNS stats

---

## Phase 4: User Story 2 — Enable/Disable Blocking (P2)

**Goal**: Toggle blocking with timer options (5m, 15m, 30m, indefinitely)

**Independent Test**: Disable blocking for 5m via widget, verify Pi-hole admin shows disabled

### Implementation

- [ ] T019 Add `usePiholeBlocking()` mutation hook to `frontend/src/state/piholeHooks.ts`
- [ ] T020 Add blocking controls to `PiholeWidget.tsx`:
  - Toggle button (enable/disable)
  - Duration selector dropdown (5m, 15m, 30m, indefinitely) — shown when disabling
  - Countdown display when disabled with timer
  - Toast feedback on success/error
- [ ] T021 Run typecheck + lint + tests to verify

**Checkpoint**: User can enable/disable blocking with timer from the dashboard

---

## Phase 5: User Story 3 — System Health Metrics (P3)

**Goal**: Display CPU, memory, load from Pi-hole host

**Independent Test**: Widget shows system metrics matching Pi-hole admin system info

### Implementation

- [ ] T022 Add `usePiholeSystemHealth(widgetInstanceId, pollInterval)` hook to `frontend/src/state/piholeHooks.ts`
- [ ] T023 Add system health section to `PiholeWidget.tsx`:
  - CPU usage (%), Memory usage (%), Load averages (1/5/15m)
  - Graceful omission of unavailable metrics (e.g., temp on Docker)
  - Compact layout below DNS stats
- [ ] T024 Add `showSystemHealth` toggle to `PiholeConfigForm.tsx`
- [ ] T025 Run typecheck + lint + tests to verify

**Checkpoint**: Widget shows full Pi-hole overview (DNS stats + blocking control + system health)

---

## Phase 6: Polish & Cross-Cutting

**Purpose**: Error handling, resilience, edge cases

- [ ] T026 Add exponential backoff on repeated Pi-hole failures (backend service)
- [ ] T027 Add staleness indicator to widget when last-known data is stale (>2× poll interval)
- [ ] T028 Add v5 detection: if Pi-hole returns 404 on v6 endpoints, show unsupported-version message
- [ ] T029 Final typecheck + lint + full test suite run
- [ ] T030 Update `specs/014-pihole-widget/checklists/requirements.md` with pass/fail for each FR/NFR/SC

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS all user stories
- **Phase 3 (US1 Stats)**: Depends on Phase 2
- **Phase 4 (US2 Blocking)**: Depends on Phase 3 (widget must exist)
- **Phase 5 (US3 Health)**: Depends on Phase 3 (widget must exist)
- **Phase 6 (Polish)**: Depends on all user stories complete

### Parallel Opportunities

- T009 (unit tests) can run in parallel with T010 (API routes)
- T012 (integration tests) can run in parallel after T010+T011
- Phase 4 and Phase 5 could theoretically run in parallel (different sections of same widget)

### MVP Delivery

After Phase 3: Widget shows live DNS stats — this is a usable MVP.  
After Phase 4: Widget has full stats + blocking control — primary value complete.  
After Phase 5: Full feature set with system health monitoring.
