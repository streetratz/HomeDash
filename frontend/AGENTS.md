# AGENTS.md — frontend (HomeDash web UI)

Inherits every rule in the [repository root `AGENTS.md`](../AGENTS.md) and the
[constitution](../.specify/memory/constitution.md). This file adds frontend
specifics only.

React 18 + Vite 5, TypeScript strict, Tailwind CSS + shadcn/ui (Radix),
TanStack Query v5, react-router-dom, react-grid-layout, Playwright for E2E.

## Layout

```
src/main.tsx        Entry point
src/app/router.tsx  Route table
src/pages/          DashboardPage, SettingsPage, LoginPage, FirstRunPage
src/components/     Shell, dashboard grid, widgets, settings/, sonos/,
                    calendar/, ui/ (shadcn primitives — regenerate, don't
                    hand-roll new variants)
src/hooks/          Reusable hooks (+ __tests__/ colocated unit tests)
src/state/          TanStack Query hooks and client-side state modules
src/lib/            apiClient, utils, build info, parsers
tests/unit/         Non-colocated unit tests
tests/e2e/          Playwright specs (excluded from vitest)
```

`@/` resolves to `frontend/src` (vite + vitest aliases).

## Rules

- **Mobile-first and accessible.** Layouts must work from ~360px to large
  desktop; touch targets sized for fingers, semantic HTML, visible focus states,
  screen-reader labelling. Constitution §II is binding.
- **Talk to the API through `src/lib/apiClient.ts`.** It carries session cookies
  and CSRF headers — no bare `fetch` to backend routes, and no secrets or
  long-lived tokens in `localStorage` / `sessionStorage`.
- **Server state belongs to TanStack Query** (`src/state/`), not component state
  or ad-hoc effects. Respect existing polling helpers such as
  `useAdaptivePoll` / `useWidgetVisibility` instead of adding raw intervals.
- **Style with Tailwind tokens and existing `components/ui` primitives.** No
  inline style objects for themable properties; both light and dark themes must
  be checked, with no flash on load.
- **Performance on low-power devices matters.** Avoid unnecessary re-renders and
  extra bundle weight; dashboards render on wall tablets and phones.
- **Critical flows need E2E coverage.** First-run, auth, navigation, and any new
  critical path require Playwright specs in `tests/e2e/`.
- UI/UX work should be checked against the
  [`design-taste`](../.github/skills/design-taste/SKILL.md),
  [`emil-design-eng`](../.github/skills/emil-design-eng/SKILL.md), and
  [`review-animations`](../.github/skills/review-animations/SKILL.md) skills.

## Commands (from the repository root)

| Scope                    | Command                                                             |
| ------------------------ | ------------------------------------------------------------------- |
| Unit tests               | `pnpm --filter frontend test:unit`                                  |
| All vitest tests         | `pnpm --filter frontend test`                                       |
| E2E                      | `pnpm --filter frontend test:e2e` (`test:e2e:ui` for the runner UI) |
| Typecheck                | `pnpm --filter frontend typecheck`                                  |
| Build (typechecks first) | `pnpm --filter frontend build`                                      |
| Dev server               | `pnpm --filter frontend dev`                                        |

A single spec: `pnpm --filter frontend exec vitest run src/hooks/__tests__/<file>`
or `pnpm --filter frontend exec playwright test tests/e2e/<file>`.
E2E runs need a running app — `playwright.config.ts` has its `webServer` block
commented out, so start `pnpm dev` yourself before running the specs.
