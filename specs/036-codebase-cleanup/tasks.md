# Tasks: Codebase Health Cleanup

**Input**: Design documents from `/specs/036-codebase-cleanup/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Unit tests are included for User Story 1 (SSRF fix) as specified in the plan — the `url-validator.test.ts` file is an explicit deliverable. No other test tasks are generated unless existing tests need verification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `backend/src/`, `frontend/src/`
- Monorepo workspaces: `backend/` and `frontend/`

---

## Phase 1: Setup

**Purpose**: No project initialization needed — this is a cleanup of an existing codebase. This phase ensures the working branch is ready.

- [ ] T001 Verify branch `036-codebase-cleanup` is checked out and clean with `git status`
- [ ] T002 Run `pnpm install` to ensure lockfile is current and dependencies are resolved

---

## Phase 2: Foundational

**Purpose**: No foundational/blocking infrastructure required for this cleanup feature. All user stories operate on independent files and can begin immediately after setup.

**Checkpoint**: Setup complete — user story implementation can now begin in parallel.

---

## Phase 3: User Story 1 — Patch SSRF Vulnerability in Sonos Art Proxy (Priority: P1) 🎯 MVP

**Goal**: Harden the Sonos album-art proxy endpoint against SSRF attacks by adding URL validation, IP blocking, hash verification, response size limits, and content-type checks.

**Independent Test**: Send crafted requests to the art-proxy endpoint with internal IPs, non-HTTP schemes, oversized responses, and non-image content-types — all must be rejected. Run `pnpm --filter backend test -- --grep "url-validator"`.

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T003 [P] [US1] Create unit test file for URL validator in backend/tests/unit/url-validator.test.ts covering: scheme rejection (file://, ftp://), loopback IP blocking (127.0.0.1), link-local/metadata blocking (169.254.169.254), IPv6 equivalents (::1, fe80::), valid HTTP/HTTPS URLs passing, and RFC 1918 ranges being allowed per R-02 decision

### Implementation for User Story 1

- [ ] T004 [P] [US1] Create URL validation utility in backend/src/lib/url-validator.ts with: `validateArtUrl(url: string, hash: string)` returning `URLValidationResult`, scheme whitelist check (http/https only), DNS resolution via `dns.promises.lookup()`, IP blocklist (127.0.0.0/8, 169.254.0.0/16, ::1, fe80::/10), and hash verification against `artHash(sourceUrl)`
- [ ] T005 [US1] Add response size limit (5 MB) and content-type validation (image/* only) to backend/src/services/artCacheService.ts in the `getArt()` method — abort stream if exceeded, return appropriate error
- [ ] T006 [US1] Integrate URL validation into the art proxy route in backend/src/api/sonos.ts — call `validateArtUrl()` before delegating to `artCacheService.getArt()`, return 400/403/413/415 status codes per the state machine in data-model.md
- [ ] T007 [US1] Add structured rejection logging (source URL, rejection reason, resolved IP) to backend/src/api/sonos.ts for blocked requests

**Checkpoint**: SSRF vulnerability patched. Verify with `pnpm --filter backend typecheck && pnpm --filter backend test`.

---

## Phase 4: User Story 2 — Fix Backend Type Errors (Priority: P2)

**Goal**: Fix the undici/Response type mismatch in `unifi-service.ts` so `tsc --noEmit` passes with zero errors.

**Independent Test**: Run `pnpm --filter backend typecheck` — should exit 0 with no errors related to response types.

### Implementation for User Story 2

- [ ] T008 [US2] Fix type mismatch in backend/src/services/unifi-service.ts — add `import type { Response as UndiciResponse } from 'undici'` and update all wrapper function return types from `Promise<Response>` to `Promise<UndiciResponse>`

**Checkpoint**: Backend typecheck passes cleanly. Verify with `pnpm --filter backend typecheck`.

---

## Phase 5: User Story 3 — Remove Unused Dependencies (Priority: P3)

**Goal**: Remove unused packages from both workspaces and replace FontAwesome icons with lucide-react equivalents in ClockStrip.

**Independent Test**: After removal, `pnpm install` succeeds, both workspaces build, and ClockStrip renders replacement icons correctly.

### Implementation for User Story 3

- [ ] T009 [P] [US3] Replace FontAwesome icon imports in frontend/src/components/ClockStrip.tsx with lucide-react equivalents: `faHouse` → `<Home>`, `faSun` → `<Sun>`, `faMoon` → `<Moon>` — remove all `@fortawesome/*` imports, add `import { Home, Sun, Moon } from 'lucide-react'`, match sizing props
- [ ] T010 [P] [US3] Remove unused dependencies from frontend/package.json: `@fortawesome/fontawesome-svg-core`, `@fortawesome/free-solid-svg-icons`, `@fortawesome/react-fontawesome`, `next-themes`, `@vitest/coverage-v8`, `@radix-ui/react-tooltip`
- [ ] T011 [P] [US3] Remove unused dependencies from backend/package.json: `@fastify/csrf-protection`, `@types/sharp`
- [ ] T012 [US3] Run `pnpm install` from repo root to regenerate lockfile after dependency removals
- [ ] T013 [US3] Verify both workspaces build successfully with `pnpm --filter frontend build && pnpm --filter backend build`

**Checkpoint**: Dependency surface reduced. Verify with `pnpm install && pnpm --filter frontend build && pnpm --filter backend build`.

---

## Phase 6: User Story 4 — Remove Dead Code (Priority: P4)

**Goal**: Delete unreachable/unused source files to reduce codebase noise and bundle analysis clutter.

**Independent Test**: After deletion, the application builds and all existing tests pass. Verify no remaining imports reference deleted modules.

### Implementation for User Story 4

- [ ] T014 [P] [US4] Delete dead calendar components: frontend/src/components/calendar/MiniCalendarView.tsx, frontend/src/components/calendar/DayDetailPanel.tsx, frontend/src/components/calendar/EventCard.tsx
- [ ] T015 [P] [US4] Delete dead UI components: frontend/src/components/ui/progress-bar.tsx, frontend/src/components/ui/status-dot.tsx, frontend/src/components/ui/tooltip.tsx
- [ ] T016 [US4] Run grep/search across frontend/src/ to confirm no remaining imports reference any deleted files — fix any discovered references
- [ ] T017 [US4] Verify frontend builds cleanly after dead code removal with `pnpm --filter frontend build`

**Checkpoint**: Dead code removed. Verify with `pnpm --filter frontend build && pnpm --filter frontend test`.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final verification across all phases

- [ ] T018 Run full verification sequence from quickstart.md: `pnpm install && pnpm --filter backend typecheck && pnpm --filter frontend typecheck && pnpm --filter backend test && pnpm --filter frontend test && pnpm --filter frontend build && pnpm --filter backend build`
- [ ] T019 [P] Verify lockfile package count decreased (compare `pnpm list --depth 0` before/after or check `pnpm-lock.yaml` diff)
- [ ] T020 [P] Verify source file count decreased by confirming 6 files deleted via `git status`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: N/A for this feature
- **User Stories (Phase 3–6)**: All can begin after Setup
  - US1 (SSRF): Independent — no cross-story dependencies
  - US2 (Types): Independent — no cross-story dependencies
  - US3 (Deps): Independent — but must complete T009 (icon replacement) before T010 (FA removal)
  - US4 (Dead code): Independent — but should run after US3 to avoid deleting tooltip.tsx before its dependency is removed
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Fully independent. T003 (tests) and T004 (validator) can be parallel. T005 depends on T004. T006 depends on T004+T005. T007 depends on T006.
- **US2 (P2)**: Fully independent. Single task.
- **US3 (P3)**: T009, T010, T011 are parallel. T012 depends on T010+T011. T013 depends on T012.
- **US4 (P4)**: T014, T015 are parallel. T016 depends on T014+T015. T017 depends on T016. Should run after US3 (tooltip.tsx dependency removed in US3).

### Parallel Opportunities

- US1, US2, US3 can all execute in parallel (different files, no shared dependencies)
- Within US1: T003 and T004 can be parallel (test file vs implementation file)
- Within US3: T009, T010, T011 can be parallel (different files)
- Within US4: T014 and T015 can be parallel (different directories)
- US4 should follow US3 (tooltip.tsx dependency must be removed first)

---

## Parallel Example: User Story 1

```bash
# Launch tests and implementation in parallel (different files):
Task: "Create unit test file in backend/tests/unit/url-validator.test.ts"
Task: "Create URL validation utility in backend/src/lib/url-validator.ts"

# Then sequentially:
Task: "Add size limit and content-type validation to artCacheService.ts"
Task: "Integrate URL validation into sonos.ts route"
Task: "Add structured rejection logging"
```

## Parallel Example: User Story 3

```bash
# Launch all removal tasks in parallel (different files):
Task: "Replace FA icons in ClockStrip.tsx"
Task: "Remove unused deps from frontend/package.json"
Task: "Remove unused deps from backend/package.json"

# Then sequentially:
Task: "Run pnpm install to regenerate lockfile"
Task: "Verify builds"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 3: User Story 1 (SSRF Fix)
3. **STOP and VALIDATE**: Run `pnpm --filter backend typecheck && pnpm --filter backend test`
4. Security vulnerability patched — safe to deploy

### Incremental Delivery

1. Complete Setup → Branch ready
2. Add US1 (SSRF fix) → Security hardened → **Deploy priority**
3. Add US2 (Type fix) → CI green → Deploy
4. Add US3 (Dep removal) → Smaller install → Deploy
5. Add US4 (Dead code) → Cleaner codebase → Deploy
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. All can start immediately after setup
   - Developer A: User Story 1 (SSRF — highest priority)
   - Developer B: User Story 2 (Type fix — quick win)
   - Developer C: User Story 3 (Deps — then US4 after)
2. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Per research.md R-02: RFC 1918 IPs are ALLOWED (Sonos devices live on LAN)
- Per research.md R-05: WidgetHeaderContext.tsx is RETAINED (actively used)
- Per research.md R-06: tooltip.tsx IS deleted (zero consumers confirmed)
- Commit after each phase or logical group
- Stop at any checkpoint to validate independently
