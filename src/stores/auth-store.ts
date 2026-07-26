import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getApiBaseUrl } from '@/lib/api-config';
import { getUserFromToken, isTokenValid } from '@/utils/jwt';
import { usePermissionsStore } from '@/stores/permissions-store';
import { useAppShellStore } from '@/stores/app-shell-store';
import { withSessionRefreshLock } from '@/lib/session-refresh-lock';

interface User {
  id: number;
  email: string;
  name?: string;
}

interface Branch {
  id: string;
  name: string;
  code?: string;
}

interface AuthTokenEnvelope {
  success?: boolean;
  data?: { accessToken?: string };
  Success?: boolean;
  Data?: { AccessToken?: string; accessToken?: string };
}

interface AuthState {
  user: User | null;
  token: string | null;
  branch: Branch | null;
  setAuth: (user: User, token: string, branch: Branch | null) => void;
  logout: (revoke?: boolean) => void;
  isAuthenticated: () => boolean;
  init: () => Promise<void>;
}

function clearClientState(userId: number | null): void {
  usePermissionsStore.getState().clearPermissions(userId);
  useAppShellStore.getState().clearAppShellData();
}

function extractAccessToken(payload: AuthTokenEnvelope): string | null {
  return payload.data?.accessToken
    ?? payload.Data?.accessToken
    ?? payload.Data?.AccessToken
    ?? null;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      branch: null,
      setAuth: (user, token, branch) => set({ user, token, branch }),
      logout: (revoke = true) => {
        const currentUserId = get().user?.id ?? null;
        if (revoke) {
          void fetch(`${getApiBaseUrl()}/api/auth/revoke`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
          }).catch(() => undefined);
        }
        clearClientState(currentUserId);
        set({ user: null, token: null, branch: null });
      },
      isAuthenticated: () => {
        const state = get();
        if (!state.token || !isTokenValid(state.token)) return false;
        const user = state.user ?? getUserFromToken(state.token);
        if (!user) return false;
        if (!state.user) set({ user });
        return true;
      },
      init: async () => {
        try {
          const token = await withSessionRefreshLock(async () => {
            const response = await fetch(`${getApiBaseUrl()}/api/auth/refresh`, {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
            });
            if (!response.ok) throw new Error('Session refresh failed.');
            return extractAccessToken(await response.json() as AuthTokenEnvelope);
          });
          const user = token ? getUserFromToken(token) : null;
          if (!token || !user) throw new Error('Session response is invalid.');
          set({ user, token });
        } catch {
          const currentUserId = get().user?.id ?? null;
          clearClientState(currentUserId);
          set({ user: null, token: null, branch: null });
        }
      },
    }),
    {
      name: 'auth-storage',
      // Access token yalnızca bellekte tutulur. Kalıcı depoda kullanıcı/şube tercihi bulunur.
      partialize: (state) => ({ user: state.user, branch: state.branch }),
    },
  ),
);
