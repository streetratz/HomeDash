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
  it('marks only today as the current date with the primary date badge and no boxed card', () => {
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
    expect(today.textContent).toContain('Today');
    expect(today.textContent).toContain("Ana's Birthday");
    expect(today.className).not.toContain('border');
    expect(today.className).not.toContain('bg-');
    expect(screen.getByText('24').className).toContain('bg-primary');
    expect(screen.getByText('Today').className).toContain('text-foreground');

    const later = screen.getByText("Ben's Birthday").closest('section') as HTMLElement;
    expect(later.getAttribute('aria-current')).toBeNull();
    expect(screen.getByText('26').className).not.toContain('bg-primary');
    expect(screen.getByText('26').className).toContain('text-foreground');
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
