import { type ReactElement, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Database,
  PackageCheck,
  RefreshCw,
  Truck,
  UserRoundCheck,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import warehouseBackdrop from '@/assets/v3riiwmsloginbg.webp';
import { useTheme } from '@/components/theme-provider';
import { useUIStore } from '@/stores/ui-store';
import { cn } from '@/lib/utils';
import { usePermissionAccess } from '@/features/access-control/hooks/usePermissionAccess';
import { useDashboardMetrics } from '../hooks/useDashboardMetrics';
import type { DashboardActivityKind } from '../types/dashboard.types';
import {
  type QuickAccessAction,
  type QuickAccessId,
  coerceQuickAccessIds,
  readQuickAccessIds,
  resolveAllowedQuickAccess,
  resolveVisibleQuickAccess,
  writeQuickAccessIds,
} from '../lib/quick-access';
import {
  DashActivityList,
  DashFooterStrip,
  DashHero,
  DashInventoryDonut,
  DashMetricCard,
  DashPanel,
  DashQuickStrip,
  DashTrendChart,
} from './dashboard-home-ui';
import { QuickAccessCustomizeDialog } from './QuickAccessCustomizeDialog';

const ACTIVITY_HREFS: Record<DashboardActivityKind, string> = {
  'goods-receipt': '/warehouse/goods-receipts/list',
  shipment: '/warehouse/shipments/list',
  transfer: '/warehouse/transfers/list',
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

function daypart(date: Date): 'goodMorning' | 'goodAfternoon' | 'goodEvening' | 'goodNight' {
  const hour = date.getHours();
  if (hour < 5) return 'goodNight';
  if (hour < 12) return 'goodMorning';
  if (hour < 18) return 'goodAfternoon';
  if (hour < 22) return 'goodEvening';
  return 'goodNight';
}

export function DashboardPage(): ReactElement {
  const { t, i18n } = useTranslation('common');
  const { skin } = useTheme();
  const isPremium = skin === 'premium';
  const commandCenterPrefix = i18n.exists('common.commandCenter.eyebrow')
    ? 'common.commandCenter'
    : 'dashboard.commandCenter';
  const commandText = (key: string, options?: Record<string, unknown>) =>
    t(`${commandCenterPrefix}.${key}`, options);
  const setPageTitle = useUIStore((state) => state.setPageTitle);
  const permissionAccess = usePermissionAccess();
  const { user, metrics, isLoading, isError, isFetching, refetch } = useDashboardMetrics();
  const [now, setNow] = useState(() => new Date());
  const userKey = user?.id != null ? String(user.id) : user?.email ?? null;
  const [preferredQuickIds, setPreferredQuickIds] = useState<QuickAccessId[]>(() =>
    readQuickAccessIds(userKey),
  );
  const [quickCustomizeOpen, setQuickCustomizeOpen] = useState(false);

  useEffect(() => {
    setPageTitle(t('dashboard.title'));
    return () => setPageTitle(null);
  }, [setPageTitle, t]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    setPreferredQuickIds(readQuickAccessIds(userKey));
  }, [userKey]);

  const displayName = user?.name || user?.email || t('dashboard.user');
  const allowedQuickActions = useMemo(
    () => resolveAllowedQuickAccess(permissionAccess.can),
    [permissionAccess],
  );
  const visibleQuickActions = useMemo(
    () => resolveVisibleQuickAccess(preferredQuickIds, permissionAccess.can),
    [permissionAccess, preferredQuickIds],
  );

  const resolveQuickTitle = (action: QuickAccessAction): string => {
    const translated = t(action.titleKey, { defaultValue: '' });
    if (typeof translated === 'string' && translated.trim() && translated !== action.titleKey) {
      return translated;
    }
    const viaCommand = commandText(action.titleKey.replace(/^dashboard\./, ''));
    return typeof viaCommand === 'string' && viaCommand.trim() ? viaCommand : action.id;
  };

  const persistQuickIds = (ids: QuickAccessId[]) => {
    const next = coerceQuickAccessIds(ids);
    writeQuickAccessIds(next, userKey);
    setPreferredQuickIds(next);
  };

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

  const formatMetric = (value: number | null | undefined): string =>
    (value ?? 0).toLocaleString(i18n.language);
  const formatSystemTimestamp = (value: string): string => {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime())
      ? '-'
      : parsed.toLocaleString(i18n.language, { dateStyle: 'short', timeStyle: 'short' });
  };

  const greeting = `${t(`dashboard.premium.${daypart(now)}`)},`;
  const heroSubtitle = isPremium
    ? t('dashboard.premium.subtitle')
    : commandText('subtitle');
  const erpHealthy = metrics.systemHealth.erpIssueCount === 0;
  const balanceReady = Boolean(metrics.systemHealth.lastBalanceProjectionAtUtc);
  const metricsReady = !isError && Boolean(metrics.systemHealth.generatedAtUtc || !isLoading);

  return (
    <div className={cn('wms-dash', isPremium ? 'wms-dash--premium' : 'wms-dash--terminal')}>
      <DashHero
        greeting={greeting}
        title={displayName}
        subtitle={heroSubtitle}
        visualImage={warehouseBackdrop}
        stats={[
          {
            label: commandText('openOperations'),
            value: isLoading ? '…' : formatMetric(metrics.openOperationCount),
            hint: commandText('liveWorkload'),
            tone: 'operations',
          },
          {
            label: commandText('stockItems'),
            value: isLoading ? '…' : formatMetric(metrics.stockSkuCount),
            hint: commandText('withBalance'),
            tone: 'stock',
          },
        ]}
        clockLabel={t('dashboard.premium.systemClock')}
        clockTime={now.toLocaleTimeString(i18n.language)}
        clockDate={now.toLocaleDateString(i18n.language, {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })}
        clockDateTime={now.toISOString()}
        systemLabel={t('dashboard.premium.systemPulse')}
        systemValue={isError ? commandText('metricsUnavailable') : commandText('systemNormal')}
        systemTone={isError ? 'warn' : 'ok'}
        healthItems={[
          {
            icon: Database,
            label: commandText('database'),
            value: metricsReady ? commandText('connected') : commandText('metricsUnavailable'),
            tone: metricsReady ? 'ok' : 'warn',
          },
          {
            icon: erpHealthy ? CheckCircle2 : AlertCircle,
            label: commandText('erpIntegration'),
            value: isError
              ? commandText('metricsUnavailable')
              : erpHealthy
                ? commandText('normal')
                : commandText('issueCount', { count: metrics.systemHealth.erpIssueCount }),
            tone: erpHealthy ? 'ok' : 'warn',
          },
          {
            icon: RefreshCw,
            label: commandText('balanceProjection'),
            value: isError
              ? commandText('metricsUnavailable')
              : balanceReady
                ? formatSystemTimestamp(metrics.systemHealth.lastBalanceProjectionAtUtc as string)
                : commandText('awaitingFirstRun'),
            tone: balanceReady ? 'ok' : 'warn',
          },
          {
            icon: ClipboardList,
            label: commandText('updated'),
            value: metrics.systemHealth.generatedAtUtc
              ? formatSystemTimestamp(metrics.systemHealth.generatedAtUtc)
              : '—',
          },
        ]}
      />

      {isError ? (
        <div className="wms-dash-alert" role="alert">
          <span>{commandText('loadError')}</span>
          <button type="button" onClick={() => void refetch()}>
            <RefreshCw size={15} className={isFetching ? 'animate-spin' : undefined} aria-hidden />
            {commandText('retry')}
          </button>
        </div>
      ) : null}

      <DashQuickStrip
        title={t('dashboard.quickAccess')}
        emptyText={t('dashboard.terminal.quickLinksEmpty')}
        customizeLabel={t('dashboard.quickAccessCustomize')}
        editLabel={t('dashboard.quickAccessEdit')}
        doneLabel={t('dashboard.quickAccessEditDone')}
        onCustomize={() => setQuickCustomizeOpen(true)}
        onReorder={(orderedIds) => {
          persistQuickIds(orderedIds as QuickAccessId[]);
        }}
        items={visibleQuickActions.map((action) => ({
          id: action.id,
          href: action.href,
          title: resolveQuickTitle(action),
          icon: action.icon,
          tone: action.tone,
        }))}
      />

      <QuickAccessCustomizeDialog
        open={quickCustomizeOpen}
        onOpenChange={setQuickCustomizeOpen}
        allowedActions={allowedQuickActions}
        selectedIds={preferredQuickIds}
        resolveTitle={resolveQuickTitle}
        onSave={persistQuickIds}
        terminalSkin={!isPremium}
      />

      <section className="wms-dash-metrics" aria-label={t('dashboard.premium.metricsPanel')}>
        <DashMetricCard
          label={commandText('todayGoodsReceipts')}
          value={formatMetric(metrics.goodsReceiptTodayCount)}
          hint={commandText('todayGoodsReceiptsHint')}
          icon={PackageCheck}
          tone="violet"
          href="/warehouse/goods-receipts/list"
          trend={goodsReceiptTrend}
          isLoading={isLoading}
        />
        <DashMetricCard
          label={commandText('todayShipments')}
          value={formatMetric(metrics.shipmentTodayCount)}
          hint={commandText('todayShipmentsHint')}
          icon={Truck}
          tone="blue"
          href="/warehouse/shipments/list"
          trend={shipmentTrend}
          isLoading={isLoading}
        />
        <DashMetricCard
          label={commandText('todayTransfers')}
          value={formatMetric(metrics.transferTodayCount)}
          hint={commandText('todayTransfersHint')}
          icon={ArrowRight}
          tone="cyan"
          href="/warehouse/transfers/list"
          trend={transferTrend}
          isLoading={isLoading}
        />
        <DashMetricCard
          label={commandText('qualityQueue')}
          value={formatMetric(metrics.pendingQualityInspectionCount)}
          hint={commandText('qualityQueueHint')}
          icon={AlertCircle}
          tone="amber"
          href="/warehouse/quality/inspections"
          isLoading={isLoading}
        />
        <DashMetricCard
          label={commandText('pendingApprovals')}
          value={formatMetric(metrics.pendingApprovalCount)}
          hint={commandText('pendingApprovalsHint')}
          icon={ClipboardList}
          tone="rose"
          href="/warehouse/goods-receipts/tasks"
          isLoading={isLoading}
        />
        <DashMetricCard
          label={commandText('myAssignments')}
          value={formatMetric(metrics.myTasksCount)}
          hint={commandText('myAssignmentsHint')}
          icon={UserRoundCheck}
          tone="green"
          href="/warehouse/goods-receipts/assigned"
          isLoading={isLoading}
        />
      </section>

      <section className="wms-dash-grid">
        <DashPanel
          className="wms-dash-panel--trend"
          title={commandText('operationsTrend')}
          action={<span className="wms-dash-chip">{commandText('lastSevenDays')}</span>}
        >
          <DashTrendChart
            data={metrics.dailyOperations}
            series={[
              { key: 'goodsReceiptCount', label: t('dashboard.goodsReceipt'), color: '#8b5cf6' },
              { key: 'shipmentCount', label: t('dashboard.shipment'), color: '#3b82f6' },
              { key: 'transferCount', label: commandText('transfer'), color: '#14b8a6' },
            ]}
            formatDate={(value) => {
              const parsed = new Date(value);
              return Number.isNaN(parsed.getTime())
                ? value
                : parsed.toLocaleDateString(i18n.language, { day: '2-digit', month: 'short' });
            }}
            emptyText={commandText('noTrendData')}
          />
        </DashPanel>

        <DashPanel
          title={commandText('inventoryHealth')}
          action={
            <Link to="/warehouse/stock-balances" className="wms-dash-link">
              {commandText('details')}
              <ArrowRight size={14} aria-hidden />
            </Link>
          }
        >
          <DashInventoryDonut
            inventory={metrics.inventoryHealth}
            labels={{
              total: commandText('stockPositions'),
              available: commandText('available'),
              reserved: commandText('reserved'),
              qualityHold: commandText('qualityHold'),
              unavailable: commandText('unavailable'),
            }}
          />
        </DashPanel>

        <DashPanel
          title={t('dashboard.recentTransactions')}
          action={<span className="wms-dash-chip wms-dash-chip--live">{commandText('live')}</span>}
        >
          <DashActivityList
            items={metrics.activityItems}
            emptyText={commandText('noRecentActivity')}
            hrefs={ACTIVITY_HREFS}
            kindLabels={activityKindLabels}
            statusLabels={statusLabels}
            formatTimestamp={(value) =>
              formatRelativeTimestamp(
                value,
                i18n.language,
                (minutes) => t('dashboard.minutesAgo', { minutes }),
                (hours) => t('dashboard.hoursAgo', { hours }),
              )
            }
          />
        </DashPanel>
      </section>

      <DashFooterStrip
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
        health={metrics.systemHealth}
        formatTimestamp={formatSystemTimestamp}
        isError={isError}
      />
    </div>
  );
}
