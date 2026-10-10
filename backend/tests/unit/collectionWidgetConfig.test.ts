import { describe, expect, it } from 'vitest';
import { CalendarConfigSchema } from '../../src/lib/validation.js';
import { collectionIds } from '../helpers/collectionFixtures.js';
describe('Calendar collection selections', () => {
  it('defaults both lists empty without changing existing source IDs', () => {
    const config = CalendarConfigSchema.parse({ sourceIds: [collectionIds.provider] });
    expect(config.sourceIds).toEqual([collectionIds.provider]);
    expect(config.collectionStreamIds).toEqual([]);
    expect(config.publicCollectionStreamIds).toEqual([]);
  });
  it('accepts unique public subset only, <=32 UUIDs, independent of sources', () => {
    const ids = [collectionIds.general, collectionIds.recycling];
    expect(
      CalendarConfigSchema.safeParse({
        sourceIds: [],
        collectionStreamIds: ids,
        publicCollectionStreamIds: [ids[1]],
      }).success,
    ).toBe(true);
    for (const config of [
      { collectionStreamIds: ids, publicCollectionStreamIds: [collectionIds.garden] },
      { collectionStreamIds: [ids[0], ids[0]] },
      { collectionStreamIds: ['not-uuid'] },
      { publicCollectionStreamIds: [ids[0]] },
    ])
      expect(CalendarConfigSchema.safeParse(config).success).toBe(false);
  });
});
