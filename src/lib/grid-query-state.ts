import type { GridRequest } from '@/components/shared/AdvancedDataGrid';

function normalizeFields(fields: readonly string[] | undefined): string[] {
  return [...new Set((fields ?? []).map((field) => field.trim()).filter(Boolean))].sort();
}

/**
 * Page number is deliberately excluded. Previous rows may be retained while
 * paging within the same result set, but never after search, field, filter,
 * sort or page-size changes.
 */
export function getGridResultScopeKey(request: GridRequest): string {
  return JSON.stringify({
    pageSize: request.pageSize,
    search: request.search ?? '',
    searchFields: normalizeFields(request.searchFields),
    actorUserIds: [...new Set(request.actorUserIds ?? [])].sort((a, b) => a - b),
    actorIncludeSystem: Boolean(request.actorIncludeSystem),
    sortBy: request.sortBy ?? null,
    sortDirection: request.sortDirection ?? 'asc',
    filterLogic: request.filterLogic,
    filters: request.filters,
  });
}

export function canRetainGridPlaceholder(
  previousRequest: GridRequest | undefined,
  nextRequest: GridRequest,
  previousRefreshKey?: unknown,
  nextRefreshKey?: unknown,
): boolean {
  if (previousRefreshKey !== nextRefreshKey) {
    return false;
  }
  return Boolean(
    previousRequest
    && getGridResultScopeKey(previousRequest) === getGridResultScopeKey(nextRequest),
  );
}
