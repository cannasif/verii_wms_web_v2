import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authAccessApi } from '@/features/access-control/api/authAccessApi';
import {
  PERMISSIONS_CACHE_TTL_MS,
  getPermissionCacheEntry,
  usePermissionsStore,
} from '@/stores/permissions-store';

interface AppShellStoreState {
  bootstrapStatus: 'idle' | 'loading' | 'ready' | 'error';
  bootstrapError: unknown | null;
  setBootstrapStatus: (status: AppShellStoreState['bootstrapStatus'], error?: unknown | null) => void;
  clearAppShellData: () => void;
  bootstrapAppShell: (args: { token: string | null; userId: number | null; force?: boolean }) => Promise<void>;
}

let bootstrapPromise: Promise<void> | null = null;

function hasFreshPermissions(userId: number | null | undefined): boolean {
  const entry = getPermissionCacheEntry(userId);
  if (!entry) {
    return false;
  }

  return Date.now() - entry.lastFetchedAt < PERMISSIONS_CACHE_TTL_MS;
}

export const useAppShellStore = create<AppShellStoreState>()(
  persist(
    (set, get) => ({
      bootstrapStatus: 'idle',
      bootstrapError: null,

      setBootstrapStatus: (status, error = null) =>
        set({
          bootstrapStatus: status,
          bootstrapError: error,
        }),

      clearAppShellData: () =>
        set({
          bootstrapStatus: 'idle',
          bootstrapError: null,
        }),

      bootstrapAppShell: async ({ token, userId, force = false }) => {
        if (!token || !userId) {
          get().setBootstrapStatus('idle', null);
          return;
        }

        if (bootstrapPromise && !force) {
          return bootstrapPromise;
        }

        const runBootstrap = async (): Promise<void> => {
          const cachedPermissions = getPermissionCacheEntry(userId);
          const shouldFetchPermissions = force || !hasFreshPermissions(userId);

          if (!shouldFetchPermissions && cachedPermissions) {
            get().setBootstrapStatus('ready', null);
            return;
          }

          get().setBootstrapStatus('loading', null);

          try {
            const permissions = await authAccessApi.getMyPermissions('web');
            usePermissionsStore.getState().setPermissions(permissions.userId, permissions);
            get().setBootstrapStatus('ready', null);
          } catch (error) {
            get().setBootstrapStatus('error', error);
            throw error;
          }
        };

        bootstrapPromise = runBootstrap().finally(() => {
          bootstrapPromise = null;
        });

        return bootstrapPromise;
      },
    }),
    {
      name: 'app-shell-storage',
      partialize: (state) => ({
        bootstrapStatus: state.bootstrapStatus === 'ready' ? 'ready' : 'idle',
      }),
    },
  ),
);
