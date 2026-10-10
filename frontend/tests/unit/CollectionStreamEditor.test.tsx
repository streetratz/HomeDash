// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CollectionStreamEditor } from '../../src/components/settings/CollectionStreamEditor.js';
import type { CollectionStream } from '../../src/state/collectionHooks.js';
afterEach(cleanup);
const stream: CollectionStream = {
  id: '06500000-0000-4000-8000-000000000001', name: 'Rubbish', color: '#123456', enabled: true,
  schedule: { mode: 'regular', weekdays: [1], intervalWeeks: 2, anchorDate: '2026-10-12' }, exceptions: [],
};
describe('independent regular stream editor', () => {
  it('changes one weekday/name/colour without coupling or losing stream identity', () => {
    const change = vi.fn();
    render(<CollectionStreamEditor stream={stream} onChange={change} />);
    fireEvent.click(screen.getByLabelText('Thursday'));
    expect(change).toHaveBeenLastCalledWith({ ...stream, schedule: { ...stream.schedule, weekdays: [1, 4] } });
    fireEvent.change(screen.getByLabelText('Stream name'), { target: { value: 'Long same-colour service' } });
    expect(change.mock.calls.at(-1)?.[0].id).toBe(stream.id);
    expect(change.mock.calls.at(-1)?.[0].name).toBe('Long same-colour service');
    expect(screen.queryByText(/Monthly/)).toBeNull();
  });
  it('links invalid interval, empty weekdays, anchor and colour errors, even while disabled', () => {
    const invalid: CollectionStream = { ...stream, color: 'red', enabled: false,
      schedule: { mode: 'regular', weekdays: [], intervalWeeks: 53, anchorDate: '2026-10-15' }, exceptions: [] };
    render(<CollectionStreamEditor stream={invalid} onChange={vi.fn()} />);
    expect(screen.getByLabelText('Hex colour').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByLabelText('Interval (weeks)').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('Choose at least one weekday.')).toBeTruthy();
    expect(screen.getByLabelText('Normal collection date').getAttribute('aria-invalid')).toBe('true');
  });
});
