import { type CSSProperties, type ReactElement, type ReactNode, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Database,
  Pencil,
  Plus,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react';
import { HugeiconsIcon } from '@hugeicons/react';
import Clock01Icon from '@hugeicons/core-free-icons/Clock01Icon';
import { cn } from '@/lib/utils';
import type {
  DashboardActivityItem,
  DashboardActivityKind,
  DashboardDailyOperationPoint,
  DashboardInventoryHealth,
  DashboardSystemHealth,
} from '../types/dashboard.types';

export type DashHealthItem = {
  icon: LucideIcon;
  label: string;
  value: string;
  tone?: 'ok' | 'warn';
};

export type DashQuickStripItem = {
  id: string;
  href: string;
  title: string;
  icon: LucideIcon;
  tone: string;
};

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

export function DashHero({
  greeting,
  title,
  subtitle,
  visualImage,
  stats,
  clockLabel,
  clockTime,
  clockDate,
  clockDateTime,
  systemLabel,
  systemValue,
  systemTone = 'ok',
  healthItems,
}: {
  greeting: string;
  title: string;
  subtitle: string;
  visualImage: string;
  stats: Array<{ label: string; value: string; hint?: string; tone?: 'operations' | 'stock' }>;
  clockLabel: string;
  clockTime: string;
  clockDate: string;
  clockDateTime: string;
  systemLabel: string;
  systemValue: string;
  systemTone?: 'ok' | 'warn';
  healthItems: DashHealthItem[];
}): ReactElement {
  return (
    <section className="wms-dash-top">
      <header className="wms-dash-welcome">
        <div className="wms-dash-welcome__copy">
          <p className="wms-dash-welcome__greeting">{greeting}</p>
          <h1 className="wms-dash-welcome__title">{title}</h1>
          <p className="wms-dash-welcome__subtitle">{subtitle}</p>
        </div>
        <div className="wms-dash-welcome__visual">
          <img className="wms-dash-welcome__photo" src={visualImage} alt="" draggable={false} />
          <div className="wms-dash-welcome__shade" aria-hidden />
          <div className="wms-dash-welcome__pulse" aria-hidden>
            <span />
            <span />
            <span />
          </div>
          {stats.map((stat) => (
            <div
              key={stat.label}
              className={cn('wms-dash-welcome__float', `wms-dash-welcome__float--${stat.tone ?? 'operations'}`)}
            >
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
              {stat.hint ? <small>{stat.hint}</small> : null}
            </div>
          ))}
        </div>
      </header>

      <aside className="wms-dash-clock" aria-live="polite">
        <div className="wms-dash-clock__watermark" aria-hidden>
          <HugeiconsIcon icon={Clock01Icon} size={118} strokeWidth={1.2} />
        </div>
        <div className="wms-dash-clock__head">
          <div>
            <span className="wms-dash-clock__label">{clockLabel}</span>
            <time className="wms-dash-clock__time" dateTime={clockDateTime}>{clockTime}</time>
            <p className="wms-dash-clock__date">{clockDate}</p>
          </div>
        </div>
        <div className={cn('wms-dash-clock__status', systemTone === 'warn' && 'wms-dash-clock__status--warn')}>
          <span className="wms-dash-clock__status-dot" aria-hidden />
          <div>
            <small>{systemLabel}</small>
            <strong>{systemValue}</strong>
          </div>
        </div>
        <ul className="wms-dash-clock__health">
          {healthItems.map((item) => {
            const Icon = item.icon;
            return (
              <li
                key={`${item.label}-${item.value}`}
                className={cn(item.tone === 'warn' && 'wms-dash-clock__health-item--warn')}
              >
                <Icon size={14} strokeWidth={1.8} aria-hidden />
                <span>
                  <small>{item.label}</small>
                  <strong>{item.value}</strong>
                </span>
              </li>
            );
          })}
        </ul>
      </aside>
    </section>
  );
}

export function DashQuickStrip({
  title,
  emptyText,
  items,
  customizeLabel,
  editLabel,
  doneLabel,
  onCustomize,
  onReorder,
}: {
  title: string;
  emptyText: string;
  items: DashQuickStripItem[];
  customizeLabel?: string;
  editLabel?: string;
  doneLabel?: string;
  onCustomize?: () => void;
  onReorder?: (orderedIds: string[]) => void;
}): ReactElement {
  const [reorderMode, setReorderMode] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !onReorder) return;
    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(items, oldIndex, newIndex).map((item) => item.id));
  };

  return (
    <section className={cn('wms-dash-quick', reorderMode && 'wms-dash-quick--reorder')}>
      <header className="wms-dash-quick__head">
        <h2>{title}</h2>
        <div className="wms-dash-quick__actions">
          {onReorder && items.length > 1 ? (
            <button
              type="button"
              className={cn('wms-dash-quick__edit', reorderMode && 'wms-dash-quick__edit--active')}
              onClick={() => setReorderMode((value) => !value)}
              aria-pressed={reorderMode}
              aria-label={reorderMode ? doneLabel : editLabel}
              title={reorderMode ? doneLabel : editLabel}
            >
              {reorderMode ? (
                <Check size={14} strokeWidth={2.4} aria-hidden />
              ) : (
                <Pencil size={14} strokeWidth={2.1} aria-hidden />
              )}
              <span>{reorderMode ? doneLabel : editLabel}</span>
            </button>
          ) : null}
          {onCustomize ? (
            <button
              type="button"
              className="wms-dash-quick__customize"
              onClick={onCustomize}
              aria-label={customizeLabel}
              title={customizeLabel}
            >
              <Plus size={15} strokeWidth={2.2} aria-hidden />
              <span>{customizeLabel}</span>
            </button>
          ) : null}
        </div>
      </header>
      {items.length === 0 ? (
        <p className="wms-dash-empty">{emptyText}</p>
      ) : reorderMode ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((item) => item.id)} strategy={horizontalListSortingStrategy}>
            <div className="wms-dash-quick__row">
              {items.map((item) => (
                <SortableQuickCard key={item.id} item={item} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="wms-dash-quick__row">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.id}
                to={item.href}
                className={cn('wms-dash-quick__item', `wms-dash-quick__item--${item.tone}`)}
              >
                <span className="wms-dash-quick__link">
                  <span className="wms-dash-quick__icon" aria-hidden>
                    <Icon size={20} strokeWidth={1.8} />
                  </span>
                  <strong>{item.title}</strong>
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

function SortableQuickCard({ item }: { item: DashQuickStripItem }): ReactElement {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const Icon = item.icon;

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.78 : 1,
        zIndex: isDragging ? 4 : undefined,
      }}
      className={cn(
        'wms-dash-quick__item',
        'wms-dash-quick__item--sortable',
        `wms-dash-quick__item--${item.tone}`,
        isDragging && 'wms-dash-quick__item--dragging',
      )}
      {...attributes}
      {...listeners}
    >
      <span className="wms-dash-quick__link">
        <span className="wms-dash-quick__icon" aria-hidden>
          <Icon size={20} strokeWidth={1.8} />
        </span>
        <strong>{item.title}</strong>
      </span>
    </div>
  );
}

