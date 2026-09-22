# Implementation Plan: CI & Tooling Upgrades

**Branch**: `031-ci-tooling-upgrades` | **Date**: 2025-07-15 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/031-ci-tooling-upgrades/spec.md`

## Summary

Upgrade all GitHub Actions to Node.js 24-compatible versions, migrate pnpm from v8 to v11, and fix 58 TS4111 TypeScript errors in integration tests. Three independent commits targeting CI health and tooling currency.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 22 (CI runner)  
**Primary Dependencies**: GitHub Actions (checkout, setup-node, docker/*), pnpm 8→11, corepack  
**Storage**: N/A (CI/tooling changes only)  
**Testing**: vitest (integration tests), `tsc --noEmit` (type-checking)  
**Target Platform**: GitHub Actions (ubuntu-latest), Docker (linux/amd64)  
**Project Type**: Web application (monorepo: backend + frontend)  
**Performance Goals**: CI pipeline must not regress >10% in execution time  
**Constraints**: No production source code changes; test-only + config-only  
**Scale/Scope**: 2 workflow files, 1 Dockerfile, 1 package.json, 1 lockfile, 3 test files

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Relevance | Status |
|-----------|-----------|--------|
| I. Secure-by-Default | No auth/endpoint changes — N/A | ✅ PASS |
| II. Mobile-First UI | No UI changes — N/A | ✅ PASS |
| III. LAN-Only Deployment | Docker build still targets same platform; no networking changes | ✅ PASS |
| IV. Operational Readiness | CI workflows maintain health endpoints; no regression | ✅ PASS |
| V. Testing & Change Safety | Test files fixed (TS4111); no production code modified; CI gates preserved | ✅ PASS |
| Security & Privacy | No secrets exposed; action versions pinned to specific tags | ✅ PASS |
| Dev Workflow & Quality Gates | Plan follows spec; logs will be produced during implementation | ✅ PASS |

**Gate Result**: ✅ ALL PASS — no violations, no complexity tracking needed.

## Project Structure

### Documentation (this feature)

```text
specs/031-ci-tooling-upgrades/
├── plan.md              # This file
├── research.md          # Phase 0 output — version research
├── data-model.md        # Phase 1 output — change matrix
├── quickstart.md        # Phase 1 output — verification commands
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (files to modify)

```text
.github/workflows/
├── docker-publish.yml       # Action version bumps (Commit 1)
└── promote-release.yml      # Action version bumps (Commit 1)

deploy/
└── Dockerfile               # corepack prepare pnpm@11 (Commit 2)

package.json                 # packageManager field (Commit 2)
pnpm-lock.yaml               # Regenerated lockfile (Commit 2)

backend/tests/integration/
├── backup.test.ts           # TS4111 bracket notation fix (Commit 3)
├── restore.test.ts          # TS4111 bracket notation fix (Commit 3)
└── restorePreview.test.ts   # TS4111 bracket notation fix (Commit 3)
```

**Structure Decision**: Existing monorepo layout preserved. Changes span CI config, package management, and test files only.

## Complexity Tracking

> No violations — section intentionally left empty.
