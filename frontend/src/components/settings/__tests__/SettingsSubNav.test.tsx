/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { SettingsSubNav, type SettingsSubNavGroup } from '../SettingsSubNav.js';

afterEach(cleanup);

const groups: SettingsSubNavGroup[] = [
  { label: 'Infrastructure', items: [{ id: 'docker', label: 'Docker' }] },
  {
    label: 'Media',
    items: [
      { id: 'photos', label: 'Photo Sources' },
      { id: 'sonos', label: 'Sonos' },
    ],
  },
];

describe('SettingsSubNav', () => {
  it('renders both responsive variants and marks the active item', () => {
    render(
      <SettingsSubNav
        ariaLabel="Integration sections"
        groups={groups}
        activeId="sonos"
        onSelect={() => {}}
      />,
    );

    // Both breakpoints render in jsdom (CSS visibility is not applied); exactly
    // one is shown at a time in the browser via responsive utility classes.
    const navs = screen.getAllByRole('navigation', { name: 'Integration sections' });
    expect(navs).toHaveLength(2);

    // Mobile variant is a collapsed disclosure whose trigger shows the active
    // trail (group · item) without revealing the list.
    const trigger = screen.getByRole('button', { expanded: false });
    expect(trigger.textContent).toContain('Media');
    expect(trigger.textContent).toContain('Sonos');

    // Desktop rail lists every item; the active one is marked.
    const sonos = screen.getByRole('button', { name: 'Sonos' });
    expect(sonos.getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('button', { name: 'Docker' }).getAttribute('aria-current')).toBeNull();
  });

  it('reports the selected item id from the desktop rail', () => {
    const onSelect = vi.fn();
    render(
      <SettingsSubNav
        ariaLabel="Integration sections"
        groups={groups}
        activeId="docker"
        onSelect={onSelect}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Photo Sources' }));
    expect(onSelect).toHaveBeenCalledWith('photos');
  });

  it('expands the mobile disclosure and reports selection', () => {
    const onSelect = vi.fn();
    render(
      <SettingsSubNav
        ariaLabel="Integration sections"
        groups={groups}
        activeId="docker"
        onSelect={onSelect}
      />,
    );

    const trigger = screen.getByRole('button', { expanded: false });
    const mobileNav = trigger.closest('nav');
    expect(mobileNav).not.toBeNull();

    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(within(mobileNav!).getByRole('button', { name: 'Sonos' }));
    expect(onSelect).toHaveBeenCalledWith('sonos');
  });
});
