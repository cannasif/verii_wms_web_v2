import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
  buildQualityInspectionStatusFilters,
  isQualityInspectionStatusFilterDefault,
  mergeQualityInspectionStatusFilters,
  QUALITY_INSPECTION_STATUS_ALL,
} from './quality-inspection-list-filters';

describe('buildQualityInspectionStatusFilters', () => {
  it('filters the API-provided default status with an advanced enum filter', () => {
    assert.deepEqual(buildQualityInspectionStatusFilters('Pending'), [
      { column: 'status', operator: 'equals', value: 'Pending' },
    ]);
    assert.equal(isQualityInspectionStatusFilterDefault('Pending', 'Pending'), true);
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

  it('replaces a persisted grid status with the selected API status facet', () => {
    assert.deepEqual(
      mergeQualityInspectionStatusFilters([
        { column: 'status', operator: 'equals', value: 'Passed' },
        { column: 'createdByName', operator: 'contains', value: 'Ayşe' },
      ], 'Pending'),
      [
        { column: 'status', operator: 'equals', value: 'Pending' },
        { column: 'createdByName', operator: 'contains', value: 'Ayşe' },
      ],
    );
  });

  it('removes persisted status filters when all statuses are selected', () => {
    assert.deepEqual(
      mergeQualityInspectionStatusFilters([
        { column: 'status', operator: 'equals', value: 'Failed' },
        { column: 'inspectionNo', operator: 'contains', value: 'QC-' },
      ], QUALITY_INSPECTION_STATUS_ALL),
      [{ column: 'inspectionNo', operator: 'contains', value: 'QC-' }],
    );
  });
});
