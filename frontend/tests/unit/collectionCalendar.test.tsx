// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { CollectionGroup } from '../../src/components/calendar/CollectionGroup.js';
import { FullScreenCalendar } from '../../src/components/calendar/FullScreenCalendar.js';
import type { CalendarSource } from '../../src/state/calendarHooks.js';
const events = vi.hoisted(() => vi.fn((_ids: string[], _from: string, _to: string) => ({ data: [] })));
vi.mock('../../src/state/calendarHooks.js', () => ({ useCalendarEvents: events }));
vi.mock('../../src/state/bootstrap.js', () => ({ useClockFormat: () => ({ hour12: false }) }));
vi.mock('../../src/state/collectionHooks.js', () => ({ useCollectionDisplay: () => ({ data: undefined, isLoading: false, isError: false }) }));
afterEach(() => { cleanup(); events.mockClear(); });
describe('complete civil collection group', () => {
  it('renders all same-colour stream names and household date without interpreting markup', () => {
    render(<CollectionGroup group={{ date: '2026-10-14', streams: [
      { key: 'a', name: 'General waste', color: '#EAB308' },
      { key: 'b', name: '<script>untrusted</script>', color: '#EAB308' },
    ] }} today="2026-10-14" timezone="Australia/Sydney" next />);
    expect(screen.getByText('General waste')).toBeTruthy();
    expect(screen.getByText('<script>untrusted</script>')).toBeTruthy();
    expect(screen.getByRole('heading').textContent).toContain('Today · Wednesday, October 14, 2026');
    expect(screen.getByText('Australia/Sydney')).toBeTruthy();
    expect(document.querySelector('script')).toBeNull();
  });
  describe('originating widget fullscreen provider isolation', () => {
    const sources: CalendarSource[] = ['provider', 'birthday'].map(id => ({
      id, name: id, oauthAccountId: null, type: id === 'birthday' ? 'birthday_local' : 'ical_file',
      url: null, fileName: null, color: '#FFFFFF', syncIntervalSeconds: 300, lastSyncAt: null,
      lastSyncError: null, enabled: true, createdAt: '2026-10-10T00:00:00.000Z', updatedAt: '2026-10-10T00:00:00.000Z',
    }));
    it('empty means none in collection-enabled mode despite existing provider/birthday sources', () => {
      render(<FullScreenCalendar sourceIds={[]} sources={sources} collectionWidgetId="widget" householdToday="2026-10-14" onClose={() => {}} />);
      expect(events.mock.calls[0]?.[0]).toEqual([]);
    });
    it('uses exactly selected providers in mixed mode', () => {
      render(<FullScreenCalendar sourceIds={['birthday']} sources={sources} collectionWidgetId="widget" onClose={() => {}} />);
      expect(events.mock.calls[0]?.[0]).toEqual(['birthday']);
    });
    it('preserves all-source fallback for legacy non-collection mode', () => {
      render(<FullScreenCalendar sourceIds={[]} sources={sources} onClose={() => {}} />);
      expect(events.mock.calls[0]?.[0]).toEqual(['provider', 'birthday']);
    });
  });
});
