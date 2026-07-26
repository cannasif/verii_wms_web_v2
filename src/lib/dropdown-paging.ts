import type { DropdownPageRequest } from '@/hooks/useDropdownInfiniteSearch';

const searchFieldsBySortColumn: Readonly<Record<string, readonly string[]>> = {
  warehouseCode: ['warehouseCode', 'warehouseName'],
  customerCode: ['customerCode', 'customerName'],
  erpStockCode: ['erpStockCode', 'stockName'],
  configurationCode: ['configurationCode', 'description'],
  code: ['code', 'name'],
  username: ['username', 'email', 'firstName', 'lastName'],
};

interface DropdownPagedBodyOptions {
  filters?: unknown[];
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  filterLogic?: 'and' | 'or';
  searchFields?: readonly string[];
}

export function buildDropdownPagedBody(
  request: DropdownPageRequest,
  options: DropdownPagedBodyOptions = {},
) {
  const sortBy = request.sortBy ?? options.sortBy;
  const configuredFields = request.searchFields?.length
    ? request.searchFields
    : options.searchFields ?? (sortBy ? searchFieldsBySortColumn[sortBy] : undefined);

  return {
    pageNumber: request.pageNumber,
    pageSize: request.pageSize,
    search: request.search ?? null,
    searchFields: request.search && configuredFields?.length ? [...configuredFields] : undefined,
    sortBy,
    sortDirection: request.sortDirection ?? options.sortDirection ?? 'asc',
    filterLogic: request.filterLogic ?? options.filterLogic ?? 'and',
    filters: [
      ...(Array.isArray(request.filters) ? request.filters : []),
      ...(options.filters ?? []),
    ],
  };
}
