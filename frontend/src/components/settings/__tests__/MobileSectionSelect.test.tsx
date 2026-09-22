/**
 * @vitest-environment jsdom
 */

import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MobileSectionSelect } from '../MobileSectionSelect.js';

const options = [
  { value: 'general', label: 'General' },
  { value: 'appearance', label: 'Appearance' },
] as const;

function TestHarness() {
  const [value, setValue] = useState<(typeof options)[number]['value']>('general');

  return (
    <MobileSectionSelect
      label="Settings section"
      value={value}
      options={options}
      onValueChange={setValue}
    />
  );
}

beforeAll(() => {
  Object.defineProperties(HTMLElement.prototype, {
    hasPointerCapture: { configurable: true, value: () => false },
    releasePointerCapture: { configurable: true, value: vi.fn() },
    scrollIntoView: { configurable: true, value: vi.fn() },
  });
});

afterEach(cleanup);

describe('MobileSectionSelect', () => {
  it('exposes its label and changes the selected section', () => {
    render(<TestHarness />);

    const trigger = screen.getByRole('combobox', { name: 'Settings section' });
    expect(trigger.textContent).toContain('General');

    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.click(screen.getByRole('option', { name: 'Appearance' }));

    expect(trigger.textContent).toContain('Appearance');
  });
});
