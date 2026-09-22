# Stocks Widget — Feature Specification

## Summary

A dashboard widget that displays a configurable watchlist of stock ticker symbols with current price, daily change, and trend indicators. The widget follows the existing proxy pattern (same as weather/Pi-hole) where the backend fetches market data from a third-party API so that API keys are never exposed to the frontend.

**Widget type identifier:** `stocks`

---

## API Data Source

### Yahoo Finance (via `yahoo-finance2` npm package)

No API key required. No paid subscription. Uses the well-maintained `yahoo-finance2` npm package which wraps Yahoo's unofficial but stable endpoints.

| Criteria | Detail |
|----------|--------|
| Cost | **Free — no API key needed** |
| Rate limit | Reasonable (self-imposed 1 req/sec recommended) |
| Data delay | Near real-time during market hours |
| Global markets | All major exchanges (ASX, NYSE, NASDAQ, LSE, TSE, etc.) |
| Package | `yahoo-finance2` (actively maintained, TypeScript, 2k+ GitHub stars) |
| Risk | Unofficial API — Yahoo may change endpoints (package maintainers handle this) |

**Why Yahoo Finance:**
- Zero cost, zero signup — just install the npm package
- Near real-time quotes (no 15-min delay)
- Full international market coverage out of the box
- Sparkline/chart data via historical quotes
- Symbol search built-in
- Active community maintaining the `yahoo-finance2` package

### Key Package Methods

| Method | Purpose | Returns |
|--------|---------|---------|
| `quote(symbol)` | Current price, change, high/low, volume | Full quote object with 50+ fields |
| `quoteSummary(symbol)` | Detailed company info | Summary modules |
| `search(query)` | Symbol search/autocomplete | `{ quotes: [{ symbol, shortname, exchange }] }` |
| `historical(symbol, { period1, period2 })` | OHLCV candles for sparkline | Array of daily bars |

### Ticker Symbol Format
- US stocks: plain symbol (e.g., `AAPL`, `MSFT`, `TSLA`)
- Australian: `CBA.AX`, `BHP.AX`
- London: `SHEL.L`, `BP.L`
- Tokyo: `7203.T` (Toyota)
- Yahoo handles exchange routing automatically for most tickers

---

## User Stories

### User Story 1 — View Stock Watchlist (P1)

> As a home dashboard user, I want to see current prices and daily changes for my chosen stock tickers at a glance, so I can quickly monitor market movements without leaving my dashboard.

**Acceptance Criteria:**
- Widget displays a list of configured stock tickers
- Each ticker shows: symbol, current price, daily change ($), daily change (%), up/down visual indicator
- Data is fetched via backend proxy (no direct frontend API calls)
- Loading and error states are handled gracefully

### User Story 2 — Configure Watchlist (P1)

> As a dashboard administrator, I want to add, remove, and reorder stock ticker symbols in the widget configuration, so I can customize which stocks I monitor.

**Acceptance Criteria:**
- Config form allows adding ticker symbols (with search/autocomplete)
- Config form allows removing individual tickers
- Config form allows reordering tickers (drag or up/down)
- Validates that a ticker exists before saving (via symbol search endpoint)
- Maximum of 20 tickers per group

### User Story 2b — Portfolio CSV Import (P1)

> As a dashboard administrator, I want to import my Yahoo Finance portfolio CSV files to automatically populate my watchlist groups, so I don't have to manually type every ticker.

**Acceptance Criteria:**
- Settings UI allows uploading one or more Yahoo Finance CSV exports
- Each uploaded CSV becomes a named **group** (name derived from filename or user-editable)
- On import, user selects/confirms: group name and currency (AUD, USD, GBP, etc.)
- Import extracts unique ticker symbols from the CSV (deduplicates multiple lots per symbol)
- Import also extracts purchase price and quantity data for cost basis / P&L display
- Re-importing a CSV for an existing group **syncs** (adds new tickers, removes tickers no longer in CSV, updates quantities/cost basis) — not just appends
- Manual add/remove of individual tickers still works alongside CSV-imported data

### User Story 2c — Portfolio Groups with Currency & Summary (P1)

> As a dashboard user, I want my stocks organized in collapsible groups with per-group currency and a combined total, so I can see holdings value in both native currency and a chosen display currency.

