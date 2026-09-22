/**
 * 021-stocks-widget: Stock market API routes.
 * Proxy endpoints for quotes, search, candles, and market status.
 */

import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../auth/requireRole.js';
import { getQuotes, searchSymbol, getCandles, getFxRate, getMarketStatus } from '../services/stock-service.js';
import { getDb } from '../db/drizzle.js';
import { appWidgetInstances } from '../db/schema/index.js';
import { eq } from 'drizzle-orm';

interface StocksWidgetConfig {
  groups: Array<{
    id: string;
    name: string;
    currency: string;
    tickers: Array<{ symbol: string }>;
  }>;
  displayCurrency: string;
}

type WidgetParams = { Params: { widgetId: string } };
type SearchQuery = { Querystring: { q: string } };
type CandlesQuery = { Params: { widgetId: string }; Querystring: { days?: string } };

/**
 * Helper to load widget config by instance ID.
 */
function getWidgetConfig(widgetId: string): StocksWidgetConfig | null {
  const db = getDb();
  const row = db
    .select({ configJson: appWidgetInstances.configJson })
    .from(appWidgetInstances)
    .where(eq(appWidgetInstances.id, widgetId))
    .get();

  if (!row?.configJson) return null;
  try {
    return JSON.parse(row.configJson) as StocksWidgetConfig;
  } catch {
    return null;
  }
}

export function registerStocksRoutes(app: FastifyInstance): void {
  // ── GET /api/stocks/:widgetId/quotes ─────────────────────────────────────
  app.get<WidgetParams>(
    '/api/stocks/:widgetId/quotes',
    async (request, reply) => {
      requireAuth(request, reply);

      const config = getWidgetConfig(request.params.widgetId);
      if (!config) {
        return reply.status(404).send({ error: 'Widget not found or not configured' });
      }

      // Collect all unique symbols across groups
      const allSymbols = [
        ...new Set(config.groups.flatMap((g) => g.tickers.map((t) => t.symbol))),
      ];

      if (allSymbols.length === 0) {
        return reply.status(200).send({ quotes: [], fxRates: {}, timestamp: Date.now() });
      }

      // Fetch quotes
      const quotes = await getQuotes(allSymbols);

      // Determine which FX rates we need
      const displayCurrency = config.displayCurrency || 'AUD';
      const currencies = [...new Set(config.groups.map((g) => g.currency))];
      const fxRates: Record<string, number> = {};

      for (const cur of currencies) {
        if (cur !== displayCurrency) {
          fxRates[`${cur}${displayCurrency}`] = await getFxRate(cur, displayCurrency);
        }
      }

      return reply.status(200).send({
        quotes,
        fxRates,
        displayCurrency,
        timestamp: Date.now(),
      });
    },
  );

  // ── GET /api/stocks/search?q=<query> ─────────────────────────────────────
  app.get<SearchQuery>('/api/stocks/search', async (request, reply) => {
    requireAuth(request, reply);

    const query = request.query.q?.trim();
    if (!query || query.length < 1) {
      return reply.status(200).send({ results: [] });
    }

    const results = await searchSymbol(query);
    return reply.status(200).send({ results });
  });

  // ── GET /api/stocks/:widgetId/candles?days=5 ─────────────────────────────
  app.get<CandlesQuery>(
    '/api/stocks/:widgetId/candles',
    async (request, reply) => {
      requireAuth(request, reply);

      const config = getWidgetConfig(request.params.widgetId);
      if (!config) {
        return reply.status(404).send({ error: 'Widget not found or not configured' });
      }

      const days = Math.min(Math.max(parseInt(request.query.days || '5', 10) || 5, 1), 30);
      const allSymbols = [
        ...new Set(config.groups.flatMap((g) => g.tickers.map((t) => t.symbol))),
      ];

      const candles: Record<string, Array<{ date: string; close: number }>> = {};
      for (const sym of allSymbols) {
        candles[sym] = await getCandles(sym, days);
      }

      return reply.status(200).send({ candles, timestamp: Date.now() });
    },
  );

  // ── GET /api/stocks/:widgetId/market-status ──────────────────────────────
  app.get<WidgetParams>(
    '/api/stocks/:widgetId/market-status',
    async (request, reply) => {
      requireAuth(request, reply);

      const config = getWidgetConfig(request.params.widgetId);
      if (!config) {
        return reply.status(404).send({ error: 'Widget not found or not configured' });
      }

      // Get one symbol per group to check market status
      const sampleSymbols = config.groups
        .filter((g) => g.tickers.length > 0)
        .map((g) => g.tickers[0]!.symbol);

      const status = await getMarketStatus(sampleSymbols);
      return reply.status(200).send({ markets: status });
    },
  );
}
