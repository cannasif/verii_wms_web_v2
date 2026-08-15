import { Loader2 } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { NavLink, Navigate, Outlet, useMatch } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/components/theme-provider';
import { usePermissionAccess } from '@/features/access-control/hooks/usePermissionAccess';
import { cn } from '@/lib/utils';
import {
  findProcessParameterSection,
  PROCESS_PARAMETER_SECTIONS,
  processParameterHubPath,
} from './process-parameters-sections';

export function ProcessParametersHubPage() {
  const { t } = useTranslation('common');
  const match = useMatch('/warehouse/process-parameters/:section');
  const section = match?.params.section;
  const { can, isLoading } = usePermissionAccess();
  const { skin } = useTheme();
  const isPremium = skin === 'premium';

  const visibleSections = useMemo(
    () => PROCESS_PARAMETER_SECTIONS.filter((item) => can(item.permission)),
    [can],
  );

  const activeSection = findProcessParameterSection(section);
  const activeAllowed = activeSection ? can(activeSection.permission) : false;
  const fallbackKey = visibleSections[0]?.key;

  useEffect(() => {
    if (!section || !activeAllowed) return;
    document.getElementById(`process-param-tab-${section}`)?.scrollIntoView({
      block: 'nearest',
      behavior: 'smooth',
    });
  }, [activeAllowed, section]);

  if (isLoading) {
    return (
      <section className="grid min-h-[50vh] place-items-center">
        <Loader2 className="size-7 animate-spin text-[var(--wms-brand-primary)]" />
      </section>
    );
  }

  if (!visibleSections.length) {
    return (
      <section className="mx-auto max-w-3xl rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-6 text-sm text-[var(--wms-app-text-muted)]">
        {t('processParametersHub.empty', {
          defaultValue: 'Görüntüleyebileceğiniz süreç parametresi bulunmuyor.',
        })}
      </section>
    );
  }

  if (section && (!activeSection || !activeAllowed) && fallbackKey) {
    return <Navigate to={processParameterHubPath(fallbackKey)} replace />;
  }

  return (
    <div className={cn('wms-ops-process-params-hub', isPremium && 'wms-ops-process-params-hub--premium')}>
      <aside className="wms-ops-process-params-hub__rail" aria-label={t('sidebar.processParameters')}>
        <header className="wms-ops-process-params-hub__rail-head">
          <p className="wms-ops-process-params-hub__eyebrow">
            {t('processParametersHub.eyebrow', { defaultValue: 'Parametreler' })}
          </p>
          <h1 className="wms-ops-process-params-hub__title">
            {t('sidebar.processParameters', { defaultValue: 'Süreç Parametreleri' })}
          </h1>
          <p className="wms-ops-process-params-hub__subtitle">
            {t('processParametersHub.railHint', {
              defaultValue: 'Soldan sekme seçin; ayarlar sağda açılır.',
            })}
          </p>
        </header>

        <nav className="wms-ops-process-params-hub__tabs" role="tablist" aria-orientation="vertical">
          {visibleSections.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.key}
                id={`process-param-tab-${item.key}`}
                to={processParameterHubPath(item.key)}
                role="tab"
                aria-selected={item.key === section}
                className={({ isActive }) =>
                  cn('wms-ops-process-params-hub__tab', isActive && 'wms-ops-process-params-hub__tab--active')
                }
              >
                <span className="wms-ops-process-params-hub__tab-icon" aria-hidden>
                  <Icon className="size-4" strokeWidth={1.75} />
                </span>
                <span className="wms-ops-process-params-hub__tab-label">
                  {t(item.titleKey, { defaultValue: item.titleFallback })}
                </span>
              </NavLink>
            );
          })}
        </nav>
      </aside>

      <section className="wms-ops-process-params-hub__panel" role="tabpanel">
        <Outlet />
      </section>
    </div>
  );
}

export function ProcessParametersIndexRedirect() {
  const { t } = useTranslation('common');
  const { can, isLoading } = usePermissionAccess();
  const first = PROCESS_PARAMETER_SECTIONS.find((item) => can(item.permission));

  if (isLoading) {
    return (
      <section className="grid min-h-[40vh] place-items-center">
        <Loader2 className="size-7 animate-spin text-[var(--wms-brand-primary)]" />
      </section>
    );
  }

  if (!first) {
    return (
      <section className="rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-6 text-sm text-[var(--wms-app-text-muted)]">
        {t('processParametersHub.empty', {
          defaultValue: 'Görüntüleyebileceğiniz süreç parametresi bulunmuyor.',
        })}
      </section>
    );
  }

  return <Navigate to={first.key} replace />;
}
