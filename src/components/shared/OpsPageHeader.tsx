import { type ReactElement, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CircleHelp } from 'lucide-react';
import { useTheme } from '@/components/theme-provider';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { buildTerminalEyebrowFromNav, PremiumEyebrow } from './PremiumEyebrow';

/**
 * Grid sayfalarındaki (mal kabul listesi) başlık iskeletinin form/işlem sayfaları için
 * kullanılabilen hali: eyebrow kartın dışında, başlık toolbar kartının içinde.
 * Premium'da sayfa açıklaması alt yazı yerine başlık yanındaki ipucu balonunda yaşar.
 */
export function OpsPageHeader({
  title,
  description,
  hintLabel,
  actions,
  subRow,
  className,
}: {
  title: ReactNode;
  description?: string;
  hintLabel?: string;
  actions?: ReactNode;
  /** Başlık kartına bitişik, sağa yaslı ikinci satır. */
  subRow?: ReactNode;
  className?: string;
}): ReactElement {
  const { skin } = useTheme();
  const { t, i18n } = useTranslation();
  const { pathname } = useLocation();
  const isPremium = skin === 'premium';
  const eyebrow = buildTerminalEyebrowFromNav(pathname, t, i18n.resolvedLanguage ?? i18n.language) ?? 'VERII WMS';

  return (
    <div className={cn('wms-ops-list wms-ops-form space-y-4', className)}>
      {isPremium ? (
        <PremiumEyebrow eyebrow={eyebrow} />
      ) : (
        <div className="wms-ops-eyebrow font-mono text-[11px] font-semibold uppercase tracking-[0.18em]">
          {eyebrow}
        </div>
      )}
      <div className="wms-ops-form-card wms-ops-data-grid-shell overflow-hidden rounded-none border border-[var(--wms-ops-card-border)] py-0 shadow-none">
        <div className="wms-ops-card-toolbar flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6">
          <div className="wms-ops-card-heading min-w-0 space-y-1">
            <h1 className="wms-ops-title flex flex-wrap items-center gap-2">
              <span className="wms-ops-title-main wms-ops-title-main--toolbar">{title}</span>
              {isPremium && description ? (
                <OpsPageHeaderHint text={description} label={hintLabel ?? ''} />
              ) : null}
            </h1>
            {!isPremium && description ? (
              <p className="wms-ops-subtitle font-mono text-sm">
                <span className="wms-ops-subtitle-prefix" aria-hidden>
                  {'> '}
                </span>
                {description}
              </p>
            ) : null}
          </div>
          {actions ? (
            <div className="wms-ops-card-toolbar-actions w-full sm:w-auto sm:shrink-0">{actions}</div>
          ) : null}
        </div>
        {subRow ? (
          <div className="wms-ops-card-toolbar border-t border-[var(--wms-ops-card-border)] px-3 py-2.5 sm:px-4">
            <div className="w-full min-w-0">{subRow}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function OpsPageHeaderHint({ text, label }: { text: string; label: string }): ReactElement {
  return (
    <TooltipProvider delayDuration={160}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className="wms-ops-gr-page-hero__hint" aria-label={label}>
            <CircleHelp className="size-3.5" aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="start"
          sideOffset={10}
          className={cn(
            'wms-ops-page-hint-tooltip max-w-[22rem] overflow-hidden rounded-xl border p-0 text-left',
            '!bg-[color-mix(in_oklab,var(--wms-app-panel)_96%,black)]',
            'border-[color-mix(in_oklab,var(--wms-ops-accent)_32%,var(--wms-app-border))]',
            '!text-[var(--wms-app-text)]',
          )}
        >
          <div className="border-b border-[color-mix(in_oklab,var(--wms-ops-accent)_18%,transparent)] bg-[color-mix(in_oklab,var(--wms-ops-accent)_8%,transparent)] px-3.5 py-2">
            <span className="inline-flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[var(--wms-ops-accent)]">
              <span className="size-1.5 rounded-full bg-[var(--wms-ops-accent)]" aria-hidden />
              {label}
            </span>
          </div>
          <p className="px-3.5 py-3 text-[0.78rem] leading-5 text-[var(--wms-app-text-muted)]">{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
