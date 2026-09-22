/**
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StocksConfigForm } from '../StocksConfigForm.js';

afterEach(cleanup);

describe('StocksConfigForm holding editor', () => {
  it('shows imported lots and commits valid manual edits', () => {
    const onChange = vi.fn();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <StocksConfigForm
          config={{
            groups: [
              {
                id: 'portfolio',
                name: 'Imported Portfolio',
                currency: 'AUD',
                tickers: [
                  {
                    symbol: 'BHP.AX',
                    lots: [
                      {
                        quantity: 10,
                        purchasePrice: 42.5,
                        tradeDate: '2026-09-01',
                      },
                    ],
                  },
                ],
              },
            ],
            displayCurrency: 'AUD',
            refreshInterval: 300,
            displayMode: 'compact',
            showSparkline: false,
            reduceOffHours: true,
            hideZeroUnits: false,
          }}
          onChange={onChange}
        />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show holding details for BHP.AX' }));
    const quantity = screen.getByLabelText('Quantity');
    expect(quantity.getAttribute('value')).toBe('10');

    fireEvent.change(quantity, { target: { value: '12.5' } });
    fireEvent.blur(quantity);

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        groups: [
          expect.objectContaining({
            tickers: [
              expect.objectContaining({
                symbol: 'BHP.AX',
                lots: [
                  {
                    quantity: 12.5,
                    purchasePrice: 42.5,
                    tradeDate: '2026-09-01',
                  },
                ],
              }),
            ],
          }),
        ],
      }),
    );
  });
});
