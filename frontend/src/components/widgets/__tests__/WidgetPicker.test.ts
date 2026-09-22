import { describe, expect, it } from 'vitest';
import { widgetRegistry } from '../registry.js';
import { buildWidgetPickerSections } from '../WidgetPicker.js';

describe('widget picker organization', () => {
  it('groups widgets in category order and sorts each group alphabetically', () => {
    const sections = buildWidgetPickerSections([...widgetRegistry.values()], '');

    expect(sections.map((section) => section.category)).toEqual([
      'essentials',
      'content',
      'media',
      'monitoring',
    ]);

    for (const section of sections) {
      const names = section.widgets.map((widget) => widget.displayName);
      expect(names).toEqual([...names].sort((left, right) => left.localeCompare(right)));
    }
  });

  it('searches widget names, descriptions, and category labels', () => {
    const definitions = [...widgetRegistry.values()];

    expect(
      buildWidgetPickerSections(definitions, 'music')
        .flatMap((section) => section.widgets)
        .map((widget) => widget.displayName),
    ).toEqual(['Sonos Music', 'Spotify']);

    const monitoring = buildWidgetPickerSections(definitions, 'monitoring');
    expect(monitoring).toHaveLength(1);
    expect(monitoring[0]?.category).toBe('monitoring');
    expect(monitoring[0]?.widgets.length).toBeGreaterThan(1);
  });

  it('returns no empty categories when a search has no matches', () => {
    expect(buildWidgetPickerSections([...widgetRegistry.values()], 'not-a-widget')).toEqual([]);
  });
});
