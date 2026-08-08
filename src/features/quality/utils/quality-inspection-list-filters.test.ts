import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
  buildQualityInspectionStatusFilters,
  isQualityInspectionStatusFilterDefault,
  QUALITY_INSPECTION_STATUS_ALL,
  QUALITY_INSPECTION_STATUS_EXCLUDE_PASSED,
} from './quality-inspection-list-filters';

describe('buildQualityInspectionStatusFilters', () => {
  it('defaults to excluding Passed', () => {
    assert.deepEqual(buildQualityInspectionStatusFilters(QUALITY_INSPECTION_STATUS_EXCLUDE_PASSED), [
      { column: 'status', operator: 'notEquals', value: 'Passed' },
    ]);
    assert.equal(isQualityInspectionStatusFilterDefault(QUALITY_INSPECTION_STATUS_EXCLUDE_PASSED), true);
  });

  it('clears filter for all', () => {
    assert.deepEqual(buildQualityInspectionStatusFilters(QUALITY_INSPECTION_STATUS_ALL), []);
  });

  it('filters equals for a concrete status including Passed', () => {
    assert.deepEqual(buildQualityInspectionStatusFilters('Passed'), [
      { column: 'status', operator: 'equals', value: 'Passed' },
    ]);
    assert.deepEqual(buildQualityInspectionStatusFilters('Quarantined'), [
      { column: 'status', operator: 'equals', value: 'Quarantined' },
    ]);
  });
});
