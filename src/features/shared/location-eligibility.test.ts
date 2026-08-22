import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  buildExcludedPutawayLocationTypeFilters,
  isEligiblePutawayTargetLocation,
  isExcludedPutawayLocationType,
} from './location-eligibility';

test('excludes zone, quarantine and virtual location types', () => {
  assert.equal(isExcludedPutawayLocationType('Zone'), true);
  assert.equal(isExcludedPutawayLocationType('quarantine'), true);
  assert.equal(isExcludedPutawayLocationType('VIRTUAL'), true);
  assert.equal(isExcludedPutawayLocationType('Shelf'), false);
  assert.equal(isExcludedPutawayLocationType('Receiving'), false);
});

test('keeps only the same warehouse and eligible location types', () => {
  const warehouseId = 12;
  const excludedIds = new Set([99]);

  assert.equal(
    isEligiblePutawayTargetLocation(
      { id: 1, warehouseId, locationType: 'Shelf' },
      { warehouseId, excludedIds },
    ),
    true,
  );
  assert.equal(
    isEligiblePutawayTargetLocation(
      { id: 2, warehouseId: 8, locationType: 'Shelf' },
      { warehouseId, excludedIds },
    ),
    false,
  );
  assert.equal(
    isEligiblePutawayTargetLocation(
      { id: 3, warehouseId, locationType: 'Zone' },
      { warehouseId, excludedIds },
    ),
    false,
  );
  assert.equal(
    isEligiblePutawayTargetLocation(
      { id: 99, warehouseId, locationType: 'Cell' },
      { warehouseId, excludedIds },
    ),
    false,
  );
});

test('builds notEquals filters for excluded putaway location types', () => {
  assert.deepEqual(buildExcludedPutawayLocationTypeFilters(), [
    { column: 'locationType', operator: 'notEquals', value: 'Zone' },
    { column: 'locationType', operator: 'notEquals', value: 'Quarantine' },
    { column: 'locationType', operator: 'notEquals', value: 'Virtual' },
  ]);
});
