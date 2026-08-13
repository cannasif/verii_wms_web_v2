import { useMemo } from 'react';
import { keepPreviousData, useInfiniteQuery, type InfiniteData } from '@tanstack/react-query';
import type { PagedFilter } from '@/types/api';
import { toTurkishApiSearch } from '@/lib/turkish-search';
import {
  isDropdownSearchSettling,
  resolveDropdownSearchInputState,
} from './dropdown-search-state';

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
  /** Immediate input value; searchTerm may be debounced by the dropdown UI. */
  inputSearchTerm?: string;
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
  inputSearchTerm,
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
  const querySearchState = resolveDropdownSearchInputState(searchTerm, minSearchLength);
  const inputSearchState = resolveDropdownSearchInputState(
    inputSearchTerm ?? searchTerm,
    minSearchLength,
  );
  const activeSearch = querySearchState.isSearchMode
    ? toTurkishApiSearch(querySearchState.activeTerm)
    : '';
  const isSearchSettling = isDropdownSearchSettling(inputSearchState, querySearchState);
  const stableKey = Array.isArray(queryKey) ? queryKey : [queryKey];

  const query = useInfiniteQuery({
    queryKey: [...stableKey, 'dropdown', querySearchState.isSearchMode ? 'search' : 'browse', activeSearch, searchFields.join('|'), pageSize, sortBy ?? null, sortDirection, ...dependencies],
    enabled: enabled && !querySearchState.isThresholdMode,
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => fetchPage({
      pageNumber: pageParam,
      pageSize,
      search: activeSearch || undefined,
      searchFields: querySearchState.isSearchMode ? [...searchFields] : undefined,
      sortBy,
      sortDirection,
      filters: buildFilters?.(activeSearch),
      filterLogic,
      signal,
    }).then((page) => {
      const items = Array.isArray(page.items)
        ? page.items
        : Array.isArray((page as DropdownPage<TItem> & { data?: TItem[] }).data)
          ? (page as DropdownPage<TItem> & { data?: TItem[] }).data!
          : [];
      return { ...page, items };
    }),
    getNextPageParam: (lastPage) => {
      const hasNextPage = lastPage.hasNextPage
        ?? lastPage.pageNumber * lastPage.pageSize < lastPage.totalCount;
      return hasNextPage ? lastPage.pageNumber + 1 : undefined;
    },
    placeholderData: keepPreviousData,
  });

  const items = useMemo(() => {
    // Never present browse/previous-search rows as matches for the text that is
    // currently visible in the input.
    if (
      inputSearchState.isThresholdMode
      || isSearchSettling
      || (query.isPlaceholderData && query.isFetching)
    ) {
      return [] as TItem[];
    }
    return query.data?.pages.flatMap((page) => page.items) ?? [];
  }, [inputSearchState.isThresholdMode, isSearchSettling, query.data, query.isFetching, query.isPlaceholderData]);

  return {
    ...query,
    data: query.data as InfiniteData<DropdownPage<TItem>> | undefined,
    items,
    isBrowseMode: inputSearchState.isBrowseMode,
    isSearchMode: inputSearchState.isSearchMode,
    isThresholdMode: inputSearchState.isThresholdMode,
    isSearchSettling,
    isLoading: query.isLoading
      || isSearchSettling
      || (query.isPlaceholderData && query.isFetching),
    hasNextPage: query.hasNextPage ?? false,
  };
}
