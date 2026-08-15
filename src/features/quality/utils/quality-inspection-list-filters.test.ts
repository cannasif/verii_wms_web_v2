import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
  buildQualityInspectionCreatedAtFilters,
  buildQualityInspectionCreatedAtRange,
  buildQualityInspectionStatusFilters,
  canAdvanceQualityInspectionCreatedPeriod,
  isCurrentQualityInspectionCreatedPeriod,
  isQualityInspectionStatusFilterDefault,
  mergeQualityInspectionStatusFilters,
  QUALITY_INSPECTION_STATUS_ALL,
  shiftQualityInspectionCreatedAnchor,
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

describe('buildQualityInspectionCreatedAtRange', () => {
  const now = new Date(2026, 7, 15, 10, 30, 0);

  it('uses the local calendar day, ISO week, month and year of the creation date', () => {
    assert.deepEqual(buildQualityInspectionCreatedAtRange('day', now), {
      start: new Date(2026, 7, 15),
      end: new Date(2026, 7, 16),
    });
    assert.deepEqual(buildQualityInspectionCreatedAtRange('week', now), {
      start: new Date(2026, 7, 10),
      end: new Date(2026, 7, 17),
    });
    assert.deepEqual(buildQualityInspectionCreatedAtRange('month', now), {
      start: new Date(2026, 7, 1),
      end: new Date(2026, 8, 1),
    });
    assert.deepEqual(buildQualityInspectionCreatedAtRange('year', now), {
      start: new Date(2026, 0, 1),
      end: new Date(2027, 0, 1),
    });
  });

  it('moves the anchor to the previous or next day, week, month or year', () => {
    assert.deepEqual(shiftQualityInspectionCreatedAnchor('day', now, -1), new Date(2026, 7, 14));
    assert.deepEqual(shiftQualityInspectionCreatedAnchor('day', now, 1), new Date(2026, 7, 16));
    assert.deepEqual(shiftQualityInspectionCreatedAnchor('week', now, -1), new Date(2026, 7, 8));
    assert.deepEqual(shiftQualityInspectionCreatedAnchor('month', now, 1), new Date(2026, 8, 1));
    assert.deepEqual(shiftQualityInspectionCreatedAnchor('year', now, -1), new Date(2025, 0, 1));
  });

  it('detects whether the selected window is the current period', () => {
    assert.equal(isCurrentQualityInspectionCreatedPeriod('day', now, now), true);
    assert.equal(isCurrentQualityInspectionCreatedPeriod('day', new Date(2026, 7, 14), now), false);
    assert.equal(isCurrentQualityInspectionCreatedPeriod('week', new Date(2026, 7, 12), now), true);
  });

  it('does not allow advancing past the current day, week, month or year', () => {
    assert.equal(canAdvanceQualityInspectionCreatedPeriod('day', now, now), false);
    assert.equal(canAdvanceQualityInspectionCreatedPeriod('week', now, now), false);
    assert.equal(canAdvanceQualityInspectionCreatedPeriod('day', new Date(2026, 7, 14), now), true);
    assert.equal(canAdvanceQualityInspectionCreatedPeriod('month', new Date(2026, 6, 1), now), true);
  });
});

describe('mergeQualityInspectionStatusFilters created period', () => {
  const now = new Date(2026, 7, 15, 10, 30, 0);

  it('adds createdAtUtc bounds for the selected period and replaces stale date filters', () => {
    assert.deepEqual(
      mergeQualityInspectionStatusFilters(
        [
          { column: 'createdAtUtc', operator: 'gte', value: '2020-01-01T00:00:00.000Z' },
          { column: 'inspectionNo', operator: 'contains', value: 'QC-' },
        ],
        'Pending',
        'day',
        now,
      ),
      [
        { column: 'status', operator: 'equals', value: 'Pending' },
        ...buildQualityInspectionCreatedAtFilters('day', now),
        { column: 'inspectionNo', operator: 'contains', value: 'QC-' },
      ],
    );
  });

  it('omits createdAtUtc filters when no period is selected', () => {
    assert.deepEqual(
      mergeQualityInspectionStatusFilters(
        [{ column: 'createdAtUtc', operator: 'gte', value: '2020-01-01T00:00:00.000Z' }],
        QUALITY_INSPECTION_STATUS_ALL,
        null,
        now,
      ),
      [],
    );
  });
});
