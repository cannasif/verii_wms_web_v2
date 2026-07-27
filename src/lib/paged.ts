import type { PagedFilter, PagedParams, PagedResponse } from '@/types/api';

/**
 * Backend paged payloads use `data` for rows (`PagedResponse`).
 * AdvancedDataGrid historically expected `items` — normalize either shape.
 */
export function normalizeGridPage<T>(page: unknown): {
  items: T[];
  pageNumber: number;
  page?: number;
  pageSize: number;
  totalCount: number;
  totalPages?: number;
  hasPreviousPage?: boolean;
  hasNextPage?: boolean;
} {
  if (page == null || typeof page !== 'object') {
    return { items: [], pageNumber: 1, pageSize: 25, totalCount: 0, totalPages: 0 };
  }

  const raw = page as Record<string, unknown>;
  const candidates = [raw.items, raw.data, raw.Data, raw.Items, raw.records, raw.results, raw.Rows];
  const arrays = candidates.filter((value): value is T[] => Array.isArray(value));
  // Prefer a non-empty row list when APIs send both `items: []` and `data: [...]`.
  const items = arrays.find((rows) => rows.length > 0) ?? arrays[0] ?? [];

  const pageNumber = Number(raw.pageNumber ?? raw.PageNumber ?? raw.page ?? 1) || 1;
  const pageSize = Number(raw.pageSize ?? raw.PageSize ?? 25) || 25;
  const totalCount = Number(raw.totalCount ?? raw.TotalCount ?? 0) || 0;

  return {
    items,
    pageNumber,
    page: typeof raw.page === 'number' ? raw.page : undefined,
    pageSize,
    totalCount,
    totalPages: typeof raw.totalPages === 'number'
      ? raw.totalPages
      : Math.max(1, Math.ceil(totalCount / pageSize) || 0),
    hasPreviousPage: typeof raw.hasPreviousPage === 'boolean' ? raw.hasPreviousPage : undefined,
    hasNextPage: typeof raw.hasNextPage === 'boolean' ? raw.hasNextPage : undefined,
  };
}

export interface BuildPagedRequestDefaults {
  pageNumber?: number;
  pageSize?: number;
  sortBy?: string;
  sortDirection?: string;
  search?: string;
  searchFields?: string[];
  filters?: PagedFilter[];
  filterLogic?: 'and' | 'or';
}

export function buildPagedRequest(
  params: PagedParams = {},
  defaults: BuildPagedRequestDefaults = {},
): Required<PagedParams> {
  return {
    pageNumber: params.pageNumber ?? defaults.pageNumber ?? 1,
    pageSize: params.pageSize ?? defaults.pageSize ?? 20,
    sortBy: params.sortBy ?? defaults.sortBy ?? 'Id',
    sortDirection: params.sortDirection ?? defaults.sortDirection ?? 'desc',
    search: params.search ?? defaults.search ?? '',
    searchFields: params.searchFields ?? defaults.searchFields ?? [],
    filters: params.filters ?? defaults.filters ?? [],
    filterLogic: params.filterLogic ?? defaults.filterLogic ?? 'and',
  };
}

export function getPagedRange(
  response: Pick<PagedResponse<unknown>, 'totalCount' | 'pageNumber' | 'pageSize'> | null | undefined,
  pageNumberBase: 0 | 1 = 1,
): { from: number; to: number; total: number } {
  if (!response || response.totalCount <= 0) {
    return { from: 0, to: 0, total: 0 };
  }

  const zeroBasedPage = pageNumberBase === 1
    ? Math.max(response.pageNumber - 1, 0)
    : Math.max(response.pageNumber, 0);

  const from = zeroBasedPage * response.pageSize + 1;
  const to = Math.min((zeroBasedPage + 1) * response.pageSize, response.totalCount);

  return {
    from,
    to,
    total: response.totalCount,
  };
}
