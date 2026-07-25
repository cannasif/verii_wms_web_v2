import { useCallback, useEffect, useMemo } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { getPermissionCacheEntry, usePermissionsStore } from '@/stores/permissions-store';
import { useAppShellStore } from '@/stores/app-shell-store';

export const useMyPermissionsQuery = () => {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const token = useAuthStore((state) => state.token);
  const permissions = usePermissionsStore((state) =>
    userId ? state.entries[String(userId)]?.data ?? null : null,
  );
  const bootstrapStatus = useAppShellStore((state) => state.bootstrapStatus);
  const bootstrapError = useAppShellStore((state) => state.bootstrapError);
  const bootstrapAppShell = useAppShellStore((state) => state.bootstrapAppShell);
  const cacheEntry = getPermissionCacheEntry(userId);

  useEffect(() => {
    if (!token || !userId) return;
    if (permissions) return;
    if (bootstrapStatus !== 'idle') return;

    void bootstrapAppShell({ token, userId });
  }, [bootstrapAppShell, bootstrapStatus, permissions, token, userId]);

  const refetch = useCallback(async () => {
    if (!token || !userId) {
      return { data: null };
    }

    await bootstrapAppShell({ token, userId, force: true });
    return { data: getPermissionCacheEntry(userId)?.data ?? null };
  }, [bootstrapAppShell, token, userId]);

  return useMemo(
    () => ({
      data: permissions ?? cacheEntry?.data ?? null,
      isLoading: !!token && !!userId && bootstrapStatus === 'loading' && !(permissions ?? cacheEntry?.data),
      isError: bootstrapStatus === 'error' && !(permissions ?? cacheEntry?.data),
      error: bootstrapError ?? null,
      refetch,
    }),
    [bootstrapError, bootstrapStatus, cacheEntry?.data, permissions, refetch, token, userId],
  );
};
