// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CollectionExplicitDatesEditor } from '../../src/components/settings/CollectionExplicitDatesEditor.js';
afterEach(cleanup);
describe('finite explicit date editor', () => {
  it('shows duplicate/bounds errors without silently changing entered dates', () => {
    const change = vi.fn();
    render(<CollectionExplicitDatesEditor dates={['2026-12-14', '2026-12-14']} onChange={change} />);
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Collection date 2').getAttribute('aria-invalid')).toBe('true');
    fireEvent.change(screen.getByLabelText('Collection date 2'), { target: { value: '2027-01-18' } });
    expect(change).toHaveBeenLastCalledWith(['2026-12-14', '2027-01-18']);
    expect(screen.getByText(/No inferred continuation/)).toBeTruthy();
  });
});
