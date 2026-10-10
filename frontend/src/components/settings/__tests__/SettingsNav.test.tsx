/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { SettingsNav, SettingsRailToggle } from '../SettingsNav.js';

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

  it('keeps an accessible name for every leaf when collapsed', () => {
    render(<SettingsNav activeLeafId="integrations" isAdmin onSelect={() => {}} collapsed />);

    const rail = screen.getByRole('navigation', { name: 'Settings sections' });
    // Collapsed buttons keep an accessible name via aria-label.
    expect(within(rail).getByRole('button', { name: 'Integrations' })).toBeTruthy();
  });
});

describe('SettingsRailToggle', () => {
  it('reports a toggle and reflects collapsed state', () => {
    const onToggle = vi.fn();
    const { rerender } = render(<SettingsRailToggle collapsed={false} onToggle={onToggle} />);

    const collapse = screen.getByRole('button', { name: 'Collapse settings menu' });
    expect(collapse.getAttribute('aria-expanded')).toBe('true');
    expect(collapse.getAttribute('aria-controls')).toBe('settings-primary-rail');
    fireEvent.click(collapse);
    expect(onToggle).toHaveBeenCalledTimes(1);

    rerender(<SettingsRailToggle collapsed onToggle={onToggle} />);
    const expand = screen.getByRole('button', { name: 'Expand settings menu' });
    expect(expand.getAttribute('aria-expanded')).toBe('false');
  });
});
