/**
 * @vitest-environment jsdom
 */

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WidgetVisibilityControl } from '../PlaceholderConfigDialog.js';
import {
  buildLayoutPayload,
  type PlaceholderDraft,
  type WidgetDraft,
} from '../../state/useEditMode.js';

function widget(
  type: string,
  publicVisibility: WidgetDraft['publicVisibility'] = 'hidden',
): WidgetDraft {
  return {
    persistedId: '00000000-0000-4000-8000-000000000001',
    draftId: '00000000-0000-4000-8000-000000000001',
    type,
    orderIndex: 0,
    configJson: '{}',
    publicVisibility,
    links: [],
  };
}

afterEach(cleanup);

describe('widget public visibility administration', () => {
  it('includes public visibility in the layout save payload', () => {
    const draft: PlaceholderDraft = {
      persistedId: '00000000-0000-4000-8000-000000000010',
      stableKey: '00000000-0000-4000-8000-000000000010',
      x: 0,
      y: 0,
      w: 4,
      h: 3,
      borderColor: '#000000',
      borderSize: 1,
      showBorder: true,
      title: null,
      showTitle: false,
      titleStyle: 'header',
      childLayout: 'stacked',
      opacity: 0.5,
      backgroundStyle: 'solid',
      backgroundColor: null,
      widgets: [widget('pihole', 'read-only')],
    };

    const payload = buildLayoutPayload([draft]);

    expect(payload.placeholders[0]?.widgets[0]?.publicVisibility).toBe('read-only');
  });

  it('shows stronger warning copy for exposed infrastructure widgets', () => {
    const view = render(
      <WidgetVisibilityControl widget={widget('unifi', 'visible')} onChange={vi.fn()} />,
    );

    expect(view.getByText('Public dashboard visibility')).toBeTruthy();
    expect(view.getByRole('alert').textContent).toContain('household infrastructure');
  });

  it('explains that unsupported widget types remain private', () => {
    const view = render(
      <WidgetVisibilityControl widget={widget('docker')} onChange={vi.fn()} />,
    );

    expect(view.getByText('Private only')).toBeTruthy();
    expect(view.queryByRole('combobox')).toBeNull();
  });
});