**Acceptance Criteria:**
- Widget displays stocks organized by group (e.g., "JP-AU", "JP-US", "SD")
- Each group has a declared native currency (e.g., AUD, USD)
- All values (group summaries, totals, individual tickers) displayed in one chosen **display currency**
- User can change the display currency in widget settings (e.g., AUD or USD)
- Currency conversion uses a free FX rate (fetched alongside stock data)
- Groups can be collapsed (shows only summary line) or expanded (shows individual tickers)
- Collapsed/expanded state persists per user session

### User Story 3 — Configurable Refresh Interval (P1)

> As a dashboard administrator, I want to set how often stock data refreshes, respecting API rate limits, so I can balance freshness vs. API quota usage.

**Acceptance Criteria:**
- Configurable refresh interval (minimum 60 seconds, default 300 seconds)
- UI displays "last updated" timestamp
- Refresh pauses or reduces frequency outside market hours (configurable)
- Manual refresh button available

### User Story 4 — Mini Sparkline Charts (P2)

> As a dashboard user, I want to see a small trend line for each stock showing recent price movement, so I can quickly assess momentum.

**Acceptance Criteria:**
- Optional sparkline chart per ticker (toggleable in config)
- Shows last 5 trading days of closing prices
- Sparkline color matches trend direction (green up, red down)
- Graceful degradation if candle data unavailable

### User Story 5 — Compact and Expanded Display Modes (P2)

> As a dashboard user, I want to switch between a compact view (just tickers and prices) and an expanded view (with sparklines, high/low, volume), so the widget adapts to my available dashboard space.

**Acceptance Criteria:**
- Compact mode: ticker, price, change % with colored indicator
- Expanded mode: adds sparkline, day high/low, open price, previous close
- Display mode stored in widget config
- Responsive within the widget grid cell

### User Story 6 — Market Status Indicator (P3)

> As a dashboard user, I want to see whether the relevant market is currently open or closed, so I understand whether prices are live or stale.

**Acceptance Criteria:**
- Small badge/indicator showing market open/closed status
- Dimmed styling when market is closed
- Tooltip or label showing next market open time (if available)

---

## Functional Requirements

### Widget Display

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-001 | Widget renders a scrollable list of stock tickers from the configured watchlist | P1 |
| FR-002 | Each ticker row displays: symbol, company name (truncated), current price, daily $ change, daily % change | P1 |
| FR-003 | Each ticker row displays a colored up/down arrow or indicator (green for gain, red for loss, gray for unchanged) | P1 |
| FR-004 | Widget shows a loading skeleton while data is being fetched | P1 |
| FR-005 | Widget shows a user-friendly error message if the API is unreachable or returns an error | P1 |
| FR-006 | Widget displays a "last updated" timestamp in relative format (e.g., "2 min ago") | P1 |
| FR-007 | Compact mode shows minimal data (symbol, price, change %) in a dense list | P2 |
| FR-007b | Minimized mode shows only a single total line (sum of selected groups) — ideal for small widget tiles | P1 |
| FR-007c | Config allows selecting which groups are included in the minimized total | P1 |
| FR-008 | Expanded mode adds sparkline, day range (high/low), and open/previous close | P2 |
| FR-009 | Optional mini sparkline chart rendered inline per ticker (SVG or canvas, no heavy chart library) | P2 |
| FR-010 | Market status indicator (open/closed badge) displayed in widget header | P3 |

### Widget Configuration

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-011 | Config form provides a text input with autocomplete/search to find and add ticker symbols | P1 |
| FR-012 | Config form displays current watchlist with ability to remove individual tickers | P1 |
| FR-013 | Config form allows reordering of tickers in the watchlist | P1 |
| FR-014 | Config form includes a refresh interval selector (60s, 120s, 300s, 600s, 900s) | P1 |
| FR-015 | Config form includes a display mode toggle (compact / expanded) | P2 |
| FR-016 | Config form includes a toggle to enable/disable sparkline charts | P2 |
| FR-017 | Config form includes a toggle for "reduce polling outside market hours" | P2 |
| FR-018 | Config form validates ticker symbols via the Yahoo Finance search before adding | P1 |
| FR-019 | Maximum watchlist size enforced at 30 tickers per group | P1 |
| FR-020a | Config form allows uploading Yahoo Finance portfolio CSV files | P1 |
| FR-020b | Each CSV import creates/updates a named group (editable name, defaults to filename) | P1 |
| FR-020c | CSV import extracts unique symbols, purchase price, quantity, and trade date per lot | P1 |
| FR-020d | Re-importing a CSV syncs the group (add new, remove missing, update quantities) — not append-only | P1 |
| FR-020e | Groups are collapsible in the widget display with per-group summary (total value, daily change) | P1 |
| FR-020f | Manual add/remove works alongside CSV-imported tickers | P1 |

