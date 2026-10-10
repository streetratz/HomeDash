// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CollectionExceptionEditor } from '../../src/components/settings/CollectionExceptionEditor.js';
afterEach(cleanup);
describe('reversible per-stream exception editor', () => {
  it('labels scheduled origin versus actual date, preserves identity and requires removal confirmation', () => {
    const change = vi.fn();
    const exception = {
      id: '06500000-0000-4000-8000-000000000004',
      kind: 'replace' as const,
      originalDate: '2026-12-25',
      actualDate: '2026-12-26',
    };
    render(<CollectionExceptionEditor exceptions={[exception]} onChange={change} />);
    fireEvent.change(screen.getByLabelText('Actual collection date'), {
      target: { value: '2026-12-24' },
    });
    expect(change).toHaveBeenLastCalledWith([{ ...exception, actualDate: '2026-12-24' }], false);
    fireEvent.click(screen.getByRole('button', { name: 'Remove exception' }));
    expect(change).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm remove exception' }));
    expect(change).toHaveBeenLastCalledWith([], true);
  });
});
