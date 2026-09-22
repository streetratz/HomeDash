/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WidgetsTab } from '../WidgetsTab.js';

const navigate = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
}));

vi.mock('../../../state/adminDashboards.js', () => ({
  useAdminDashboards: () => ({
    data: [{ id: 'dashboard-1', name: 'Home' }],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
  navigate.mockReset();
});

describe('WidgetsTab', () => {
  it('routes widget management to the dashboard editor', () => {
    render(<WidgetsTab />);

    fireEvent.click(screen.getByRole('button', { name: 'Open Dashboard Editor' }));

    expect(navigate).toHaveBeenCalledWith('/', {
      state: { startDashboardEdit: true },
    });
  });
});
