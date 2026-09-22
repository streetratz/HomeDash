/**
 * @vitest-environment jsdom
 */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClockConfigForm } from '../ClockConfigForm.js';

afterEach(cleanup);

describe('widget configuration controls', () => {
  it('labels selects, grouped choices, and switches', () => {
    render(
      <ClockConfigForm
        config={{ timezone: null, format: '12h', showDate: true, showSeconds: false }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('combobox', { name: 'Timezone' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Time Format' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '12-hour' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(screen.getByRole('switch', { name: 'Show Date' })).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Show Seconds' })).toBeTruthy();
  });
});
