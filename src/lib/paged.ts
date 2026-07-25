import type { PagedFilter, PagedParams, PagedResponse } from '@/types/api';

export interface BuildPagedRequestDefaults {
  pageNumber?: number;
  pageSize?: number;
  sortBy?: string;
  sortDirection?: string;
  search?: string;
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
