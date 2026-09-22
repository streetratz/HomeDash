# Tasks: CI & Tooling Upgrades

**Input**: Design documents from `/specs/031-ci-tooling-upgrades/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, quickstart.md ✅

**Tests**: Not explicitly requested — test tasks omitted. Verification is via CI pipeline execution and `tsc --noEmit`.

**Organization**: Tasks are grouped by user story (three commits), each independently deliverable and verifiable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: User Story 1 — GitHub Actions Node.js 24 Migration (Priority: P1) 🎯 MVP

**Goal**: Upgrade all GitHub Actions to Node.js 24-compatible versions so CI pipelines function without deprecation warnings.

**Independent Test**: Trigger both workflows on the feature branch; both complete with zero Node.js deprecation warnings.

### Implementation

- [X] T001 [P] [US1] Update actions/checkout from v4 to v6 in .github/workflows/docker-publish.yml
- [X] T002 [P] [US1] Update docker/setup-buildx-action from v3 to v4 in .github/workflows/docker-publish.yml
- [X] T003 [P] [US1] Update docker/login-action from v3 to v4 in .github/workflows/docker-publish.yml
- [X] T004 [P] [US1] Update docker/metadata-action from v5 to v6 in .github/workflows/docker-publish.yml
- [X] T005 [P] [US1] Update docker/build-push-action from v6 to v7 in .github/workflows/docker-publish.yml
- [X] T006 [P] [US1] Update actions/checkout from v4 to v6 in .github/workflows/promote-release.yml
- [X] T007 [P] [US1] Update actions/setup-node from v4 to v6 in .github/workflows/promote-release.yml
- [X] T008 [US1] Validate workflow YAML syntax with `gh workflow list` or actionlint

**Checkpoint**: Commit 1 complete — both workflows use Node.js 24-compatible action versions.

---

## Phase 2: User Story 2 — pnpm 8 → 11 Upgrade (Priority: P2)

**Goal**: Migrate the project package manager from pnpm 8.15.9 to pnpm 11.x for performance, security, and supportability.

**Independent Test**: Run `pnpm install && pnpm build` across the workspace and `docker build -f deploy/Dockerfile .` — all succeed.

### Implementation

- [X] T009 [US2] Update packageManager field to pnpm 11.x in package.json
- [X] T010 [P] [US2] Update corepack prepare command at build stage (line 8) in deploy/Dockerfile
- [X] T011 [P] [US2] Update corepack prepare command at production stage (line 37) in deploy/Dockerfile
- [X] T012 [US2] Review .npmrc for pnpm 9/10/11 breaking changes and adjust if needed
- [X] T013 [US2] Regenerate pnpm-lock.yaml by running `pnpm install` with pnpm 11.x
- [X] T014 [US2] Verify full workspace build succeeds with `pnpm build`
- [X] T015 [US2] Verify Docker image builds successfully with `docker build -f deploy/Dockerfile -t homedash:test .`

**Checkpoint**: Commit 2 complete — pnpm 11.x active, lockfile regenerated, workspace builds cleanly.

---

## Phase 3: User Story 3 — Fix TS4111 Errors in Integration Tests (Priority: P3)

**Goal**: Resolve all 58 TS4111 TypeScript errors by switching dot notation to bracket notation on index-signature typed responses.

**Independent Test**: Run `cd backend && npx tsc --noEmit` — zero TS4111 errors reported.

### Implementation

- [X] T016 [P] [US3] Fix TS4111 bracket notation errors in backend/tests/integration/backup.test.ts
- [X] T017 [P] [US3] Fix TS4111 bracket notation errors in backend/tests/integration/restore.test.ts
- [X] T018 [P] [US3] Fix TS4111 bracket notation errors in backend/tests/integration/restorePreview.test.ts
- [X] T019 [US3] Verify typecheck passes with `cd backend && npx tsc --noEmit`
- [X] T020 [US3] Run affected integration tests with `pnpm --filter backend exec vitest run tests/integration/`

**Checkpoint**: Commit 3 complete — zero TS4111 errors, all integration tests pass.

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Final validation across all three commits combined.

- [X] T021 Run full CI simulation: `pnpm install && pnpm build && cd backend && npx tsc --noEmit`
- [X] T022 Confirm zero production source files modified (only workflow, config, and test files changed)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (US1 — Actions)**: No dependencies — can start immediately
- **Phase 2 (US2 — pnpm)**: No dependency on Phase 1 — can start in parallel
- **Phase 3 (US3 — TS4111)**: No dependency on Phase 1 or 2 — can start in parallel
- **Phase 4 (Polish)**: Depends on all three phases complete

### User Story Dependencies

- **User Story 1 (P1)**: Fully independent — workflow file changes only
- **User Story 2 (P2)**: Fully independent — package manager and Dockerfile changes only
- **User Story 3 (P3)**: Fully independent — test file syntax changes only

### Within Each User Story

- All action version bumps within US1 are parallel (different `uses:` lines, same files)
- Dockerfile changes (T010, T011) are parallel (different lines)
- All three test file fixes (T016–T018) are parallel (different files)
- Verification tasks (T008, T014–T015, T019–T020) must follow implementation

### Parallel Opportunities

- **All three user stories** can execute simultaneously (completely independent file sets)
- Within US1: T001–T007 are all parallelizable
- Within US2: T010 and T011 are parallelizable
- Within US3: T016, T017, T018 are parallelizable

---

## Parallel Example: All Stories Simultaneously

```bash
# All stories touch completely different file sets — maximum parallelism:

# Story 1 (Actions):
Task: "Update actions/checkout v4→v6 in .github/workflows/docker-publish.yml"
Task: "Update docker/setup-buildx-action v3→v4 in .github/workflows/docker-publish.yml"
Task: "Update actions/checkout v4→v6 in .github/workflows/promote-release.yml"
Task: "Update actions/setup-node v4→v6 in .github/workflows/promote-release.yml"

# Story 2 (pnpm):
Task: "Update packageManager field in package.json"
Task: "Update corepack prepare in deploy/Dockerfile"

# Story 3 (TS4111):
Task: "Fix bracket notation in backend/tests/integration/backup.test.ts"
Task: "Fix bracket notation in backend/tests/integration/restore.test.ts"
Task: "Fix bracket notation in backend/tests/integration/restorePreview.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: GitHub Actions Node.js 24 upgrade
2. **STOP and VALIDATE**: Trigger workflows, confirm zero deprecation warnings
3. Commit and push — immediate CI health improvement

### Incremental Delivery

1. Commit 1: Actions upgrade → Validate workflows → Push
2. Commit 2: pnpm upgrade → Validate build + Docker → Push
3. Commit 3: TS4111 fixes → Validate typecheck → Push
4. Each commit is independently revertible without affecting others

### Parallel Strategy

All three commits touch completely separate file sets:
- Commit 1: `.github/workflows/` only
- Commit 2: `package.json`, `deploy/Dockerfile`, `pnpm-lock.yaml` only
- Commit 3: `backend/tests/integration/` only

All three can be developed and validated simultaneously.

---

## Notes

- [P] tasks = different files or different lines, no dependencies
- [Story] label maps task to specific user story for traceability
- Each commit/story is independently deliverable and revertible
- No production source code is modified in any phase
- Commit after each phase for clean git history
