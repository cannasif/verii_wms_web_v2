import type { GridFilter } from '@/components/shared/AdvancedDataGrid';

/** Varsayılan: başarılı (Passed) dışındakiler. */
export const QUALITY_INSPECTION_STATUS_EXCLUDE_PASSED = '__exclude_passed__';
export const QUALITY_INSPECTION_STATUS_ALL = '__all__';
export const QUALITY_INSPECTION_SUCCESS_STATUS = 'Passed';

export const QUALITY_INSPECTION_STATUS_OPTIONS = [
  'Queued',
  'Pending',
  'InProgress',
  'Quarantined',
  'PartiallyDecided',
  'Passed',
  'Failed',
  'Released',
  'Cancelled',
] as const;

export type QualityInspectionStatusOption =
  (typeof QUALITY_INSPECTION_STATUS_OPTIONS)[number];

export function buildQualityInspectionStatusFilters(statusFacet: string): GridFilter[] {
  const value = statusFacet.trim();
  if (!value || value === QUALITY_INSPECTION_STATUS_ALL) return [];
  if (value === QUALITY_INSPECTION_STATUS_EXCLUDE_PASSED) {
    return [{ column: 'status', operator: 'notEquals', value: QUALITY_INSPECTION_SUCCESS_STATUS }];
  }
  return [{ column: 'status', operator: 'equals', value }];
}

export function isQualityInspectionStatusFilterDefault(statusFacet: string): boolean {
  return statusFacet === QUALITY_INSPECTION_STATUS_EXCLUDE_PASSED;
}