export function DashMetricCard({
  label,
  value,
  hint,
  href,
  icon: Icon,
  tone,
  trend = [],
  isLoading = false,
}: {
  label: string;
  value: string;
  hint: string;
  href: string;
  icon: LucideIcon;
  tone: 'violet' | 'blue' | 'cyan' | 'amber' | 'rose' | 'green';
  trend?: number[];
  isLoading?: boolean;
}): ReactElement {
  return (
    <Link to={href} className={cn('wms-dash-metric', `wms-dash-metric--${tone}`)}>
      <div className="wms-dash-metric__top">
        <span className="wms-dash-metric__icon" aria-hidden>
          <Icon size={16} strokeWidth={1.8} />
        </span>
        <span className="wms-dash-metric__label">{label}</span>
      </div>
      <strong className="wms-dash-metric__value">{isLoading ? '…' : value}</strong>
      <span className="wms-dash-metric__hint">{hint}</span>
      {trend.length > 0 ? (
        <svg className="wms-dash-metric__spark" viewBox="0 0 112 28" role="img" aria-label={label}>
          <path d={sparklinePath(trend)} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
      ) : (
        <span className="wms-dash-metric__spark wms-dash-metric__spark--empty" aria-hidden />
      )}
    </Link>
  );
}

export function DashPanel({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}): ReactElement {
  return (
    <section className={cn('wms-dash-panel', className)}>
      <header className="wms-dash-panel__head">
        <h2>{title}</h2>
        {action}
      </header>
      <div className="wms-dash-panel__body">{children}</div>
    </section>
  );
}

