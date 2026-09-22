/**
 * @vitest-environment jsdom
 */

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { WidgetView } from '../../../state/dashboards.js';
import { ClockWidget } from '../ClockWidget.js';

function clockWidget(timezone: string): WidgetView {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    type: 'clock',
    orderIndex: 0,
    config: {
      timezone,
      format: '12h',
      showDate: true,
      showSeconds: true,
    },
    links: [],
  };
}

describe('ClockWidget', () => {
  afterEach(cleanup);

  it('falls back to browser-local time for an invalid configured timezone', () => {
    const view = render(<ClockWidget widget={clockWidget('Invalid/Timezone_XYZ')} />);

    expect(view.getByTestId('clock-widget').getAttribute('data-timezone')).toBe('local');
    expect(view.queryByTestId('clock-timezone')).toBeNull();
    expect(view.getByTestId('clock-time').textContent).not.toBe('');
  });
});
