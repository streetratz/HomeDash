# 03 — Technical Planning

[← Back to Logs Index](readme.md)

## Table of Contents

- [Overview](#overview)
- [Commands Run](#commands-run)
- [Run 1: Context and setup](#run-1-context-and-setup)
- [Design decisions](#design-decisions)
- [Errors & Fixes](#errors--fixes)
- [Phase Checkpoint](#phase-checkpoint)

## Overview

**Phase**: 03 — Planning  
**Task range**: Plan only; parent generates tasks next  
**Date/Time**: 2026-10-10 10:50 UTC+11  
**Purpose**: Ground issue #19 design in current manifests and calendar code,
generate planning artifacts, and validate task-generation prerequisites.

The owner confirmed Calendar-widget/fullscreen-only icon-and-text presentation
in CH-02. One-household and manual-entry remain documented conservative draft
defaults, not new claims of owner approval. Existing dirty feature pointer and
feature artifacts are preserved. Optional git hooks are skipped. No application
implementation, task generation, version bump, commit, push, PR, or action on
unrelated dependency work is authorised. Local operating policy was read before
any network use; its private contents are excluded from this audit.

## Commands Run

| # | Command | Outcome | Log File |
| --- | --- | --- | --- |

| 1 | `bash /Users/streetratz/Personal/MyGH-Personal/HomeDash/.specify/scripts/bash/setup-plan.sh --json` | PASS (0) | [setup-run-1.log](03-phase-planning/setup-run-1.log) |

| 2 | `cat /Users/streetratz/Personal/MyGH-Personal/HomeDash/backend/AGENTS.md; cat /Users/streetratz/Personal/MyGH-Personal/HomeDash/frontend/AGENTS.md; cat /Users/streetratz/Personal/MyGH-Personal/HomeDash/package.json; cat /Users/streetratz/Personal/MyGH-Personal/HomeDash/backend/package.json; cat /Users/streetratz/Personal/MyGH-Personal/HomeDash/frontend/package.json; cat /Users/streetratz/Personal/MyGH-Personal/HomeDash/specs/065-bin-collection-calendar/plan.md; cat /Users/streetratz/Personal/MyGH-Personal/HomeDash/.specify/scripts/bash/check-prerequisites.sh; cat /Users/streetratz/Personal/MyGH-Personal/HomeDash/.specify/scripts/bash/update-agent-context.sh` | PASS (0) | [context-run-1.log](03-phase-planning/context-run-1.log) |

| 3 | `find /Users/streetratz/Personal/MyGH-Personal/HomeDash/backend/src -iname "*calendar*" -o -iname "*backup*" -o -iname "*permission*"; find /Users/streetratz/Personal/MyGH-Personal/HomeDash/frontend/src -iname "*calendar*" -o -iname "*poll*" -o -iname "*visibility*"; rg -n "calendar&#124;backup&#124;restore" /Users/streetratz/Personal/MyGH-Personal/HomeDash/backend/src/db/schema /Users/streetratz/Personal/MyGH-Personal/HomeDash/backend/src/api/index.ts; rg -n "COPILOT&#124;copilot&#124;SPECKIT&#124;update_existing&#124;update_agent_file" /Users/streetratz/Personal/MyGH-Personal/HomeDash/.specify/scripts/bash/update-agent-context.sh; cat /Users/streetratz/Personal/MyGH-Personal/HomeDash/backend/src/api/calendar.ts` | FAIL (1) | [trace-run-1.log](03-phase-planning/trace-run-1.log) |

| 4 | `cat /Users/streetratz/Personal/MyGH-Personal/HomeDash/backend/src/api/admin-calendar.ts; cat /Users/streetratz/Personal/MyGH-Personal/HomeDash/backend/src/services/calendar-types.ts; cat /Users/streetratz/Personal/MyGH-Personal/HomeDash/backend/src/lib/permissions.ts; cat /Users/streetratz/Personal/MyGH-Personal/HomeDash/frontend/src/state/calendarHooks.ts; cat /Users/streetratz/Personal/MyGH-Personal/HomeDash/frontend/src/lib/calendarDates.ts` | PASS (0) | [calendar-run-1.log](03-phase-planning/calendar-run-1.log) |

| 5 | `cat /Users/streetratz/Personal/MyGH-Personal/HomeDash/frontend/src/components/widgets/CalendarWidget.tsx; cat /Users/streetratz/Personal/MyGH-Personal/HomeDash/frontend/src/components/widgets/CalendarConfigForm.tsx; cat /Users/streetratz/Personal/MyGH-Personal/HomeDash/frontend/src/components/calendar/FullScreenCalendar.tsx; cat /Users/streetratz/Personal/MyGH-Personal/HomeDash/frontend/src/lib/calendarDates.ts; cat /Users/streetratz/Personal/MyGH-Personal/HomeDash/backend/src/auth/requireRole.ts; rg -n "calendar&#124;sourceIds&#124;requirePermission&#124;widget" /Users/streetratz/Personal/MyGH-Personal/HomeDash/backend/src/api/public.ts` | PASS (0) | [architecture-run-1.log](03-phase-planning/architecture-run-1.log) |

| 6 | `rg -n "calendar&#124;sourceIds&#124;allowed&#124;public" /Users/streetratz/Personal/MyGH-Personal/HomeDash/backend/src/services/public* /Users/streetratz/Personal/MyGH-Personal/HomeDash/backend/src/auth/middleware.ts; cat /Users/streetratz/Personal/MyGH-Personal/HomeDash/backend/src/services/backupTypes.ts; rg -n "calendar&#124;table&#124;INSERT&#124;DELETE&#124;version&#124;transaction&#124;schema" /Users/streetratz/Personal/MyGH-Personal/HomeDash/backend/src/services/backupService.ts; sed -n "394,507p" /Users/streetratz/Personal/MyGH-Personal/HomeDash/backend/src/db/schema/index.ts; cat /Users/streetratz/Personal/MyGH-Personal/HomeDash/backend/src/services/calendar-sync-service.ts; cat /Users/streetratz/Personal/MyGH-Personal/HomeDash/frontend/src/components/calendar/AgendaView.tsx; rg -n "Calendar&#124;calendar&#124;isAdmin&#124;integrations" /Users/streetratz/Personal/MyGH-Personal/HomeDash/frontend/src/pages/SettingsPage.tsx` | PASS (0) | [persistence-run-1.log](03-phase-planning/persistence-run-1.log) |

| 7 | `cat /Users/streetratz/Personal/MyGH-Personal/HomeDash/backend/src/services/publicWidgetProjection.ts; cat /Users/streetratz/Personal/MyGH-Personal/HomeDash/backend/src/services/publicVisibility.ts; rg -n "calendar&#124;sourceIds&#124;snapshot&#124;widget-data" /Users/streetratz/Personal/MyGH-Personal/HomeDash/backend/src/api/widget-data.ts /Users/streetratz/Personal/MyGH-Personal/HomeDash/backend/src/services/widget-data* /Users/streetratz/Personal/MyGH-Personal/HomeDash/frontend/src/state/calendarHooks.ts; find /Users/streetratz/Personal/MyGH-Personal/HomeDash/backend/src/auth -maxdepth 1 -type f; rg -n "calendar&#124;auth&#124;public" /Users/streetratz/Personal/MyGH-Personal/HomeDash/backend/src/server.ts; sed -n "320,448p" /Users/streetratz/Personal/MyGH-Personal/HomeDash/backend/src/services/backupService.ts; cat /Users/streetratz/Personal/MyGH-Personal/HomeDash/.specify/integration.json; find /Users/streetratz/Personal/MyGH-Personal/HomeDash/.specify/workflows -type f; sed -n "364,510p" /Users/streetratz/Personal/MyGH-Personal/HomeDash/.specify/scripts/bash/update-agent-context.sh` | PASS (0) | [projection-run-1.log](03-phase-planning/projection-run-1.log) |

| 8 | `cat /Users/streetratz/Personal/MyGH-Personal/HomeDash/backend/src/auth/authMiddleware.ts; cat /Users/streetratz/Personal/MyGH-Personal/HomeDash/backend/src/auth/csrf.ts; cat /Users/streetratz/Personal/MyGH-Personal/HomeDash/backend/src/services/dashboardAccessService.ts; cat /Users/streetratz/Personal/MyGH-Personal/HomeDash/backend/src/lib/errors.ts; cat /Users/streetratz/Personal/MyGH-Personal/HomeDash/frontend/src/hooks/useAdaptivePoll.ts; cat /Users/streetratz/Personal/MyGH-Personal/HomeDash/frontend/src/state/widgetVisibility.ts; sed -n "945,1085p" /Users/streetratz/Personal/MyGH-Personal/HomeDash/specs/065-bin-collection-calendar/logs/03-phase-planning/calendar-run-1.log; cat /Users/streetratz/Personal/MyGH-Personal/HomeDash/.specify/workflows/task_generation.json` | FAIL (1) | [security-run-1.log](03-phase-planning/security-run-1.log) |

| 9 | `find /Users/streetratz/Personal/MyGH-Personal/HomeDash/backend/src -iname "*access*" -o -iname "*widget*"; find /Users/streetratz/Personal/MyGH-Personal/HomeDash/.specify/workflows -type f; rg -n "calendar&#124;sourceIds" /Users/streetratz/Personal/MyGH-Personal/HomeDash/frontend/src/state/calendarHooks.ts; rg -n "canAccess&#124;assert.*Access&#124;dashboard.*Access&#124;requirePermission&#124;owner" /Users/streetratz/Personal/MyGH-Personal/HomeDash/backend/src/api/widgets.ts /Users/streetratz/Personal/MyGH-Personal/HomeDash/backend/src/services/dashboardService.ts; cat /Users/streetratz/Personal/MyGH-Personal/HomeDash/.specify/integration.json; sed -n "320,365p" /Users/streetratz/Personal/MyGH-Personal/HomeDash/backend/src/services/backupService.ts; sed -n "364,445p" /Users/streetratz/Personal/MyGH-Personal/HomeDash/.specify/scripts/bash/update-agent-context.sh` | PASS (0) | [locations-run-1.log](03-phase-planning/locations-run-1.log) |

| 10 | `cat /Users/streetratz/Personal/MyGH-Personal/HomeDash/.specify/workflows/speckit/workflow.yml; rg -n "assert.*Access&#124;canAccess&#124;dashboardAccessRules&#124;requirePermission" /Users/streetratz/Personal/MyGH-Personal/HomeDash/backend/src/api /Users/streetratz/Personal/MyGH-Personal/HomeDash/backend/src/lib &#124; head -90; cat /Users/streetratz/Personal/MyGH-Personal/HomeDash/backend/src/db/migrate.ts; cat /Users/streetratz/Personal/MyGH-Personal/HomeDash/backend/src/db/sqlite.ts; sed -n "255,440p" /Users/streetratz/Personal/MyGH-Personal/HomeDash/specs/065-bin-collection-calendar/logs/03-phase-planning/security-run-1.log; find /Users/streetratz/Personal/MyGH-Personal/HomeDash/backend/tests /Users/streetratz/Personal/MyGH-Personal/HomeDash/frontend/tests/e2e -iname "*calendar*" -o -iname "*backup*" -o -iname "*public*" -o -iname "*birthday*"` | PASS (0) | [policy-run-1.log](03-phase-planning/policy-run-1.log) |

| 11 | `rg -n "access&#124;Access&#124;requireAuth&#124;userId&#124;groupIds" /Users/streetratz/Personal/MyGH-Personal/HomeDash/backend/src/api/user-dashboards.ts /Users/streetratz/Personal/MyGH-Personal/HomeDash/backend/src/api/app-widgets.ts /Users/streetratz/Personal/MyGH-Personal/HomeDash/backend/src/services/dashboardService.ts /Users/streetratz/Personal/MyGH-Personal/HomeDash/backend/src/lib/rbac.ts; cat /Users/streetratz/Personal/MyGH-Personal/HomeDash/frontend/src/hooks/useWidgetVisibility.ts; cat /Users/streetratz/Personal/MyGH-Personal/HomeDash/frontend/src/lib/apiClient.ts; cat /Users/streetratz/Personal/MyGH-Personal/HomeDash/.github/agents/copilot-instructions.md; rg -n "task_generation&#124;prerequisite" /Users/streetratz/Personal/MyGH-Personal/HomeDash/.specify /Users/streetratz/Personal/MyGH-Personal/HomeDash/.github/prompts/speckit.tasks.prompt.md` | PASS (0) | [access-run-1.log](03-phase-planning/access-run-1.log) |

| 12 | `ls /Users/streetratz/Personal/MyGH-Personal/HomeDash/backend/src/api; rg -n "access&#124;Access&#124;userId&#124;groupIds&#124;requireAuth" /Users/streetratz/Personal/MyGH-Personal/HomeDash/backend/src/api/dashboards.ts; rg -n "dashboardAccess&#124;can.*Dashboard&#124;resolve.*Dashboard&#124;access.*dashboard" /Users/streetratz/Personal/MyGH-Personal/HomeDash/backend/src; cat /Users/streetratz/Personal/MyGH-Personal/HomeDash/.github/prompts/speckit.tasks.prompt.md; sed -n "200,320p" /Users/streetratz/Personal/MyGH-Personal/HomeDash/frontend/src/pages/SettingsPage.tsx; sed -n "1,110p" /Users/streetratz/Personal/MyGH-Personal/HomeDash/backend/src/api/public.ts` | PASS (0) | [read-resolved-run-1.log](03-phase-planning/read-resolved-run-1.log) |

| 13 | `cat /Users/streetratz/Personal/MyGH-Personal/HomeDash/backend/src/services/dashboardSelection.ts; sed -n "1,200p" /Users/streetratz/Personal/MyGH-Personal/HomeDash/backend/src/api/user.ts; sed -n "1,160p" /Users/streetratz/Personal/MyGH-Personal/HomeDash/backend/src/api/adminDashboards.ts; rg -n "CalendarSourceList&#124;calendar&#124;Calendar" /Users/streetratz/Personal/MyGH-Personal/HomeDash/frontend/src/components/settings/IntegrationsTab.tsx; rg -n "task_generation&#124;prerequisite&#124;approval" /Users/streetratz/Personal/MyGH-Personal/HomeDash/.github/agents/speckit.tasks.agent.md; cat /Users/streetratz/Personal/MyGH-Personal/HomeDash/backend/src/lib/validation.ts &#124; tail -90` | PASS (0) | [authorization-run-1.log](03-phase-planning/authorization-run-1.log) |

| 14 | `rg -n "publicVisibility&#124;calendar&#124;isExplicitPublicWidgetType" /Users/streetratz/Personal/MyGH-Personal/HomeDash/backend/src/services/dashboardService.ts /Users/streetratz/Personal/MyGH-Personal/HomeDash/backend/src/lib/validation.ts /Users/streetratz/Personal/MyGH-Personal/HomeDash/frontend/src/state/widgetVisibility.ts; sed -n "1,125p" /Users/streetratz/Personal/MyGH-Personal/HomeDash/.github/agents/speckit.tasks.agent.md; sed -n "390,465p" /Users/streetratz/Personal/MyGH-Personal/HomeDash/specs/065-bin-collection-calendar/logs/03-phase-planning/projection-run-1.log; cat /Users/streetratz/Personal/MyGH-Personal/HomeDash/backend/src/auth/rateLimit.ts` | PASS (0) | [final-context-run-1.log](03-phase-planning/final-context-run-1.log) |

| 15 | `bash /Users/streetratz/Personal/MyGH-Personal/HomeDash/.specify/scripts/bash/update-agent-context.sh copilot` | PASS (0) | [agent-context-run-1.log](03-phase-planning/agent-context-run-1.log) |

| 16 | `bash /Users/streetratz/Personal/MyGH-Personal/HomeDash/.specify/scripts/bash/check-prerequisites.sh --json; git --no-pager diff --check; git --no-pager diff --stat; git --no-pager status --short; git --no-pager diff -- /Users/streetratz/Personal/MyGH-Personal/HomeDash/.github/agents/copilot-instructions.md /Users/streetratz/Personal/MyGH-Personal/HomeDash/.github/copilot-instructions.md; cat /Users/streetratz/Personal/MyGH-Personal/HomeDash/.specify/scripts/bash/setup-tasks.sh` | PASS (0) | [prerequisites-run-1.log](03-phase-planning/prerequisites-run-1.log) |

| 17 | `python3 /tmp/homedash-validate-plan.py` | FAIL (1) | [validate-run-1.log](03-phase-planning/validate-run-1.log) |

| 18 | `python3 /tmp/homedash-validate-plan.py` | PASS (0) | [validate-run-2.log](03-phase-planning/validate-run-2.log) |

| 19 | `python3 /tmp/homedash-validate-plan.py; cat /Users/streetratz/Personal/MyGH-Personal/HomeDash/.specify/extensions.yml` | PASS (0) | [final-check-run-1.log](03-phase-planning/final-check-run-1.log) |

## Run 1: Context and setup

Repository instructions, constitution, CH-02, specification, official-source
research, checklist and prior numbered phase logs reviewed. Tool reads are
read-only. Subsequent shell output is captured in this phase's sidecar folder.

## Design decisions

Completed standard plan, technical research appendix (original council provenance
preserved), data model, API/UI contracts and quickstart. Key decisions:

- Separate authoritative household/stream/date/exception state from provider
  events, with bounded read-only date generation and no sync/materialization.
- Monday-anchored signed N-week recurrence and independent no-phase-shift
  exceptions; validate all finite collisions, not only preview dates.
- Admin+CSRF aggregate preview/save, revision/runtime-epoch concurrency and
  immediate atomic transaction; no new settings permission bypass.
- Separate authenticated and selected-device-dashboard/widget public display
  DTOs; saved public subset defaults empty, no management metadata/catalogue.
- Household-date agenda window derived by server on first load; labelled
  collection Today/Tomorrow and scoped fullscreen preserve original providers.
- Additive generated migration, strict portable backup v2 with warned v1 full
  replacement and pre-delete semantic validation, prior-image+DB recovery.
- Existing Calendar/settings-only accessible icon-and-visible-name presentation.

No spec/changelog rewrite or CH-03 was needed. Application code remains untouched.
The standard required agent-context script added feature 065 technology/storage
entries and its Recent Changes entry to `.github/agents/copilot-instructions.md`,
pruning the oldest of that bounded Recent Changes list (012). It did not refresh
historical entries/header; its extraction also yielded `lucide-reac` from the
plan's trailing Markdown spacing. These are recorded generated metadata, not
authoritative dependency evidence; no manual inventory cleanup was performed.
The SPECKIT-marked relative pointer in `.github/copilot-instructions.md` now
references this plan. Existing `.specify/feature.json` change is preserved.

## Errors & Fixes

1. Combined feature-context read exceeded the inline output limit; the tool
   retained full output in a temporary file, reviewed in bounded ranges.
   No source artifact was changed or data lost.

2. Trace run 1 failed on guessed `api/calendar.ts`; discovery located and
   inspected `api/admin-calendar.ts`. Raw failure retained.
3. Security run 1 failed on guessed `dashboardAccessService.ts` and
   `.specify/workflows/task_generation.json`; actual routes/services and
   `.specify/workflows/speckit/workflow.yml` resolved the policy/workflow.
4. Composite probes sometimes exited zero after earlier missing-path stderr
   (`auth/middleware.ts`, `widget-data.ts`, widget-data services, `widgets.ts`,
   `user-dashboards.ts`, `app-widgets.ts`, `lib/rbac.ts`, `api/dashboards.ts`).
   Table PASS records overall shell exit only, not success of each subcommand.
   Actual authMiddleware/user/adminDashboards/dashboardSelection paths were
   read afterward; no nonexistent helper/ACL enforcement is assumed in design.
5. One API-contract patch failed matching context and made no change; corrected
   with a narrower patch. Plan/contracts now agree on server-derived agenda
   window versus explicit fullscreen date range.
6. Public primary-reference lookup attempts produced no usable evidence.
   Research appendix qualifies that limitation, relies on inspected local
   code/specification for decisions, and preserves original council provenance.
7. Planning validator run 1 incorrectly rejected intentional Markdown two-space
   hard line breaks. Corrected the temporary validator to allow precisely that
   Markdown syntax while still rejecting accidental whitespace; raw failure
   remains preserved and the corrected run is recorded below.

Command validate run 1 failed; raw output retained above. Resolution must be recorded.

## Phase Checkpoint

Design complete; corrected [validation run 2](03-phase-planning/validate-run-2.log)
passed artifact/section/relative-link checks, unresolved-placeholder checks,
changed-file boundary, Markdown-aware whitespace, raw audit headers/links,
independent civil-date/preset oracle and task prerequisite checks. This oracle
is a temporary design check, not a test of an implemented application engine.
Task prerequisite checker resolves all four companion document types.
No tasks, application tests/build/lint, migrations, commit, push or PR executed.
Constitution gates are design checks, not implementation proof or plan approval.
