/**
 * 021-stocks-widget: Main display component.
 * Renders portfolio data in minimized or compact (collapsible) mode.
 */

import { useState } from 'react';
import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronRight } from 'lucide-react';
import type { WidgetDisplayProps } from './registry.js';
import { useStockQuotes } from '../../hooks/useStocks.js';
import type { QuotesResponse } from '../../hooks/useStocks.js';
import { useIsPublicView } from '../../state/publicView.js';
import { usePublicWidgetSnapshot } from '../../state/publicWidgets.js';

interface StocksConfig {
  groups: Array<{
    id: string;
    name: string;
    currency: string;
    tickers: Array<{ symbol: string; lots?: Array<{ purchasePrice: number; quantity: number; tradeDate: string }> }>;
    collapsed?: boolean;
    includeInTotal?: boolean;
  }>;
  displayCurrency: string;
  refreshInterval: number;
  displayMode: 'minimized' | 'compact' | 'expanded';
  showSparkline: boolean;
  reduceOffHours: boolean;
  hideZeroUnits: boolean;
}

// Currency symbols map
const CURRENCY_SYMBOLS: Record<string, string> = {
  AUD: 'A$', USD: 'US$', EUR: '€', GBP: '£', JPY: '¥', CAD: 'C$', NZD: 'NZ$',
  CHF: 'CHF', HKD: 'HK$', SGD: 'S$', INR: '₹', KRW: '₩', CNY: '¥',
};

function getCurrencySymbol(code: string): string {
  return CURRENCY_SYMBOLS[code] ?? code;
}

