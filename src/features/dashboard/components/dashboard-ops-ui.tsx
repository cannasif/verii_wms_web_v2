import { type ComponentProps, type ReactElement, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { cn } from '@/lib/utils';
import type { DashboardActivityItem } from '../types/dashboard.types';

type HugeIcon = ComponentProps<typeof HugeiconsIcon>['icon'];

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
}): ReactElement {
  const showClock = Boolean(clockTime);

  return (
    <header className="wms-ops-dashboard-hero">
      <span className="wms-ops-dashboard-hero__frame" aria-hidden>
        <span className="wms-ops-dashboard-hero__corner wms-ops-dashboard-hero__corner--tl" />
        <span className="wms-ops-dashboard-hero__corner wms-ops-dashboard-hero__corner--tr" />
        <span className="wms-ops-dashboard-hero__corner wms-ops-dashboard-hero__corner--bl" />
        <span className="wms-ops-dashboard-hero__corner wms-ops-dashboard-hero__corner--br" />
        <span className="wms-ops-dashboard-hero__glow" />
      </span>
      <div className="wms-ops-dashboard-hero__content">
        <div className={cn('wms-ops-dashboard-hero__main', showClock && 'wms-ops-dashboard-hero__main--with-clock')}>
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
}: {
  pulseLabel: string;
  pulseValue: string;
  tasksLabel: string;
  tasksValue: string;
  hint: string;
}): ReactElement {
  return (
    <div className="wms-ops-dashboard-status" aria-live="polite">
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
}: {
  label: string;
  value: ReactNode;
  hint: string;
  tone?: 'default' | 'accent' | 'warn' | 'success';
  isLoading?: boolean;
}): ReactElement {
  return (
    <article className={cn('wms-ops-dashboard-metric', tone !== 'default' && `wms-ops-dashboard-metric--${tone}`)}>
      <span className="wms-ops-dashboard-metric__label">{label}</span>
      <div className="wms-ops-dashboard-metric__value">{isLoading ? '…' : value}</div>
      <p className="wms-ops-dashboard-metric__hint">{hint}</p>
    </article>
  );
}

export function DashboardOpsSection({
  title,
  description,
  sectionCode,
  children,
}: {
  title: string;
  description: string;
  sectionCode: string;
  children: ReactNode;
}): ReactElement {
  return (
    <section className="wms-ops-dashboard-section">
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
  formatTimestamp,
}: {
  items: DashboardActivityItem[];
  emptyText: string;
  kindLabels: Record<DashboardActivityItem['kind'], string>;
  statusLabels: Record<DashboardActivityItem['statusKey'], string>;
  formatTimestamp: (value: string) => string;
}): ReactElement {
  if (items.length === 0) {
    return <p className="wms-ops-dashboard-activity__empty">{emptyText}</p>;
  }

  return (
    <div className="wms-ops-dashboard-activity-panel">
      <ul className="wms-ops-dashboard-activity">
        {items.map((item) => (
          <li key={item.id} className="wms-ops-dashboard-activity__row">
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
  icon,
  openLabel,
}: {
  index: number;
  moduleCode: string;
  title: string;
  description: string;
  href: string;
  icon: HugeIcon;
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
          <HugeiconsIcon icon={icon} size={22} strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="wms-ops-dashboard-module__title">{title}</h3>
          <p className="wms-ops-dashboard-module__desc">{description}</p>
        </div>
      </div>
      <div className="wms-ops-dashboard-module__action">
        <span>{openLabel}</span>
        <HugeiconsIcon icon={ArrowRight02Icon} size={16} strokeWidth={1.75} className="wms-ops-dashboard-module__action-icon" />
      </div>
    </Link>
  );
}
