# AGENTS.md — HomeDash (repository root)

HomeDash is a self-hosted, LAN-first home lab dashboard: a Fastify + SQLite
backend and a React + Vite frontend in a single pnpm workspace, shipped as a
Docker image to GHCR. See [`README.md`](./README.md) for the product overview.

## How these files work

This file applies to **every** path in the repository. When changing a file,
walk from the repository root down to that file's directory and read every
`AGENTS.md` on the way. Apply the outermost file's rules first; a nearer file
overrides only the rules it explicitly contradicts, and all non-conflicting
ancestor rules stay in force.

Scoped files:

- [`backend/AGENTS.md`](./backend/AGENTS.md)
- [`frontend/AGENTS.md`](./frontend/AGENTS.md)

## Local environment restrictions

Before installing dependencies, accessing package registries, or using external
network services, read `.agent-environment.md` at the repository root.

- If the file is missing in a new clone or worktree, ask the user whether the
  machine has environment, network, proxy, registry, or tool restrictions.
- Create `.agent-environment.md` with the user's answer before proceeding. If
  there are no restrictions, create it with `None`.
- The file is intentionally gitignored and must never be committed or copied
  into tracked documentation, logs, issues, pull requests, or command output.
- Treat its contents as binding local operating instructions.

## Authoritative sources (do not duplicate — read them)

| Source                                                                               | Covers                                                                                                                                                                 |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`.specify/memory/constitution.md`](./.specify/memory/constitution.md)               | **Highest-order rule set.** Security, UI, LAN boundary, ops, testing, phase logging, spec changelog, governance. Specs, plans, tasks, and implementation MUST conform. |
| [`RELEASE-LIFECYCLE.md`](./RELEASE-LIFECYCLE.md)                                     | Branching, promotion, tagging, GHCR, rollback.                                                                                                                         |
| [`docs/getting-started.md`](./docs/getting-started.md)                               | Install, Docker, environment variables, dev setup.                                                                                                                     |
| [`docs/operations.md`](./docs/operations.md)                                         | Admin reset, break-glass, database management.                                                                                                                         |
| [`.github/copilot-instructions.md`](./.github/copilot-instructions.md)               | Speckit pointer to the current feature plan.                                                                                                                           |
| [`.github/agents/copilot-instructions.md`](./.github/agents/copilot-instructions.md) | Speckit-generated tech inventory. Auto-generated — treat as history, not policy; prefer manifests for current facts.                                                   |
| [`.github/skills/`](./.github/skills/)                                               | Code-review standard, design taste, animation/UI craft.                                                                                                                |

Where any of these conflicts with this file, the constitution wins, then the
document nearest the change.

## Repository layout

```
backend/          Fastify API server (TypeScript, Node 24)
frontend/         React 18 + Vite web UI
specs/NNN-slug/   Per-feature spec, plan, tasks, logs, changelog-spec.md
.specify/         Speckit templates, scripts, memory/constitution.md
.github/          Workflows, speckit agents/prompts, skills
docs/             Getting started + operations guides
deploy/           Deployment Dockerfile and assets
Dockerfile        Multi-stage production image (root build)
```

`backend/dist`, `frontend/dist`, `node_modules/`, `pnpm-lock.yaml`,
`backend/drizzle/*.sql`, and `.github/agents/copilot-instructions.md` are
generated. Never hand-edit them: regenerate via the owning tool
(`pnpm build`, `pnpm install`, `pnpm --filter backend db:generate`, speckit).

## Non-negotiable rules

1. **Security first.** The LAN is hostile. Authentication required for every
   state-mutating or private endpoint; public endpoints are GET-only,
   read-only, admin-selected. Default-deny authorization. Validate input at
   every trust boundary. Constitution §I is binding.
2. **No secrets in the repo.** Session keys, DB creds, and API tokens come from
   environment variables or mounted secret files only, and are never logged.
3. **Branch, never push to `main`.** Branch from `main` as `NNN-feature-name`
   matching the `specs/NNN-.../` directory; open a PR with `gh pr create --base main`;
   squash-merge. `release` is moved only by the **Promote to Release** workflow.
4. **Spec-driven changes.** Every feature has a spec and plan under
   `specs/NNN-slug/` produced from `.specify` templates, and every plan carries a
   Constitution Check section.
5. **Spec edits are logged.** Any edit to a feature `spec.md` requires a new
   `CH-NN` entry in that feature's `changelog-spec.md`, committed in the same
   commit (constitution → Spec Changelog).
6. **Implementation phases are logged.** Per-phase files and raw `.log` sidecars
   under `specs/NNN-slug/logs/`, indexed by `logs/readme.md`, are committed audit
   artifacts (constitution → Test & Error Logging).
