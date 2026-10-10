/**
 * Synthetic collection fixtures. Global tests/setup.ts supplies a disposable DB.
 * Expected dates are hand enumerated, never produced by the recurrence engine.
 */
export const collectionIds = {
  general: '06500000-0000-4000-8000-000000000001',
  recycling: '06500000-0000-4000-8000-000000000002',
  garden: '06500000-0000-4000-8000-000000000003',
  exceptionA: '06500000-0000-4000-8000-000000000004',
  exceptionB: '06500000-0000-4000-8000-000000000005',
  provider: '06500000-0000-4000-8000-000000000006',
  birthday: '06500000-0000-4000-8000-000000000007',
  webDashboard: '06500000-0000-4000-8000-000000000008',
  mobileDashboard: '06500000-0000-4000-8000-000000000009',
  widget: '06500000-0000-4000-8000-000000000010',
};

export const presetExpected = [
  ['2026-10-14', ['General waste', 'Recycling']],
  ['2026-10-21', ['General waste', 'Garden waste']],
  ['2026-10-28', ['General waste', 'Recycling']],
  ['2026-11-04', ['General waste', 'Garden waste']],
] as const;

export function collectionPreset() {
  return {
    timezone: 'Australia/Sydney',
    providerLabel: 'Synthetic private provider',
    streams: [
      {
        id: collectionIds.general,
        name: 'General waste',
        color: '#DC2626',
        enabled: true,
        schedule: {
          mode: 'regular' as const,
          weekdays: [3],
          intervalWeeks: 1,
          anchorDate: '2026-10-14',
        },
        exceptions: [],
      },
      {
        id: collectionIds.recycling,
        name: 'Recycling',
        color: '#EAB308',
        enabled: true,
        schedule: {
          mode: 'regular' as const,
          weekdays: [3],
          intervalWeeks: 2,
          anchorDate: '2026-10-14',
        },
        exceptions: [],
      },
      {
        id: collectionIds.garden,
        name: 'Garden waste',
        color: '#16A34A',
        enabled: true,
        schedule: {
          mode: 'regular' as const,
          weekdays: [3],
          intervalWeeks: 2,
          anchorDate: '2026-10-21',
        },
        exceptions: [],
      },
    ],
  };
}

export const collectionWidgetConfig = {
  sourceIds: [collectionIds.provider, collectionIds.birthday],
  collectionStreamIds: [collectionIds.general, collectionIds.recycling, collectionIds.garden],
  publicCollectionStreamIds: [collectionIds.recycling],
  daysAhead: 30,
  maxEvents: 10,
};
