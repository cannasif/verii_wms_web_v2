import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { dashboardApi } from '../api/dashboard.api';
import {
  quickSearchMinLength,
  serializeQuickSearchScopes,
  type QuickSearchScope,
} from '../lib/quick-search-scopes';
import type { DashboardQuickSearchHit } from '../types/dashboard.types';

export function useNavbarQuickSearch(
  query: string,
  enabled: boolean,
  scopes: readonly QuickSearchScope[],
): {
  results: DashboardQuickSearchHit[];
  isSearching: boolean;
  tooShort: boolean;
} {
  const trimmed = query.trim();
  const minLength = quickSearchMinLength(scopes);
  const tooShort = trimmed.length > 0 && trimmed.length < minLength;
  const [debouncedQuery, setDebouncedQuery] = useState(trimmed);
  const branchCode = useAuthStore((state) => state.branch?.code ?? null);
  const scopeKey = serializeQuickSearchScopes(scopes) ?? 'all';

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(trimmed), 250);
    return () => window.clearTimeout(timer);
  }, [trimmed]);

  const searchQuery = useQuery({
    queryKey: ['dashboard', 'quick-search', debouncedQuery, branchCode, scopeKey],
    queryFn: ({ signal }) => dashboardApi.quickSearch(debouncedQuery, {
      signal,
      scopes: serializeQuickSearchScopes(scopes),
    }),
    enabled: enabled && debouncedQuery.length >= minLength,
    staleTime: 0,
    retry: 0,
    placeholderData: keepPreviousData,
  });

  const waitingForDebounce = trimmed !== debouncedQuery && trimmed.length >= minLength;

  return {
    results: tooShort || trimmed.length === 0 ? [] : (searchQuery.data?.items ?? []),
    isSearching: enabled && (waitingForDebounce || (searchQuery.isFetching && trimmed.length >= minLength)),
    tooShort,
  };
}
