/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { SettingsNav } from '../SettingsNav.js';

afterEach(cleanup);

describe('SettingsNav', () => {
  it('renders the desktop rail with the active leaf marked', () => {
    render(<SettingsNav activeLeafId="branding" isAdmin onSelect={() => {}} />);

    const rail = screen.getByRole('navigation', { name: 'Settings sections' });
    const active = within(rail).getByRole('button', { name: 'Branding' });
    expect(active.getAttribute('aria-current')).toBe('page');
  });

  it('reports the selected leaf id', () => {
    const onSelect = vi.fn();
    render(<SettingsNav activeLeafId="general" isAdmin onSelect={onSelect} />);

    const rail = screen.getByRole('navigation', { name: 'Settings sections' });
    fireEvent.click(within(rail).getByRole('button', { name: 'Integrations' }));
    expect(onSelect).toHaveBeenCalledWith('integrations');
  });

  it('hides admin-only leaves from non-admins', () => {
    render(<SettingsNav activeLeafId="general" isAdmin={false} onSelect={() => {}} />);

    const rail = screen.getByRole('navigation', { name: 'Settings sections' });
    expect(within(rail).getByRole('button', { name: 'General' })).toBeTruthy();
    expect(within(rail).queryByRole('button', { name: 'Branding' })).toBeNull();
    expect(within(rail).queryByRole('button', { name: 'Users' })).toBeNull();
  });
});
