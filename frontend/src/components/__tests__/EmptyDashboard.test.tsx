/**
 * @vitest-environment jsdom
 */

import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { EmptyDashboard } from '../EmptyDashboard.js';

afterEach(cleanup);

describe('EmptyDashboard', () => {
  it('gives administrators a direct path to dashboard settings', () => {
    render(
      <MemoryRouter>
        <EmptyDashboard isAdmin isAuthenticated hasNoDashboard />
      </MemoryRouter>,
    );

    const link = screen.getByRole('link', { name: 'Open dashboard settings' });
    expect(link.getAttribute('href')).toBe('/settings?tab=dashboards');
    expect(screen.getByText('Create your first dashboard to start adding widgets.')).toBeTruthy();
  });

  it('keeps the public empty state informational', () => {
    render(
      <MemoryRouter>
        <EmptyDashboard isAdmin={false} isAuthenticated={false} hasNoDashboard />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('link', { name: 'Open dashboard settings' })).toBeNull();
    expect(screen.getByText('No public dashboard has been configured yet.')).toBeTruthy();
  });
});
