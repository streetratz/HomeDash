# 19 — Independent Custom Event Review

[<- Back to Logs Index](readme.md)

## Table of Contents

- [Review](#review)
- [Correction](#correction)
- [Commands Run](#commands-run)
- [Errors & Fixes](#errors--fixes)
- [Phase Checkpoint](#phase-checkpoint)

## Review

Fresh-context Opus 4.8 reviewed candidate c74bbe8 for correctness and UI
consistency against CH-03/CH-04. No Critical, High or Medium defect identified.
Acceptable for local owner validation; real-device/assistive verification remains
owner work. Recurring interval changes retaining exceptions are deliberate:
invalidated origins block preview/save, rather than silently losing exceptions.

## Correction

One Low privacy-contract mismatch: public display keys embedded stream UUIDs.
Public keys now use date and selected-row ordinal, preserving presentation and
React uniqueness without exposing stored event identity. Authenticated keys
remain unchanged. Added explicit regression assertions.

The reviewer could not run database suites under its Node 22 runtime/native
module mismatch. Parent validation uses the required Node 24 runtime instead.
The isolated preview restarted successfully; health/readiness/login responded.

## Commands Run

All validation used Node 24.18.0 and pnpm 11.

| Command | Exit | Raw output |
| --- | --- | --- |
| `pnpm --filter backend test` (initial attempt; remaining chained gates not reached) | 1 | [validation-run-1.log](19-phase-custom-event-review/validation-run-1.log) |
| `pnpm --filter backend exec vitest run tests/integration/publicBootstrap.test.ts tests/integration/collectionPublic.test.ts` | 0; 13 tests | [targeted-rerun-1.log](19-phase-custom-event-review/targeted-rerun-1.log) |
| `pnpm --filter backend test && pnpm typecheck && pnpm build && pnpm --filter frontend exec playwright test tests/e2e/collections-custom.spec.ts tests/e2e/collections-custom.mobile.spec.ts tests/e2e/collections-reading.spec.ts tests/e2e/collections-reading.mobile.spec.ts && pnpm lint` | 0; 835 backend / 5 browser tests | [validation-run-2.log](19-phase-custom-event-review/validation-run-2.log) |
| Preview health, readiness and login checks | 0 | [preview-run-1.log](19-phase-custom-event-review/preview-run-1.log) |

Prettier reported both touched TypeScript files unchanged; diff whitespace
checks passed. Full lint passed with zero warnings.

## Errors & Fixes

Reviewer environment limitation above is not an application defect.
Initial full backend run had one intermittent bootstrap assertion failure:
`dashboard` was undefined rather than null. Its cause is not established;
isolated bootstrap/public regressions passed, then the unchanged full suite
passed 835/835. Retained both attempts; no unrelated test or production code
was changed to suppress it. Existing build chunk-size warnings remain.

## Phase Checkpoint

Automated review/remediation gates passed. Isolated preview rebuilt/restarted
against its existing disposable database, preserving demo data.
R011 complete; human local owner validation remains pending.
No PR, push, version preparation or live-data wipe.
