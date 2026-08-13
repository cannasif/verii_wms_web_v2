import { type ReactElement, type ReactNode, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeftRight,
  ArrowRight,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  PackageCheck,
  PackageSearch,
  RefreshCw,
  ScanLine,
  Send,
  ShieldCheck,
  Truck,
  UserRoundCheck,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import warehouseBackdrop from '@/assets/v3riiwmsloginbg.webp';
import { useUIStore } from '@/stores/ui-store';
import { usePermissionAccess } from '@/features/access-control/hooks/usePermissionAccess';
import { cn } from '@/lib/utils';
import { useDashboardMetrics } from '../hooks/useDashboardMetrics';
import type { DashboardActivityItem, DashboardActivityKind } from '../types/dashboard.types';
import {
  DashboardCommandMetric,
  DashboardInventoryDonut,
  DashboardOperationsTrend,
  DashboardSystemHealthStrip,
} from './dashboard-command-center';

interface QuickActionConfig {
  permission: string;
  titleKey: string;
  descriptionKey: string;
  href: string;
  icon: LucideIcon;
}

const QUICK_ACTIONS: QuickActionConfig[] = [
  {
    permission: 'wms.goods-receipt.create',
    titleKey: 'dashboard.newGoodsReceipt',
    descriptionKey: 'dashboard.terminal.quickGrDescription',
    href: '/warehouse/goods-receipts/new',
    icon: ClipboardCheck,
  },
  {
    permission: 'wms.transfer.create',
    titleKey: 'newTransfer',
    descriptionKey: 'dashboard.terminal.quickTransferDescription',
    href: '/warehouse/transfers/new-operation',
    icon: ArrowLeftRight,
  },
  {
    permission: 'wms.shipment.create',
    titleKey: 'dashboard.newShipment',
    descriptionKey: 'dashboard.terminal.quickShipmentDescription',
    href: '/warehouse/shipments/new',
    icon: Send,
  },
  {
    permission: 'wms.inventory-count.view',
    titleKey: 'inventoryCount',
    descriptionKey: 'inventoryCountDescription',
    href: '/warehouse/inventory-counts',
    icon: ScanLine,
  },
  {
    permission: 'wms.warehouse-balance.view',
    titleKey: 'dashboard.stockQuery',
    descriptionKey: 'dashboard.terminal.quickStockDescription',
    href: '/warehouse/stock-balances',
    icon: PackageSearch,
  },
  {
    permission: 'wms.quality.inspections.view',
    titleKey: 'qualityControl',
    descriptionKey: 'qualityControlDescription',
    href: '/warehouse/quality/inspections',
    icon: ShieldCheck,
  },
];

const ACTIVITY_HREFS: Record<DashboardActivityKind, string> = {
  'goods-receipt': '/warehouse/goods-receipts/list',
  shipment: '/warehouse/shipments/list',
  transfer: '/warehouse/transfers/list',
};

const ACTIVITY_ICONS: Record<DashboardActivityKind, LucideIcon> = {
  'goods-receipt': PackageCheck,
  shipment: Truck,
  transfer: ArrowLeftRight,
};

function formatRelativeTimestamp(
  value: string,
  language: string,
  minuteLabel: (minutes: number) => string,
  hourLabel: (hours: number) => string,
): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60_000));
  if (diffMinutes < 60) return minuteLabel(diffMinutes);
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 48) return hourLabel(diffHours);
  return date.toLocaleString(language);
}

function daypart(date: Date): 'goodMorning' | 'goodAfternoon' | 'goodEvening' {
  const hour = date.getHours();
  if (hour < 12) return 'goodMorning';
  if (hour < 18) return 'goodAfternoon';
  return 'goodEvening';
}

function DashboardPanel({
  title,
  description,
  action,
  className,
  children,
}: {
  title: string;
  description: string;
  action?: ReactElement;
  className?: string;
  children: ReactNode;
}): ReactElement {
  return (
    <section className={cn('wms-command-panel', className)}>
      <header className="wms-command-panel__header">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        {action}
      </header>
      <div className="wms-command-panel__body">{children}</div>
    </section>
  );
}

