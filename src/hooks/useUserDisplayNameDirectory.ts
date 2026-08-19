import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  buildUserDisplayNameMap,
  fetchUserDisplayNameDirectory,
  setUserDisplayNameDirectory,
  type UserDisplayNameSource,
} from '@/lib/user-display-names';

export const USER_DISPLAY_NAME_DIRECTORY_KEY = ['users', 'display-name-directory'] as const;
const EMPTY_USERS: readonly UserDisplayNameSource[] = [];

function useUserDisplayNameDirectoryQuery(enabled: boolean) {
  const query = useQuery({
    queryKey: USER_DISPLAY_NAME_DIRECTORY_KEY,
    queryFn: async ({ signal }) => {
      try {
        return await fetchUserDisplayNameDirectory(signal);
      } catch {
        // Liste yine açılsın; isim çözülemezse Kullanıcı #id fallback kalır.
        return [];
      }
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (query.data) {
      setUserDisplayNameDirectory(query.data);
    }
  }, [query.data]);

  return query;
}

export function useUserDisplayNameDirectoryState(enabled = true): {
  names: Map<number, string>;
  users: readonly UserDisplayNameSource[];
} {
  const query = useUserDisplayNameDirectoryQuery(enabled);
  const names = useMemo(
    () => (query.data ? buildUserDisplayNameMap(query.data) : new Map<number, string>()),
    [query.data],
  );

  return { names, users: query.data ?? EMPTY_USERS };
}

/** Grid audit kolonları ve detay satırları için kullanıcı id → ad soyad dizinini yükler. */
export function useUserDisplayNameDirectory(enabled = true): Map<number, string> {
  return useUserDisplayNameDirectoryState(enabled).names;
}
