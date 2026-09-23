# Release Lifecycle

How code moves from development to a deployed Docker image on your NAS.

---

## Pipeline Overview

```
Feature Branch ──PR──► main ──Promote──► release ──► GHCR ──► NAS (Watchtower)
                         │                  │
                         │    ┌─────────────┤
                         ▼    ▼             ▼
                     version sync      git tag vX.Y.Z
                     committed         GitHub Release created
                                       (auto-generated changelog)
```

---

## Branching Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Active development target. All PRs merge here (squash merge). |
| `release` | Production branch. Fast-forwarded from `main` during promotion. Triggers Docker build. |
| `NNN-feature-name` | Feature branches. Named after spec number (e.g. `025-ci-github-releases`). |

---

## Step-by-Step Lifecycle

### 1. Development

```bash
git checkout -b NNN-feature-name main
# ... implement ...
git push -u origin NNN-feature-name
gh pr create --base main
```

- Feature branches always branch from `main`
- PRs squash-merge into `main` (delete branch after merge)
- Never push directly to `main`
- Every PR increments only the README **Main Version** badge by one patch step
- `versions.json` is authoritative; use `pnpm version:bump-main` to update its
  `main` value and the README badge together
- Normal PRs do not change `package.json` or the **Release Version** badge
- After rebasing, use the latest Main badge value so concurrent PRs do not reuse a number

### 2. Promote to Release (Manual)

Triggered via **GitHub Actions → "Promote to Release" → Run workflow**.

The workflow performs these steps automatically:

| # | Step | Detail |
|---|------|--------|
| 1 | Pin candidate | Both jobs check out the exact `main` commit that triggered the workflow |
| 2 | Verify upgrade | Starts the pinned candidate on the current `release` database |
| 3 | Owner approval | The protected `release` environment requires owner approval |
| 4 | Revalidate main | Fails if `main` changed while approval was pending |
| 5 | Promote Main Version | Copies exact `versions.json.main` into `versions.json.release`, `package.json`, and the Release badge; Main remains unchanged |
| 6 | Commit to main | `release: vX.Y.Z` commit pushed to `main` |
| 7 | Fast-forward release | `release` branch moves to the same promoted commit |
| 8 | Create git tag | `vX.Y.Z` tag pushed to the repository |
| 9 | Create GitHub Release | Auto-generated changelog from merged PRs since last tag |
| 10 | Build and publish Docker image | Calls the reusable "Build & Push to GHCR" workflow once |

### 3. Docker Build & Push

Called only by Step 10 above after the promotion job completes. A branch push or
standalone manual action cannot build or publish an image independently.

The **Build & Push to GHCR** workflow:

1. Checks out `release` branch
2. Validates `versions.json`, the README badges, and `package.json`
3. Reads version from `package.json`
4. Builds multi-stage Docker image
5. Pushes to `ghcr.io/streetratz/homedash` with tags:
   - `:latest` — always points to newest build
   - `:X.Y.Z` — pinned semantic version
   - `:abc1234` — short commit SHA

### 4. Deployment (Watchtower)

- Watchtower polls GHCR on a schedule (default: daily at 3am)
- Detects updated `:latest` tag
- Pulls new image, recreates container with same volumes/env
- Zero-downtime for stateless services

---

## Tagging & Versioning

- Semantic versioning: `MAJOR.MINOR.PATCH`
- Git tags: `vX.Y.Z` (prefixed with `v`)
- Version source of truth: `versions.json`
- `versions.json.main` is the next release target
- `versions.json.release` is the current deployed release
- `package.json` and the README Release badge must mirror `versions.json.release`
- The README Main badge must mirror `versions.json.main`
- Tags are immutable — never delete or move a tag

Main Version is advanced by normal PRs. Promotion does not calculate another patch,
minor, or major increment: if Main is `3.4.5`, the resulting package, tag, GitHub
Release, and image version are all exactly `3.4.5`.

---

## GitHub Releases

Each promotion creates a GitHub Release at:
`https://github.com/streetratz/HomeDash/releases/tag/vX.Y.Z`

The release includes:
- **Auto-generated changelog** — lists merged PRs since previous tag
- **Tag reference** — points to the exact promoted commit
- **Source archives** — auto-attached `.zip` and `.tar.gz`

---

## Workflow Files

| File | Trigger | Purpose |
|------|---------|---------|
| `.github/workflows/promote-release.yml` | Manual (`workflow_dispatch`) | Version bump + tag + release + invoke build |
| `.github/workflows/docker-publish.yml` | Reusable call from promotion | Build Docker image and push to GHCR |

---

## Rollback

To roll back to a previous version:

```bash
# On your NAS / Docker host:
docker pull ghcr.io/streetratz/homedash:1.2.3   # specific older version
docker-compose down && docker-compose up -d
```

Or pin the image tag in `docker-compose.yml`:
```yaml
image: ghcr.io/streetratz/homedash:1.2.3  # instead of :latest
```

---

## Quick Reference

```bash
# Check current version
cat versions.json

# Advance Main for a normal PR
pnpm version:bump-main

# List existing tags
git tag --sort=-v:refname | head -10

# View releases
gh release list

# Manually trigger promote (from CLI)
gh workflow run "Promote to Release"
```
