# 01 — Specification and Official-Source Research

[← Back to Logs Index](readme.md)

## Table of Contents

- [Overview](#overview)
- [Commands Run](#commands-run)
- [Run 1: Branch hook](#run-1-branch-hook)
- [Run 2: Calendar context](#run-2-calendar-context)
- [Run 3: Specification validation](#run-3-specification-validation)
- [Run 4: Lint gate](#run-4-lint-gate)
- [Run 5: Issue preservation](#run-5-issue-preservation)
- [Research and policy review](#research-and-policy-review)
- [Errors & Fixes](#errors--fixes)
- [Phase Checkpoint](#phase-checkpoint)

## Overview

**Phase**: 01 — Specification  
**Task range**: Specification only; implementation tasks not generated  
**Date/Time**: 2026-10-10 10:29 UTC+11 (session start)  
**Purpose**: Specify issue #19 using official AU/NZ council evidence, preserve
international scheduling requirements, and validate constitution conformity.

Initial checks found a clean `main` at
`c5bd8a1102cd2e7a1d22cbea93b68614be5903a5`; GitHub's main branch matched.
Local operating policy was read before network access; private machine-specific
details are intentionally excluded from these audit artifacts.

## Commands Run

| # | Command | Outcome | Log File |
| --- | --- | --- | --- |
| 1 | `git rev-parse --is-inside-work-tree; test "$(git branch --show-current)" = main && test -z "$(git status --porcelain)" && test "$(git rev-parse HEAD)" = c5bd8a1102cd2e7a1d22cbea93b68614be5903a5 && bash .specify/extensions/git/scripts/bash/create-new-feature.sh --json --short-name "bin-collection-calendar" "GitHub issue 19 Calendar Track recurring bin collection days with researched AU NZ preset and independently customisable local schedules"; git --no-pager status --short --branch; git rev-parse HEAD` | PASS; branch created once | [git-run-1.log](01-phase-specification/git-run-1.log) |
| 2 | `bash -c` calendar context inspection; complete exact command in sidecar header | Reads succeeded; initial banner error recorded below | [context-run-1.log](01-phase-specification/context-run-1.log) |
| 3 | `bash -c` corrected banner/status/ignore check; complete exact command in sidecar header | PASS | [context-run-2.log](01-phase-specification/context-run-2.log) |
| 4 | `python3 /tmp/homedash-bin-spec-audit.py validate --inner` | FAIL: validator incorrectly omitted the required feature pointer from permitted changes | [spec-validator-run-1.log](01-phase-specification/spec-validator-run-1.log) |
| 5 | `bash -c 'PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH" node --version'` | PASS; v24.18.0 | [node-run-1.log](01-phase-specification/node-run-1.log) |
| 6 | `bash -c 'PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH" pnpm lint'` | PASS; zero errors/warnings | [eslint-run-1.log](01-phase-specification/eslint-run-1.log) |
| 7 | `gh issue view 19 --repo streetratz/HomeDash --json number,title,body,labels,url,state` | PASS; body baseline retained | [gh-issue-run-1.log](01-phase-specification/gh-issue-run-1.log) |
| 8 | `python3 /tmp/homedash-bin-spec-audit.py validate --inner` | PASS after helper allowlist correction | [spec-validator-run-2.log](01-phase-specification/spec-validator-run-2.log) |
| 9 | `gh issue comment 19 --repo streetratz/HomeDash --body <local-spec tracking note>`; exact body in sidecar header | PASS; explicitly local/uncommitted/unpushed | [gh-comment-run-1.log](01-phase-specification/gh-comment-run-1.log) |
| 10 | `gh issue view 19 --repo streetratz/HomeDash --json number,title,body,labels,url,state` | PASS; body, labels, title, state unchanged against baseline | [gh-issue-run-2.log](01-phase-specification/gh-issue-run-2.log) |
| 11 | `python3 /tmp/homedash-bin-spec-audit.py final-check --inner` | FAIL: helper assumed command metadata occupies exactly one line | [final-check-run-1.log](01-phase-specification/final-check-run-1.log) |
| 12 | `python3 /tmp/homedash-bin-spec-audit.py final-check --inner` | PASS; structural/fixture/audit/whitespace checks and docs-only git inspection | [final-check-run-2.log](01-phase-specification/final-check-run-2.log) |
| 13 | `python3 /tmp/homedash-bin-spec-audit.py final-check --inner` | PASS after final research-range correction and checkpoint/index completion | [final-check-run-3.log](01-phase-specification/final-check-run-3.log) |

## Run 1: Branch hook

The enabled mandatory `before_specify` hook was executed directly, without
delegation. It returned `BRANCH_NAME=065-bin-collection-calendar` and
`FEATURE_NUM=065`. The core specify command independently scanned existing spec
directories (highest sequential prefix: 064), created
`specs/065-bin-collection-calendar/`, and copied the repository spec template.
The branch hook did not create the spec directory.

## Run 2: Calendar Context

Read existing Calendar agenda/fullscreen selection, event types, date-only helper,
and public-widget policy. No code was edited. These establish behavioural reuse
opportunities, not a chosen implementation. In particular, independent stream
colour and confirmed-household relative dates still need planning assessment.
The required core feature pointer is tracked in this repository.

## Run 3: Specification Validation

Direct semantic review found all 16 quality items satisfied. The first structural
validator run confirmed section order, FR/SC IDs, scenarios, fixture coverage,
links, CH-01, branch/base, and bounded scope, then failed its allowlist because
`.specify/feature.json` was absent from the helper's permitted changed paths.
This is a validation-helper defect, not an unrelated repository change.
The helper was corrected; run 2 passed all structural, link, branch/base, scope,
sidecar-header, and written-date-fixture checks. The helper resides temporarily outside
the repository and is not application code or an implementation deliverable.

## Run 4: Lint Gate

Loaded the repository lint-gate skill. Confirmed Node v24.18.0 and ran the full
`pnpm lint` command once. It completed with zero errors and zero warnings.
No automatic fixes were run. No app tests/builds were needed for this docs-only
phase; no implementation, E2E, migration, or user-study result is claimed.

## Run 5: Issue Preservation

Retrieved issue #19 through `gh` under `streetratz/HomeDash`; title/state/labels
and all existing research remain intact. Before any optional tracking comment,
the issue body SHA-256 is:
`a4b036d75048820fd6ee93cb4ee8a247abbdb77fb66455033804940d1c44b3a2`.

After files persisted and validation passed, added a tracking comment identifying
the local branch/spec, draft boundaries, and no commit/push/PR. The comment URL is
https://github.com/streetratz/HomeDash/issues/19#issuecomment-6091113564.
Fetched the issue again and confirmed byte-for-byte body equality plus unchanged
labels/title/state and the same SHA-256. No dependency issue/PR was acted upon.

## Research and Policy Review

Read the root instructions, constitution 2.4.0, release lifecycle, branch hook,
spec/checklist templates, and existing calendar feature specifications.
Retrieved current issue #19 using `gh` against `streetratz/HomeDash`.
Council-source research is documented in [research.md](../research.md), including
three opened AU council examples, three principal NZ examples, supplementary
findings, international sources, evidence-to-requirement mapping, and retrieval
limits. Dunedin's 2026 zone calendars were visually inspected. No private
repository content was sent to public research services.
The six principal source URLs were reopened before final reporting to retain
verifiable citations. Final Auckland PDF text lists July 2025–June 2026 rather
than only the initially examined November–April portion; corrected the companion
research's partial-range wording. Its historical status and all scheduling
findings remain unchanged, so no specification edit or CH-02 was necessary.
Some final `web.run` find/open calls also returned retrieval errors; the earlier
opened primary evidence and accessible Wollongong/Dunedin PDF content remain the
basis of the findings, not a claimed successful response from those failed calls.

Created the template-derived spec, CH-01, quality checklist and
[constitution check](../constitution-check.md). No plan/tasks were generated,
and no Main Version or app files were changed. Draft scope limits are explicitly
distinguished from owner-confirmed preset requirements.

## Errors & Fixes

1. **Oversized read responses**: Combined reads exceeded the tool's inline limit.
   Read their saved output in bounded ranges; no repository data was lost.
2. **Context banner**: Shell `printf` interpreted a leading `---` as options.
   The file reads continued, so the composite exit code was zero despite the
   stderr warning. Fixed subsequent banners using `printf '%s\n'`; the focused
   rerun passed. The original raw stderr is preserved.
3. **Research fetch failures**: Brisbane PDF, Bega Valley and Seattle page opens
   failed; Auckland PDF screenshot was restricted; Christchurch production page
   retrieval was inconsistent. Root cause is retrieval/access limitation, not
   disproven council policy. Used other accessible primary evidence and explicitly
   labelled indexed/partial/historical findings; details are in research.md.
4. **Validator allowlist**: Run 1 mistakenly treated the core-required tracked
   `.specify/feature.json` update as unrelated. Corrected the session-local helper
   to allow only that pointer plus this feature directory; run 2 passed. No spec
   change was necessary, so CH-01 remains the only spec-edit entry.
5. **Documentation patch context**: One multi-file patch updated the temporary
   helper but could not match a stray final context line in the phase Markdown.
   The tool reported the partial application. Inspected the Markdown (unchanged)
   and retried only its remaining hunks; no existing work was overwritten.
6. **Multiline command header**: Final-check run 1 rejected the comment sidecar
   because the exact `gh --body` argument contains newlines. All required metadata
   and the original raw output are present. Changed only the temporary validator
   to locate ordered phase/run/time/exit fields after a possibly multiline command.
   Preserved the original sidecar and failed run; did not repeat the issue comment.
   Final-check run 2 passed after this correction.

## Phase Checkpoint

**Complete — specification phase only.** Four independently testable stories,
23 functional requirements, eight measurable success criteria, and 16/16 quality
checklist items are complete. CH-01 and constitution/threat-model/research
companions are present. Structural/date-fixture/link/header checks passed, full
root lint passed with zero errors/warnings, and `git diff --check` passed.
The final audit confirms changes are limited to this feature's artifacts and the
core feature pointer. HEAD remains the verified main base on the single requested
feature branch. The successful run's sidecar is linked above after capture.

No blocking clarification markers remain. Calendar-only, single-household and
manual-entry boundaries are revisable draft defaults, explicitly not owner
confirmation. Historical/fetch-limited sources are qualified, not hidden blockers.
Issue #19's body/research remains unchanged; its tracking comment states local
uncommitted/unpushed status. No implementation plan/tasks, app code, application
tests, version bump, dependency PR actions, commit, push, or PR were produced.
Ready for `/speckit.plan` only when the owner requests the next phase. The optional
commit after-hook is offered, not executed.
