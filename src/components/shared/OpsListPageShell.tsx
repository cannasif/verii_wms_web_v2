import { type ReactElement, type ReactNode } from 'react';
import { useTheme } from '@/components/theme-provider';
import { cn } from '@/lib/utils';
import { PremiumEyebrow } from './PremiumEyebrow';

interface OpsListPageShellProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function OpsListPageShell({
  eyebrow,
  title,
  description,
  actions,
  children,
  className,
}: OpsListPageShellProps): ReactElement {
  const { skin } = useTheme();
  const isPremium = skin === 'premium';

  return (
    <div className={cn('wms-ops-list wms-ops-form space-y-4', className)}>
      {eyebrow ? (
        isPremium ? (
          <PremiumEyebrow eyebrow={eyebrow} />
        ) : (
          <div className="wms-ops-eyebrow font-mono text-[11px] font-semibold uppercase tracking-[0.18em]">
            {eyebrow}
          </div>
        )
      ) : null}

      <div className="wms-ops-form-card wms-ops-data-grid-shell overflow-hidden rounded-none border border-[var(--wms-ops-card-border)] py-0 shadow-none">
        <div className="wms-ops-card-toolbar flex flex-col gap-3 border-b border-[color-mix(in_oklab,var(--wms-ops-card-border)_80%,transparent)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6">
          <div className="wms-ops-card-heading min-w-0 space-y-1">
            <h1 className="wms-ops-title">
              <span className="wms-ops-title-main wms-ops-title-main--toolbar">{title}</span>
            </h1>
            {description ? (
              <p className="wms-ops-subtitle font-mono text-sm">
                <span className="wms-ops-subtitle-prefix" aria-hidden>
                  {'> '}
                </span>
                {description}
              </p>
            ) : null}
          </div>
          {actions ? <div className="wms-ops-card-toolbar-actions w-full sm:w-auto sm:shrink-0">{actions}</div> : null}
        </div>
        <div className="px-3 py-3 sm:px-4 sm:py-4">{children}</div>
      </div>
    </div>
  );
}
