/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsErrorState, SettingsLoadingState } from '../SettingsDataState.js';

afterEach(cleanup);

describe('settings data states', () => {
  it('announces loading state', () => {
    render(<SettingsLoadingState label="Loading widgets…" />);

    expect(screen.getByRole('status').textContent).toContain('Loading widgets');
  });

  it('shows a recoverable error state', () => {
    const onRetry = vi.fn();
    render(<SettingsErrorState message="Widgets could not be loaded." onRetry={onRetry} />);

    expect(screen.getByRole('alert').textContent).toContain('Widgets could not be loaded');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
