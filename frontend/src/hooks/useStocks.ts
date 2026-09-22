/**
 * 021-stocks-widget: TanStack Query hooks for stock market data.
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface StockQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  timestamp: number;
  marketState?: string;
}

export interface QuotesResponse {
  quotes: StockQuote[];
  fxRates: Record<string, number>;
  displayCurrency: string;
  timestamp: number;
}

export interface SymbolSearchResult {
  symbol: string;
  shortname: string;
  exchange: string;
  typeDisp: string;
}

export interface CandlesResponse {
  candles: Record<string, Array<{ date: string; close: number }>>;
  timestamp: number;
}

export interface MarketStatusResponse {
  markets: Record<string, { open: boolean; state: string }>;
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

/**
 * Fetch stock quotes for a widget's configured tickers.
 */
export function useStockQuotes(widgetId: string | undefined, refetchInterval = 300_000) {
  return useQuery<QuotesResponse>({
    queryKey: ['stocks', 'quotes', widgetId],
    queryFn: () => apiClient.get<QuotesResponse>(`/api/stocks/${widgetId}/quotes`),
    enabled: !!widgetId,
    refetchInterval,
    staleTime: 30_000,
  });
}

/**
 * Search for stock symbols (debounced by caller).
 */
export function useStockSearch(query: string) {
  return useQuery<{ results: SymbolSearchResult[] }>({
    queryKey: ['stocks', 'search', query],
    queryFn: () => apiClient.get<{ results: SymbolSearchResult[] }>(`/api/stocks/search?q=${encodeURIComponent(query)}`),
    enabled: query.length >= 1,
    staleTime: 60_000,
  });
}

/**
 * Fetch sparkline candle data for a widget's tickers.
 */
export function useStockCandles(widgetId: string | undefined, days = 5, enabled = true) {
  return useQuery<CandlesResponse>({
    queryKey: ['stocks', 'candles', widgetId, days],
    queryFn: () => apiClient.get<CandlesResponse>(`/api/stocks/${widgetId}/candles?days=${days}`),
    enabled: !!widgetId && enabled,
    staleTime: 15 * 60_000,
  });
}

/**
 * Fetch market open/closed status for a widget's exchanges.
 */
export function useMarketStatus(widgetId: string | undefined) {
  return useQuery<MarketStatusResponse>({
    queryKey: ['stocks', 'market-status', widgetId],
    queryFn: () => apiClient.get<MarketStatusResponse>(`/api/stocks/${widgetId}/market-status`),
    enabled: !!widgetId,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
}
