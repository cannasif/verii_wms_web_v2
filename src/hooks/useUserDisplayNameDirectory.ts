import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  buildUserDisplayNameMap,
  fetchUserDisplayNameDirectory,
  setUserDisplayNameDirectory,
} from '@/lib/user-display-names';

export const USER_DISPLAY_NAME_DIRECTORY_KEY = ['users', 'display-name-directory'] as const;

/** Grid audit kolonları ve detay satırları için kullanıcı id → ad soyad dizinini yükler. */
export function useUserDisplayNameDirectory(): Map<number, string> {
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
    staleTime: 5 * 60 * 1000,
  });

  const map = useMemo(
    () => (query.data ? buildUserDisplayNameMap(query.data) : new Map<number, string>()),
    [query.data],
  );

  useEffect(() => {
    if (query.data) {
      setUserDisplayNameDirectory(query.data);
    }
  }, [query.data]);

  return map;
}
