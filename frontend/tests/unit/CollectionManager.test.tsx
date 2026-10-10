// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  buildCollectionPreset,
  CollectionManager,
} from '../../src/components/settings/CollectionManager.js';
import type { CollectionConfig } from '../../src/state/collectionHooks.js';
import { ApiRequestError } from '../../src/lib/apiClient.js';
const hooks = vi.hoisted(() => {
  const config: CollectionConfig = {
    configured: false,
    revision: 0,
    runtimeEpoch: 'epoch',
    timezone: null,
    providerLabel: null,
    streams: [],
  };
  return {
    preview: vi.fn(),
    save: vi.fn(),
    refetch: vi.fn(),
    config,
    pending: false,
  };
});
vi.mock('../../src/state/collectionHooks.js', () => ({
  useCollectionConfig: () => ({
    data: hooks.config,
    isLoading: false,
    isError: false,
    refetch: hooks.refetch,
  }),
  useCollectionPreview: () => ({ mutateAsync: hooks.preview, isPending: hooks.pending }),
  useCollectionSave: () => ({ mutateAsync: hooks.save, isPending: false }),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  hooks.pending = false;
  hooks.config = {
    configured: false,
    revision: 0,
    runtimeEpoch: 'epoch',
    timezone: null,
    providerLabel: null,
    streams: [],
  };
});
describe('household preset draft', () => {
  it('builds independent weekly/A/B schedules anchored on the normal Recycling date', () => {
    const streams = buildCollectionPreset(3, '2026-10-14');
    expect(streams.map((s) => [s.name, s.color, s.schedule])).toEqual([
      [
        'General waste',
        '#EF4444',
        { mode: 'regular', weekdays: [3], intervalWeeks: 1, anchorDate: '2026-10-14' },
      ],
      [
        'Recycling',
        '#EAB308',
        { mode: 'regular', weekdays: [3], intervalWeeks: 2, anchorDate: '2026-10-14' },
      ],
      [
        'Garden',
        '#22C55E',
        { mode: 'regular', weekdays: [3], intervalWeeks: 2, anchorDate: '2026-10-21' },
      ],
    ]);
    expect(new Set(streams.map((s) => s.id)).size).toBe(3);
  });
  it('requires explicit timezone confirmation and a current preview, invalidates edits, retains failures and cancels', async () => {
    hooks.preview.mockResolvedValue({
      canSave: true,
      previewDigest: 'digest',
      groups: [],
      blockers: [],
    });
    hooks.save.mockRejectedValue(new Error('Temporary failure; draft retained'));
    render(<CollectionManager />);
    fireEvent.change(screen.getByLabelText('Household timezone'), {
      target: { value: 'Australia/Sydney' },
    });
    fireEvent.change(screen.getByLabelText('Normal Recycling collection date'), {
      target: { value: '2026-10-14' },
    });
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Use weekly / alternating preset' })
        .disabled,
    ).toBe(true);
    fireEvent.click(
      screen.getByLabelText('I confirm the household timezone and normal provider date'),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Use weekly / alternating preset' }));
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Save collections' }).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Preview dates' }));
    await waitFor(() => expect(hooks.preview).toHaveBeenCalledTimes(1));
    expect(hooks.preview.mock.calls[0]?.[0].range).toEqual({
      from: '2026-10-14',
      to: '2026-11-11',
    });
    await waitFor(() =>
      expect(
        screen.getByRole<HTMLButtonElement>('button', { name: 'Save collections' }).disabled,
      ).toBe(false),
    );
    fireEvent.change(screen.getByLabelText('Provider label (private, optional)'), {
      target: { value: 'Private provider' },
    });
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Save collections' }).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Preview dates' }));
    await waitFor(() =>
      expect(
        screen.getByRole<HTMLButtonElement>('button', { name: 'Save collections' }).disabled,
      ).toBe(false),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save collections' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('draft retained'));
    expect(
      screen.getByLabelText<HTMLInputElement>('Provider label (private, optional)').value,
    ).toBe('Private provider');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('button', { name: 'Save collections' })).toBeNull();
    expect(hooks.save).toHaveBeenCalledTimes(1);
  });
  it('rejects mismatched weekday without silently changing normal dates', () => {
    expect(() => buildCollectionPreset(3, '2026-10-15')).toThrow(/weekday/i);
  });
  it('requires renewed destructive confirmation after rebase and keeps all retained fields', async () => {
    const stream = buildCollectionPreset(3, '2026-10-14')[0]!;
    hooks.config = {
      configured: true,
      revision: 1,
      runtimeEpoch: 'epoch',
      timezone: 'Australia/Sydney',
      providerLabel: null,
      streams: [stream],
    };
    hooks.preview.mockRejectedValueOnce(
      new ApiRequestError(409, { error: 'RESOURCE_CONFLICT', message: 'Changed' }),
    );
    hooks.preview.mockResolvedValue({
      canSave: true,
      previewDigest: 'new',
      groups: [],
      blockers: [],
    });
    render(<CollectionManager />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit collection configuration' }));
    fireEvent.change(screen.getByLabelText('Provider label (private, optional)'), {
      target: { value: 'Retained label' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Remove stream' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm remove stream' }));
    fireEvent.click(screen.getByRole('button', { name: 'Preview dates' }));
    await screen.findByRole('button', { name: 'Reload and rebase retained draft' });
    hooks.config = { ...hooks.config, revision: 2 };
    hooks.refetch.mockResolvedValue({ data: hooks.config });
    fireEvent.click(screen.getByRole('button', { name: 'Reload and rebase retained draft' }));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Reload and rebase retained draft' })).toBeNull(),
    );
    expect(
      screen.getByLabelText<HTMLInputElement>('Provider label (private, optional)').value,
    ).toBe('Retained label');
    fireEvent.click(screen.getByRole('button', { name: 'Review retained destructive changes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm retained draft removals' }));
    fireEvent.click(screen.getByRole('button', { name: 'Preview dates' }));
    await waitFor(() => expect(hooks.preview).toHaveBeenCalledTimes(2));
    expect(hooks.preview.mock.calls[1]?.[0]).toMatchObject({
      expectedRevision: 2,
      streams: [],
      confirmations: { deletedStreamIds: [stream.id] },
    });
  });
  it('prevents editing the submitted draft while preview/save is in flight', () => {
    hooks.config = {
      configured: true,
      revision: 1,
      runtimeEpoch: 'epoch',
      timezone: 'UTC',
      providerLabel: null,
      streams: [],
    };
    const view = render(<CollectionManager />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit collection configuration' }));
    hooks.pending = true;
    view.rerender(<CollectionManager />);
    const input = screen.getByLabelText('Provider label (private, optional)');
    expect(input.closest('fieldset')?.disabled).toBe(true);
  });
});
