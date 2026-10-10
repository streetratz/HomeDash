// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CollectionGroup } from '../../src/components/calendar/CollectionGroup.js';
import { FullScreenCalendar } from '../../src/components/calendar/FullScreenCalendar.js';
import type { CalendarSource } from '../../src/state/calendarHooks.js';
import type { CollectionDisplay } from '../../src/state/collectionHooks.js';
import { AgendaView } from '../../src/components/calendar/AgendaView.js';
const events = vi.hoisted(() =>
  vi.fn((_ids: string[], _from: string, _to: string) => ({ data: [] })),
);
const collections = vi.hoisted(() => ({ data: undefined as CollectionDisplay | undefined }));
vi.mock('../../src/state/calendarHooks.js', () => ({ useCalendarEvents: events }));
vi.mock('../../src/state/bootstrap.js', () => ({ useClockFormat: () => ({ hour12: false }) }));
vi.mock('../../src/state/collectionHooks.js', () => ({
  useCollectionDisplay: () => ({ data: collections.data, isLoading: false, isError: false }),
}));
afterEach(() => {
  cleanup();
  events.mockClear();
  collections.data = undefined;
});
describe('complete civil collection group', () => {
  it('renders all same-colour stream names and household date without interpreting markup', () => {
    render(
      <CollectionGroup
        group={{
          date: '2026-10-14',
          streams: [
            { key: 'a', name: 'General waste', color: '#EAB308' },
            { key: 'b', name: '<script>untrusted</script>', color: '#EAB308' },
          ],
        }}
        today="2026-10-14"
        timezone="Australia/Sydney"
        next
      />,
    );
    expect(screen.getByText('General waste')).toBeTruthy();
    expect(screen.getByText('<script>untrusted</script>')).toBeTruthy();
    expect(screen.getByRole('heading').textContent).toContain(
      'Today · Wednesday, October 14, 2026',
    );
    expect(screen.getByText('Australia/Sydney')).toBeTruthy();
    expect(document.querySelector('script')).toBeNull();
  });
  it('renders a cross-month actual target once with every same-date stream, never inventing an origin', () => {
    const display: CollectionDisplay = {
      timezone: 'Australia/Sydney',
      householdToday: '2026-12-31',
      serverNow: '2026-12-30T13:00:00Z',
      range: { from: '2027-01-01', to: '2027-01-31' },
      state: 'ready',
      groups: [
        {
          date: '2027-01-02',
          streams: [
            { key: 'moved', name: 'Moved waste', color: '#123456' },
            { key: 'explicit', name: 'Finite garden', color: '#123456' },
          ],
        },
      ],
    };
    const agenda = render(<AgendaView events={[]} sources={[]} collections={display} />);
    expect(screen.getAllByText('Moved waste')).toHaveLength(1);
    expect(screen.getByRole('heading').textContent).toContain('January 2, 2027');
    expect(screen.queryByText(/December 31, 2026/)).toBeNull();
    agenda.unmount();
    collections.data = { ...display, householdToday: '2027-01-02' };
    render(
      <FullScreenCalendar
        sourceIds={[]}
        sources={[]}
        collectionWidgetId="widget"
        householdToday="2027-01-02"
        onClose={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /2027-01-02/ }));
    expect(screen.getAllByText('Moved waste').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Finite garden').length).toBeGreaterThan(0);
  });
  it.each(['exhausted', 'no_dates_in_range'] as const)(
    'does not extrapolate an empty %s explicit DTO',
    (state) => {
      const display: CollectionDisplay = {
        timezone: 'Australia/Sydney',
        householdToday: '2027-02-16',
        serverNow: '2027-02-15T13:00:00Z',
        range: { from: '2027-02-16', to: '2027-03-01' },
        state,
        groups: [],
      };
      const { container } = render(<AgendaView events={[]} sources={[]} collections={display} />);
      expect(container.textContent).toBe('');
    },
  );
  describe('originating widget fullscreen provider isolation', () => {
    const sources: CalendarSource[] = ['provider', 'birthday'].map((id) => ({
      id,
      name: id,
      oauthAccountId: null,
      type: id === 'birthday' ? 'birthday_local' : 'ical_file',
      url: null,
      fileName: null,
      color: '#FFFFFF',
      syncIntervalSeconds: 300,
      lastSyncAt: null,
      lastSyncError: null,
      enabled: true,
      createdAt: '2026-10-10T00:00:00.000Z',
      updatedAt: '2026-10-10T00:00:00.000Z',
    }));
    it('empty means none in collection-enabled mode despite existing provider/birthday sources', () => {
      render(
        <FullScreenCalendar
          sourceIds={[]}
          sources={sources}
          collectionWidgetId="widget"
          householdToday="2026-10-14"
          onClose={() => {}}
        />,
      );
      expect(events.mock.calls[0]?.[0]).toEqual([]);
    });
    it('uses exactly selected providers in mixed mode', () => {
      render(
        <FullScreenCalendar
          sourceIds={['birthday']}
          sources={sources}
          collectionWidgetId="widget"
          onClose={() => {}}
        />,
      );
      expect(events.mock.calls[0]?.[0]).toEqual(['birthday']);
    });
    it('preserves all-source fallback for legacy non-collection mode', () => {
      render(<FullScreenCalendar sourceIds={[]} sources={sources} onClose={() => {}} />);
      expect(events.mock.calls[0]?.[0]).toEqual(['provider', 'birthday']);
    });
  });
});
