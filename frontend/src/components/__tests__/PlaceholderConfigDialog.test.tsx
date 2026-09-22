/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlaceholderConfigDialog } from '../PlaceholderConfigDialog.js';
import type { PlaceholderDraft } from '../../state/useEditMode.js';

const placeholder: PlaceholderDraft = {
  stableKey: 'placeholder-1',
  x: 0,
  y: 0,
  w: 4,
  h: 3,
  borderColor: '#3b82f6',
  borderSize: 2,
  showBorder: true,
  title: 'Weather',
  showTitle: true,
  titleStyle: 'header',
  childLayout: 'stacked',
  opacity: 0.3,
  backgroundStyle: 'solid',
  backgroundColor: null,
  widgets: [
    {
      draftId: 'widget-1',
      type: 'unknown-one',
      orderIndex: 0,
      configJson: '{}',
      publicVisibility: 'hidden',
      links: [],
    },
    {
      draftId: 'widget-2',
      type: 'unknown-two',
      orderIndex: 1,
      configJson: '{}',
      publicVisibility: 'hidden',
      links: [],
    },
  ],
};

function renderDialog(overrides: Partial<React.ComponentProps<typeof PlaceholderConfigDialog>> = {}) {
  const props: React.ComponentProps<typeof PlaceholderConfigDialog> = {
    placeholder,
    open: true,
    onOpenChange: vi.fn(),
    dashboardDirty: false,
    onSave: vi.fn(),
    onRestorePlaceholder: vi.fn(),
    onAddWidget: vi.fn(),
    onRemoveWidget: vi.fn(),
    onReorderWidgets: vi.fn(),
    onUpdateWidgetConfig: vi.fn(),
    onUpdateWidgetVisibility: vi.fn(),
    ...overrides,
  };
  render(<PlaceholderConfigDialog {...props} />);
  return props;
}

afterEach(cleanup);

describe('PlaceholderConfigDialog draft semantics', () => {
  it('restores the opening snapshot when canceled', () => {
    const props = renderDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(props.onRestorePlaceholder).toHaveBeenCalledWith(
      placeholder.stableKey,
      expect.objectContaining({
        stableKey: placeholder.stableKey,
        title: placeholder.title,
        widgets: placeholder.widgets,
      }),
      false,
    );
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('applies placeholder changes without restoring the snapshot', () => {
    const props = renderDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Apply to Draft' }));

    expect(props.onSave).toHaveBeenCalledWith(
      placeholder.stableKey,
      expect.objectContaining({ title: placeholder.title }),
    );
    expect(props.onRestorePlaceholder).not.toHaveBeenCalled();
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('captures a fresh snapshot when the same container is reopened', () => {
    const onOpenChange = vi.fn();
    const onRestorePlaceholder = vi.fn();
    const props: React.ComponentProps<typeof PlaceholderConfigDialog> = {
      placeholder,
      open: true,
      onOpenChange,
      dashboardDirty: false,
      onSave: vi.fn(),
      onRestorePlaceholder,
      onAddWidget: vi.fn(),
      onRemoveWidget: vi.fn(),
      onReorderWidgets: vi.fn(),
      onUpdateWidgetConfig: vi.fn(),
      onUpdateWidgetVisibility: vi.fn(),
    };
    const { rerender } = render(<PlaceholderConfigDialog {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    rerender(<PlaceholderConfigDialog {...props} open={false} />);
    rerender(<PlaceholderConfigDialog {...props} open />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onRestorePlaceholder).toHaveBeenCalledTimes(2);
  });
});
