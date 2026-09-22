import { describe, expect, it } from 'vitest';
import { isValidStockLot } from '../StocksConfigForm.js';

describe('isValidStockLot', () => {
  it('accepts a valid holding lot', () => {
    expect(
      isValidStockLot({
        purchasePrice: 123.45,
        quantity: 10.5,
        tradeDate: '2026-09-19',
      }),
    ).toBe(true);
  });

  it.each([
    { purchasePrice: 0, quantity: 1, tradeDate: '2026-09-19' },
    { purchasePrice: 1, quantity: 0, tradeDate: '2026-09-19' },
    { purchasePrice: Number.NaN, quantity: 1, tradeDate: '2026-09-19' },
    { purchasePrice: 1, quantity: 1, tradeDate: '2026-02-30' },
    { purchasePrice: 1, quantity: 1, tradeDate: '19/09/2026' },
  ])('rejects invalid lot %#', (lot) => {
    expect(isValidStockLot(lot)).toBe(false);
  });
});
