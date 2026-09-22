import { describe, expect, it } from 'vitest';

import { StocksConfigSchema } from '../../src/lib/validation.js';

function configWithTradeDate(tradeDate: string) {
  return {
    groups: [
      {
        id: 'portfolio',
        name: 'Portfolio',
        currency: 'AUD',
        tickers: [
          {
            symbol: 'MSFT',
            lots: [{ purchasePrice: 100, quantity: 2, tradeDate }],
          },
        ],
      },
    ],
  };
}

describe('StocksConfigSchema trade dates', () => {
  it.each(['2026-09-19', '20260919', '2026/09/19'])(
    'accepts valid current and legacy Yahoo format %s',
    (tradeDate) => {
      expect(StocksConfigSchema.safeParse(configWithTradeDate(tradeDate)).success).toBe(true);
    },
  );

  it.each(['not-a-date', '2026-02-30', '20261301', '2026/00/19'])(
    'rejects malformed or impossible date %s',
    (tradeDate) => {
      expect(StocksConfigSchema.safeParse(configWithTradeDate(tradeDate)).success).toBe(false);
    },
  );
});
