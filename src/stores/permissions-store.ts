import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MyPermissionsDto } from '@/features/access-control/types/access-control.types';

export const PERMISSIONS_CACHE_TTL_MS = 30 * 60 * 1000;

interface PermissionCacheEntry {
  data: MyPermissionsDto;
  lastFetchedAt: number;
}

interface PermissionsStoreState {
  entries: Record<string, PermissionCacheEntry>;
  setPermissions: (userId: number, data: MyPermissionsDto, fetchedAt?: number) => void;
  clearPermissions: (userId?: number | null) => void;
}

export const usePermissionsStore = create<PermissionsStoreState>()(
  persist(
    (set) => ({
      entries: {},
      setPermissions: (userId, data, fetchedAt = Date.now()) =>
        set((state) => ({
          entries: {
            ...state.entries,
            [String(userId)]: {
              data,
              lastFetchedAt: fetchedAt,
            },
          },
        })),
      clearPermissions: (userId) =>
        set((state) => {
          if (userId == null) {
            return { entries: {} };
          }

          const nextEntries = { ...state.entries };
          delete nextEntries[String(userId)];
          return { entries: nextEntries };
        }),
    }),
    {
      name: 'permissions-cache-storage',
      partialize: (state) => ({ entries: state.entries }),
    },
  ),
);

export function getPermissionCacheEntry(userId: number | null | undefined): PermissionCacheEntry | null {
  if (!userId) {
    return null;
  }

  return usePermissionsStore.getState().entries[String(userId)] ?? null;
}

export function isPermissionCacheFresh(
  userId: number | null | undefined,
  ttlMs: number = PERMISSIONS_CACHE_TTL_MS,
): boolean {
  const entry = getPermissionCacheEntry(userId);
  if (!entry) {
    return false;
  }

  return Date.now() - entry.lastFetchedAt < ttlMs;
}
