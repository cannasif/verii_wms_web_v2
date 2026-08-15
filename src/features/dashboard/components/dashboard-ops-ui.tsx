import { type ReactElement, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Database,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  DashboardActivityItem,
  DashboardActivityKind,
  DashboardSystemHealth,
} from '../types/dashboard.types';

function FlagChip({
  children,
  tone = 'default',
}: {
  children: ReactNode;
  tone?: 'default' | 'info' | 'success' | 'warn';
}): ReactElement {
  return (
    <span className={cn('wms-ops-code-badge', tone !== 'default' && `wms-ops-flag-badge--${tone}`)}>
      {children}
    </span>
  );
}

function sparklinePath(values: number[]): string {
  if (values.length === 0) return '';
  const max = Math.max(...values, 1);
  const width = 112;
  const height = 28;
  return values
    .map((value, index) => {
      const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
      const y = height - (value / max) * (height - 4) - 2;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

export function DashboardOpsHero({
  eyebrow,
  greeting,
  title,
  subtitle,
  operatorLabel,
  operatorValue,
  branchLabel,
  branchValue,
  clockLabel,
  clockTime,
  clockDate,
  clockDateTime,
  visualImage,
  stats,
}: {
  eyebrow: string;
  greeting?: string;
  title: string;
  subtitle: string;
  operatorLabel: string;
  operatorValue: string;
  branchLabel: string;
  branchValue: string;
  clockLabel?: string;
  clockTime?: string;
  clockDate?: string;
  clockDateTime?: string;
  visualImage?: string;
  stats?: Array<{ label: string; value: string; hint?: string; tone?: 'operations' | 'stock' }>;
}): ReactElement {
  const showClock = Boolean(clockTime);
  const showVisual = Boolean(visualImage);
  const showStats = Boolean(stats?.length);

  return (
    <header className={cn('wms-ops-dashboard-hero', showVisual && 'wms-ops-dashboard-hero--pictorial')}>
      <span className="wms-ops-dashboard-hero__frame" aria-hidden>
        <span className="wms-ops-dashboard-hero__corner wms-ops-dashboard-hero__corner--tl" />
        <span className="wms-ops-dashboard-hero__corner wms-ops-dashboard-hero__corner--tr" />
        <span className="wms-ops-dashboard-hero__corner wms-ops-dashboard-hero__corner--bl" />
        <span className="wms-ops-dashboard-hero__corner wms-ops-dashboard-hero__corner--br" />
        <span className="wms-ops-dashboard-hero__glow" />
      </span>
      <div className="wms-ops-dashboard-hero__content">
        <div
          className={cn(
            'wms-ops-dashboard-hero__main',
            showVisual && 'wms-ops-dashboard-hero__main--pictorial',
            showClock && 'wms-ops-dashboard-hero__main--with-clock',
            !showVisual && showStats && 'wms-ops-dashboard-hero__main--with-stats',
          )}
        >
          <div className="wms-ops-dashboard-hero__intro">
            <p className="wms-ops-dashboard-hero__eyebrow">{eyebrow}</p>
            {greeting ? <p className="wms-ops-dashboard-hero__greeting">{greeting}</p> : null}
            <h1 className="wms-ops-dashboard-hero__title">{title}</h1>
            <p className="wms-ops-dashboard-hero__subtitle">{subtitle}</p>
            <div className="wms-ops-dashboard-hero__meta">
              <div className="wms-ops-dashboard-hero__meta-item">
                <span className="wms-ops-dashboard-hero__meta-label">{operatorLabel}</span>
                <span className="wms-ops-dashboard-hero__meta-value">{operatorValue}</span>
              </div>
              <div className="wms-ops-dashboard-hero__meta-item">
                <span className="wms-ops-dashboard-hero__meta-label">{branchLabel}</span>
                <span className="wms-ops-dashboard-hero__meta-value">{branchValue}</span>
              </div>
            </div>
          </div>

          {showVisual ? (
            <div
              className="wms-ops-dashboard-hero__visual"
              style={{ backgroundImage: `url(${visualImage})` }}
            >
              <div className="wms-ops-dashboard-hero__visual-shade" aria-hidden />
              <div className="wms-ops-dashboard-hero__pulse" aria-hidden>
                <span />
                <span />
                <span />
              </div>
              {showStats
                ? stats!.map((stat) => (
                    <div
                      key={stat.label}
                      className={cn(
                        'wms-ops-dashboard-hero__floating',
                        `wms-ops-dashboard-hero__floating--${stat.tone ?? 'operations'}`,
                      )}
                    >
                      <span>{stat.label}</span>
                      <strong>{stat.value}</strong>
                      {stat.hint ? <small>{stat.hint}</small> : null}
                    </div>
                  ))
                : null}
            </div>
          ) : showStats ? (
            <div className="wms-ops-dashboard-hero__stats">
              {stats!.map((stat) => (
                <div key={stat.label} className="wms-ops-dashboard-hero__stat">
                  <span className="wms-ops-dashboard-hero__meta-label">{stat.label}</span>
                  <strong className="wms-ops-dashboard-hero__stat-value">{stat.value}</strong>
                  {stat.hint ? <small className="wms-ops-dashboard-hero__stat-hint">{stat.hint}</small> : null}
                </div>
              ))}
            </div>
          ) : null}

          {showClock ? (
            <aside className="wms-ops-dashboard-hero__clock" aria-live="polite">
              {clockLabel ? <span className="wms-ops-dashboard-hero__clock-label">{clockLabel}</span> : null}
              <time className="wms-ops-dashboard-hero__clock-time" dateTime={clockDateTime ?? clockTime}>
                {clockTime}
              </time>
              {clockDate ? <span className="wms-ops-dashboard-hero__clock-date">{clockDate}</span> : null}
            </aside>
          ) : null}
        </div>
      </div>
    </header>
  );
}

export function DashboardOpsStatusBar({
  pulseLabel,
  pulseValue,
  tasksLabel,
  tasksValue,
  hint,
  tone = 'success',
}: {
  pulseLabel: string;
  pulseValue: string;
  tasksLabel: string;
  tasksValue: string;
  hint: string;
  tone?: 'success' | 'warn';
}): ReactElement {
  return (
    <div
      className={cn('wms-ops-dashboard-status', tone === 'warn' && 'wms-ops-dashboard-status--warn')}
      aria-live="polite"
    >
      <div className="wms-ops-dashboard-status__line">
        <span className="wms-ops-dashboard-status__prompt" aria-hidden>{'> '}</span>
        <span className="wms-ops-dashboard-status__label">{pulseLabel}: {pulseValue}</span>
        <span className="wms-ops-dashboard-status__sep" aria-hidden>{' | '}</span>
        <span className="wms-ops-dashboard-status__ready">
          {tasksLabel}: {tasksValue}
          <span className="wms-ops-dashboard-status__cursor" aria-hidden>_</span>
        </span>
      </div>
      <p className="wms-ops-dashboard-status__hint">{hint}</p>
    </div>
  );
}

export function DashboardOpsPanel({
  children,
  className,
  withCorners = true,
}: {
  children: ReactNode;
  className?: string;
  withCorners?: boolean;
}): ReactElement {
  return (
    <div className={cn('wms-ops-dashboard-panel', className)}>
      {withCorners ? (
        <span className="wms-ops-dashboard-panel__frame" aria-hidden>
          <span className="wms-ops-dashboard-panel__corner wms-ops-dashboard-panel__corner--tl" />
          <span className="wms-ops-dashboard-panel__corner wms-ops-dashboard-panel__corner--tr" />
          <span className="wms-ops-dashboard-panel__corner wms-ops-dashboard-panel__corner--bl" />
          <span className="wms-ops-dashboard-panel__corner wms-ops-dashboard-panel__corner--br" />
        </span>
      ) : null}
      <div className="wms-ops-dashboard-panel__content">{children}</div>
    </div>
  );
}

export function DashboardOpsMetricTile({
  label,
  value,
  hint,
  tone = 'default',
  isLoading = false,
  href,
  trend = [],
}: {
  label: string;
  value: ReactNode;
  hint: string;
  tone?: 'default' | 'accent' | 'warn' | 'success';
  isLoading?: boolean;
  href?: string;
  trend?: number[];
}): ReactElement {
  const body = (
    <>
      <span className="wms-ops-dashboard-metric__label">{label}</span>
      <div className="wms-ops-dashboard-metric__value-row">
        <div className="wms-ops-dashboard-metric__value">{isLoading ? '…' : value}</div>
        {trend.length > 0 ? (
          <svg className="wms-ops-dashboard-metric__sparkline" viewBox="0 0 112 28" role="img" aria-label={label}>
            <path d={sparklinePath(trend)} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          </svg>
        ) : null}
      </div>
      <p className="wms-ops-dashboard-metric__hint">{hint}</p>
    </>
  );

  const className = cn(
    'wms-ops-dashboard-metric',
    tone !== 'default' && `wms-ops-dashboard-metric--${tone}`,
    trend.length > 0 && 'wms-ops-dashboard-metric--chart',
  );

  if (href) {
    return (
      <Link className={className} to={href}>
        {body}
      </Link>
    );
  }

  return <article className={className}>{body}</article>;
}

export function DashboardOpsSection({
  title,
  description,
  sectionCode,
  action,
  children,
  compact = false,
}: {
  title: string;
  description: string;
  sectionCode: string;
  action?: ReactNode;
  children: ReactNode;
  compact?: boolean;
}): ReactElement {
  return (
    <section className={cn('wms-ops-dashboard-section', compact && 'wms-ops-dashboard-section--compact')}>
      <span className="wms-ops-dashboard-section__frame" aria-hidden>
        <span className="wms-ops-dashboard-section__corner wms-ops-dashboard-section__corner--tl" />
        <span className="wms-ops-dashboard-section__corner wms-ops-dashboard-section__corner--tr" />
        <span className="wms-ops-dashboard-section__corner wms-ops-dashboard-section__corner--bl" />
        <span className="wms-ops-dashboard-section__corner wms-ops-dashboard-section__corner--br" />
      </span>
      <header className="wms-ops-dashboard-section__header">
        <div className="wms-ops-dashboard-section__heading">
          <div className="wms-ops-pt-terminal__prompt">
            <span className="wms-ops-subtitle-prefix" aria-hidden>{'> '}</span>
            <h2 className="wms-ops-pt-terminal__title wms-ops-dashboard-section__title text-sm">{title}</h2>
          </div>
          <p className="wms-ops-dashboard-section__description wms-ops-pt-terminal__meta text-xs">{description}</p>
        </div>
        <div className="wms-ops-dashboard-section__meta">
          {action}
          <span className="wms-ops-code-badge wms-ops-dashboard-section__code">{sectionCode}</span>
        </div>
      </header>
      <div className="wms-ops-dashboard-section__body">{children}</div>
    </section>
  );
}

export function DashboardOpsActivityFeed({
  items,
  emptyText,
  kindLabels,
  statusLabels,
  hrefs,
  formatTimestamp,
}: {
  items: DashboardActivityItem[];
  emptyText: string;
  kindLabels: Record<DashboardActivityItem['kind'], string>;
  statusLabels: Record<DashboardActivityItem['statusKey'], string>;
  hrefs: Record<DashboardActivityKind, string>;
  formatTimestamp: (value: string) => string;
}): ReactElement {
  if (items.length === 0) {
    return <p className="wms-ops-dashboard-activity__empty">{emptyText}</p>;
  }

  return (
    <div className="wms-ops-dashboard-activity-panel">
      <ul className="wms-ops-dashboard-activity">
        {items.map((item) => (
          <li key={item.id}>
            <Link className="wms-ops-dashboard-activity__row" to={hrefs[item.kind]}>
              <div className="wms-ops-dashboard-activity__rail" aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <FlagChip tone="info">{kindLabels[item.kind]}</FlagChip>
                  <FlagChip tone={item.statusKey === 'completed' ? 'success' : item.statusKey === 'pending' ? 'warn' : 'default'}>
                    {statusLabels[item.statusKey]}
                  </FlagChip>
                </div>
                <p className="wms-ops-dashboard-activity__title">{item.title}</p>
                <p className="wms-ops-dashboard-activity__subtitle">{item.subtitle}</p>
                <p className="wms-ops-dashboard-activity__time">{formatTimestamp(item.timestamp)}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DashboardOpsQuickLink({
  index,
  moduleCode,
  title,
  description,
  href,
  icon: Icon,
  openLabel,
}: {
  index: number;
  moduleCode: string;
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  openLabel: string;
}): ReactElement {
  return (
    <Link to={href} className="wms-ops-dashboard-module group">
      <span className="wms-ops-dashboard-module__frame" aria-hidden>
        <span className="wms-ops-dashboard-module__corner wms-ops-dashboard-module__corner--tl" />
        <span className="wms-ops-dashboard-module__corner wms-ops-dashboard-module__corner--tr" />
        <span className="wms-ops-dashboard-module__corner wms-ops-dashboard-module__corner--bl" />
        <span className="wms-ops-dashboard-module__corner wms-ops-dashboard-module__corner--br" />
        <span className="wms-ops-dashboard-module__scan" />
      </span>
      <span className="wms-ops-dashboard-module__sheen" aria-hidden />
      <div className="wms-ops-dashboard-module__head">
        <span className="wms-ops-dashboard-module__index">{String(index).padStart(2, '0')}</span>
        <span className="wms-ops-code-badge wms-ops-dashboard-module__code">{moduleCode}</span>
      </div>
      <div className="wms-ops-dashboard-module__body">
        <span className="wms-ops-dashboard-module__icon" aria-hidden>
          <Icon className="size-[1.35rem]" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="wms-ops-dashboard-module__title">{title}</h3>
          <p className="wms-ops-dashboard-module__desc">{description}</p>
        </div>
      </div>
      <div className="wms-ops-dashboard-module__action">
        <span>{openLabel}</span>
        <ArrowRight className="wms-ops-dashboard-module__action-icon size-4" strokeWidth={1.75} />
      </div>
    </Link>
  );
}

function HealthItem({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  tone: 'success' | 'warning' | 'neutral';
}): ReactElement {
  return (
    <div className={cn('wms-ops-dashboard-health__item', `wms-ops-dashboard-health__item--${tone}`)}>
      <Icon size={17} strokeWidth={1.8} aria-hidden />
      <span>
        <small>{label}</small>
        <strong>{value}</strong>
      </span>
    </div>
  );
}

export function DashboardOpsHealthStrip({
  health,
  labels,
  formatTimestamp,
}: {
  health: DashboardSystemHealth;
  labels: {
    database: string;
    connected: string;
    erpIntegration: string;
    normal: string;
    issueCount: (count: number) => string;
    balanceProjection: string;
    awaitingFirstRun: string;
    updated: string;
  };
  formatTimestamp: (value: string) => string;
}): ReactElement {
  const erpHealthy = health.erpIssueCount === 0;
  return (
    <footer className="wms-ops-dashboard-health">
      <HealthItem icon={Database} label={labels.database} value={labels.connected} tone="success" />
      <HealthItem
        icon={erpHealthy ? CheckCircle2 : AlertTriangle}
        label={labels.erpIntegration}
        value={erpHealthy ? labels.normal : labels.issueCount(health.erpIssueCount)}
        tone={erpHealthy ? 'success' : 'warning'}
      />
      <HealthItem
        icon={RefreshCw}
        label={labels.balanceProjection}
        value={health.lastBalanceProjectionAtUtc ? formatTimestamp(health.lastBalanceProjectionAtUtc) : labels.awaitingFirstRun}
        tone={health.lastBalanceProjectionAtUtc ? 'neutral' : 'warning'}
      />
      <HealthItem
        icon={CheckCircle2}
        label={labels.updated}
        value={health.generatedAtUtc ? formatTimestamp(health.generatedAtUtc) : '-'}
        tone="neutral"
      />
    </footer>
  );
}
