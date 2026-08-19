import type { LucideIcon } from 'lucide-react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useMemo, type ReactElement, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/components/theme-provider';
import { cn } from '@/lib/utils';
import { resolveNavTrailLabels } from './nav-items';

export type OpsProcessHubCard = {
  key: string;
  title: string;
  description: string;
  code: string;
  icon: LucideIcon;
  href?: string;
  disabled?: boolean;
  badge?: string;
  featured?: boolean;
};

export type OpsProcessHubPhase = {
  key: string;
  number: string;
  title: string;
  description: string;
  sectionCode: string;
  items: OpsProcessHubCard[];
};

export type OpsProcessHubProps = {
  eyebrow: string;
  title: string;
  description: string;
  path?: string;
  showPath?: boolean;
  phases: OpsProcessHubPhase[];
  callout?: { title: string; text: string };
  loading?: boolean;
  className?: string;
  /** Overrides skin-specific launch button text (terminal: Başlat, premium: Devam et). */
  launchLabel?: string;
};

function CornerFrame({ className }: { className?: string }): ReactElement {
  return (
    <span className={className} aria-hidden>
      <span className="wms-ops-dashboard-module__corner wms-ops-dashboard-module__corner--tl" />
      <span className="wms-ops-dashboard-module__corner wms-ops-dashboard-module__corner--tr" />
      <span className="wms-ops-dashboard-module__corner wms-ops-dashboard-module__corner--bl" />
      <span className="wms-ops-dashboard-module__corner wms-ops-dashboard-module__corner--br" />
    </span>
  );
}

function HubHero({
  eyebrow,
  title,
  description,
  path,
  showPath,
  isPremium,
}: {
  eyebrow: string;
  title: string;
  description: string;
  path?: string;
  showPath: boolean;
  isPremium: boolean;
}): ReactElement {
  const { t, i18n } = useTranslation('common');
  const language = i18n.resolvedLanguage ?? i18n.language;
  const pathValue = useMemo(() => {
    if (!path) return '';
    const labels = resolveNavTrailLabels(t, language, path);
    if (labels?.length) {
      return labels.join(isPremium ? ' · ' : ' :: ');
    }
    return path;
  }, [isPremium, language, path, t]);

  return (
    <header className="wms-ops-dashboard-hero wms-ops-process-hub__hero">
      <span className="wms-ops-dashboard-hero__frame" aria-hidden>
        <span className="wms-ops-dashboard-hero__corner wms-ops-dashboard-hero__corner--tl" />
        <span className="wms-ops-dashboard-hero__corner wms-ops-dashboard-hero__corner--tr" />
        <span className="wms-ops-dashboard-hero__corner wms-ops-dashboard-hero__corner--bl" />
        <span className="wms-ops-dashboard-hero__corner wms-ops-dashboard-hero__corner--br" />
        <span className="wms-ops-dashboard-hero__glow" />
      </span>
      <div className="wms-ops-dashboard-hero__content">
        <p className="wms-ops-dashboard-hero__eyebrow">{eyebrow}</p>
        <h1 className="wms-ops-dashboard-hero__title">{title}</h1>
        <p className="wms-ops-dashboard-hero__subtitle">{description}</p>
        {showPath && path ? (
          <div className="wms-ops-process-hub__path" aria-label="route">
            <span className="wms-ops-process-hub__path-prompt" aria-hidden>
              {isPremium ? '' : '> '}
            </span>
            <span className="wms-ops-process-hub__path-label">
              {isPremium
                ? t('processHub.path', { defaultValue: 'Rota' })
                : t('processHub.pathTerminal', { defaultValue: 'PATH' })}
            </span>
            <span className="wms-ops-process-hub__path-sep" aria-hidden>
              {isPremium ? ' · ' : ' :: '}
            </span>
            <span className="wms-ops-process-hub__path-value">{pathValue}</span>
          </div>
        ) : null}
      </div>
    </header>
  );
}

function HubCard({
  card,
  index,
  openLabel,
}: {
  card: OpsProcessHubCard;
  index: number;
  openLabel: string;
}): ReactElement {
  const Icon = card.icon;
  const body = (
    <>
      <CornerFrame className="wms-ops-dashboard-module__frame" />
      <span className="wms-ops-dashboard-module__scan" aria-hidden />
      <span className="wms-ops-dashboard-module__sheen" aria-hidden />
      <div className="wms-ops-dashboard-module__head">
        <span className="wms-ops-dashboard-module__index">{String(index).padStart(2, '0')}</span>
        <span className="wms-ops-code-badge wms-ops-dashboard-module__code">{card.code}</span>
      </div>
      <div className="wms-ops-dashboard-module__body">
        <span className="wms-ops-dashboard-module__icon" aria-hidden>
          <Icon className="size-[1.35rem]" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="wms-ops-process-hub__card-title-row">
            <h3 className="wms-ops-dashboard-module__title">{card.title}</h3>
            {card.badge ? <span className="wms-ops-process-hub__badge">{card.badge}</span> : null}
          </div>
          <p className="wms-ops-dashboard-module__desc">{card.description}</p>
        </div>
      </div>
      {!card.disabled ? (
        <div className="wms-ops-dashboard-module__action">
          <span>{openLabel}</span>
          <ArrowRight className="wms-ops-dashboard-module__action-icon size-4" strokeWidth={1.75} />
        </div>
      ) : null}
    </>
  );

  if (card.disabled || !card.href) {
    return (
      <div
        className={cn(
          'wms-ops-dashboard-module wms-ops-process-hub__card wms-ops-process-hub__card--disabled',
          card.featured && 'wms-ops-process-hub__card--featured',
        )}
        aria-disabled="true"
      >
        {body}
      </div>
    );
  }

  return (
    <Link
      to={card.href}
      className={cn(
        'wms-ops-dashboard-module wms-ops-process-hub__card group',
        card.featured && 'wms-ops-process-hub__card--featured',
      )}
    >
      {body}
    </Link>
  );
}

