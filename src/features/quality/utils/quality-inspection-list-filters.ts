import type { GridFilter } from '@/components/shared/AdvancedDataGrid';
import {
  buildCreatedPeriodRange,
  canAdvanceCreatedPeriod,
  CREATED_PERIODS,
  isCurrentCreatedPeriod,
  shiftCreatedPeriodAnchor,
  startOfLocalDay,
  type CreatedPeriod,
} from '@/lib/created-period';

export const QUALITY_INSPECTION_STATUS_ALL = '__all__';

export const QUALITY_INSPECTION_CREATED_PERIODS = CREATED_PERIODS;

export type QualityInspectionCreatedPeriod = CreatedPeriod;

export { startOfLocalDay };

export function buildQualityInspectionStatusFilters(statusFacet: string): GridFilter[] {
  const value = statusFacet.trim();
  if (!value || value === QUALITY_INSPECTION_STATUS_ALL) return [];
  return [{ column: 'status', operator: 'equals', value }];
}

export const buildQualityInspectionCreatedAtRange = buildCreatedPeriodRange;
export const shiftQualityInspectionCreatedAnchor = shiftCreatedPeriodAnchor;
export const isCurrentQualityInspectionCreatedPeriod = isCurrentCreatedPeriod;
export const canAdvanceQualityInspectionCreatedPeriod = canAdvanceCreatedPeriod;

export function buildQualityInspectionCreatedAtFilters(
  period: QualityInspectionCreatedPeriod | null,
  now = new Date(),
): GridFilter[] {
  if (!period) return [];
  const { start, end } = buildQualityInspectionCreatedAtRange(period, now);
  return [
    { column: 'createdAtUtc', operator: 'gte', value: start.toISOString() },
    { column: 'createdAtUtc', operator: 'lt', value: end.toISOString() },
  ];
}

export function mergeQualityInspectionStatusFilters(
  filters: GridFilter[],
  statusFacet: string,
  createdPeriod: QualityInspectionCreatedPeriod | null = null,
  now = new Date(),
): GridFilter[] {
  const filtersWithoutOwnedColumns = filters.filter((filter) => {
    const column = filter.column.trim().toLocaleLowerCase('en-US');
    return column !== 'status' && column !== 'createdatutc';
  });
  return [
    ...buildQualityInspectionStatusFilters(statusFacet),
    ...buildQualityInspectionCreatedAtFilters(createdPeriod, now),
    ...filtersWithoutOwnedColumns,
  ];
}

export function isQualityInspectionStatusFilterDefault(statusFacet: string, defaultValue: string): boolean {
  return statusFacet === defaultValue;
}
