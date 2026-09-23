---
name: lint-gate
version: 1.0.0
description: Use before declaring HomeDash changes ready, committing them, opening a pull request, or merging a pull request. Runs the repository's full local ESLint gate with zero warnings allowed and blocks completion when lint fails.
verified: 2026-09-18
---

# HomeDash Local Lint Gate

This skill is the local replacement for a merge-blocking GitHub branch-protection
check. It verifies the complete repository with the same authoritative command used by
the pull-request workflow.

## When to use

Invoke this skill:

- after code changes are complete;
- before creating a commit or pull request;
- after resolving merge or rebase conflicts;
- immediately before merging a pull request;
- whenever the user asks to lint, validate, or check code quality.

## Required command

Run from the repository root:

```bash
PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH" pnpm lint
```

This executes the root script:

```bash
eslint . --max-warnings=0
```

Always run the full repository command. Do not replace it with a package-filtered,
changed-files-only, editor, or IDE lint check.

## Gate behavior

1. Confirm the command runs under Node 24.
2. Run `pnpm lint` once after the final edits.
3. If it exits zero, report the gate as passed.
4. If it fails:
   - report that the change is not ready;
   - identify the rule, file, and line for each actionable finding;
   - fix findings caused by the current change;
   - do not hide findings with broad disables, warning downgrades, ignored paths, or
     `--no-verify`;
   - rerun the full command after fixes.
5. Do not run `pnpm lint:fix` unless the user requests automatic fixes or the changes
   are understood and will be reviewed afterward.

## Completion rule

Never claim that code is ready, reviewed, safe to merge, or complete while this gate is
failing. A successful earlier run does not count after subsequent code edits, rebases,
or conflict resolution.

## Report format

On success:

> **Lint gate: passed** — `pnpm lint` completed with zero errors and zero warnings.

On failure:

> **Lint gate: failed** — `<count>` finding(s) must be resolved before this change is
> ready.

Then list only the actionable ESLint findings. Do not dilute the result with unrelated
build, test, or formatting output.