function ActivityRow({
  item,
  kindLabel,
  statusLabel,
  timestamp,
}: {
  item: DashboardActivityItem;
  kindLabel: string;
  statusLabel: string;
  timestamp: string;
}): ReactElement {
  const Icon = ACTIVITY_ICONS[item.kind];
  return (
    <li>
      <Link className="wms-command-activity" to={ACTIVITY_HREFS[item.kind]}>
        <span className={cn('wms-command-activity__icon', `wms-command-activity__icon--${item.kind}`)} aria-hidden>
          <Icon size={18} strokeWidth={1.8} />
        </span>
        <span className="wms-command-activity__content">
          <span className="wms-command-activity__title">{kindLabel}</span>
          <strong>{item.title}</strong>
          <small>{item.subtitle}</small>
        </span>
        <span className="wms-command-activity__meta">
          <span className={cn('wms-command-status', `wms-command-status--${item.statusKey}`)}>{statusLabel}</span>
          <time>{timestamp}</time>
        </span>
        <ArrowRight size={16} className="wms-command-activity__arrow" aria-hidden />
      </Link>
    </li>
  );
}

export function DashboardPage(): ReactElement {
  const { t, i18n } = useTranslation('common');
  const commandCenterPrefix = i18n.exists('common.commandCenter.eyebrow')
    ? 'common.commandCenter'
    : 'dashboard.commandCenter';
  const commandText = (key: string, options?: Record<string, unknown>) =>
    t(`${commandCenterPrefix}.${key}`, options);
  const setPageTitle = useUIStore((state) => state.setPageTitle);
  const permissionAccess = usePermissionAccess();
  const { user, branch, metrics, isLoading, isError, isFetching, refetch } = useDashboardMetrics();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    setPageTitle(t('dashboard.title'));
    return () => setPageTitle(null);
  }, [setPageTitle, t]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const displayName = user?.name || user?.email || t('dashboard.user');
  const branchLabel = branch?.name || branch?.code;
  const hasBranchContext = Boolean(branchLabel && branchLabel !== '0');
  const visibleQuickActions = useMemo(
    () => QUICK_ACTIONS.filter((action) => permissionAccess.can(action.permission)),
    [permissionAccess],
  );
  const goodsReceiptTrend = metrics.dailyOperations.map((item) => item.goodsReceiptCount);
  const shipmentTrend = metrics.dailyOperations.map((item) => item.shipmentCount);
  const transferTrend = metrics.dailyOperations.map((item) => item.transferCount);
  const activityKindLabels: Record<DashboardActivityKind, string> = {
    'goods-receipt': t('dashboard.goodsReceipt'),
    shipment: t('dashboard.shipment'),
    transfer: commandText('transfer'),
  };
  const statusLabels = {
    completed: t('dashboard.completed'),
    preparing: t('dashboard.preparing'),
    pending: t('dashboard.terminal.pending'),
  };

  const formatMetric = (value: number): string => value.toLocaleString(i18n.language);
  const formatSystemTimestamp = (value: string): string => {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime())
      ? '-'
      : parsed.toLocaleString(i18n.language, { dateStyle: 'short', timeStyle: 'short' });
  };

  return (
    <div className="wms-command-page">
      <section className="wms-command-hero">
        <div className="wms-command-hero__intro">
          <span className="wms-command-hero__eyebrow">{commandText('eyebrow')}</span>
          <p className="wms-command-hero__greeting">{t(`dashboard.premium.${daypart(now)}`)}</p>
          <h1>{commandText('welcome', { name: displayName })}</h1>
          <p>{commandText('subtitle')}</p>
          <div className="wms-command-hero__identity">
            <span><UserRoundCheck size={15} aria-hidden />{displayName}</span>
            {hasBranchContext ? <span><Warehouse size={15} aria-hidden />{branchLabel}</span> : null}
          </div>
        </div>

        <div className="wms-command-hero__visual" style={{ backgroundImage: `url(${warehouseBackdrop})` }}>
          <div className="wms-command-hero__visual-shade" aria-hidden />
          <div className="wms-command-hero__pulse" aria-hidden><span /><span /><span /></div>
          <div className="wms-command-hero__floating wms-command-hero__floating--operations">
            <span>{commandText('openOperations')}</span>
            <strong>{isLoading ? '…' : formatMetric(metrics.openOperationCount)}</strong>
            <small>{commandText('liveWorkload')}</small>
          </div>
          <div className="wms-command-hero__floating wms-command-hero__floating--stock">
            <span>{commandText('stockItems')}</span>
            <strong>{isLoading ? '…' : formatMetric(metrics.stockSkuCount)}</strong>
            <small>{commandText('withBalance')}</small>
          </div>
        </div>

        <aside className="wms-command-clock">
          <div>
            <Clock3 size={17} aria-hidden />
            <span>{t('dashboard.premium.systemClock')}</span>
          </div>
          <time dateTime={now.toISOString()}>{now.toLocaleTimeString(i18n.language)}</time>
          <p>{now.toLocaleDateString(i18n.language, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          <div className={cn('wms-command-clock__status', isError && 'wms-command-clock__status--error')}>
            {isError ? <AlertCircle size={15} aria-hidden /> : <CheckCircle2 size={15} aria-hidden />}
            <span>{isError ? commandText('metricsUnavailable') : commandText('systemNormal')}</span>
          </div>
        </aside>
      </section>

      {isError ? (
        <div className="wms-command-error" role="alert">
          <AlertCircle size={18} aria-hidden />
          <span>{commandText('loadError')}</span>
          <button type="button" onClick={refetch} disabled={isFetching}>
            <RefreshCw size={15} className={isFetching ? 'animate-spin' : undefined} aria-hidden />
            {commandText('retry')}
          </button>
        </div>
      ) : null}

      <section className="wms-command-quick" aria-labelledby="dashboard-quick-actions">
        <header>
          <div>
            <h2 id="dashboard-quick-actions">{t('dashboard.quickAccess')}</h2>
            <p>{commandText('quickAccessDescription')}</p>
          </div>
          <span>{commandText('permissionScoped')}</span>
        </header>
        <div className="wms-command-quick__grid">
          {visibleQuickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.href} to={action.href} className="wms-command-quick__item">
                <span aria-hidden><Icon size={20} strokeWidth={1.8} /></span>
                  <strong>{action.titleKey.includes('.') ? t(action.titleKey) : commandText(action.titleKey)}</strong>
                  <small>{action.descriptionKey.includes('.') ? t(action.descriptionKey) : commandText(action.descriptionKey)}</small>
                <ArrowRight size={15} aria-hidden />
              </Link>
            );
          })}
        </div>
      </section>

      <section className="wms-command-metrics" aria-label={t('dashboard.premium.metricsPanel')}>
        <DashboardCommandMetric
          label={commandText('todayGoodsReceipts')}
          value={formatMetric(metrics.goodsReceiptTodayCount)}
          hint={commandText('todayGoodsReceiptsHint')}
          icon={PackageCheck}
          tone="violet"
          href="/warehouse/goods-receipts/list"
          trend={goodsReceiptTrend}
          isLoading={isLoading}
        />
        <DashboardCommandMetric
          label={commandText('todayShipments')}
          value={formatMetric(metrics.shipmentTodayCount)}
          hint={commandText('todayShipmentsHint')}
          icon={Truck}
          tone="blue"
          href="/warehouse/shipments/list"
          trend={shipmentTrend}
          isLoading={isLoading}
        />
        <DashboardCommandMetric
          label={commandText('todayTransfers')}
          value={formatMetric(metrics.transferTodayCount)}
          hint={commandText('todayTransfersHint')}
          icon={ArrowLeftRight}
          tone="cyan"
          href="/warehouse/transfers/list"
          trend={transferTrend}
          isLoading={isLoading}
        />
        <DashboardCommandMetric
          label={commandText('qualityQueue')}
          value={formatMetric(metrics.pendingQualityInspectionCount)}
          hint={commandText('qualityQueueHint')}
          icon={ShieldCheck}
          tone="amber"
          href="/warehouse/quality/inspections"
          isLoading={isLoading}
        />
        <DashboardCommandMetric
          label={commandText('pendingApprovals')}
          value={formatMetric(metrics.pendingApprovalCount)}
          hint={commandText('pendingApprovalsHint')}
          icon={ClipboardList}
          tone="rose"
          href="/warehouse/goods-receipts/list"
          isLoading={isLoading}
        />
        <DashboardCommandMetric
          label={commandText('myAssignments')}
          value={formatMetric(metrics.myTasksCount)}
          hint={commandText('myAssignmentsHint')}
          icon={UserRoundCheck}
          tone="green"
          href="/warehouse/goods-receipts/assigned"
          isLoading={isLoading}
        />
      </section>

      <div className="wms-command-analytics">
        <DashboardPanel
          className="wms-command-panel--trend"
          title={commandText('operationsTrend')}
          description={commandText('operationsTrendDescription')}
          action={<span className="wms-command-panel__period">{commandText('lastSevenDays')}</span>}
        >
          <DashboardOperationsTrend
            data={metrics.dailyOperations}
            series={[
              { key: 'goodsReceiptCount', label: t('dashboard.goodsReceipt'), color: '#8b5cf6' },
              { key: 'shipmentCount', label: t('dashboard.shipment'), color: '#3b82f6' },
              { key: 'transferCount', label: commandText('transfer'), color: '#14b8a6' },
            ]}
            formatDate={(value) => new Date(`${value}T00:00:00`).toLocaleDateString(i18n.language, { day: '2-digit', month: 'short' })}
            emptyText={commandText('noTrendData')}
          />
        </DashboardPanel>

        <DashboardPanel
          title={commandText('inventoryHealth')}
          description={commandText('inventoryHealthDescription')}
          action={<Link className="wms-command-panel__link" to="/warehouse/stock-balances">{commandText('details')}<ArrowRight size={14} aria-hidden /></Link>}
        >
          <DashboardInventoryDonut
            inventory={metrics.inventoryHealth}
            labels={{
              total: commandText('stockPositions'),
              available: commandText('available'),
              reserved: commandText('reserved'),
              qualityHold: commandText('qualityHold'),
              unavailable: commandText('unavailable'),
            }}
          />
        </DashboardPanel>
      </div>

      <DashboardPanel
        className="wms-command-panel--activity"
        title={t('dashboard.recentTransactions')}
        description={commandText('recentTransactionsDescription')}
        action={<span className="wms-command-panel__live"><span aria-hidden />{commandText('live')}</span>}
      >
        {metrics.activityItems.length === 0 ? (
          <div className="wms-command-empty"><Boxes size={28} aria-hidden /><p>{t('dashboard.terminal.activityEmpty')}</p></div>
        ) : (
          <ul className="wms-command-activity-list">
            {metrics.activityItems.map((item) => (
              <ActivityRow
                key={item.id}
                item={item}
                kindLabel={activityKindLabels[item.kind]}
                statusLabel={statusLabels[item.statusKey]}
                timestamp={formatRelativeTimestamp(
                  item.timestamp,
                  i18n.language,
                  (minutes) => t('dashboard.terminal.minutesAgo', { minutes }),
                  (hours) => t('dashboard.hoursAgo', { hours }),
                )}
              />
            ))}
          </ul>
        )}
      </DashboardPanel>

      <DashboardSystemHealthStrip
        health={metrics.systemHealth}
        labels={{
          database: commandText('database'),
          connected: commandText('connected'),
          erpIntegration: commandText('erpIntegration'),
          normal: commandText('normal'),
          issueCount: (count) => commandText('issueCount', { count }),
          balanceProjection: commandText('balanceProjection'),
          awaitingFirstRun: commandText('awaitingFirstRun'),
          updated: commandText('updated'),
        }}
        formatTimestamp={formatSystemTimestamp}
      />
    </div>
  );
}