function formatCurrency(value: number, currency: string): string {
  const symbol = getCurrencySymbol(currency);
  const formatted = new Intl.NumberFormat('en-AU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(Math.abs(value));
  return `${value < 0 ? '-' : ''}${symbol}${formatted}`;
}

function formatPrice(value: number, currency: string): string {
  const symbol = getCurrencySymbol(currency);
  return `${symbol}${value.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function StocksWidget({ widget }: WidgetDisplayProps) {
  const cfg = (widget.config ?? {}) as StocksConfig;
  const widgetId = widget.id;
  const isPublicView = useIsPublicView();

  const privateQuery = useStockQuotes(
    isPublicView ? undefined : widgetId,
    (cfg.refreshInterval ?? 300) * 1000,
  );
  const publicQuery = usePublicWidgetSnapshot<QuotesResponse>(
    widgetId,
    widget.type,
    isPublicView,
  );
  const data = isPublicView ? publicQuery.data?.data : privateQuery.data;
  const isLoading = isPublicView ? publicQuery.isLoading : privateQuery.isLoading;
  const error = isPublicView ? publicQuery.error : privateQuery.error;

  if (cfg.groups.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        <p>Add stock tickers in widget settings to get started.</p>
      </div>
    );
  }

  if (isLoading && !data) {
    return (
      <div className="p-3 space-y-3 animate-pulse">
        {[1, 2].map((i) => (
          <div key={i} className="widget-panel rounded-lg border p-3 space-y-2">
            <div className="h-5 bg-white/10 rounded w-1/3" />
            <div className="h-4 bg-white/5 rounded w-full" />
            <div className="h-4 bg-white/5 rounded w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex items-center justify-center h-full text-destructive text-sm">
        <p>Failed to load stock data</p>
      </div>
    );
  }

  const quotes = data?.quotes ?? [];
  const fxRates = data?.fxRates ?? {};

  if (cfg.displayMode === 'minimized') {
    return <MinimizedView cfg={cfg} quotes={quotes} fxRates={fxRates} />;
  }

  return <CompactView cfg={cfg} quotes={quotes} fxRates={fxRates} startCollapsed={cfg.displayMode === 'compact'} />;
}

// ─── Minimized View ───────────────────────────────────────────────────────────

function MinimizedView({
  cfg,
  quotes,
  fxRates,
}: {
  cfg: StocksConfig;
  quotes: Array<{ symbol: string; price: number; change: number; changePercent: number }>;
  fxRates: Record<string, number>;
}) {
  const { totalValue, totalChange } = computeTotals(cfg, quotes, fxRates);
  const changePercent = totalValue > 0 ? (totalChange / (totalValue - totalChange)) * 100 : 0;

  return (
    <div className="widget-panel flex items-center justify-between p-3 h-full rounded-lg border">
      <span className="text-lg font-semibold light-text-primary">
        {formatCurrency(totalValue, cfg.displayCurrency)}
      </span>
      <ChangeIndicator change={totalChange} changePercent={changePercent} />
    </div>
  );
}

// ─── Compact View ─────────────────────────────────────────────────────────────

function CompactView({
  cfg,
  quotes,
  fxRates,
  startCollapsed,
}: {
  cfg: StocksConfig;
  quotes: Array<{ symbol: string; price: number; change: number; changePercent: number }>;
  fxRates: Record<string, number>;
  startCollapsed: boolean;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    cfg.groups.forEach((g) => { initial[g.id] = startCollapsed || (g.collapsed ?? false); });
    return initial;
  });

  const toggleGroup = (groupId: string) => {
    setCollapsed((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const { totalValue, totalChange } = computeTotals(cfg, quotes, fxRates);
  const totalChangePercent = totalValue > 0 ? (totalChange / (totalValue - totalChange)) * 100 : 0;

  return (
    <div className="stocks-widget flex flex-col h-full text-xs">
      {/* Sticky Total Header */}
      <div className="widget-panel-header shrink-0 flex items-center justify-between border-b px-3 py-2">
        <span className="font-bold text-indigo-200 dark:text-indigo-200 text-indigo-700 text-sm">Portfolio Total</span>
        <div className="flex items-center gap-2">
          <span className="font-mono light-text-primary text-sm font-bold">
            {formatCurrency(totalValue, cfg.displayCurrency)}
          </span>
          <ChangeIndicator change={totalChange} changePercent={totalChangePercent} compact />
        </div>
      </div>

      {/* Scrollable groups */}
      <div className="flex-1 overflow-auto p-2 space-y-2">
      {cfg.groups.map((group) => {
        const fxKey = `${group.currency}${cfg.displayCurrency}`;
        const rate = group.currency === cfg.displayCurrency ? 1 : (fxRates[fxKey] ?? 1);
        const groupQuotes = quotes.filter((q) =>
          group.tickers.some((t) => t.symbol === q.symbol)
        );

        const groupValue = groupQuotes.reduce((sum, q) => {
          const ticker = group.tickers.find((t) => t.symbol === q.symbol);
          const qty = ticker?.lots?.reduce((s, l) => s + l.quantity, 0) ?? 0;
          return sum + (qty > 0 ? q.price * qty * rate : 0);
        }, 0);

        const groupChange = groupQuotes.reduce((sum, q) => {
          const ticker = group.tickers.find((t) => t.symbol === q.symbol);
          const qty = ticker?.lots?.reduce((s, l) => s + l.quantity, 0) ?? 0;
          return sum + (qty > 0 ? q.change * qty * rate : 0);
        }, 0);

        const groupChangePercent = groupValue > 0
          ? (groupChange / (groupValue - groupChange)) * 100
          : 0;

        const isCollapsed = collapsed[group.id] ?? false;

        return (
          <div key={group.id} className="widget-panel overflow-hidden rounded-lg border">
            {/* Group Header */}
            <button
              onClick={() => toggleGroup(group.id)}
              className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-white/5 dark:hover:bg-white/5 hover:bg-black/5 transition-colors"
            >
              <div className="flex items-center gap-1.5">
                {isCollapsed
                  ? <ChevronRight className="h-3 w-3 light-text-secondary" />
                  : <ChevronDown className="h-3 w-3 light-text-secondary" />
                }
                <span className="font-semibold light-text-primary">{group.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono light-text-primary">
                  {formatCurrency(groupValue, cfg.displayCurrency)}
                </span>
                <ChangeIndicator change={groupChange} changePercent={groupChangePercent} compact />
              </div>
            </button>

            {/* Ticker rows */}
            {!isCollapsed && (
              <div className="border-t border-white/10 dark:border-white/10 border-border px-3 py-2 space-y-1">
                {group.tickers
                  .filter((ticker) => {
                    if (!cfg.hideZeroUnits) return true;
                    const qty = ticker.lots?.reduce((s, l) => s + l.quantity, 0) ?? 0;
                    return qty !== 0;
                  })
                  .map((ticker) => {
                  const q = groupQuotes.find((gq) => gq.symbol === ticker.symbol);
                  if (!q) return null;
                  const qty = ticker.lots?.reduce((s, l) => s + l.quantity, 0) ?? 0;
                  const costBasis =
                    ticker.lots?.reduce((sum, lot) => sum + lot.purchasePrice * lot.quantity, 0) ??
                    0;
                  const averageCost = qty > 0 ? costBasis / qty : 0;
                  const holdingValue = q.price * qty * rate;

                  return (
                    <div
                      key={ticker.symbol}
                      className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 text-left"
                    >
                      <div className="min-w-0">
                        <span className="font-mono font-medium light-text-primary">
                          {ticker.symbol}
                        </span>
                        <span className="ml-2 font-mono text-[10px] light-text-secondary">
                          {formatPrice(q.price, group.currency)}
                        </span>
                      </div>
                      <span className="shrink-0 justify-self-end">
                        <ChangeIndicator change={q.change} changePercent={q.changePercent} compact />
                      </span>
                      <span className="truncate text-[10px] light-text-secondary">
                        {qty > 0
                          ? `${qty % 1 === 0 ? qty : qty.toFixed(2)} units · avg ${formatPrice(averageCost, group.currency)}`
                          : 'Watchlist only'}
                      </span>
                      <span className="justify-self-end font-mono text-[10px] tabular-nums light-text-secondary">
                        {qty > 0 ? formatCurrency(holdingValue, cfg.displayCurrency) : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ChangeIndicator({
  change,
  changePercent,
  compact,
}: {
  change: number;
  changePercent: number;
  compact?: boolean;
}) {
  const isPositive = change > 0;
  const isNegative = change < 0;
  const color = isPositive ? 'text-green-400 dark:text-green-400 text-green-600' : isNegative ? 'text-red-400 dark:text-red-400 text-red-600' : 'light-text-secondary';
  const Icon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;
  const size = compact ? 'h-3 w-3' : 'h-4 w-4';

  return (
    <span className={`inline-flex items-center gap-1.5 ${color}`}>
      <Icon className={size} />
      {!compact && (
        <span className="text-xs font-mono">
          {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(2)}%
        </span>
      )}
      {compact && changePercent !== 0 && (
        <span className="text-[10px] font-mono">
          {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(1)}%
        </span>
      )}
    </span>
  );
}

function computeTotals(
  cfg: StocksConfig,
  quotes: Array<{ symbol: string; price: number; change: number }>,
  fxRates: Record<string, number>,
) {
  let totalValue = 0;
  let totalChange = 0;

  for (const group of cfg.groups) {
    if (group.includeInTotal === false) continue;

    const fxKey = `${group.currency}${cfg.displayCurrency}`;
    const rate = group.currency === cfg.displayCurrency ? 1 : (fxRates[fxKey] ?? 1);

    for (const ticker of group.tickers) {
      const quote = quotes.find((q) => q.symbol === ticker.symbol);
      if (!quote) continue;
      const qty = ticker.lots?.reduce((s, l) => s + l.quantity, 0) ?? 0;
      if (qty > 0) {
        totalValue += quote.price * qty * rate;
        totalChange += quote.change * qty * rate;
      }
    }
  }

  return { totalValue, totalChange };
}
