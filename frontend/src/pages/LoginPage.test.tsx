/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { LoginPage, normalizeReturnTo } from './LoginPage.js';

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

describe('normalizeReturnTo', () => {
  it.each([
    ['/settings?tab=security#sessions', '/settings?tab=security#sessions'],
    ['/', '/'],
    [null, '/'],
    ['//attacker.example', '/'],
    ['%2F%2Fattacker.example', '/'],
    ['\\attacker.example', '/'],
    ['/\\attacker.example', '/'],
    ['https://attacker.example', '/'],
    ['javascript:alert(1)', '/'],
    ['/%00settings', '/'],
    ['/%E0%A4%A', '/'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeReturnTo(input)).toBe(expected);
  });
});
