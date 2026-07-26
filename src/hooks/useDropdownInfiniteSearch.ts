import { useMemo } from 'react';
import { keepPreviousData, useInfiniteQuery, type InfiniteData } from '@tanstack/react-query';
import type { PagedFilter } from '@/types/api';

export interface DropdownPageRequest {
  pageNumber: number;
  pageSize: number;
  search?: string;
  searchFields?: string[];
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  filters?: PagedFilter[] | Record<string, unknown>;
  filterLogic?: 'and' | 'or';
  signal: AbortSignal;
}

export interface DropdownPage<TItem> {
  items: TItem[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPages?: number;
  hasNextPage?: boolean;
}

interface DropdownInfiniteSearchOptions<TItem> {
  queryKey: string | readonly unknown[];
  searchTerm: string;
  fetchPage: (request: DropdownPageRequest) => Promise<DropdownPage<TItem>>;
  buildFilters?: (searchTerm: string) => PagedFilter[] | Record<string, unknown> | undefined;
  enabled?: boolean;
  minSearchLength?: number;
  pageSize?: number;
  searchFields?: readonly string[];
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  filterLogic?: 'and' | 'or';
  dependencies?: readonly unknown[];
}

export function useDropdownInfiniteSearch<TItem>({
  queryKey,
  searchTerm,
  fetchPage,
  buildFilters,
  enabled = true,
  minSearchLength = 2,
  pageSize = 25,
  sortBy,
  sortDirection = 'asc',
  searchFields = [],
  filterLogic = 'or',
  dependencies = [],
}: DropdownInfiniteSearchOptions<TItem>) {
  const normalizedSearch = searchTerm.trim();
  const isBrowseMode = normalizedSearch.length === 0;
  const isSearchMode = normalizedSearch.length >= minSearchLength;
  const isThresholdMode = !isBrowseMode && !isSearchMode;
  const activeSearch = isSearchMode ? normalizedSearch : '';
  const stableKey = Array.isArray(queryKey) ? queryKey : [queryKey];

  const query = useInfiniteQuery({
    queryKey: [...stableKey, 'dropdown', isSearchMode ? 'search' : 'browse', activeSearch, searchFields.join('|'), pageSize, sortBy ?? null, sortDirection, ...dependencies],
    enabled: enabled && !isThresholdMode,
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => fetchPage({
      pageNumber: pageParam,
      pageSize,
      search: activeSearch || undefined,
      searchFields: isSearchMode ? [...searchFields] : undefined,
      sortBy,
      sortDirection,
      filters: buildFilters?.(activeSearch),
      filterLogic,
      signal,
    }),
    getNextPageParam: (lastPage) => {
      const hasNextPage = lastPage.hasNextPage
        ?? lastPage.pageNumber * lastPage.pageSize < lastPage.totalCount;
      return hasNextPage ? lastPage.pageNumber + 1 : undefined;
    },
    placeholderData: keepPreviousData,
  });

  const items = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? [],
    [query.data],
  );

  return {
    ...query,
    data: query.data as InfiniteData<DropdownPage<TItem>> | undefined,
    items,
    isBrowseMode,
    isSearchMode,
    isThresholdMode,
    hasNextPage: query.hasNextPage ?? false,
  };
}
