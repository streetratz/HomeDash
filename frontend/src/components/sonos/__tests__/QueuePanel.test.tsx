/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueuePanel } from '../QueuePanel.js';

const clearQueue = vi.fn();
let localOnly = false;

vi.mock('../../../hooks/useSonos.js', () => ({
  useSonosQueue: () => ({
    data: localOnly
      ? { items: [], currentTrack: 0, localOnly: true }
      : {
          items: [
            {
              trackNumber: 1,
              title: 'Track one',
              artist: 'Artist',
              duration: 180,
            },
          ],
          currentTrack: 1,
        },
    isLoading: false,
  }),
  useClearQueue: () => ({ mutate: clearQueue, isPending: false }),
  usePlayFromQueue: () => ({ mutate: vi.fn(), isPending: false }),
}));

const accent = {
  text: 'text-orange-400',
  btnBg: 'bg-orange-500',
  dot: 'bg-orange-500',
};

describe('QueuePanel', () => {
  afterEach(() => {
    cleanup();
    clearQueue.mockReset();
    localOnly = false;
  });

  it('requires confirmation before clearing the queue', () => {
    render(<QueuePanel groupId="group-1" accent={accent} />);

    fireEvent.click(screen.getByRole('button', { name: 'Clear queue' }));
    expect(screen.getByRole('heading', { name: 'Clear the queue?' })).not.toBeNull();
    expect(clearQueue).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Clear queue' }));
    expect(clearQueue).toHaveBeenCalledWith({ groupId: 'group-1' });
  });

  it('explains that queue management requires local mode', () => {
    localOnly = true;
    render(<QueuePanel groupId="group-1" accent={accent} />);

    expect(screen.getByText('Queue is available in local mode only')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Clear queue' })).toBeNull();
  });
});
