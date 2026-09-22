/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BirthdaySourceDialog } from '../BirthdaySourceDialog.js';
import { CalendarSourceList } from '../CalendarSourceList.js';
import { ICalFileSourceForm } from '../ICalFileSourceForm.js';
import type { CalendarSource } from '../../../state/calendarHooks.js';

const mocks = vi.hoisted(() => ({
  updateSource: vi.fn(),
  syncSource: vi.fn(),
}));

const source: CalendarSource = {
  id: 'source-1',
  oauthAccountId: null,
  type: 'birthday_local',
  name: 'Family Birthdays',
  url: null,
  fileName: null,
  color: '#ec4899',
  syncIntervalSeconds: 900,
  lastSyncAt: null,
  lastSyncError: null,
  enabled: true,
  createdAt: '2026-09-20T00:00:00.000Z',
  updatedAt: '2026-09-20T00:00:00.000Z',
};

function mutation(overrides: Record<string, unknown> = {}) {
  return {
    mutate: vi.fn(),
    isPending: false,
    data: undefined,
    reset: vi.fn(),
    ...overrides,
  };
}

vi.mock('../../../state/calendarHooks.js', () => ({
  useCalendarSources: () => ({ data: [source] }),
  useDeleteCalendarSource: () => mutation(),
  useSyncCalendarSource: () => mutation({ mutate: mocks.syncSource }),
  useUpdateCalendarSource: () => mutation({ mutate: mocks.updateSource }),
  useBirthdays: () => ({ data: [] }),
  useCreateBirthday: () => mutation(),
  useCreateBirthdaySource: () => mutation(),
  useDeleteBirthday: () => mutation(),
  useExportBirthdays: () => mutation(),
  useImportBirthdayCsv: () => mutation(),
  usePreviewBirthdayCsv: () => mutation(),
  useUpdateBirthday: () => mutation(),
  useCreateCalendarSource: () => mutation(),
  useImportCalendarFile: () => mutation(),
}));

beforeEach(() => {
  mocks.updateSource.mockReset();
  mocks.syncSource.mockReset();
  mocks.updateSource.mockImplementation(
    (
      input: { id: string; name?: string },
      options?: { onSuccess?: (updated: CalendarSource) => void },
    ) => {
      options?.onSuccess?.({ ...source, name: input.name ?? source.name });
    },
  );
});

afterEach(cleanup);

describe('calendar source editing', () => {
  it('renames a birthday calendar through the existing source update mutation', () => {
    render(<BirthdaySourceDialog open onOpenChange={vi.fn()} source={source} />);

    const title = screen.getByLabelText('Calendar title');
    const save = screen.getByRole('button', { name: 'Save title' });
    expect(save.hasAttribute('disabled')).toBe(true);

    fireEvent.change(title, { target: { value: 'Friends and Family' } });
    fireEvent.click(save);

    expect(mocks.updateSource).toHaveBeenCalledWith(
      { id: source.id, name: 'Friends and Family' },
      expect.anything(),
    );
    expect(title.getAttribute('value')).toBe('Friends and Family');
  });

  it('presents source identity, status, and actions as explicit controls', () => {
    render(<CalendarSourceList />);

    expect(screen.getByRole('article', { name: 'Family Birthdays calendar source' })).toBeTruthy();
    expect(screen.getByText('Editable local birthdays')).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Disable Family Birthdays' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sync Family Birthdays' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Manage Family Birthdays' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete Family Birthdays' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Sync Family Birthdays' }));
    expect(mocks.syncSource).toHaveBeenCalledWith(
      source.id,
      expect.anything(),
    );
  });

  it('renames an uploaded ICS calendar without requiring a replacement file', () => {
    const fileSource: CalendarSource = {
      ...source,
      id: 'file-source',
      type: 'ical_file',
      name: 'Imported Calendar',
      fileName: 'birthdays.ics',
    };

    render(<ICalFileSourceForm open onOpenChange={vi.fn()} editSource={fileSource} />);

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Renamed Calendar' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(mocks.updateSource).toHaveBeenCalledWith(
      { id: fileSource.id, name: 'Renamed Calendar', color: fileSource.color },
      expect.anything(),
    );
  });
});
