# Quickstart: CI & Tooling Upgrades

## Prerequisites

- Node.js 22+
- corepack enabled (`corepack enable`)
- Docker (for Dockerfile verification)
- GitHub CLI (`gh`) for workflow dispatch testing

## Verification Commands

### After Commit 1 (Actions Upgrade)

```bash
# Validate workflow YAML syntax
gh workflow list
# or use actionlint locally:
# npx actionlint .github/workflows/docker-publish.yml
# npx actionlint .github/workflows/promote-release.yml

# Trigger a test run (on feature branch, workflow_dispatch only for promote-release)
gh workflow run "Build & Push to GHCR" --ref 031-ci-tooling-upgrades
```

### After Commit 2 (pnpm Upgrade)

```bash
# Activate new pnpm version via corepack
corepack prepare

# Verify pnpm version
pnpm --version  # Should output 11.x.x

# Clean install from regenerated lockfile
rm -rf node_modules
pnpm install

# Full workspace build
pnpm build

# Verify Docker build still works
docker build -f deploy/Dockerfile -t homedash:test .
docker run --rm homedash:test node -e "console.log('OK')"
```

### After Commit 3 (TS4111 Fixes)

```bash
# Type-check — should report zero TS4111 errors
cd backend && npx tsc --noEmit

# Run affected integration tests
pnpm --filter backend exec vitest run tests/integration/backup.test.ts
pnpm --filter backend exec vitest run tests/integration/restore.test.ts
pnpm --filter backend exec vitest run tests/integration/restorePreview.test.ts
```

### Full Validation (all commits applied)

```bash
# Complete CI simulation
pnpm install
pnpm build
cd backend && npx tsc --noEmit
pnpm --filter backend exec vitest run tests/integration/
```

## Rollback

Each commit is independent and can be reverted individually:

```bash
# Revert actions upgrade only
git revert <commit-1-sha>

# Revert pnpm upgrade (will need lockfile regeneration with pnpm 8)
git revert <commit-2-sha>
rm pnpm-lock.yaml && pnpm install

# Revert TS4111 fixes (re-introduces type errors)
git revert <commit-3-sha>
```
