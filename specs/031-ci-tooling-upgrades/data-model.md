# Data Model: CI & Tooling Upgrades

This feature modifies configuration files and test code only. No database entities, API schemas, or persistent data models are introduced or changed.

## Change Matrix

### Commit 1: GitHub Actions Node.js 24 Upgrade

| File | Change Type | Details |
|------|-------------|---------|
| `.github/workflows/docker-publish.yml` | Version bump | 4 action `uses:` references updated |
| `.github/workflows/promote-release.yml` | Version bump | 2 action `uses:` references updated |

**Action Reference Changes (docker-publish.yml)**:

| Line | Current | Target |
|------|---------|--------|
| `actions/checkout` | `@v4` | `@v6` |
| `docker/setup-buildx-action` | `@v3` | `@v4` |
| `docker/login-action` | `@v3` | `@v4` |
| `docker/metadata-action` | `@v5` | `@v6` |
| `docker/build-push-action` | `@v6` | `@v7` |

**Action Reference Changes (promote-release.yml)**:

| Line | Current | Target |
|------|---------|--------|
| `actions/checkout` | `@v4` | `@v6` |
| `actions/setup-node` | `@v4` | `@v6` |

---

### Commit 2: pnpm 8 → 11 Upgrade

| File | Change Type | Details |
|------|-------------|---------|
| `package.json` | Add field | `"packageManager": "pnpm@11.x.x"` |
| `deploy/Dockerfile` | Version string | `corepack prepare pnpm@8` → `corepack prepare pnpm@11.x.x` (lines 8, 37) |
| `pnpm-lock.yaml` | Regenerate | Full lockfile regeneration for pnpm 11 format |

**Dockerfile Change Points**:
- Line 8 (build stage): `RUN corepack enable && corepack prepare pnpm@8 --activate`
- Line 37 (production stage): `RUN corepack enable && corepack prepare pnpm@11.x.x --activate`

---

### Commit 3: TS4111 Test Fixes

| File | Change Type | Details |
|------|-------------|---------|
| `backend/tests/integration/backup.test.ts` | Syntax fix | Dot notation → bracket notation |
| `backend/tests/integration/restore.test.ts` | Syntax fix | Dot notation → bracket notation |
| `backend/tests/integration/restorePreview.test.ts` | Syntax fix | Dot notation → bracket notation |

**Pattern Applied**:
```typescript
// TS4111: Property 'X' comes from an index signature, use ['X'] to access it
res.body.field     →  res.body['field']
res.body.nested    →  res.body['nested']
```

## State Transitions

N/A — no stateful entities introduced.

## Validation Rules

| Validation | Scope | Enforcement |
|-----------|-------|-------------|
| Action versions resolve to Node.js 24 runtime | CI workflows | GitHub Actions runner validates on execution |
| pnpm version matches between package.json and Dockerfile | Build pipeline | `corepack prepare` will fail on mismatch |
| Lockfile format compatible with declared pnpm version | Install step | `pnpm install --frozen-lockfile` validates in CI |
| Zero TS4111 errors | Type-check gate | `tsc --noEmit` must exit 0 |
