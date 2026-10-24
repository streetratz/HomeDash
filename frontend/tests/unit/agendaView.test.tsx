// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { AgendaView } from '../../src/components/calendar/AgendaView.js';
import type { CalendarEvent, CalendarSource } from '../../src/state/calendarHooks.js';

const source = {
  id: 'birthday',
  name: 'Birthdays',
  color: '#F97316',
} as CalendarSource;

function allDay(id: string, date: string, title: string): CalendarEvent {
  return {
    id,
    sourceId: 'birthday',
    title,
    startAt: `${date}T00:00:00.000Z`,
    endAt: `${date}T23:59:59.000Z`,
    isAllDay: true,
  } as CalendarEvent;
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('AgendaView day highlighting', () => {
  it('marks only today with a larger date number and renders unboxed tinted rows', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 24, 12));
    render(
      <AgendaView
        events={[
          allDay('a', '2026-10-24', "Ana's Birthday"),
          allDay('b', '2026-10-26', "Ben's Birthday"),
        ]}
        sources={[source]}
      />,
    );

    const current = document.querySelectorAll('[aria-current="date"]');
    expect(current).toHaveLength(1);
    const today = current[0] as HTMLElement;
    expect(today.textContent).toContain("Ana's Birthday");
    expect(today.className).not.toContain('border');
    expect(today.className).not.toContain('bg-');
    const [todayHeading, laterHeading] = screen.getAllByRole('heading');
    expect(todayHeading!.textContent).toContain('24Sat · Today');
    expect(todayHeading!.textContent).toContain('Today · Saturday, October 24, 2026');
    expect(todayHeading!.querySelector('.text-2xl')?.textContent).toBe('24');
    expect(laterHeading!.textContent).toContain('26Mon');
    expect(laterHeading!.querySelector('.text-lg')?.className).toContain('text-foreground/80');

    for (const row of screen.getAllByRole('listitem')) {
      expect(row.className).toContain('bg-foreground/[0.06]');
      expect(row.className).not.toContain('border');
    }
    const later = screen.getByText("Ben's Birthday").closest('section') as HTMLElement;
    expect(later.getAttribute('aria-current')).toBeNull();
  });

  it("shows collections inside their matching day, before that day's events", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 24, 12));
    render(
      <AgendaView
        events={[allDay('b', '2026-10-26', "Ben's Birthday")]}
        sources={[source]}
        collections={{
          timezone: 'Australia/Sydney',
          householdToday: '2026-10-24',
          serverNow: '2026-10-24T01:00:00Z',
          range: { from: '2026-10-24', to: '2026-11-21' },
          state: 'ready',
          groups: [
            {
              date: '2026-10-26',
              streams: [{ key: 'w', name: 'General waste', color: '#EF4444' }],
            },
          ],
        }}
      />,
    );

    expect(screen.getAllByRole('heading')).toHaveLength(1);
    const day = screen.getByRole('heading').closest('section') as HTMLElement;
    const list = screen.getByRole('list', { name: 'Next collection' });
    expect(day.contains(list)).toBe(true);
    expect(day.textContent.indexOf('General waste')).toBeLessThan(
      day.textContent.indexOf("Ben's Birthday"),
    );
    expect(screen.getAllByText(/Australia\/Sydney/)).toHaveLength(1);
  });

  it('draws a theme-aware timeline rail instead of a dark-only translucent white line', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 24, 12));
    const { container } = render(
      <AgendaView events={[allDay('a', '2026-10-27', 'Bin night')]} sources={[source]} />,
    );
    expect(container.querySelector('.border-white\\/10')).toBeNull();
    expect(container.querySelector('.border-foreground\\/20')).not.toBeNull();
    expect(container.querySelector('.ring-2')).toBeNull();
  });
});
