/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UsersTab } from '../UsersTab.js';

vi.mock('../../../state/users.js', () => ({
  useAdminUsers: () => ({
    data: [
      {
        id: 'user-2',
        username: 'jamie',
        displayName: 'Jamie Jones',
        role: 'standard',
        lastLoginAt: null,
        createdAt: '2026-09-20T00:00:00.000Z',
        groups: [],
      },
    ],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useCreateUser: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateUser: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteUser: () => ({ mutate: vi.fn(), isPending: false }),
  useResetUserPassword: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('../../../state/rbac.js', () => ({
  useGroups: () => ({ data: [] }),
}));

vi.mock('../../../state/bootstrap.js', () => ({
  useBootstrap: () => ({ user: { id: 'user-1' } }),
}));

afterEach(cleanup);

describe('settings management actions', () => {
  it('gives user actions explicit accessible names and mobile touch targets', () => {
    render(<UsersTab />);

    for (const name of [
      'Edit Jamie Jones',
      'Reset password for Jamie Jones',
      'Delete Jamie Jones',
    ]) {
      const button = screen.getByRole('button', { name });
      expect(button.className).toContain('h-11');
      expect(button.className).toContain('w-11');
    }
  });

  it('clears password fields when the reset dialog is canceled', () => {
    render(<UsersTab />);

    fireEvent.click(screen.getByRole('button', { name: 'Reset password for Jamie Jones' }));
    fireEvent.change(screen.getByLabelText('New Password'), {
      target: { value: 'temporary-password' },
    });
    fireEvent.change(screen.getByLabelText('Confirm New Password'), {
      target: { value: 'temporary-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    fireEvent.click(screen.getByRole('button', { name: 'Reset password for Jamie Jones' }));

    const newPassword = screen.getByLabelText<HTMLInputElement>('New Password');
    const confirmedPassword =
      screen.getByLabelText<HTMLInputElement>('Confirm New Password');
    expect(newPassword.value).toBe('');
    expect(confirmedPassword.value).toBe('');
  });
});
