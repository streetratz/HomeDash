/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WidgetPicker } from '../WidgetPicker.js';

afterEach(cleanup);

describe('WidgetPicker', () => {
  it('filters the categorized catalog and selects a widget', () => {
    const onOpenChange = vi.fn();
    const onSelect = vi.fn();

    render(<WidgetPicker open onOpenChange={onOpenChange} onSelect={onSelect} />);

    expect(screen.getByRole('heading', { name: 'Essentials' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Monitoring' })).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Search widgets'), {
      target: { value: 'music' },
    });

    expect(screen.getByRole('button', { name: /Sonos Music/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Spotify/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Docker Containers/ })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Sonos Music/ }));

    expect(onSelect).toHaveBeenCalledWith(
      'sonos_music',
      expect.objectContaining({ showGrouping: true }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
