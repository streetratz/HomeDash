# Stocks Widget — Implementation Plan

## Technical Approach

The stocks widget follows the established HomeDash proxy pattern (like Pi-hole/Weather widgets): the backend fetches market data from Yahoo Finance via the `yahoo-finance2` npm package—no API key needed—caches it in memory, and exposes REST endpoints. The frontend uses TanStack Query for polling with configurable refetch intervals.

Key design decisions:
- **Backend service** with in-memory cache + self-imposed rate limiter (1 req/sec)
- **Batch quote fetching** — `yahoo-finance2` supports multi-symbol `quote()` calls
- **FX conversion** via yahoo-finance2 (e.g., `AUDUSD=X` ticker)
- **CSV import** parsed client-side, symbols stored in widget config JSON (no separate DB tables)
- **Three display modes**: minimized (total only), compact (group summaries), expanded (individual tickers + sparklines)
- **Lightweight SVG sparklines** — no chart library dependency

---

## Phase 1 — Backend Foundation

Install `yahoo-finance2`, create the stock service with caching/rate-limiting, and expose API routes.

### Tasks

| # | Task | Details |
|---|------|---------|
| 1.1 | Install `yahoo-finance2` | `pnpm add yahoo-finance2 --filter backend` |
| 1.2 | Create `backend/src/services/stock-service.ts` | In-memory cache (Map keyed by symbol, TTL-based), rate limiter (token bucket, 1 req/sec), methods: `getQuotes(symbols[])`, `searchSymbol(query)`, `getCandles(symbol, days)`, `getFxRate(from, to)` |
| 1.3 | Create `backend/src/api/stocks.ts` | Routes: `GET /api/stocks/:widgetId/quotes`, `GET /api/stocks/search?q=`, `GET /api/stocks/:widgetId/candles?days=5`, `GET /api/stocks/:widgetId/market-status`. Auth: `requireAuth` for reads. widgetId used to look up config → tickers. |
| 1.4 | Register routes | Import `registerStocksRoutes` in `backend/src/api/index.ts` |
| 1.5 | Add config schema | Add `StocksConfigSchema` to `backend/src/lib/validation.ts` + register in `widgetConfigSchemas['stocks']` |

### Config Schema (Zod)

```typescript
export const StocksConfigSchema = z.object({
  groups: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1).max(100),
    currency: z.string().length(3),
    tickers: z.array(z.object({
      symbol: z.string().min(1).max(20),
      lots: z.array(z.object({
        purchasePrice: z.number().positive(),
        quantity: z.number().positive(),
        tradeDate: z.string(),
      })).optional(),
    })).max(30),
    collapsed: z.boolean().default(false),
    includeInTotal: z.boolean().default(true),
    csvFilename: z.string().optional(),
    lastImported: z.string().optional(),
  })).default([]),
  displayCurrency: z.string().length(3).default('AUD'),
  refreshInterval: z.number().int().min(60).max(900).default(300),
  displayMode: z.enum(['minimized', 'compact', 'expanded']).default('compact'),
  showSparkline: z.boolean().default(false),
  reduceOffHours: z.boolean().default(true),
}).passthrough();
```

### API Response Shapes

```
GET /api/stocks/:widgetId/quotes
→ { quotes: StockQuote[], fxRates: Record<string, number>, timestamp: number }

GET /api/stocks/search?q=apple
→ { results: [{ symbol, shortname, exchange, typeDisp }] }

GET /api/stocks/:widgetId/candles?days=5
→ { candles: Record<symbol, { date: string, close: number }[]> }

GET /api/stocks/:widgetId/market-status
→ { markets: Record<exchange, { open: boolean, nextOpen?: string }> }
```

---

## Phase 2 — Widget Registration & Config Form

Register the widget type and build the configuration UI (group management, ticker search, CSV import, display settings).

### Tasks

| # | Task | Details |
|---|------|---------|
| 2.1 | Create `frontend/src/components/widgets/StocksConfigForm.tsx` | Sections: group management (add/rename/delete groups), ticker search (debounced autocomplete hitting `/api/stocks/search`), CSV upload (parse client-side, extract symbols + lots), display settings (mode, currency, refresh interval, sparkline toggle) |
| 2.2 | Create `frontend/src/hooks/useStocksApi.ts` | TanStack Query hooks: `useStockQuotes(widgetId, config)`, `useStockSearch(query)`, `useStockCandles(widgetId, config)`. Configurable `refetchInterval` from config. |
| 2.3 | Create CSV parser utility | `frontend/src/lib/parse-yahoo-csv.ts` — parse Yahoo Finance CSV export format, extract symbol, quantity, purchase price, trade date. Deduplicate symbols, aggregate lots. |
| 2.4 | Register widget type | Add `stocks` entry in `frontend/src/components/widgets/registry.tsx` with icon `TrendingUp` from lucide-react, default config, and component imports. |

### CSV Import Flow
1. User clicks "Import CSV" → file picker opens
2. Client-side parse → extract unique symbols + lot data
3. Prompt: group name (default: filename sans extension) + currency dropdown
4. Creates/updates group in config state
5. Config saved on form submit (same as any widget config save)

