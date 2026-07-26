import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getApiBaseUrl } from '@/lib/api-config';
import {
  clearSessionAccessToken,
  isDefinitiveSessionRefreshError,
  readSessionAccessToken,
  requestSessionAccessToken,
  writeSessionAccessToken,
} from '@/lib/auth-session';
import { getUserFromToken, isTokenValid } from '@/utils/jwt';
import { usePermissionsStore } from '@/stores/permissions-store';
import { useAppShellStore } from '@/stores/app-shell-store';

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

export type AuthSessionStatus =
  | 'idle'
  | 'restoring'
  | 'authenticated'
  | 'recovery-required'
  | 'anonymous';

interface AuthState {
  user: User | null;
  token: string | null;
  branch: Branch | null;
  sessionStatus: AuthSessionStatus;
  sessionError: string | null;
  setAuth: (user: User, token: string, branch: Branch | null) => void;
  markSessionRecoveryRequired: (message?: string) => void;
  logout: (revoke?: boolean) => void;
  isAuthenticated: () => boolean;
  init: () => Promise<void>;
}

function clearClientState(userId: number | null): void {
  usePermissionsStore.getState().clearPermissions(userId);
  useAppShellStore.getState().clearAppShellData();
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      branch: null,
      sessionStatus: 'idle',
      sessionError: null,
      setAuth: (user, token, branch) => {
        writeSessionAccessToken(token);
        set({
          user,
          token,
          branch,
          sessionStatus: 'authenticated',
          sessionError: null,
        });
      },
      markSessionRecoveryRequired: (message = 'Oturum servisine geçici olarak ulaşılamıyor.') => {
        clearSessionAccessToken();
        set({
          token: null,
          sessionStatus: 'recovery-required',
          sessionError: message,
        });
      },
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
        clearSessionAccessToken();
        set({
          user: null,
          token: null,
          branch: null,
          sessionStatus: 'anonymous',
          sessionError: null,
        });
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
        const restoredToken = readSessionAccessToken();
        const restoredUser = restoredToken && isTokenValid(restoredToken, 30)
          ? getUserFromToken(restoredToken)
          : null;

        if (restoredToken && restoredUser) {
          set({
            user: restoredUser,
            token: restoredToken,
            sessionStatus: 'authenticated',
            sessionError: null,
          });
          return;
        }

        clearSessionAccessToken();
        set({ token: null, sessionStatus: 'restoring', sessionError: null });

        try {
          const token = await requestSessionAccessToken();
          const user = getUserFromToken(token);
          if (!user) {
            throw new Error('Oturum yanıtındaki kullanıcı bilgisi geçersiz.');
          }

          writeSessionAccessToken(token);
          set({
            user,
            token,
            sessionStatus: 'authenticated',
            sessionError: null,
          });
        } catch (error) {
          if (isDefinitiveSessionRefreshError(error)) {
            const currentUserId = get().user?.id ?? null;
            clearClientState(currentUserId);
            set({
              user: null,
              token: null,
              branch: null,
              sessionStatus: 'anonymous',
              sessionError: null,
            });
            return;
          }

          set({
            token: null,
            sessionStatus: 'recovery-required',
            sessionError: error instanceof Error
              ? error.message
              : 'Oturum servisine geçici olarak ulaşılamıyor.',
          });
        }
      },
    }),
    {
      name: 'auth-storage',
      // The token is tab-scoped in sessionStorage; only user and branch preferences persist here.
      partialize: (state) => ({ user: state.user, branch: state.branch }),
    },
  ),
);
