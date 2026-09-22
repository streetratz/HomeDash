# Implementation Plan: Exact Main Version Promotion

**Branch**: `058-release-version-promotion` | **Date**: 2026-09-20 | **Spec**: [spec.md](./spec.md)

## Summary

Add an authoritative `versions.json` and replace promotion-time SemVer calculation
with a tested repository script that validates every mirror, updates only the intended
track, and returns exact Main Version to the existing tag/release/image flow.

## Constitution Check

| Gate | Assessment |
| --- | --- |
| Security | Workflow retains least-privilege `contents: write` and `actions: write`; no new secrets or external services. |
| Input validation | Stable SemVer, badge uniqueness, forward progress, package/badge agreement, and tag uniqueness are enforced before push. |
| Operations | Release tags remain immutable; the mistaken `v3.2.1` remains historical and the corrected release advances to `v3.2.6`. |
| Testing | Pure Node tests cover promotion and failure cases; PR checks run them automatically. |
| Compatibility | Docker publishing still reads `package.json`; only target selection changes. |

**Result**: PASS.

## Design

`scripts/version-state.mjs` is the single version-state parser/updater. It reads:

- `versions.json.main` as the requested release;
- `versions.json.release` as the current deployed version;
- `package.json` and both README badges as consistency mirrors.

It provides:

- `bump-main` for normal PRs;
- `validate-pr` to prove Main advanced and Release did not change;
- `promote` to copy Main into all release-owned surfaces;
- `validate` for local consistency checks.

The workflow records the actual previous tag before creating the new one, uses it for
comparison links, rejects an existing target tag, and no longer accepts a bump input.

## Validation

- `pnpm test:release-version`
- `pnpm lint`
- workflow YAML inspection
- mandatory code review and upgrade gate before PR

## Rollback

Revert the workflow, script, tests, and documentation before a promotion. Existing
release tags remain unchanged.
