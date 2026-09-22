---
name: pre-pr-upgrade-gate
version: 1.0.0
description: Use before opening or merging a HomeDash pull request. Proves that the candidate Docker image can start on a database created by main without losing existing configuration.
verified: 2026-09-19
---

# HomeDash Pre-PR Upgrade Gate

This gate catches migration and startup regressions that unit tests cannot: the
candidate image must successfully upgrade a real database created by `main`.

## When to use

Invoke this skill:

- after final code and migration changes;
- before creating a pull request;
- after the final rebase or conflict resolution;
- immediately before merging a pull request.

## Required command

Run from the repository root:

```bash
pnpm test:upgrade
```

For persistence, migration, backup/restore, or configuration changes, use a
representative portable backup when one is available:

```bash
bash .github/skills/pre-pr-upgrade-gate/run.sh \
  --backup /absolute/path/to/homedash-backup.json
```

The backup is sent only to local containers and is never copied into the repository.

## What the gate proves

1. Builds the committed `main` Docker image and the current worktree image.
2. Starts `main` on a new isolated Docker volume and completes first-run setup.
3. Optionally restores a portable backup through the supported API.
4. Records the baseline schema columns, normalized row counts, and content hashes.
5. Starts the candidate image on the same volume so its real startup migrations run.
6. Requires:
   - a healthy candidate container;
   - no lost baseline table or column;
   - identical normalized data for every pre-existing column;
   - zero `PRAGMA foreign_key_check` violations;
   - a non-decreasing migration count;
   - the original bootstrap administrator can still sign in.
7. Removes its temporary containers, volume, images, and local files.

Volatile `last_*` and `next_*` fields are excluded from hash comparison because
background schedulers may update them during startup.

## Gate behavior

- A non-zero exit blocks the PR or merge.
- Never bypass a failure by deleting the affected table from the comparison.
- Intentional data transformations require a feature-specific migration assertion and
  an update to this gate; document the expected before/after values.
- If `--backup` fails on the baseline image, the backup/restore compatibility problem
  must be fixed or explicitly validated with a feature-specific upgrade test before the
  PR can proceed.

## Report format

On success:

> **Upgrade gate: passed** — the candidate image upgraded the `main` database with
> identical pre-existing configuration data and zero foreign-key violations.

On failure:

> **Upgrade gate: failed** — the pull request is blocked by a migration, startup,
> authentication, or data-preservation regression.