7. **Tests gate completion.** No phase is ✅ with known failing tests. Auth/authz
   changes need positive _and_ negative coverage; contract/schema changes need
   migration notes and tests.
8. **Stay in scope.** No drive-by refactors, dependency bumps, or unrelated file
   rewrites in a feature change.
9. **Document behavior changes.** New config/env vars, deployment changes, and
   breaking changes must land in the same PR as docs updates and be called out
   explicitly (SemVer).
10. **Advance Main Version in every PR.** [`versions.json`](./versions.json) is the
    machine-readable source of truth. Each feature, fix, or docs PR increments only
    `main` and the blue README `Main Version` badge by one patch step; use
    `pnpm version:bump-main`. Do not change `release`, `package.json` version, or the
    green `Release Version` badge in a normal PR. The **Promote to Release** workflow
    copies the exact Main Version into all release-owned surfaces. Branches created
    from the same base must rebase before merge so two PRs never claim the same Main
    version.

## Work items and PRs

- Tracker is **GitHub Issues** on `streetratz/HomeDash` (labels such as
  `enhancement`, `sonos`, `widget`, `frontend`). Use `gh issue` / `gh pr`.
- Link the issue in the PR description (`Closes #NNN`) when one exists. If no
  issue exists and the work is user-visible, open one rather than inventing
  another tracking convention.
- **Mandatory PR gate.** Invoke and satisfy all of the following immediately
  before opening a PR. After the PR is open, rerun the full gate only when the
  candidate branch changes (for example: a new commit, rebase, merge from
  `main`, or conflict resolution). If the PR branch is unchanged, confirm the
  existing results and required GitHub checks immediately before merge rather
  than repeating the full local suite:
  1. [`code-review-standard`](./.github/skills/code-review-standard/SKILL.md) —
     review the final branch diff and resolve every significant finding.
  2. [`design-taste`](./.github/skills/design-taste/SKILL.md) and
     [`emil-design-eng`](./.github/skills/emil-design-eng/SKILL.md) — review
     user-facing UI changes; for a PR with no UI surface, record that the UI review
     is not applicable rather than inventing findings.
  3. [`pre-pr-upgrade-gate`](./.github/skills/pre-pr-upgrade-gate/SKILL.md) —
     prove that the candidate Docker image upgrades a database created by `main`
     without losing pre-existing configuration or violating foreign keys.
  4. [`lint-gate`](./.github/skills/lint-gate/SKILL.md) — run the full local
     `pnpm lint` command under Node 24 after the final edits.
- Do not open or merge a PR while any mandatory gate is failing. A passing GitHub
  Actions check is supplemental evidence and does not replace the local lint gate.

## Validation commands

Run the **smallest** command that covers the change; escalate only if it fails.
All commands run from the repository root with pnpm 11 (`packageManager` field)
and Node 24 (root `engines`).

| Scope               | Command                                          |
| ------------------- | ------------------------------------------------ |
| Install             | `pnpm install`                                   |
| Backend tests       | `pnpm --filter backend test`                     |
| Frontend unit tests | `pnpm --filter frontend test:unit`               |
| Frontend E2E        | `pnpm --filter frontend test:e2e`                |
| Typecheck (both)    | `pnpm typecheck`                                 |
| Lint                | `pnpm lint` (`pnpm lint:fix` to autofix)         |
| Format              | `pnpm format:check` / `pnpm format`              |
| Build everything    | `pnpm build`                                     |
| Dev servers         | `pnpm dev` (runs backend + frontend in parallel) |

Markdown/docs-only changes do not require builds or app tests — there is no
docs-specific validation command in this repo.

**There is no CI on pull requests.** `.github/workflows/docker-publish.yml` runs
only on pushes to `release`, and `promote-release.yml` is manual. The commands
above are the only gate, so run them locally before merging. Note that `pnpm lint`
and `pnpm --filter backend openapi:lint` currently report pre-existing findings
repo-wide; compare against `main` rather than expecting a clean run.

## Dependencies

Dependencies are pinned via `pnpm-lock.yaml` and updated deliberately. A
transitive package that must be forced to a newer version is pinned with an
`overrides` entry in [`pnpm-workspace.yaml`](./pnpm-workspace.yaml), followed by
`pnpm install`. Native modules that may run install scripts are listed under
`allowBuilds` in the same file.

Switching between branches whose `overrides` differ leaves `node_modules`
stale, and `pnpm install` will report "Already up to date" without repairing the
links. Force a relink by removing the install-state file first:

```bash
rm -f node_modules/.pnpm-workspace-state-v1.json && pnpm install
```
