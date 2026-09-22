/**
 * 021-stocks-widget: Stock market data service.
 * Uses yahoo-finance2 (no API key needed) with in-memory cache and rate limiting.
 */

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

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

export interface SymbolSearchResult {
  symbol: string;
  shortname: string;
  exchange: string;
  typeDisp: string;
}

export interface CandleData {
  date: string;
  close: number;
}

// ─── Cache ───────────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

const quoteCache = new Map<string, CacheEntry<StockQuote>>();
const candleCache = new Map<string, CacheEntry<CandleData[]>>();
const fxCache = new Map<string, CacheEntry<number>>();

const DEFAULT_QUOTE_TTL = 60_000; // 60s
const CANDLE_TTL = 30 * 60_000; // 30 min
const FX_TTL = 15 * 60_000; // 15 min

function getCached<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() < entry.expiry) return entry.data;
  if (entry) cache.delete(key);
  return null;
}

function setCache<T>(cache: Map<string, CacheEntry<T>>, key: string, data: T, ttl: number): void {
  cache.set(key, { data, expiry: Date.now() + ttl });
}

// ─── Rate Limiter (token bucket, 1 req/sec) ─────────────────────────────────

let tokens = 5;
const maxTokens = 5;
const refillRate = 1; // 1 token per second
let lastRefill = Date.now();

function acquireToken(): Promise<void> {
  const now = Date.now();
  const elapsed = (now - lastRefill) / 1000;
  tokens = Math.min(maxTokens, tokens + elapsed * refillRate);
  lastRefill = now;

  if (tokens >= 1) {
    tokens -= 1;
    return Promise.resolve();
  }

  const waitMs = ((1 - tokens) / refillRate) * 1000;
  tokens = 0;
  return new Promise((resolve) => setTimeout(resolve, waitMs));
}

// ─── Service Methods ─────────────────────────────────────────────────────────

/**
 * Get quotes for multiple symbols. Uses cache; fetches missing ones in batch.
 */
export async function getQuotes(symbols: string[]): Promise<StockQuote[]> {
  const results: StockQuote[] = [];
  const toFetch: string[] = [];

  for (const sym of symbols) {
    const cached = getCached(quoteCache, sym);
    if (cached) {
      results.push(cached);
    } else {
      toFetch.push(sym);
    }
  }

  if (toFetch.length > 0) {
    await acquireToken();
    try {
      const rawQuotes: any = await yahooFinance.quote(toFetch);
      const quotesArr: any[] = Array.isArray(rawQuotes) ? rawQuotes : [rawQuotes];

      for (const q of quotesArr) {
        if (!q || !q.symbol) continue;
        const quote: StockQuote = {
          symbol: q.symbol,
          price: q.regularMarketPrice ?? 0,
          change: q.regularMarketChange ?? 0,
          changePercent: q.regularMarketChangePercent ?? 0,
          high: q.regularMarketDayHigh ?? 0,
          low: q.regularMarketDayLow ?? 0,
          open: q.regularMarketOpen ?? 0,
          previousClose: q.regularMarketPreviousClose ?? 0,
          timestamp: q.regularMarketTime ? new Date(q.regularMarketTime).getTime() : Date.now(),
          marketState: q.marketState ?? undefined,
        };
        setCache(quoteCache, q.symbol, quote, DEFAULT_QUOTE_TTL);
        results.push(quote);
      }
    } catch (err) {
      console.error('[stock-service] quote fetch error:', err);
      // Return whatever we got from cache for the failed ones
    }
  }

  return results;
}

/**
 * Search for symbols by query string.
 */
export async function searchSymbol(query: string): Promise<SymbolSearchResult[]> {
  if (!query || query.length < 1) return [];

  await acquireToken();
  try {
    const result: any = await yahooFinance.search(query, { newsCount: 0 });
    return ((result.quotes as any[]) || [])
      .filter((q) => q['symbol'] && q['isYahooFinance'] !== false)
      .slice(0, 10)
      .map((q) => ({
        symbol: (q['symbol'] as string) || '',
        shortname: (q['shortname'] as string) || (q['longname'] as string) || '',
        exchange: (q['exchange'] as string) || '',
        typeDisp: (q['typeDisp'] as string) || (q['quoteType'] as string) || '',
      }));
  } catch (err) {
    console.error('[stock-service] search error:', err);
    return [];
  }
}

/**
 * Get historical candle data for sparkline charts.
 */
export async function getCandles(symbol: string, days: number = 5): Promise<CandleData[]> {
  const cacheKey = `${symbol}:${days}`;
  const cached = getCached(candleCache, cacheKey);
  if (cached) return cached;

  await acquireToken();
  try {
    const now = new Date();
    const from = new Date(now);
    // Add extra days to account for weekends/holidays
    from.setDate(from.getDate() - (days * 2 + 5));

    const result: any[] = await yahooFinance.historical(symbol, {
      period1: from,
      period2: now,
      interval: '1d',
    });

    const candles: CandleData[] = result.slice(-days).map((bar: any) => ({
      date: (bar.date as Date)?.toISOString?.().split('T')[0] ?? '',
      close: (bar.close as number) ?? 0,
    }));

    setCache(candleCache, cacheKey, candles, CANDLE_TTL);
    return candles;
  } catch (err) {
    console.error('[stock-service] candles error:', err);
    return [];
  }
}

/**
 * Get FX rate between two currencies (e.g., "AUD", "USD").
 * Uses Yahoo Finance currency pairs like "AUDUSD=X".
 */
export async function getFxRate(from: string, to: string): Promise<number> {
  if (from === to) return 1;

  const pair = `${from}${to}=X`;
  const cached = getCached(fxCache, pair);
  if (cached !== null) return cached;

  await acquireToken();
  try {
    const result: any = await yahooFinance.quote(pair);
    const rate: number = Array.isArray(result)
      ? (result[0]?.regularMarketPrice ?? 1)
      : (result?.regularMarketPrice ?? 1);
    setCache(fxCache, pair, rate, FX_TTL);
    return rate;
  } catch (err) {
    console.error('[stock-service] FX rate error:', err);
    // Try inverse
    const inversePair = `${to}${from}=X`;
    try {
      const inv: any = await yahooFinance.quote(inversePair);
      const invRate: number = Array.isArray(inv)
        ? (inv[0]?.regularMarketPrice ?? 1)
        : (inv?.regularMarketPrice ?? 1);
      const rate = invRate > 0 ? 1 / invRate : 1;
      setCache(fxCache, pair, rate, FX_TTL);
      return rate;
    } catch {
      return 1;
    }
  }
}

/**
 * Get market status for a given exchange symbol.
 */
export async function getMarketStatus(
  symbols: string[],
): Promise<Record<string, { open: boolean; state: string }>> {
  // We can infer market state from the quote's marketState field
  const quotes = await getQuotes(symbols);
  const status: Record<string, { open: boolean; state: string }> = {};
  for (const q of quotes) {
    status[q.symbol] = {
      open: q.marketState === 'REGULAR',
      state: q.marketState || 'CLOSED',
    };
  }
  return status;
}