---

## Phase 3 — Widget Display Component

Build the main display with three view modes, group collapsing, currency conversion, and sparklines.

### Tasks

| # | Task | Details |
|---|------|---------|
| 3.1 | Create `frontend/src/components/widgets/StocksWidget.tsx` | Main component: reads config, fetches quotes via hook, renders based on `displayMode`. Contains sub-components for each mode. |
| 3.2 | Minimized mode | Single line: portfolio total value + daily change (sum of selected groups converted to display currency). Ideal for 1×1 grid tile. |
| 3.3 | Compact mode | Per-group collapsible sections: group name, total value, daily change %. When expanded: individual ticker rows (symbol, price, change, change%). |
| 3.4 | Expanded mode | Same as compact + inline SVG sparklines, day high/low, open/prev close per ticker. |
| 3.5 | Create `frontend/src/components/widgets/stocks/Sparkline.tsx` | Lightweight SVG polyline component. Props: `data: number[]`, `width`, `height`, `color`. No external chart library. |
| 3.6 | Currency conversion logic | `frontend/src/lib/stocks-currency.ts` — helper to convert group values using FX rates returned by the quotes endpoint. |
| 3.7 | Group summary calculations | Compute per-group: total value, cost basis, day change, total gain/loss from quote data + lot quantities. |

### Component Hierarchy
```
StocksWidget
├── MinimizedView (total line only)
├── CompactView
│   └── StockGroup (collapsible)
│       ├── GroupHeader (name, summary, chevron)
│       └── TickerRow[] (symbol, price, change)
└── ExpandedView
    └── StockGroup (collapsible)
        ├── GroupHeader
        └── TickerRowExpanded[] (+ sparkline, high/low, open/close)
```

---

## Phase 4 — Polish & Edge Cases

Error handling, loading states, market status, stale data, and UX refinements.

### Tasks

| # | Task | Details |
|---|------|---------|
| 4.1 | Loading skeletons | Skeleton rows matching compact/expanded layouts while data is loading. |
| 4.2 | Error states | Per-ticker error badges (invalid/delisted), full widget error fallback with retry button, "last updated" relative timestamp. |
| 4.3 | Stale data indicator | If refetch fails, show last data with amber "Stale" badge + time since last success. Never clear existing data on failure. |
| 4.4 | Market status indicator | Small open/closed badge in widget header. Green dot = open, gray dot = closed. Tooltip with exchange name. |
| 4.5 | Off-hours polling reduction | If `reduceOffHours` is true and all markets are closed, multiply refetchInterval by 4x (e.g., 300s → 1200s). |
| 4.6 | Empty state | "Add stock tickers to get started" with link to open config panel when zero groups/tickers configured. |
| 4.7 | Accessibility | Ensure color indicators have supplementary arrows (↑/↓), ARIA labels on sparklines, keyboard-accessible group collapse. |

---

## File Changes

### New Files

| File | Purpose |
|------|---------|
| `backend/src/services/stock-service.ts` | Yahoo Finance wrapper with cache + rate limiter |
| `backend/src/api/stocks.ts` | REST API routes for quotes, search, candles, market status |
| `frontend/src/components/widgets/StocksWidget.tsx` | Display component (all three modes) |
| `frontend/src/components/widgets/StocksConfigForm.tsx` | Config form (groups, search, CSV, settings) |
| `frontend/src/components/widgets/stocks/Sparkline.tsx` | SVG sparkline sub-component |
| `frontend/src/hooks/useStocksApi.ts` | TanStack Query hooks for stock endpoints |
| `frontend/src/lib/parse-yahoo-csv.ts` | Client-side Yahoo Finance CSV parser |
| `frontend/src/lib/stocks-currency.ts` | FX conversion helper functions |

### Modified Files

| File | Change |
|------|--------|
| `backend/package.json` | Add `yahoo-finance2` dependency |
| `backend/src/api/index.ts` | Import + call `registerStocksRoutes(app)` |
| `backend/src/lib/validation.ts` | Add `StocksConfigSchema` + register in `widgetConfigSchemas` |
| `frontend/src/components/widgets/registry.tsx` | Register `stocks` widget type |

---

## Dependencies

| Package | Location | Purpose |
|---------|----------|---------|
| `yahoo-finance2` | backend | Market data (quotes, search, historical, FX rates) |

No other new dependencies required. Sparklines use raw SVG; CSV parsing is a simple custom parser (Yahoo Finance CSVs are straightforward).

---

## Risk Mitigations

| Risk | Mitigation |
|------|-----------|
| Yahoo Finance endpoint changes | `yahoo-finance2` package handles upstream changes; pin to stable major version |
| Rate limiting / IP blocking | Self-imposed 1 req/sec limiter + cache sharing across widget instances |
| Large portfolios (100+ tickers) | Batch `quote()` calls (yahoo-finance2 supports arrays), paginate if needed |
| Stale FX rates | Cache FX rates with 15-min TTL (rates don't move fast enough to matter for a dashboard) |
