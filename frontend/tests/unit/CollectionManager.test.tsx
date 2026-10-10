// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { buildCollectionPreset, CollectionManager } from '../../src/components/settings/CollectionManager.js';
const hooks = vi.hoisted(() => ({
  preview: vi.fn(), save: vi.fn(), refetch: vi.fn(),
  config: { configured: false, revision: 0, runtimeEpoch: 'epoch', timezone: null, providerLabel: null, streams: [] },
}));
vi.mock('../../src/state/collectionHooks.js', () => ({
  useCollectionConfig: () => ({ data: hooks.config, isLoading: false, isError: false, refetch: hooks.refetch }),
  useCollectionPreview: () => ({ mutateAsync: hooks.preview, isPending: false }),
  useCollectionSave: () => ({ mutateAsync: hooks.save, isPending: false }),
}));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
describe('household preset draft', () => {
  it('builds independent weekly/A/B schedules anchored on the normal Recycling date', () => {
    const streams = buildCollectionPreset(3, '2026-10-14');
    expect(streams.map(s => [s.name, s.color, s.schedule])).toEqual([
      ['General waste', '#EF4444', { mode: 'regular', weekdays: [3], intervalWeeks: 1, anchorDate: '2026-10-14' }],
      ['Recycling', '#EAB308', { mode: 'regular', weekdays: [3], intervalWeeks: 2, anchorDate: '2026-10-14' }],
      ['Garden', '#22C55E', { mode: 'regular', weekdays: [3], intervalWeeks: 2, anchorDate: '2026-10-21' }],
    ]);
    expect(new Set(streams.map(s => s.id)).size).toBe(3);
  });
  it('requires explicit timezone confirmation and a current preview, invalidates edits, retains failures and cancels', async () => {
    hooks.preview.mockResolvedValue({ canSave: true, previewDigest: 'digest', groups: [], blockers: [] });
    hooks.save.mockRejectedValue(new Error('Temporary failure; draft retained'));
    render(<CollectionManager />);
    fireEvent.change(screen.getByLabelText('Household timezone'), { target: { value: 'Australia/Sydney' } });
    fireEvent.change(screen.getByLabelText('Normal Recycling collection date'), { target: { value: '2026-10-14' } });
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Use weekly / alternating preset' }).disabled).toBe(true);
    fireEvent.click(screen.getByLabelText('I confirm the household timezone and normal provider date'));
    fireEvent.click(screen.getByRole('button', { name: 'Use weekly / alternating preset' }));
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Save collections' }).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Preview dates' }));
    await waitFor(() => expect(hooks.preview).toHaveBeenCalledTimes(1));
    expect(hooks.preview.mock.calls[0]?.[0].range).toEqual({ from: '2026-10-14', to: '2026-11-11' });
    await waitFor(() => expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Save collections' }).disabled).toBe(false));
    fireEvent.change(screen.getByLabelText('Provider label (private, optional)'), { target: { value: 'Private provider' } });
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Save collections' }).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Preview dates' }));
    await waitFor(() => expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Save collections' }).disabled).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: 'Save collections' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('draft retained'));
    expect(screen.getByLabelText<HTMLInputElement>('Provider label (private, optional)').value).toBe('Private provider');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('button', { name: 'Save collections' })).toBeNull();
    expect(hooks.save).toHaveBeenCalledTimes(1);
  });
  it('rejects mismatched weekday without silently changing normal dates', () => {
    expect(() => buildCollectionPreset(3, '2026-10-15')).toThrow(/weekday/i);
  });
});
