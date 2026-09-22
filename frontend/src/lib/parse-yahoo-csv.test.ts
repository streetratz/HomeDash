import { describe, expect, it } from 'vitest';
import { parseYahooCsv } from './parse-yahoo-csv.js';

describe('parseYahooCsv', () => {
  it('normalizes supported Yahoo trade dates', () => {
    const result = parseYahooCsv(
      [
        'Symbol,Trade Date,Purchase Price,Quantity',
        'MSFT,20260919,100,2',
        'AAPL,2026/09/18,200,3',
      ].join('\n'),
    );

    expect(result.errors).toEqual([]);
    expect(result.tickers).toEqual([
      {
        symbol: 'MSFT',
        lots: [{ purchasePrice: 100, quantity: 2, tradeDate: '2026-09-19' }],
      },
      {
        symbol: 'AAPL',
        lots: [{ purchasePrice: 200, quantity: 3, tradeDate: '2026-09-18' }],
      },
    ]);
  });

  it.each([
    ['', 'missing'],
    ['19/09/2026', 'unsupported'],
    ['2026-02-30', 'invalid'],
  ])('imports the symbol without a lot when the trade date is %s (%s)', (tradeDate) => {
    const result = parseYahooCsv(
      [
        'Symbol,Trade Date,Purchase Price,Quantity',
        `MSFT,${tradeDate},100,2`,
      ].join('\n'),
    );

    expect(result.tickers).toEqual([{ symbol: 'MSFT', lots: [] }]);
    expect(result.errors).toEqual([
      'Row 2: purchase data requires a valid Trade Date; imported MSFT without the lot',
    ]);
  });
});
