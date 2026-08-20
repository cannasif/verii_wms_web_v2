import { describe, expect, it } from 'vitest';
import { isProductionTransferUnpickTargetLocation } from './production-transfer-unpick-locations';

describe('production transfer unpick locations', () => {
  const excludedIds = new Set([10, 20]);
  const allowedIds = new Set([30]);

  it('keeps normal shelves and goods receipt', () => {
    expect(isProductionTransferUnpickTargetLocation(
      { id: 1, locationType: 'Shelf' },
      { excludedIds },
    )).toBe(true);
    expect(isProductionTransferUnpickTargetLocation(
      { id: 2, locationType: 'Cell' },
      { excludedIds },
    )).toBe(true);
    expect(isProductionTransferUnpickTargetLocation(
      { id: 3, locationType: 'Rack' },
      { excludedIds },
    )).toBe(true);
    expect(isProductionTransferUnpickTargetLocation(
      { id: 4, locationType: 'Receiving' },
      { excludedIds },
    )).toBe(true);
  });

  it('hides staging shipping quarantine virtual and zone', () => {
    for (const locationType of ['Staging', 'Shipping', 'Quarantine', 'Virtual', 'Zone', 'Aisle']) {
      expect(isProductionTransferUnpickTargetLocation(
        { id: 5, locationType },
        { excludedIds },
      )).toBe(false);
    }
  });

  it('hides waiting and picking-staging ids even when type is allowed', () => {
    expect(isProductionTransferUnpickTargetLocation(
      { id: 10, locationType: 'Cell' },
      { excludedIds },
    )).toBe(false);
  });

  it('still allows configured goods-receipt id when type is not receiving', () => {
    expect(isProductionTransferUnpickTargetLocation(
      { id: 30, locationType: 'Staging' },
      { excludedIds, allowedIds },
    )).toBe(true);
  });

  it('does not allow configured goods-receipt id when it is excluded', () => {
    expect(isProductionTransferUnpickTargetLocation(
      { id: 10, locationType: 'Receiving' },
      { excludedIds, allowedIds: new Set([10]) },
    )).toBe(false);
  });

  it('hides non-pickable and quarantine locations', () => {
    expect(isProductionTransferUnpickTargetLocation(
      { id: 8, locationType: 'Cell', isPickable: false },
      { excludedIds },
    )).toBe(false);
    expect(isProductionTransferUnpickTargetLocation(
      { id: 9, locationType: 'Cell', isQuarantine: true },
      { excludedIds },
    )).toBe(false);
  });
});
