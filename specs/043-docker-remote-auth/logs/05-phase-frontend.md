# Phase 5: Frontend & Guidance — Implementation Log

[← Back to Index](./readme.md)

## Contents

- [Overview](#overview)
- [What changed](#what-changed)
- [Commands Run](#commands-run)
- [Run 1 — first gate attempt](#run-1--first-gate-attempt)
- [Run 2 — gate after fixes](#run-2--gate-after-fixes)
- [Playwright — four attempts to an honest run](#playwright--four-attempts-to-an-honest-run)
- [Errors & Fixes](#errors--fixes)
- [Design notes](#design-notes)
- [Phase Checkpoint](#phase-checkpoint)

## Overview

`tasks.md` Phase 6 (T057–T065) — the user-facing half of
[#181](https://github.com/streetratz/HomeDash/issues/181).

Phase 5 made the server stop lying: a misconfigured Docker widget now fails with
a specific, classified error instead of silently showing the local daemon's
containers. That is only useful if the UI *says* which failure it is, because
each of the six categories is fixed in a different place. This phase carries the
taxonomy from the API boundary to the screen, and writes the endpoint-format
guidance that stops the misconfiguration happening in the first place.

## What changed

- **`frontend/src/hooks/useDocker.ts`** — moved off bare `fetch` onto
  `apiClient`, so the Docker calls carry the session cookie and CSRF token the
  routes now require. Added `classifyDockerError()` / `DockerErrorKind` /
  `ERROR_KIND_BY_CODE`, mapping the nine server codes onto six user-meaningful
  categories. `useDockerPing` deleted — its route no longer exists.
- **`frontend/src/state/dashboards.ts`** — `dockerUrl?` removed from
  `DockerConfig`. The address now lives only on the connection row; a widget
  cannot carry one.
- **`frontend/src/components/widgets/DockerWidget.tsx`** — per-category
  `ERROR_COPY` map (title + the one hint that actually fixes that category) and
  a `DockerWidgetError` component. The local-socket fallback rendering is gone.
- **`frontend/src/components/settings/DockerConnectionForm.tsx`** — the four
  accepted forms with their default ports stated *before* any input, plus
  `saveError` surfaced in a `role="alert"` with `aria-describedby` /
  `aria-invalid` wiring.
- **`docs/getting-started.md`** — a "Docker Connections" section: the four
  formats, why `http://` and bare `host:port` are rejected, the five-step SSH
  key recipe, and the error-to-remedy table.
- **Tests** — `useDocker.test.ts` (16 unit tests) and
  `tests/e2e/dockerConnection.spec.ts` (4 Playwright tests).

## Commands Run

| # | Command | Sidecar | Result |
|---|---------|---------|--------|
| 1 | `pnpm --filter frontend test:unit` | [vitest-run-1.log](./05-phase-frontend/vitest-run-1.log) | 37 passed |
| 2 | `pnpm --filter frontend typecheck` | [frontend-tsc-run-1.log](./05-phase-frontend/frontend-tsc-run-1.log) | ❌ 2 errors |
| 3 | `pnpm --filter frontend build` | [vite-run-1.log](./05-phase-frontend/vite-run-1.log) | ❌ (typecheck gate) |
| 4 | `pnpm lint` | [lint-run-1.log](./05-phase-frontend/lint-run-1.log) | ❌ 83 problems (+1) |
| 5 | `pnpm typecheck` | [tsc-run-1.log](./05-phase-frontend/tsc-run-1.log) | 23 errors — baseline |
| 6 | `pnpm --filter frontend test:unit` | [vitest-run-2.log](./05-phase-frontend/vitest-run-2.log) | ✅ 37 passed |
| 7 | `pnpm --filter frontend typecheck` | [frontend-tsc-run-2.log](./05-phase-frontend/frontend-tsc-run-2.log) | ✅ clean |
| 8 | `pnpm --filter frontend build` | [vite-run-2.log](./05-phase-frontend/vite-run-2.log) | ✅ built in 3.61s |
| 9 | `pnpm lint` | [lint-run-2.log](./05-phase-frontend/lint-run-2.log) | ✅ 81 problems (−1 vs baseline) |
| 10 | `playwright test dockerConnection.spec.ts` | [playwright-run-1.log](./05-phase-frontend/playwright-run-1.log) | ❌ no browsers installed |
| 11 | `playwright … --project=chromium` | [playwright-run-2.log](./05-phase-frontend/playwright-run-2.log) | ❌ wrong baseURL |
| 12 | `PLAYWRIGHT_BASE_URL=…:5173 playwright …` | [playwright-run-3.log](./05-phase-frontend/playwright-run-3.log) | ❌ login failed |
| 13 | `PLAYWRIGHT_BASE_URL=…:5173 playwright …` | [playwright-run-4.log](./05-phase-frontend/playwright-run-4.log) | ✅ 4 passed |

## Run 1 — first gate attempt

| Check | Baseline | Run 1 | Delta |
|-------|----------|-------|-------|
| `pnpm lint` | 82 problems (55 E / 27 W) | 83 problems (56 E / 27 W) | **+1 error** |
| `pnpm typecheck` | 23 errors | 23 errors | ✅ |
| `frontend typecheck` | clean | 2 errors | **+2** |
| `frontend test:unit` | 21 passed | 37 passed | +16 new |
| `frontend build` | succeeds | fails | **regressed** |

## Run 2 — gate after fixes

| Check | Baseline | Run 2 | Delta |
|-------|----------|-------|-------|
| `pnpm lint` | 82 problems (55 E / 27 W) | **81 problems (54 E / 27 W)** | −1 error |
| `pnpm typecheck` | 23 errors | 23 errors | ✅ |
| `frontend typecheck` | clean | clean | ✅ |
| `frontend test:unit` | 21 passed | **37 passed** | +16 |
| `frontend build` | succeeds | ✅ built in 3.61s | ✅ |
| `dockerConnection.spec.ts` | n/a | **4 passed** | +4 |

The lint count landing *below* baseline is not a miscount: the unused `Loader2`
import removed in the fix pass was one of the 55 baseline errors, and the
rewritten `DockerWidget` no longer needs it.

## Playwright — four attempts to an honest run

The spec was written before it could be run, so every assumption in it was
suspect. Rather than record it as "written, unverified", each failure was chased
down until the suite genuinely executed.

1. **No browsers.** `chromium_headless_shell-1223` was absent from the
   Playwright cache. Installed chromium (92 MiB). Not a code fault.
2. **Wrong target.** `playwright.config.ts` defaults `baseURL` to
   `http://localhost:3000` — the *backend*. In dev the backend does not serve
   the SPA, so `/login` returned a Fastify 404 JSON body and `getByLabel`
   waited 30s against a `<generic>` node. Fixed by pointing
   `PLAYWRIGHT_BASE_URL` at Vite on `:5173`.
3. **Wrong database.** Login then reached a real form but never navigated: the
   developer's working DB has an admin whose password is not the fixture's
   `strongpassword1`. Running destructive UI tests against it would have been
   the wrong fix.
4. **Isolated stack.** Started the backend with
   `HOMEDASH_DATA_DIR=/tmp/homedash-e2e` (empty) plus Vite. `firstRunRequired`
   came back `true`, the spec's own first-run helper created the admin, and all
   four tests passed in 5.7s. The temp data dir was deleted afterwards.

Two selector assumptions were also wrong and were corrected against the real
components before the passing run:

- There is no `role="tab"` navigation *into* the Docker panel — the Integrations
  tab is reached by URL (`/settings?tab=integrations`) and `IntegrationsTab`
  defaults `activeService` to `'docker'`, so the panel is already open.
- The button is labelled **`Add`**, not "Add Docker". Only the active service
  panel is rendered, so `{ name: 'Add', exact: true }` is unambiguous.

## Errors & Fixes

**1. `TS2322` — spy types widened to `never` (frontend typecheck).**
`let getSpy: ReturnType<typeof vi.spyOn>` doesn't work: `vi.spyOn`'s type
parameters have no defaults, so `ReturnType` of the unapplied generic collapses
to `MockInstance<unknown[], unknown>`, which the actual spy isn't assignable to.
Supplying the type arguments explicitly (`vi.spyOn<typeof x, 'get'>`) failed
differently — the constraint resolves to `never` in that position. The form that
works is to name the signature directly:

```ts
type ApiGet = typeof apiClientModule.apiClient.get;
let getSpy: MockInstance<Parameters<ApiGet>, ReturnType<ApiGet>>;
```

**2. `no-unused-vars` — `Loader2`.** Left over from the previous spinner-based
error state that `DockerWidgetError` replaced.

**3. `no-unnecessary-type-assertion` — `mock.calls[0]![0] as string`.** With the
spy now correctly typed, the first argument is already `string`; the assertion
that had been papering over error 1 became redundant once error 1 was fixed
properly.

## Design notes

**Six categories, not nine codes.** The server distinguishes nine error codes;
the UI shows six. Codes are collapsed only when the *remedy* is identical —
`DOCKER_REMOTE_UNAVAILABLE` and a connect timeout are both "the address is
valid, the host didn't answer", and splitting them would ask the user to care
about a distinction they cannot act on. The categories that stay separate are
exactly the ones fixed in different places: the widget config, the connection
address, the remote host, the SSH key, `known_hosts`, and the daemon version.

**Guidance is stated before the error, not only after it.** `#docker-url-help`
lists all four forms and their default ports on first render. The rejection
message exists for the case where that was skimmed; it is not the primary
teaching surface. This is what SC-003 is measuring.

**`apiClient`, not `fetch`.** Phase 5 put the Docker routes behind
`requireAuthHook`; bare `fetch` sends no CSRF token, so the mutation route would
have started 403-ing. Moving the hook onto `apiClient` is what keeps the actions
working, and is why the hook file changed at all.

**No local-socket fallback in the UI either.** The widget renders an error and
zero containers. Showing *this* machine's containers when a remote host is
unreachable is the original #181 bug wearing a frontend costume.

## Phase Checkpoint

- T057–T065 complete.
- Gate: frontend typecheck clean, build clean, 37 unit tests passing, 4
  Playwright tests passing, repo lint **81 problems — one below the 82
  baseline**, repo typecheck at its 23-error baseline.
- No backend source touched in this phase; no migrations touched.
- Next: Phase 7 (T066–T073), manual live verification against the `docker-host`
  host over the SSH forward.

[← Back to Index](./readme.md)
