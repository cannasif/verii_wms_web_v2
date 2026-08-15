import type { GridFilter } from '@/components/shared/AdvancedDataGrid';

export const QUALITY_INSPECTION_STATUS_ALL = '__all__';

export const QUALITY_INSPECTION_CREATED_PERIODS = ['day', 'week', 'month', 'year'] as const;

export type QualityInspectionCreatedPeriod = (typeof QUALITY_INSPECTION_CREATED_PERIODS)[number];

export function buildQualityInspectionStatusFilters(statusFacet: string): GridFilter[] {
  const value = statusFacet.trim();
  if (!value || value === QUALITY_INSPECTION_STATUS_ALL) return [];
  return [{ column: 'status', operator: 'equals', value }];
}

export function startOfLocalDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

export function buildQualityInspectionCreatedAtRange(
  period: QualityInspectionCreatedPeriod,
  now = new Date(),
): { start: Date; end: Date } {
  const start = startOfLocalDay(now);
  if (period === 'day') {
    return { start, end: new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1) };
  }
  if (period === 'week') {
    const mondayOffset = (start.getDay() + 6) % 7;
    const weekStart = new Date(start.getFullYear(), start.getMonth(), start.getDate() - mondayOffset);
    return { start: weekStart, end: new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 7) };
  }
  if (period === 'month') {
    const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
    return { start: monthStart, end: new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1) };
  }
  const yearStart = new Date(start.getFullYear(), 0, 1);
  return { start: yearStart, end: new Date(yearStart.getFullYear() + 1, 0, 1) };
}

export function shiftQualityInspectionCreatedAnchor(
  period: QualityInspectionCreatedPeriod,
  anchor: Date,
  step: -1 | 1,
): Date {
  const start = startOfLocalDay(anchor);
  if (period === 'day') {
    return new Date(start.getFullYear(), start.getMonth(), start.getDate() + step);
  }
  if (period === 'week') {
    return new Date(start.getFullYear(), start.getMonth(), start.getDate() + step * 7);
  }
  if (period === 'month') {
    return new Date(start.getFullYear(), start.getMonth() + step, 1);
  }
  return new Date(start.getFullYear() + step, 0, 1);
}

export function isCurrentQualityInspectionCreatedPeriod(
  period: QualityInspectionCreatedPeriod,
  anchor: Date,
  now = new Date(),
): boolean {
  const current = buildQualityInspectionCreatedAtRange(period, now);
  const selected = buildQualityInspectionCreatedAtRange(period, anchor);
  return selected.start.getTime() === current.start.getTime();
}

export function canAdvanceQualityInspectionCreatedPeriod(
  period: QualityInspectionCreatedPeriod,
  anchor: Date,
  now = new Date(),
): boolean {
  const current = buildQualityInspectionCreatedAtRange(period, now);
  const next = buildQualityInspectionCreatedAtRange(
    period,
    shiftQualityInspectionCreatedAnchor(period, anchor, 1),
  );
  return next.start.getTime() <= current.start.getTime();
}

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
