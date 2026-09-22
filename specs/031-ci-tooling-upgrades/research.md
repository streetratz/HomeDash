# Research: CI & Tooling Upgrades

## Phase 0 — Resolved Questions

### R-01: GitHub Actions Node.js 24 Compatible Versions

**Decision**: Upgrade to latest Node.js 24-compatible versions for all actions.

**Rationale**: GitHub is deprecating Node.js 20 runners (deadline: June 2, 2026). All actions must use versions built on Node.js 24 to avoid deprecation warnings and eventual failure.

**Version Matrix**:

| Action | Current | Target | Node.js 24 Support |
|--------|---------|--------|-------------------|
| actions/checkout | v4 | v6.0.2 | ✅ Yes |
| actions/setup-node | v4 | v6.4.0 | ✅ Yes |
| docker/build-push-action | v6 | v7.1.0 | ✅ Yes |
| docker/login-action | v3 | v4.1.0 | ✅ Yes |
| docker/metadata-action | v5 | v6.0.0 | ✅ Yes |
| docker/setup-buildx-action | v3 | v4.0.0 | ✅ Yes |

**Alternatives Considered**:
- Pin to SHA instead of major tag: Rejected — tags are standard practice and auto-receive patch fixes
- Stay on current versions with deprecation warnings: Rejected — hard deadline exists

---

### R-02: pnpm 8 → 11 Migration Path

**Decision**: Upgrade directly from pnpm 8.15.9 to pnpm 11 (latest stable).

**Rationale**: pnpm 8 is three major versions behind. Jumping directly is safe because:
1. The project has a simple workspace structure (backend + frontend)
2. No exotic pnpm features are used (no patching, no catalog)
3. Lockfile regeneration handles format changes automatically

**Breaking Changes Reviewed**:

| pnpm Version | Breaking Change | Impact on HomeDash |
|--------------|----------------|-------------------|
| pnpm 9 | Lockfile v9 format | Auto-migrated on `pnpm install` |
| pnpm 9 | `auto-install-peers` default true | Already compatible — no conflicting peer deps |
| pnpm 9 | Dropped Node.js 16 support | N/A — project uses Node.js 22 |
| pnpm 10 | `node-linker=hoisted` no longer default | May need `.npmrc` if packages expect hoisting |
| pnpm 10 | Lockfile v10 format | Auto-migrated |
| pnpm 11 | Lockfile v11 format | Auto-migrated |
| pnpm 11 | `resolve-peers-from-workspace-root` default true | Compatible with monorepo structure |

**Migration Steps**:
1. Add `"packageManager": "pnpm@11.x.x"` to root `package.json`
2. Update `deploy/Dockerfile` — change `corepack prepare pnpm@8 --activate` to `corepack prepare pnpm@11.x.x --activate`
3. Delete `pnpm-lock.yaml` and regenerate with `pnpm install`
4. Verify `pnpm build` succeeds across workspace
5. If hoisting issues arise, add `node-linker=hoisted` to `.npmrc`

**Alternatives Considered**:
- Incremental upgrade (8→9→10→11): Rejected — unnecessary complexity; direct jump is well-supported
- Stay on pnpm 8: Rejected — accumulates tech debt and misses security patches

---

### R-03: TS4111 Error Resolution Pattern

**Decision**: Convert dot notation property access to bracket notation on `Record<string, unknown>` typed response bodies.

**Rationale**: TypeScript's `noPropertyAccessFromIndexSignature` (TS4111) enforces bracket notation for index signature types. The test responses are typed as `Record<string, unknown>`, so `res.body.field` must become `res.body['field']`.

**Affected Files**:
- `backend/tests/integration/backup.test.ts`
- `backend/tests/integration/restore.test.ts`
- `backend/tests/integration/restorePreview.test.ts`

**Pattern**:
```typescript
// Before (TS4111 error):
expect(res.body.summary).toHaveProperty('users');

// After (fixed):
expect(res.body['summary']).toHaveProperty('users');
```

**Alternatives Considered**:
- Disable `noPropertyAccessFromIndexSignature` in tsconfig: Rejected — weakens type safety project-wide
- Add type assertions to responses: Rejected — more invasive; bracket notation is simpler and preserves type checking
- Fix only in the three identified files: Accepted — spec scopes to these files; other test files may need separate treatment

---

### R-04: Docker Action Input/Output Compatibility

**Decision**: No input/output schema changes affect HomeDash workflows.

**Rationale**: Reviewed release notes for all Docker-prefixed actions:
- `docker/build-push-action@v7`: No breaking input changes; `context`, `file`, `platforms`, `push`, `tags`, `labels`, `build-args`, `cache-from`, `cache-to` all preserved
- `docker/login-action@v4`: Same inputs (`registry`, `username`, `password`)
- `docker/metadata-action@v6`: Same inputs (`images`, `tags`); output `tags` and `labels` unchanged
- `docker/setup-buildx-action@v4`: No required inputs in our workflow; still sets up buildx

**Alternatives Considered**: None needed — full backward compatibility confirmed.
