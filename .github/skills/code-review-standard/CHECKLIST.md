# Code Review Checklist

The itemised pass behind `code-review-standard`. Work top-down; the order is the
priority order. Not every item applies to every change — use judgment, skip what's
irrelevant, and never pad the report to "cover" the list.

## 1. Correctness
- [ ] Logic does what the change intends; no inverted conditions or off-by-one.
- [ ] Null / undefined / empty / zero / negative inputs handled.
- [ ] Boundary conditions (first/last, empty collection, max size) handled.
- [ ] Errors are caught at the right level — not swallowed, not over-broad, not leaking.
- [ ] `async`/`await` correct: no unawaited promises, no missing error propagation,
      no accidental serial-where-parallel (or vice versa).
- [ ] No race conditions on shared/mutable state; concurrency assumptions are safe.
- [ ] Resources released (files, handles, connections, listeners, timers, subscriptions).
- [ ] Return values and early-exits are consistent across all paths.

## 2. Security  (deep pass → `security-review` agent)
- [ ] No injection: SQL/NoSQL, OS command, path traversal, template injection.
- [ ] Output encoded / escaped for its sink (HTML/JS/SQL) — XSS guarded.
- [ ] AuthN/AuthZ enforced on every new entry point; no missing permission checks.
- [ ] No secrets, tokens, or credentials committed in code or config.
- [ ] Untrusted input validated and bounded before use.
- [ ] No unsafe deserialization; no SSRF via user-controlled URLs.
- [ ] Sensitive data not logged.

## 3. Data & state integrity
- [ ] Shared/global state not mutated unexpectedly.
- [ ] Transaction boundaries correct; partial failures don't corrupt state.
- [ ] Operations are idempotent where they need to be (retries, webhooks, queues).
- [ ] Schema/migration changes are backward compatible (or coordinated); reversible.
- [ ] API contract changes are backward compatible or versioned.

## 4. Performance (only flag real risk at expected scale)
- [ ] No N+1 queries / per-iteration I/O that should be batched.
- [ ] No accidental quadratic (or worse) loops on large inputs.
- [ ] No unbounded memory growth / missing pagination / missing limits.
- [ ] Expensive work isn't repeated (memoize / hoist where it clearly matters).
- [ ] Frontend: no needless re-renders, no heavy work on the render path.

## 5. Maintainability & design
- [ ] Each unit has a single clear responsibility (high cohesion).
- [ ] Low coupling: change doesn't reach across boundaries it shouldn't.
- [ ] No unnecessary abstraction (premature interfaces/layers) — and no missing one
      where duplication is about to drift.
- [ ] Names tell the truth about what things are/do; no misleading names.
- [ ] No dead code, commented-out blocks, or leftover debug logging.
- [ ] Duplication that will diverge is factored; trivial duplication left alone.
- [ ] Public/exported types are well-designed (especially TypeScript: avoid `any`,
      model the domain, make illegal states unrepresentable where practical).

## 6. Tests
- [ ] Risky and changed paths have tests; not just the happy path.
- [ ] Edge cases and error paths are covered.
- [ ] Tests assert behavior, not implementation; mocking isn't hiding the real logic.
- [ ] No hardcoded/time-dependent/order-dependent flakiness.

## 7. Docs & contracts
- [ ] Public API / exported symbols documented where non-obvious.
- [ ] README / docs / examples updated to match behavior changes.
- [ ] Changelog / release notes updated if the project tracks them.
- [ ] Config/env changes documented.

## Red flags (escalate severity if seen)
- A `catch` block that's empty or only logs and continues on a critical path.
- Auth/permission check that was present and is now removed or weakened.
- A migration with no rollback / that locks a large table.
- New external input that flows into a query/command/path without validation.
- A "small" change that alters a public API or serialized format silently.
- Disabled/skipped tests added alongside the change.
