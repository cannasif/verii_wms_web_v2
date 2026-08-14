import type { GridFilter } from '@/components/shared/AdvancedDataGrid';

export const QUALITY_INSPECTION_STATUS_ALL = '__all__';

export function buildQualityInspectionStatusFilters(statusFacet: string): GridFilter[] {
  const value = statusFacet.trim();
  if (!value || value === QUALITY_INSPECTION_STATUS_ALL) return [];
  return [{ column: 'status', operator: 'equals', value }];
}

export function isQualityInspectionStatusFilterDefault(statusFacet: string, defaultValue: string): boolean {
  return statusFacet === defaultValue;
}
