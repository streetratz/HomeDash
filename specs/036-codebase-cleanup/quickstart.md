# Quickstart — Codebase Health Cleanup

## Prerequisites

- Node.js ≥ 22.x
- pnpm (workspace-aware)
- Git on branch `036-codebase-cleanup`

## Verification Commands

### After Phase 1 (SSRF Fix)

```bash
# Run backend typecheck (should pass with new url-validator.ts)
cd backend && pnpm typecheck

# Run url-validator unit tests
cd backend && pnpm test:unit -- --grep "url-validator"

# Manual SSRF test (should be rejected)
curl -v "http://localhost:3001/api/sonos/art/fakehash?src=$(echo -n 'http://169.254.169.254/latest/meta-data' | base64)"
# Expected: 403 Forbidden
```

### After Phase 2 (Type Fix)

```bash
# Backend typecheck must pass cleanly
cd backend && pnpm typecheck

# Full backend test suite
cd backend && pnpm test
```

### After Phase 3 (Dependency Removal)

```bash
# Reinstall with removed packages
pnpm install

# Build both workspaces
cd frontend && pnpm build
cd ../backend && pnpm build

# Verify ClockStrip renders (E2E or visual check)
cd frontend && pnpm test:e2e
```

### After Phase 4 (Dead Code Removal)

```bash
# Full build (catches broken imports)
cd frontend && pnpm build
cd ../backend && pnpm build

# Full test suite
pnpm --filter frontend test
pnpm --filter backend test
```

### Full Verification (all phases complete)

```bash
# From repo root
pnpm install
pnpm --filter backend typecheck
pnpm --filter frontend typecheck
pnpm --filter backend test
pnpm --filter frontend test
pnpm --filter frontend build
pnpm --filter backend build
```

## Key Files Modified

| Phase | File | Change |
|-------|------|--------|
| 1 | `backend/src/lib/url-validator.ts` | NEW — URL validation + IP blocking |
| 1 | `backend/src/services/artCacheService.ts` | Add size limit + content-type check |
| 1 | `backend/src/api/sonos.ts` | Add hash verify + URL validation before fetch |
| 1 | `backend/tests/unit/url-validator.test.ts` | NEW — unit tests for SSRF blocking |
| 2 | `backend/src/services/unifi-service.ts` | Fix Response type to UndiciResponse |
| 3 | `frontend/package.json` | Remove FA, next-themes, coverage-v8, radix-tooltip |
| 3 | `backend/package.json` | Remove @fastify/csrf-protection, @types/sharp |
| 3 | `frontend/src/components/ClockStrip.tsx` | Replace FA icons with lucide-react |
| 4 | `frontend/src/components/calendar/MiniCalendarView.tsx` | DELETE |
| 4 | `frontend/src/components/calendar/DayDetailPanel.tsx` | DELETE |
| 4 | `frontend/src/components/calendar/EventCard.tsx` | DELETE |
| 4 | `frontend/src/components/ui/progress-bar.tsx` | DELETE |
| 4 | `frontend/src/components/ui/status-dot.tsx` | DELETE |
| 4 | `frontend/src/components/ui/tooltip.tsx` | DELETE |
