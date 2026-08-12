import { describe, expect, it } from 'vitest';
import { requiresQualityDat } from './quality-dat-routing';

describe('quality DAT routing', () => {
  it('keeps same-warehouse quality routing as an internal location movement', () => {
    expect(requiresQualityDat(100, [{ decision: 'Accepted', targetWarehouseId: 100 }])).toBe(false);
  });

  it('requires DAT when a quality destination is in another warehouse', () => {
    expect(requiresQualityDat(100, [{ decision: 'Quarantined', targetWarehouseId: 399 }])).toBe(true);
  });

  it('ignores supplier returns and destinations that are not selected yet', () => {
    expect(requiresQualityDat(100, [
      { decision: 'Returned', targetWarehouseId: 399 },
      { decision: 'Accepted', targetWarehouseId: null },
    ])).toBe(false);
  });
});
