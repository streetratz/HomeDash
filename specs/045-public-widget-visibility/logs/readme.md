# Implementation Logs: 045 — Public Dashboard Widget Visibility

## Feature Overview

Gives administrators per-widget control over what an unauthenticated visitor
sees on the designated public dashboard
([#66](https://github.com/streetratz/HomeDash/issues/66)), and makes the
default deny.

Today `/api/public/bootstrap` hands an anonymous visitor the entire dashboard
while every widget data route requires a session, so the public dashboard
renders as a wall of 401-driven error states.

Sits below [#100](https://github.com/streetratz/HomeDash/issues/100), which
established that *reading* widget data is an authenticated action and only
configuration is an admin action. This feature adds the anonymous tier beneath
that boundary without disturbing it, and must not reopen the unauthenticated
Docker hole closed by [#189](https://github.com/streetratz/HomeDash/issues/189).

## Phase Log Index

| Phase | Name | Status | Log File |
| ----- | ---- | ------ | -------- |
| —     | Specification | ✅ Complete | [spec.md](../spec.md) |
| —     | Planning      | ✅ Complete | [plan.md](../plan.md) |
| 0     | Research      | ✅ Complete | [research.md](../research.md) |
| 1     | Setup & baselines    | ✅ Complete | [01-phase-setup-baselines.md](01-phase-setup-baselines.md) |
| 2     | Visibility model     | ✅ Complete | [02-phase-visibility-model.md](02-phase-visibility-model.md) |
| 3     | Authorization service| ✅ Complete | [03-phase-public-authorization.md](03-phase-public-authorization.md) |
| 4     | Public data namespace| ✅ Complete | [04-phase-public-data-namespace.md](04-phase-public-data-namespace.md) |
| 5     | Bootstrap pruning    | ✅ Complete | [05-phase-bootstrap-pruning.md](05-phase-bootstrap-pruning.md) |
| 6     | Frontend public mode | ✅ Complete | [06-phase-frontend-public-mode.md](06-phase-frontend-public-mode.md) |
| 7     | Administration UI    | ✅ Complete | [07-phase-administration-ui.md](07-phase-administration-ui.md) |
| 8     | Verification & docs  | ✅ Complete | [08-phase-verification-docs.md](08-phase-verification-docs.md) |
| 9     | Migration integrity  | ✅ Complete | [09-phase-migration-integrity.md](09-phase-migration-integrity.md) |

Phases 2→5 are the security spine and land before any UI work.

Phase 0 and Phase 1 design artifacts are complete. Implementation starts with
Phase 1 baseline capture from `tasks.md`.

## Resolved Questions

Both questions raised at specification time are now closed; see
[spec.md](../spec.md#assumptions):

1. **Public Sonos control — resolved: read-only.** The issue asked for
   `allowPublicControls: true` by default. Constitution §I requires public
   endpoints to be GET-only and Sonos transport control is state-changing. The
   requester accepted look-but-don't-touch, so no constitutional exception is
   sought and public control is out of scope for this feature.
2. **UniFi `summary` mode — resolved: out of scope.** UniFi is publicly
   visible with its normal read payload or not at all. A reduced payload can be
   added later without changing the visibility model.

## Baselines

**There is no CI on pull requests.** Local runs are the only gate, and the gate
is **"no NEW problems versus these baselines"** — never "clean". To be
re-captured at the start of implementation; carried forward from 043 and #100
for reference:

| Command | Baseline result |
| --- | --- |
| `pnpm lint` | 81 problems (54 errors, 27 warnings) |
| `pnpm typecheck` | 23 errors, all in backend test files |
| `PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH" pnpm --filter backend test` | 638 pass; 3 pre-existing `calendar-phase7.test.ts` failures |
| `pnpm --filter backend openapi:lint` | 5 errors, 39 warnings |

The active default shell uses Node 26, which cannot load the installed
Node-22-built `better-sqlite3` binary. All implementation validation commands
must pin local Node `v22.22.3`.
