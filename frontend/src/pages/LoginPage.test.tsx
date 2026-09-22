/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { LoginPage } from './LoginPage.js';

afterEach(cleanup);

describe('LoginPage password visibility', () => {
  it('reveals and re-masks the password without changing its value', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    const password = screen.getByLabelText('Password');
    fireEvent.change(password, { target: { value: 'correct horse battery staple' } });

    expect(password.getAttribute('type')).toBe('password');
    expect(password.getAttribute('autocomplete')).toBe('current-password');

    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));

    expect(password.getAttribute('type')).toBe('text');
    expect(password.getAttribute('value')).toBe('correct horse battery staple');
    expect(screen.getByRole('button', { name: 'Hide password' }).getAttribute('aria-pressed')).toBe(
      'true',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));

    expect(password.getAttribute('type')).toBe('password');
    expect(password.getAttribute('value')).toBe('correct horse battery staple');
  });
});