function trendPath(
  data: DashboardDailyOperationPoint[],
  key: 'goodsReceiptCount' | 'shipmentCount' | 'transferCount',
  maxValue: number,
): string {
  const width = 720;
  const height = 230;
  const left = 34;
  const right = 18;
  const top = 18;
  const bottom = 34;
  const usableWidth = width - left - right;
  const usableHeight = height - top - bottom;
  return data
    .map((point, index) => {
      const x = data.length === 1 ? left + usableWidth / 2 : left + (index / (data.length - 1)) * usableWidth;
      const y = top + usableHeight - (point[key] / maxValue) * usableHeight;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

export function DashTrendChart({
  data,
  series,
  formatDate,
  emptyText,
}: {
  data: DashboardDailyOperationPoint[];
  series: Array<{ key: 'goodsReceiptCount' | 'shipmentCount' | 'transferCount'; label: string; color: string }>;
  formatDate?: (value: string) => string;
  emptyText: string;
}): ReactElement {
  const gradientPrefix = useId().replace(/:/g, '');
  const maxValue = Math.max(1, ...data.flatMap((point) => series.map((item) => point[item.key])));
  const chartHasData = data.some((point) => series.some((item) => point[item.key] > 0));
  const formatAxisDate = formatDate ?? ((value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
  });

  return (
    <div className="wms-dash-trend">
      <div className="wms-dash-trend__legend">
        {series.map((item) => (
          <span key={item.key}>
            <i style={{ background: item.color }} aria-hidden />
            {item.label}
          </span>
        ))}
      </div>
      <div className="wms-dash-trend__canvas">
        <svg viewBox="0 0 720 230" role="img" aria-label={series.map((item) => item.label).join(', ')}>
          <defs>
            {series.map((item) => (
              <linearGradient key={item.key} id={`${gradientPrefix}-${item.key}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={item.color} stopOpacity="0.45" />
                <stop offset="100%" stopColor={item.color} />
              </linearGradient>
            ))}
          </defs>
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
            <line
              key={ratio}
              x1="34"
              x2="702"
              y1={18 + (1 - ratio) * 178}
              y2={18 + (1 - ratio) * 178}
              className="wms-dash-trend__grid"
            />
          ))}
          {series.map((item) => (
            <path
              key={item.key}
              d={trendPath(data, item.key, maxValue)}
              fill="none"
              stroke={`url(#${gradientPrefix}-${item.key})`}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {data.map((point, index) => {
            const x = data.length === 1 ? 368 : 34 + (index / (data.length - 1)) * 668;
            return (
              <text key={point.date} x={x} y="220" textAnchor="middle" className="wms-dash-trend__axis">
                {formatAxisDate(point.date)}
              </text>
            );
          })}
        </svg>
        {!chartHasData ? <p className="wms-dash-empty">{emptyText}</p> : null}
      </div>
    </div>
  );
}

function visualDonutPercents(values: number[], minPct = 5.5): number[] {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return values.map(() => 0);

  const percents = values.map((value) => (value / total) * 100);
  const nonzeroIndexes = values
    .map((value, index) => (value > 0 ? index : -1))
    .filter((index) => index >= 0);
  if (nonzeroIndexes.length <= 1) return percents;

  // Keep tiny slices readable without lying in the legend numbers.
  const cappedMin = Math.min(minPct, 55 / nonzeroIndexes.length);
  const visual = [...percents];
  let debt = 0;
  for (const index of nonzeroIndexes) {
    if (visual[index] > 0 && visual[index] < cappedMin) {
      debt += cappedMin - visual[index];
      visual[index] = cappedMin;
    }
  }
  if (debt <= 0) return visual;

  const donors = nonzeroIndexes
    .filter((index) => visual[index] > cappedMin)
    .sort((a, b) => visual[b] - visual[a]);

  let remaining = debt;
  for (const index of donors) {
    const give = Math.min(visual[index] - cappedMin, remaining);
    visual[index] -= give;
    remaining -= give;
    if (remaining <= 0) break;
  }

  return visual;
}

export function DashInventoryDonut({
  inventory,
  labels,
}: {
  inventory?: DashboardInventoryHealth | null;
  labels: {
    total: string;
    available: string;
    reserved: string;
    qualityHold: string;
    unavailable: string;
  };
}): ReactElement {
  const safeInventory = {
    availablePositionCount: inventory?.availablePositionCount ?? 0,
    reservedPositionCount: inventory?.reservedPositionCount ?? 0,
    qualityHoldPositionCount: inventory?.qualityHoldPositionCount ?? 0,
    unavailablePositionCount: inventory?.unavailablePositionCount ?? 0,
  };
  const segments = [
    { label: labels.available, value: safeInventory.availablePositionCount, color: '#3b82f6' },
    { label: labels.reserved, value: safeInventory.reservedPositionCount, color: '#22c55e' },
    { label: labels.qualityHold, value: safeInventory.qualityHoldPositionCount, color: '#f59e0b' },
    { label: labels.unavailable, value: safeInventory.unavailablePositionCount, color: '#f43f5e' },
  ];
  const total = segments.reduce((sum, item) => sum + item.value, 0);
  const visualPercents = visualDonutPercents(segments.map((item) => item.value));
  let cursor = 0;
  const gradient = total === 0
    ? 'conic-gradient(color-mix(in oklab, var(--wms-app-border) 70%, transparent) 0 100%)'
    : `conic-gradient(${segments.map((item, index) => {
        const start = cursor;
        cursor += visualPercents[index] ?? 0;
        // Thin white separators so adjacent tiny slices stay distinct.
        return `${item.color} ${start.toFixed(2)}% ${Math.max(start, cursor - 0.35).toFixed(2)}%, color-mix(in oklab, var(--dash-surface) 88%, transparent) ${Math.max(start, cursor - 0.35).toFixed(2)}% ${cursor.toFixed(2)}%`;
      }).join(', ')})`;

  return (
    <div className="wms-dash-donut">
      <div className="wms-dash-donut__ring" style={{ background: gradient } as CSSProperties}>
        <div className="wms-dash-donut__center">
          <strong>{total.toLocaleString()}</strong>
          <span>{labels.total}</span>
        </div>
      </div>
      <ul className="wms-dash-donut__legend">
        {segments.map((item) => (
          <li key={item.label}>
            <span style={{ background: item.color }} aria-hidden />
            <span>{item.label}</span>
            <strong>{item.value.toLocaleString()}</strong>
            <small>
              {total <= 0
                ? '%0'
                : item.value > 0 && (item.value / total) * 100 < 0.5
                  ? '%<1'
                  : `%${Math.round((item.value / total) * 100)}`}
            </small>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DashActivityList({
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
  if (!items || items.length === 0) {
    return <p className="wms-dash-empty">{emptyText}</p>;
  }

  return (
    <ul className="wms-dash-activity">
      {items.map((item) => (
        <li key={item.id} className="wms-dash-activity__item">
          <Link to={hrefs[item.kind]} className="wms-dash-activity__row">
            <span className={cn('wms-dash-activity__badge', `wms-dash-activity__badge--${item.statusKey}`)}>
              {statusLabels[item.statusKey]}
            </span>
            <span className="wms-dash-activity__body">
              <strong>{item.title}</strong>
              <small>{kindLabels[item.kind]} · {item.subtitle}</small>
            </span>
            <time>{formatTimestamp(item.timestamp)}</time>
            <ArrowRight size={14} aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function DashFooterStrip({
  health,
  labels,
  formatTimestamp,
  isError = false,
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
  isError?: boolean;
}): ReactElement {
  const erpHealthy = !isError && health.erpIssueCount === 0;
  const items = [
    {
      icon: Database,
      label: labels.database,
      value: isError ? labels.issueCount(1) : labels.connected,
      tone: isError ? ('warn' as const) : ('ok' as const),
    },
    {
      icon: erpHealthy ? CheckCircle2 : AlertTriangle,
      label: labels.erpIntegration,
      value: erpHealthy ? labels.normal : labels.issueCount(health.erpIssueCount),
      tone: erpHealthy ? ('ok' as const) : ('warn' as const),
    },
    {
      icon: RefreshCw,
      label: labels.balanceProjection,
      value: health.lastBalanceProjectionAtUtc
        ? formatTimestamp(health.lastBalanceProjectionAtUtc)
        : labels.awaitingFirstRun,
      tone: health.lastBalanceProjectionAtUtc ? ('ok' as const) : ('warn' as const),
    },
    {
      icon: CheckCircle2,
      label: labels.updated,
      value: health.generatedAtUtc ? formatTimestamp(health.generatedAtUtc) : '-',
      tone: isError ? ('warn' as const) : ('ok' as const),
    },
  ];

  return (
    <footer className="wms-dash-footer">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.label} className={cn('wms-dash-footer__item', item.tone === 'warn' && 'wms-dash-footer__item--warn')}>
            <Icon size={15} strokeWidth={1.8} aria-hidden />
            <span>
              <small>{item.label}</small>
              <strong>{item.value}</strong>
            </span>
          </div>
        );
      })}
    </footer>
  );
}
