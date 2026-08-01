import { Suspense, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Navbar } from '@/components/shared/Navbar';
import { PremiumTopNav } from '@/components/shared/PremiumTopNav';
import { Sidebar } from '@/components/shared/Sidebar';
import { LegacyLocalizationBoundary } from '@/components/shared/LegacyLocalizationBoundary';
import { filterAuthorizedNavItems, WMS_NAV_ITEMS } from '@/components/shared/nav-items';
import { useTheme } from '@/components/theme-provider';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';
import { SHELL_PORTAL_ROOT_ID, WORKSPACE_PORTAL_ROOT_ID } from '@/lib/workspace-portal';
import { projectSettingsApi } from '@/features/project-settings/project-settings.api';
import { useProjectSettingsStore } from '@/stores/project-settings-store';
import { useMyPermissionsQuery } from '@/features/access-control/hooks/useMyPermissionsQuery';
import { canAccessPath } from '@/features/access-control/utils/hasPermission';
import { SessionRecoveryPage } from '@/features/auth/components/SessionRecoveryPage';
import { WarehouseAmbientBackground } from '@/components/shared/WarehouseAmbientBackground';
import { OpsLoadingState } from '@/components/shared/OpsLoadingState';
import { StockCardProvider } from '@/features/erp-mirror/components/StockCardProvider';
import { useUserDetail } from '@/features/user-detail/hooks/useUserDetail';
import {
  DEFAULT_WMS_BACKGROUND_MOTION,
  normalizeBackgroundMotionVariant,
} from '@/lib/background-motion';

export function AppLayout() {
  const { t } = useTranslation();
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const { skin, setBackgroundMotionPreferences } = useTheme();
  const authenticated = useAuthStore((state) => state.isAuthenticated());
  const sessionStatus = useAuthStore((state) => state.sessionStatus);
  const setProjectSettings = useProjectSettingsStore((state) => state.setSettings);
  const permissionQuery = useMyPermissionsQuery();
  const userDetailQuery = useUserDetail(authenticated);
  const isPremium = skin === 'premium';
  const visibleNavItems = useMemo(
    () => permissionQuery.data ? filterAuthorizedNavItems(WMS_NAV_ITEMS, permissionQuery.data) : [],
    [permissionQuery.data],
  );

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, left: 0 });
  }, [location.key]);

  useEffect(() => {
    if (!authenticated) return;
    projectSettingsApi.current().then(setProjectSettings).catch(() => undefined);
  }, [authenticated, setProjectSettings]);

  useEffect(() => {
    const detail = userDetailQuery.data;
    if (!detail) return;

    setBackgroundMotionPreferences(
      detail.backgroundMotionEnabled === true,
      normalizeBackgroundMotionVariant(detail.backgroundMotionVariant)
        ?? DEFAULT_WMS_BACKGROUND_MOTION,
    );
  }, [
    setBackgroundMotionPreferences,
    userDetailQuery.data,
  ]);

  if (sessionStatus === 'restoring' || sessionStatus === 'unavailable') {
    return <SessionRecoveryPage />;
  }

  if (!authenticated) {
    return <Navigate to="/auth/login" replace state={{ from: location.pathname }} />;
  }

  if (!permissionQuery.data) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[var(--wms-app-background)] p-6">
        <div className="max-w-md rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-6 text-center shadow-xl">
          <h1 className="text-lg font-semibold">
            {permissionQuery.isError
              ? t('appLayout.permissionsLoadFailed', { defaultValue: 'Permissions could not be loaded' })
              : t('appLayout.permissionsLoading', { defaultValue: 'Loading permissions' })}
          </h1>
          <p className="mt-2 text-sm text-[var(--wms-app-muted)]">
            {permissionQuery.isError
              ? t('appLayout.permissionsLoadFailedDescription', { defaultValue: 'Session permissions could not be retrieved. Check the connection and try again.' })
              : t('appLayout.permissionsLoadingDescription', { defaultValue: 'Preparing the secure application session.' })}
          </p>
          {permissionQuery.isError ? (
            <button
              type="button"
              className="mt-4 rounded-xl bg-[var(--wms-brand-primary)] px-4 py-2 text-sm font-semibold text-white"
              onClick={() => void permissionQuery.refetch()}
            >
              {t('common.retry', { defaultValue: 'Retry' })}
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  if (!canAccessPath(permissionQuery.data, location.pathname)) {
    return <Navigate to="/access-denied" replace state={{ from: location.pathname }} />;
  }

  return (
    <div className="relative flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-[var(--wms-app-background)] transition-colors duration-300">
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <WarehouseAmbientBackground />
        {!isPremium ? (
          <>
            <div className="absolute -left-[5%] -top-[1%] h-[720px] w-[720px] rounded-full bg-[var(--wms-app-aura-start)] blur-[120px]" />
            <div className="absolute -bottom-[7%] -right-[7%] h-[620px] w-[620px] rounded-full bg-[var(--wms-app-aura-end)] blur-[100px]" />
          </>
        ) : (
          <div aria-hidden className="absolute inset-0 wms-ops-main-glow wms-premium-shell-glow" />
        )}
      </div>

      <div className="relative z-10 flex h-full min-h-0 overflow-hidden">
        {!isPremium && <Sidebar items={visibleNavItems} />}
        <div
          className="app-main-panel relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
          data-layout-region="application"
        >
          <Navbar navItems={visibleNavItems} />
          {isPremium && <PremiumTopNav items={visibleNavItems} />}
          <section
            className="relative isolate flex min-h-0 min-w-0 flex-1 overflow-hidden"
            data-layout-region="workspace"
          >
            <main
              ref={mainRef}
              className="wms-ops-scrollbar custom-scrollbar crm-skin relative min-h-0 min-w-0 flex-1 touch-pan-y overflow-x-hidden overflow-y-auto overscroll-contain"
              data-layout-region="screen"
            >
              {!isPremium ? (
                <>
                  <div aria-hidden className="pointer-events-none absolute inset-0 z-0 wms-ops-main-glow" />
                  <div aria-hidden className="pointer-events-none absolute inset-0 z-0 wms-ops-grid-bg" />
                </>
              ) : null}
              <div
                className={cn(
                  'relative z-[1] w-full wms-ops-workspace-host wms-ops-form wms-ops-list',
                  isPremium
                    ? 'mx-auto max-w-[1560px] px-4 py-5 sm:px-6 sm:py-6 lg:px-8'
                    : 'px-3 py-3 sm:px-4 sm:py-4',
                )}
              >
                <Suspense fallback={<WorkspaceRouteLoader />}>
                  <LegacyLocalizationBoundary>
                    <StockCardProvider>
                      <Outlet />
                    </StockCardProvider>
                  </LegacyLocalizationBoundary>
                </Suspense>
              </div>
            </main>
            <div
              id={WORKSPACE_PORTAL_ROOT_ID}
              className="pointer-events-none absolute inset-0 z-[80] overflow-hidden wms-ops-workspace-host wms-ops-form wms-ops-list"
            />
          </section>
          <div
            id={SHELL_PORTAL_ROOT_ID}
            className="pointer-events-none absolute inset-0 z-[100] overflow-visible"
          />
        </div>
      </div>
    </div>
  );
}

function WorkspaceRouteLoader() {
  const { t } = useTranslation();

  return (
    <section className="grid min-h-[18rem] place-items-center p-6" aria-live="polite">
      <OpsLoadingState
        message={t('appLayout.pageLoading', { defaultValue: 'Loading page' })}
        code="FETCH"
      />
    </section>
  );
}