### Backend / API Proxy

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-020 | Backend exposes `GET /api/stocks/:widgetId/quotes` returning current quotes for all configured tickers | P1 |
| FR-021 | Backend exposes `GET /api/stocks/:widgetId/candles?days=5` returning sparkline candle data | P2 |
| FR-022 | Backend exposes `GET /api/stocks/search?q=<query>` for ticker symbol autocomplete | P1 |
| FR-023 | Backend exposes `GET /api/stocks/:widgetId/market-status` returning open/closed for relevant exchange | P3 |
| FR-024 | Backend uses `yahoo-finance2` package — no API key or environment variable required | P1 |
| FR-024b | Backend fetches FX rates (e.g., AUDUSD=X) via `yahoo-finance2` for currency conversion between groups | P1 |
| FR-025 | Backend implements in-memory cache with TTL to avoid redundant API calls within refresh interval | P1 |
| FR-026 | Backend batches quote requests where possible (`yahoo-finance2` supports multi-symbol `quote()`) | P1 |
| FR-027 | Backend returns graceful error response (not 500) if Yahoo Finance is unavailable | P1 |

### Data Handling

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-028 | Widget config stored in `configJson` column following existing widget pattern | P1 |
| FR-029 | Config schema: `{ tickers: string[], refreshInterval: number, displayMode: 'compact'|'expanded', showSparkline: boolean, reduceOffHours: boolean }` | P1 |
| FR-030 | Frontend uses TanStack Query with `refetchInterval` matching configured refresh interval | P1 |
| FR-031 | Stale data is shown with visual staleness indicator if refresh fails (not cleared) | P1 |

---

## Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-001 | **Security:** No API keys needed — `yahoo-finance2` requires no credentials |
| NFR-002 | **Performance:** Backend cache with self-imposed rate limiting (max 1 req/sec to Yahoo) prevents IP blocking |
| NFR-003 | **Performance:** Widget renders within 100ms of receiving data; sparklines use lightweight SVG (no D3/Chart.js) |
| NFR-004 | **Resilience:** Widget degrades gracefully — shows last known data with staleness indicator on API failure |
| NFR-005 | **Resilience:** Individual ticker failures don't break the entire widget (partial results displayed) |
| NFR-006 | **Accessibility:** Color indicators supplemented with icons/arrows (not color-only) for color-blind users |
| NFR-007 | **Configuration:** Widget functional with zero config (shows empty state with prompt to add tickers) |
| NFR-008 | **Rate Limiting:** Backend enforces self-imposed rate limiter (1 req/sec) for Yahoo Finance calls shared across all stocks widget instances |
| NFR-009 | **Internationalization:** Support for international exchange tickers via standard suffix notation (e.g., `.AX`, `.L`, `.T`) |

---

## Success Criteria

| ID | Criterion |
|----|-----------|
| SC-001 | User can add at least 5 stock tickers and see live (delayed) prices within the configured refresh interval |
| SC-002 | Daily change is displayed with correct sign, color coding, and directional indicator |
| SC-003 | Widget continues to display last-known data when API is temporarily unavailable |
| SC-004 | Refresh interval is respected and API rate limits are not exceeded under normal usage |
| SC-005 | Widget config persists across dashboard reloads and server restarts |
| SC-006 | Backend proxy pattern keeps API key secure (not visible in network tab or frontend bundle) |

---

## Out of Scope

- **Real-time streaming** (WebSocket) price updates (future enhancement)
- **Portfolio tracking** (shares owned, cost basis, P&L calculations)
- **News/headlines** integration per ticker
- **Options/derivatives** data
- **Alerts/notifications** for price thresholds
- **Multiple API provider** switching in the UI (backend abstracts this; future work)
- **Fundamental data** (P/E ratio, market cap, earnings) — could be a P3 future addition
- **Dark pool / pre-market / after-hours** data display
- **Paid tier** features of Finnhub (true real-time, higher limits)

