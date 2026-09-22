# Quickstart — Fixed Page Width

## What This Feature Does

Constrains the dashboard grid to a fixed maximum width (1200px) on desktop viewports, preventing widgets from squishing/stretching when the browser is resized. The grid is horizontally centred when the viewport exceeds the max width. Mobile behaviour is unchanged.

## Prerequisites

- Node.js ≥22.13.0
- pnpm ≥11.0.0
- Frontend dev server running (`pnpm dev` from repo root)

## Development

```bash
# Start dev server (from repo root)
pnpm dev

# Run frontend unit tests
pnpm --filter frontend test:unit

# Run E2E tests
pnpm --filter frontend test:e2e

# Type check
pnpm typecheck
```

## Verification

### Manual Testing

1. **Desktop fixed width**: Open `http://localhost:5173` at a viewport ≥1200px wide. Resize the browser horizontally — widgets should NOT reflow or change size.
2. **Centering**: At viewports wider than 1200px (e.g., 1920px), the grid should be horizontally centred with equal space on both sides.
3. **Mobile stacked**: Resize below 480px or use mobile device emulation — the stacked layout should render identically to before.
4. **Breakpoint transition**: Slowly resize from 1300px → 900px → 400px. Transitions should be clean with no overlapping widgets or broken states.
5. **Background full-bleed**: Dashboard backgrounds (solid colour or image) should still fill the entire viewport, not be constrained to the grid width.

### Automated Testing

```bash
# E2E test for fixed width behaviour
pnpm --filter frontend test:e2e -- --grep "fixed-width"
```

## Key Files Changed

| File | Change |
|------|--------|
| `frontend/src/components/DashboardGrid.tsx` | Add `max-width` + `margin: 0 auto` to grid container |
| `frontend/src/lib/constants.ts` | New file — shared layout constants |
| `frontend/tests/e2e/fixed-width.spec.ts` | New file — E2E tests for width behaviour |

## Configuration

No new environment variables or configuration required. The fixed width value (1200px) is a code constant matching the existing `lg` breakpoint.

## Rollback

Revert the `max-width` and `margin` styles from the grid container div in `DashboardGrid.tsx` to restore fluid behaviour.
