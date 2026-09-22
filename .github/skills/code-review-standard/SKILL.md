---
name: code-review-standard
version: 1.0.0
description: Use when reviewing code, a pull/merge request, a branch diff, or a set of changed files for quality, correctness, security, and maintainability. The house code-review standard — high signal-to-noise, findings-first, severity-ranked, with a per-finding contract and explicit "what NOT to flag" rules. Use whenever the user asks for a code review, PR review, diff review, or "is this code good?". Pairs with the built-in security-review agent (deep security) and design-taste/emil-design-eng (UI/UX craft).
review_standard_version: 1.0
verified: 2026-06-28
---

# Code Review Standard

The house standard for reviewing code. The goal is **high signal-to-noise**: surface
issues that genuinely matter — bugs, security holes, logic errors, design flaws — and
stay silent on noise. A review that lists 30 nitpicks buries the one bug that matters.

> This skill is the *standard* (the judgment). For a deep, dedicated security pass,
> delegate to the built-in **`security-review`** agent. For UI/UX/visual quality, use
> **`design-taste`** / **`emil-design-eng`**. Don't reinvent those here.

## How to use this skill
1. **Detect scope** (don't guess):
   - If the user named files → review those.
   - Else inspect the **PR / branch diff** (`git diff`, the open PR, or the changes the
     user is staging). Review the diff first; open surrounding files only for context.
   - Only ask what to review if no reviewable scope exists at all.
2. **Understand context before judging:** language/version, framework, the project's own
   conventions (infer from neighbouring code), and what the change is *trying* to do.
   Review against the codebase's actual standards, not your personal defaults.
3. Review against the **dimensions** below, in priority order. See `CHECKLIST.md` for the
   itemised list.
4. Produce the **findings-first, severity-ranked report** (format below). Every finding
   follows the **per-finding contract**.
5. **Recommend only — do not modify code** unless the user explicitly asks for fixes.

## Review dimensions (priority order)
1. **Correctness** — logic errors, off-by-one, null/undefined, unhandled edge cases,
   race conditions, incorrect async/await, resource leaks, error handling that swallows
   or misroutes failures.
2. **Security** — injection (SQL/command/path), XSS/CSRF, authn/authz gaps, secrets in
   code, unsafe deserialization, SSRF, missing input validation. *For anything
   non-trivial, hand off to the `security-review` agent and cite its findings.*
3. **Data & state integrity** — mutation of shared state, transaction boundaries,
   idempotency, migration safety, backward compatibility of APIs/schemas.
4. **Performance** — N+1 queries, accidental quadratic loops, unbounded growth,
   missing indexes, needless re-computation/re-render. Flag only when it's a *real*
   risk at expected scale, not premature optimization.
5. **Maintainability & design** — responsibility boundaries, cohesion/coupling,
   unnecessary abstraction (and missing necessary ones), dead code, duplication that
   will drift, naming that misleads.
6. **Tests** — are the risky paths covered? Missing edge-case/error-path tests,
   over-mocking that tests nothing, hardcoded/flaky test data.
7. **Docs & contracts** — public API/exported types documented; README/docs updated to
   match behavior changes; changelog where relevant.

## Per-finding contract
Every finding MUST include:
- **Location** — `path:line-range` (or component/function).
- **Severity** — Critical / High / Medium / Low (see scale).
- **What** — one sentence: the problem.
- **Why it matters** — the concrete consequence if unfixed.
- **Fix** — a specific, actionable suggestion; a short code snippet when it clarifies.

## Severity scale
| Severity | Meaning | Examples |
|---|---|---|
| **Critical** 🔴 | Must fix now — crash, data loss, or exploitable vuln | Injection, unhandled exception on the happy path, auth bypass, data corruption |
| **High** 🟠 | Fix this iteration — clear defect | Resource leak, race condition, missing error handling on a real path, broken backward compat |
| **Medium** 🟡 | Should fix — hurts maintainability/perf | Over-long function, duplicated logic that will drift, N+1 query, missing test on risky path |
| **Low** 🔵 | Optional — minor improvement | Naming, clarifying comment, small simplification |

If unsure between two levels, pick the lower and say why — don't inflate severity.

## Output format
1. **Summary** — 1–3 sentences: what changed, overall risk, ship/hold recommendation.
2. **Findings** — grouped by severity (Critical → Low), each following the contract.
   This section leads the report.
3. **Strengths** — at least note what's done well (real, not filler). Builds trust and
   tells the author what to keep.
4. **Priority punch-list** — the top 3–5 highest-impact actions, ordered.
5. If **no significant issue** is found, say so plainly and name the residual risk or
   test gap rather than padding with trivia.

## What NOT to flag (signal discipline)
- **Style & formatting** — indentation, quote style, import order. That's the linter/
  formatter's job, not a human review. Mention only if there's no tooling and it's
  actively harming readability.
- **Pure taste / subjective rewrites** that don't change correctness or clarity.
- **Visual/UX design** — route that to `design-taste` / `emil-design-eng`.
- **Pre-existing issues unrelated to the change** — note briefly at most; don't expand
  the review scope uninvited.
- **Speculative "what if the requirements were different"** — review the code as it is
  against what it's meant to do.
- **Restating what the code obviously does** without identifying a problem.

A good review can be short. Three real findings beat thirty nitpicks.

## When to delegate
- Deep/comprehensive **security** audit → built-in **`security-review`** agent.
- **Design/UX** of a UI change → **`design-taste`**, **`emil-design-eng`**,
  **`review-animations`**.
- Sanity-checking a **plan or approach** (not written code yet) → **`rubber-duck`** agent.
- This skill stays focused on the correctness/maintainability review of actual code.