---

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Invalid or delisted ticker | Show error badge on that ticker row; don't break other tickers |
| API unavailable | Widget shows stale data with staleness warning; retries on next interval |
| Rate limit exceeded (HTTP 429) | Backend queues retries with exponential backoff; frontend shows stale data |
| Market closed (weekend/holiday) | Display last closing data; show "Market Closed" badge; reduce polling if configured |
| Network timeout to Yahoo Finance | Return cached data if available; show staleness warning |
| Ticker returns partial data | Display available fields; hide unavailable fields gracefully |
| Duplicate ticker in watchlist | Prevent duplicates at config validation time |
| Widget with 0 tickers configured | Show friendly empty state: "Add stock tickers to get started" |
| International ticker with exchange closed | Same as US market closed handling; per-exchange status |

---

## Key Entities

| Entity | Description |
|--------|-------------|
| **Stock Widget Config** | JSON config stored in `configJson`: tickers array, refresh interval, display mode, sparkline toggle |
| **Stock Quote** | Transient data from API: symbol, current price, change, change %, high, low, open, prev close, timestamp |
| **Candle Data** | Historical OHLCV data for sparkline rendering (not persisted, cached in memory) |
| **Market Status** | Boolean open/closed with exchange identifier |

---

## Technical Notes

### Config JSON Schema
```typescript
interface StocksWidgetConfig {
  groups: StockGroup[]          // portfolio groups
  displayCurrency: string       // preferred total display currency (e.g., "AUD")
  refreshInterval: number       // seconds (min: 60, default: 300)
  displayMode: 'compact' | 'expanded'  // default: 'compact'
  showSparkline: boolean        // default: false
  reduceOffHours: boolean       // default: true
}

interface StockGroup {
  id: string                    // unique group id
  name: string                  // display name (e.g., "JP-AU", "JP-US", "SD")
  currency: string              // native currency for this group (e.g., "AUD", "USD")
  tickers: StockTicker[]        // stocks in this group
  collapsed: boolean            // UI fold state
  csvFilename?: string          // original CSV filename (for re-import matching)
  lastImported?: string         // ISO timestamp of last CSV import
}

interface StockTicker {
  symbol: string                // e.g., "AAPL", "CBA.AX"
  lots?: StockLot[]             // purchase lots (from CSV import)
}

interface StockLot {
  purchasePrice: number         // cost basis per share
  quantity: number              // shares in this lot
  tradeDate: string             // YYYYMMDD
}
```

### Quote Response Shape
```typescript
interface StockQuote {
  symbol: string
  price: number           // current price (c)
  change: number          // daily change in $ (d)
  changePercent: number   // daily change in % (dp)
  high: number            // day high (h)
  low: number             // day low (l)
  open: number            // day open (o)
  previousClose: number   // previous close (pc)
  timestamp: number       // Unix timestamp of last update
}

interface StockGroupSummary {
  groupId: string
  totalValue: number          // sum of (current price × total quantity) across all tickers
  totalCostBasis: number      // sum of (purchase price × quantity) across all lots
  totalDayChange: number      // sum of (daily $ change × total quantity)
  totalDayChangePercent: number // weighted daily % change
  totalGainLoss: number       // totalValue - totalCostBasis
  totalGainLossPercent: number // (totalValue - totalCostBasis) / totalCostBasis × 100
}
```

### Rate Limit Budget
With `yahoo-finance2` (no official rate limit, self-imposed 1 req/sec):
- 10 tickers batched in a single `quote()` call = 1 request per refresh cycle
- At 300s (5 min) interval → trivial load
- At 60s interval with 20 tickers → 1 call/min (well within safe limits)
- Sparkline candles fetched less frequently (every 30 min or on-demand)
- Cache TTL prevents duplicate calls across multiple widget instances

### Backend Cache Strategy
- In-memory cache keyed by ticker symbol
- TTL matches the shortest configured refresh interval across all stocks widget instances
- Shared cache: if two widget instances both track AAPL, only one API call is made
- Cache warming on first request; stale-while-revalidate pattern for subsequent requests

### Dependencies
- `yahoo-finance2` — npm package, zero-config, no API key needed
