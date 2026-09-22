# Feature Specification: CI & Tooling Upgrades

**Feature Branch**: `031-ci-tooling-upgrades`  
**Created**: 2025-07-15  
**Status**: Draft  
**Priority**: High (Node.js 24 deadline: June 2, 2026)  
**Related Issues**: #116, #117, #95  
**Input**: Infrastructure/CI maintenance — upgrade GitHub Actions to Node.js 24, migrate pnpm to v11, fix TS4111 errors in integration tests.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - GitHub Actions Node.js 24 Migration (Priority: P1)

As a maintainer, I need all GitHub Actions workflows to run on Node.js 24-compatible action versions so that CI pipelines continue functioning after GitHub deprecates Node.js 20 runners.

**Why this priority**: Hard deadline of June 2, 2026. After this date, workflows using Node.js 20-based actions will emit deprecation warnings or fail entirely. This is the most time-sensitive task.

**Independent Test**: Run the Docker publish and promote-release workflows end-to-end on a test branch after upgrading action versions. Both workflows complete successfully without deprecation warnings.

**Acceptance Scenarios**:

1. **Given** the docker-publish workflow is triggered, **When** all actions execute, **Then** no Node.js deprecation warnings appear in logs and the workflow completes successfully
2. **Given** the promote-release workflow is triggered, **When** all actions execute, **Then** no Node.js deprecation warnings appear in logs and the workflow completes successfully
3. **Given** actions/checkout, actions/setup-node, docker/build-push-action, docker/login-action, docker/metadata-action, and docker/setup-buildx-action are all upgraded, **When** the workflow runs, **Then** all actions resolve to Node.js 24-compatible runtime versions

---

### User Story 2 - pnpm Major Version Upgrade (Priority: P2)

As a maintainer, I need the project's package manager upgraded from pnpm 8.15.9 to pnpm 11.x so the project benefits from performance improvements, security patches, and stays on a supported version.

**Why this priority**: pnpm 8.x is several major versions behind; staying current reduces technical debt and avoids future forced migrations under time pressure.

**Independent Test**: After updating the packageManager field, Dockerfile, and regenerating the lockfile, run `pnpm install` and `pnpm build` across the entire workspace. All packages install and build without errors.

**Acceptance Scenarios**:

1. **Given** package.json has packageManager set to pnpm 11.x, **When** `corepack prepare` is run, **Then** pnpm 11.x is activated without errors
2. **Given** pnpm-lock.yaml is regenerated, **When** `pnpm install --frozen-lockfile` is run in CI, **Then** installation completes successfully
3. **Given** the Dockerfile uses the updated corepack prepare command, **When** a Docker image is built, **Then** the build succeeds and the container runs correctly
4. **Given** breaking changes from pnpm 9, 10, and 11 have been reviewed, **When** the workspace builds, **Then** no regressions are introduced in dependency resolution or script execution

---

### User Story 3 - Fix TS4111 Errors in Integration Tests (Priority: P3)

As a developer, I need the 58 TypeScript TS4111 errors in integration tests resolved so that `tsc --noEmit` passes cleanly and CI type-checking gates succeed.

**Why this priority**: These errors block strict type-checking in CI but affect only test files — no production code changes are needed. Lower urgency than the other two tasks but still important for CI health.

**Independent Test**: Run `tsc --noEmit` against the backend test files. Zero TS4111 errors are reported.

**Acceptance Scenarios**:

1. **Given** integration test files use dot notation on `Record<string, unknown>` typed responses, **When** those accesses are changed to bracket notation, **Then** TS4111 errors are eliminated
2. **Given** only test files are modified (backup.test.ts, restore.test.ts, restorePreview.test.ts), **When** production source files are checked, **Then** no production code has been changed
3. **Given** all 58 TS4111 errors are fixed, **When** the full test suite runs, **Then** all integration tests still pass with correct assertions

---

### Edge Cases

- What happens if a GitHub Action version is pinned by SHA rather than tag? Verify all action references use the correct format for the upgraded versions.
- How does the project handle pnpm 11's changed default behaviors (e.g., hoisting changes, peer dependency resolution)? Any workspace-specific overrides in `.npmrc` must be reviewed.
- Are there TS4111 errors outside the three identified test files that should also be fixed for consistency?
- What if a Docker action's latest version introduces breaking changes to its inputs/outputs schema?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: All GitHub Actions in `docker-publish.yml` MUST use versions compatible with Node.js 24 runtime
- **FR-002**: All GitHub Actions in `promote-release.yml` MUST use versions compatible with Node.js 24 runtime
- **FR-003**: The `packageManager` field in root `package.json` MUST specify pnpm 11.x (latest stable)
- **FR-004**: The Dockerfile `corepack prepare` command MUST reference the same pnpm version as `package.json`
- **FR-005**: `pnpm-lock.yaml` MUST be regenerated to reflect pnpm 11.x lockfile format
- **FR-006**: The full workspace (`pnpm install` + `pnpm build`) MUST complete without errors after the pnpm upgrade
- **FR-007**: All 58 TS4111 errors in `backend/tests/integration/` MUST be resolved by switching from dot notation to bracket notation
- **FR-008**: No production source files MUST be modified to resolve TS4111 errors — changes are test-only
- **FR-009**: All existing CI workflows MUST continue to pass after all upgrades are applied
- **FR-010**: Breaking changes across pnpm 9, 10, and 11 MUST be reviewed and any required configuration adjustments applied

### Key Entities

- **Workflow File**: A GitHub Actions YAML definition (docker-publish.yml, promote-release.yml) containing action references that need version bumps
- **Action Reference**: A `uses:` declaration in a workflow file specifying an action and version (e.g., `actions/checkout@v4`)
- **Package Manager Declaration**: The `packageManager` field in `package.json` that controls which pnpm version corepack activates
- **Lockfile**: `pnpm-lock.yaml` — the resolved dependency graph that must be regenerated for pnpm 11.x compatibility

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Both CI workflows (docker-publish, promote-release) execute with zero Node.js deprecation warnings
- **SC-002**: CI pipeline total execution time does not regress by more than 10% after upgrades
- **SC-003**: `tsc --noEmit` reports zero TS4111 errors across the entire project
- **SC-004**: Docker image builds successfully and container starts without errors after pnpm upgrade
- **SC-005**: All existing automated tests pass after all three changes are applied together
- **SC-006**: Zero production source files are modified (changes confined to workflow files, package.json, lockfile, Dockerfile, and test files)

## Assumptions

- GitHub will continue to support action version tags (e.g., `@v5`) as the primary referencing mechanism
- The latest versions of all Docker-prefixed actions maintain backward-compatible input/output schemas (or any changes are well-documented in release notes)
- pnpm 11.x is stable and compatible with the project's Node.js version and workspace structure
- The existing `.npmrc` configuration (if any) will need review but is assumed compatible with minor adjustments
- corepack is available in both the local development environment and the CI Docker build environment
- The 58 TS4111 errors are all in the three identified test files and follow a consistent pattern (dot notation on `Record<string, unknown>`)
- No other TypeScript strict-mode errors are introduced by the bracket notation changes
- The June 2, 2026 deadline for Node.js 24 migration is based on GitHub's published deprecation timeline
