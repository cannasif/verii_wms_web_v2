import { describe, expect, it } from 'vitest';
import {
  requiresQualityDat,
  resolveQualityInventorySourceWarehouseId,
} from './quality-dat-routing';

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

  it('requires DAT on quarantine release when stock sits in another warehouse', () => {
    expect(requiresQualityDat(100, [{
      decision: 'Accepted',
      sourceWarehouseId: 399,
      targetWarehouseId: 100,
    }])).toBe(true);
  });

  it('does not require DAT when quarantine release stays in the same warehouse', () => {
    expect(requiresQualityDat(100, [{
      decision: 'Accepted',
      sourceWarehouseId: 100,
      targetWarehouseId: 100,
    }])).toBe(false);
  });
});

describe('quality inventory source warehouse', () => {
  it('uses the latest quarantine disposition target warehouse for release', () => {
    expect(resolveQualityInventorySourceWarehouseId({
      lineDecision: 'Quarantined',
      quarantineLocationId: 22,
      lineId: 7,
      dispositions: [
        {
          lineId: 7,
          decision: 'Quarantined',
          sequenceNo: 1,
          targetWarehouseId: 200,
        },
        {
          lineId: 7,
          decision: 'Quarantined',
          sequenceNo: 2,
          targetWarehouseId: 399,
        },
      ],
      quarantineDestinations: [{ locationId: 22, warehouseId: 200 }],
      fallbackWarehouseId: 100,
    })).toBe(399);
  });

  it('falls back to the quarantine destination warehouse when disposition history is missing', () => {
    expect(resolveQualityInventorySourceWarehouseId({
      lineDecision: 'Quarantined',
      quarantineLocationId: 22,
      lineId: 7,
      dispositions: [],
      quarantineDestinations: [{ locationId: 22, warehouseId: 399 }],
      fallbackWarehouseId: 100,
    })).toBe(399);
  });

  it('uses the receiving warehouse for pending quality lines', () => {
    expect(resolveQualityInventorySourceWarehouseId({
      lineDecision: 'Pending',
      quarantineLocationId: null,
      lineId: 7,
      dispositions: [],
      quarantineDestinations: [],
      fallbackWarehouseId: 100,
    })).toBe(100);
  });
});
