import { type CSSProperties, type ReactElement, type ReactNode, useId } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Database,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  DashboardDailyOperationPoint,
  DashboardInventoryHealth,
  DashboardSystemHealth,
} from '../types/dashboard.types';

type MetricTone = 'cyan' | 'blue' | 'violet' | 'amber' | 'rose' | 'green';

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

export function DashboardCommandMetric({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  href,
  trend = [],
  isLoading = false,
}: {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  tone: MetricTone;
  href: string;
  trend?: number[];
  isLoading?: boolean;
}): ReactElement {
  return (
    <Link className={cn('wms-command-metric', `wms-command-metric--${tone}`)} to={href}>
      <div className="wms-command-metric__topline">
        <span className="wms-command-metric__icon" aria-hidden><Icon size={18} strokeWidth={1.8} /></span>
        <span className="wms-command-metric__label">{label}</span>
        <ArrowUpRight className="wms-command-metric__arrow" size={16} aria-hidden />
      </div>
      <div className="wms-command-metric__content">
        <strong className="wms-command-metric__value">{isLoading ? '…' : value}</strong>
        {trend.length > 0 ? (
          <svg className="wms-command-metric__sparkline" viewBox="0 0 112 28" role="img" aria-label={label}>
            <path d={sparklinePath(trend)} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          </svg>
        ) : null}
      </div>
      <span className="wms-command-metric__hint">{hint}</span>
    </Link>
  );
}

interface TrendSeriesDefinition {
  key: 'goodsReceiptCount' | 'shipmentCount' | 'transferCount';
  label: string;
  color: string;
}

function trendPath(
  data: DashboardDailyOperationPoint[],
  key: TrendSeriesDefinition['key'],
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

export function DashboardOperationsTrend({
  data,
  series,
  formatDate,
  emptyText,
}: {
  data: DashboardDailyOperationPoint[];
  series: TrendSeriesDefinition[];
  formatDate: (value: string) => string;
  emptyText: string;
}): ReactElement {
  const gradientPrefix = useId().replace(/:/g, '');
  const maxValue = Math.max(
    1,
    ...data.flatMap((point) => series.map((item) => point[item.key])),
  );
  const chartHasData = data.some((point) => series.some((item) => point[item.key] > 0));

  return (
    <div className="wms-command-trend">
      <div className="wms-command-trend__legend">
        {series.map((item) => (
          <span key={item.key} className="wms-command-trend__legend-item">
            <span style={{ background: item.color }} aria-hidden />{item.label}
          </span>
        ))}
      </div>
      <div className="wms-command-trend__canvas">
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
              className="wms-command-trend__gridline"
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
              <text key={point.date} x={x} y="220" textAnchor="middle" className="wms-command-trend__axis-label">
                {formatDate(point.date)}
              </text>
            );
          })}
        </svg>
        {!chartHasData ? <p className="wms-command-trend__empty">{emptyText}</p> : null}
      </div>
    </div>
  );
}

export function DashboardInventoryDonut({
  inventory,
  labels,
}: {
  inventory: DashboardInventoryHealth;
  labels: {
    total: string;
    available: string;
    reserved: string;
    qualityHold: string;
    unavailable: string;
  };
}): ReactElement {
  const segments = [
    { label: labels.available, value: inventory.availablePositionCount, color: '#22c55e' },
    { label: labels.reserved, value: inventory.reservedPositionCount, color: '#3b82f6' },
    { label: labels.qualityHold, value: inventory.qualityHoldPositionCount, color: '#f59e0b' },
    { label: labels.unavailable, value: inventory.unavailablePositionCount, color: '#f43f5e' },
  ];
  const total = segments.reduce((sum, item) => sum + item.value, 0);
  let cursor = 0;
  const gradient = total === 0
    ? 'conic-gradient(color-mix(in oklab, var(--wms-app-border) 70%, transparent) 0 100%)'
    : `conic-gradient(${segments.map((item) => {
        const start = cursor;
        cursor += (item.value / total) * 100;
        return `${item.color} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`;
      }).join(', ')})`;

  return (
    <div className="wms-command-inventory">
      <div className="wms-command-inventory__donut" style={{ background: gradient } as CSSProperties}>
        <div className="wms-command-inventory__donut-center">
          <strong>{total.toLocaleString()}</strong>
          <span>{labels.total}</span>
        </div>
      </div>
      <ul className="wms-command-inventory__legend">
        {segments.map((item) => (
          <li key={item.label}>
            <span className="wms-command-inventory__dot" style={{ background: item.color }} aria-hidden />
            <span>{item.label}</span>
            <strong>{item.value.toLocaleString()}</strong>
            <small>{total > 0 ? `%${Math.round((item.value / total) * 100)}` : '%0'}</small>
          </li>
        ))}
      </ul>
    </div>
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
    <div className={cn('wms-command-health__item', `wms-command-health__item--${tone}`)}>
      <Icon size={17} strokeWidth={1.8} aria-hidden />
      <span><small>{label}</small><strong>{value}</strong></span>
    </div>
  );
}

export function DashboardSystemHealthStrip({
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
    <footer className="wms-command-health">
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