function HubPhase({
  phase,
  openLabel,
}: {
  phase: OpsProcessHubPhase;
  openLabel: string;
}): ReactElement {
  return (
    <section className="wms-ops-dashboard-section wms-ops-process-hub__phase">
      <span className="wms-ops-dashboard-section__frame" aria-hidden>
        <span className="wms-ops-dashboard-section__corner wms-ops-dashboard-section__corner--tl" />
        <span className="wms-ops-dashboard-section__corner wms-ops-dashboard-section__corner--tr" />
        <span className="wms-ops-dashboard-section__corner wms-ops-dashboard-section__corner--bl" />
        <span className="wms-ops-dashboard-section__corner wms-ops-dashboard-section__corner--br" />
      </span>
      <header className="wms-ops-dashboard-section__header">
        <div className="wms-ops-dashboard-section__heading">
          <div className="wms-ops-process-hub__phase-heading">
            <span className="wms-ops-process-hub__phase-number">{phase.number}</span>
            <h2 className="wms-ops-pt-terminal__title wms-ops-dashboard-section__title text-sm">{phase.title}</h2>
          </div>
          <p className="wms-ops-dashboard-section__description wms-ops-pt-terminal__meta text-xs">{phase.description}</p>
        </div>
        <div className="wms-ops-dashboard-section__meta">
          <span className="wms-ops-code-badge wms-ops-dashboard-section__code">{phase.sectionCode}</span>
        </div>
      </header>
      <div className="wms-ops-dashboard-section__body">
        <div
          className={cn(
            'wms-ops-dashboard-quick-grid wms-ops-process-hub__grid',
            phase.items.length === 1 && 'wms-ops-process-hub__grid--single',
            phase.items.length === 2 && 'wms-ops-process-hub__grid--two',
            phase.items.length >= 3 && 'wms-ops-process-hub__grid--multi',
          )}
        >
          {phase.items.map((card, index) => (
            <HubCard key={card.key} card={card} index={index + 1} openLabel={openLabel} />
          ))}
        </div>
      </div>
    </section>
  );
}

function HubCallout({ title, text }: { title: string; text: string }): ReactElement {
  return (
    <aside className="wms-ops-dashboard-panel wms-ops-process-hub__callout">
      <span className="wms-ops-dashboard-panel__frame" aria-hidden>
        <span className="wms-ops-dashboard-panel__corner wms-ops-dashboard-panel__corner--tl" />
        <span className="wms-ops-dashboard-panel__corner wms-ops-dashboard-panel__corner--tr" />
        <span className="wms-ops-dashboard-panel__corner wms-ops-dashboard-panel__corner--bl" />
        <span className="wms-ops-dashboard-panel__corner wms-ops-dashboard-panel__corner--br" />
      </span>
      <div className="wms-ops-dashboard-panel__content">
        <h2 className="wms-ops-process-hub__callout-title">{title}</h2>
        <p className="wms-ops-process-hub__callout-text">{text}</p>
      </div>
    </aside>
  );
}

export function OpsProcessHub({
  eyebrow,
  title,
  description,
  path,
  showPath = true,
  phases,
  callout,
  loading,
  className,
  launchLabel,
}: OpsProcessHubProps): ReactElement {
  const { t } = useTranslation('common');
  const { skin } = useTheme();
  const isPremium = skin === 'premium';
  const openLabel = launchLabel
    ?? (isPremium
      ? t('dashboard.premium.launch', { defaultValue: 'Devam et' })
      : t('dashboard.terminal.launch', { defaultValue: 'Başlat' }));

  if (loading) {
    return (
      <section className="grid min-h-[50vh] place-items-center">
        <Loader2 className="size-7 animate-spin text-[var(--wms-brand-primary)]" />
      </section>
    );
  }

  return (
    <div className={cn('wms-ops-dashboard-page wms-ops-erp-skin wms-ops-process-hub', className)}>
      <div className="wms-ops-dashboard-terminal">
        <div className="wms-ops-dashboard-terminal__scanlines" aria-hidden />
        <HubHero
          eyebrow={eyebrow}
          title={title}
          description={description}
          path={path}
          showPath={showPath}
          isPremium={isPremium}
        />
        {phases.map((phase) => (
          <HubPhase key={phase.key} phase={phase} openLabel={openLabel} />
        ))}
        {callout ? <HubCallout title={callout.title} text={callout.text} /> : null}
      </div>
    </div>
  );
}

export function OpsProcessHubLoading(): ReactNode {
  return (
    <section className="grid min-h-[50vh] place-items-center">
      <Loader2 className="size-7 animate-spin text-[var(--wms-brand-primary)]" />
    </section>
  );
}
