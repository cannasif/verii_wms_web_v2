import { type ComponentProps, type ReactElement, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HugeiconsIcon } from '@hugeicons/react';
import Alert02Icon from '@hugeicons/core-free-icons/Alert02Icon';
import ArrowDataTransferHorizontalIcon from '@hugeicons/core-free-icons/ArrowDataTransferHorizontalIcon';
import ClipboardListIcon from '@hugeicons/core-free-icons/ClipboardListIcon';
import DeliveryTruck01Icon from '@hugeicons/core-free-icons/DeliveryTruck01Icon';
import PackageReceive01Icon from '@hugeicons/core-free-icons/PackageReceive01Icon';
import SecurityCheckIcon from '@hugeicons/core-free-icons/SecurityCheckIcon';
import UserCheck01Icon from '@hugeicons/core-free-icons/UserCheck01Icon';
import WarehouseIcon from '@hugeicons/core-free-icons/WarehouseIcon';
import { cn } from '@/lib/utils';
import type { NavbarKpiKey } from '@/lib/navbar-preferences';
import { useDashboardMetrics } from '@/features/dashboard/hooks/useDashboardMetrics';
import type { DashboardDailyOperationPoint } from '@/features/dashboard/types/dashboard.types';

type HugeIcon = ComponentProps<typeof HugeiconsIcon>['icon'];
type KpiTone = 'cyan' | 'amber' | 'rose' | 'green' | 'blue' | 'violet' | 'teal';
type KpiAccent = 'spark' | 'bar' | 'dots' | 'status';

interface NavbarKpiDefinition {
  key: NavbarKpiKey;
  labelKey: string;
  href: string;
  icon: HugeIcon;
  tone: KpiTone;
  accent: KpiAccent;
}

const KPI_CATALOG: Record<NavbarKpiKey, NavbarKpiDefinition> = {
  myTasks: {
    key: 'myTasks',
    labelKey: 'myAssignments',
    href: '/warehouse/goods-receipts/assigned',
    icon: UserCheck01Icon,
    tone: 'green',
    accent: 'dots',
  },
  qualityQueue: {
    key: 'qualityQueue',
    labelKey: 'qualityQueue',
    href: '/warehouse/quality/inspections',
    icon: SecurityCheckIcon,
    tone: 'amber',
    accent: 'dots',
  },
  pendingApproval: {
    key: 'pendingApproval',
    labelKey: 'pendingApprovals',
    href: '/warehouse/goods-receipts/list',
    icon: ClipboardListIcon,
    tone: 'rose',
    accent: 'bar',
  },
  erpIssues: {
    key: 'erpIssues',
    labelKey: 'erpIntegration',
    href: '/dashboard',
    icon: Alert02Icon,
    tone: 'rose',
    accent: 'status',
  },
  openOperations: {
    key: 'openOperations',
    labelKey: 'openOperations',
    href: '/dashboard',
    icon: WarehouseIcon,
    tone: 'cyan',
    accent: 'spark',
  },
  goodsReceiptToday: {
    key: 'goodsReceiptToday',
    labelKey: 'todayGoodsReceipts',
    href: '/warehouse/goods-receipts/list',
    icon: PackageReceive01Icon,
    tone: 'violet',
    accent: 'spark',
  },
  shipmentToday: {
    key: 'shipmentToday',
    labelKey: 'todayShipments',
    href: '/warehouse/shipments/list',
    icon: DeliveryTruck01Icon,
    tone: 'teal',
    accent: 'spark',
  },
  transferToday: {
    key: 'transferToday',
    labelKey: 'todayTransfers',
    href: '/warehouse/transfers/list',
    icon: ArrowDataTransferHorizontalIcon,
    tone: 'blue',
    accent: 'spark',
  },
};

function sparkPoints(
  daily: readonly DashboardDailyOperationPoint[],
  key: NavbarKpiKey,
): number[] {
  if (daily.length === 0) return [];
  return daily.map((point) => {
    if (key === 'goodsReceiptToday') return point.goodsReceiptCount;
    if (key === 'shipmentToday') return point.shipmentCount;
    if (key === 'transferToday') return point.transferCount;
    return point.goodsReceiptCount + point.shipmentCount + point.transferCount;
  });
}

function KpiSparkline({ points }: { points: readonly number[] }): ReactElement | null {
  if (points.length < 2) return null;
  const max = Math.max(...points, 1);
  const width = 52;
  const height = 20;
  const coords = points.map((point, index) => {
    const x = (index / (points.length - 1)) * width;
    const y = height - (point / max) * (height - 4) - 2;
    return { x, y };
  });
  const line = coords
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(' ');
  const area = `${line} L${width} ${height} L0 ${height} Z`;
  return (
    <svg className="wms-navbar-kpi__spark" viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <path className="wms-navbar-kpi__spark-fill" d={area} />
      <path className="wms-navbar-kpi__spark-line" d={line} />
    </svg>
  );
}

function KpiDots({ count }: { count: number }): ReactElement {
  const lit = Math.min(3, count);
  return (
    <span className="wms-navbar-kpi__dots" aria-hidden>
      {[0, 1, 2].map((index) => (
        <i key={index} className={cn(index < lit && 'is-on')} />
      ))}
    </span>
  );
}

export function NavbarKpiStrip({ keys }: { keys: readonly NavbarKpiKey[] }): ReactElement {
  const { t, i18n } = useTranslation();
  const { metrics, isLoading } = useDashboardMetrics();

  const values: Record<NavbarKpiKey, number> = {
    myTasks: metrics.myTasksCount,
    qualityQueue: metrics.pendingQualityInspectionCount,
    pendingApproval: metrics.pendingApprovalCount,
    erpIssues: metrics.systemHealth.erpIssueCount,
    openOperations: metrics.openOperationCount,
    goodsReceiptToday: metrics.goodsReceiptTodayCount,
    shipmentToday: metrics.shipmentTodayCount,
    transferToday: metrics.transferTodayCount,
  };

  const approvalRatio = useMemo(() => {
    const total = Math.max(metrics.goodsReceiptCount, metrics.pendingApprovalCount, 1);
    return Math.min(100, Math.round((metrics.pendingApprovalCount / total) * 100));
  }, [metrics.goodsReceiptCount, metrics.pendingApprovalCount]);

  return (
    <div className="wms-navbar-kpi-rail">
      <div className="wms-navbar-kpi-strip" role="list">
        {keys.map((key) => {
          const item = KPI_CATALOG[key];
          const value = values[key];
          const warning = key === 'erpIssues' && value > 0;
          const ok = key === 'erpIssues' && value === 0;
          return (
            <Link
              key={key}
              to={item.href}
              role="listitem"
              className={cn(
                'wms-navbar-kpi',
                `wms-navbar-kpi--${item.tone}`,
                warning && 'wms-navbar-kpi--alert',
                ok && 'wms-navbar-kpi--ok',
              )}
            >
              <span className="wms-navbar-kpi__head">
                <span className="wms-navbar-kpi__icon" aria-hidden>
                  <HugeiconsIcon icon={item.icon} size={16} strokeWidth={1.7} />
                </span>
                <span className="wms-navbar-kpi__label">{t(`common.commandCenter.${item.labelKey}`)}</span>
                {item.accent === 'status' ? (
                  <span className={cn('wms-navbar-kpi__pulse', ok && 'is-ok', warning && 'is-alert')} aria-hidden />
                ) : null}
              </span>
              <span className="wms-navbar-kpi__body">
                <strong className="wms-navbar-kpi__value">
                  {isLoading
                    ? '…'
                    : key === 'erpIssues' && value === 0
                      ? t('common.commandCenter.normal', { defaultValue: 'Normal' })
                      : value.toLocaleString(i18n.language)}
                </strong>
                {item.accent === 'spark' ? (
                  <KpiSparkline points={sparkPoints(metrics.dailyOperations, key)} />
                ) : null}
                {item.accent === 'bar' ? (
                  <span className="wms-navbar-kpi__bar" aria-hidden>
                    <i style={{ width: `${approvalRatio}%` }} />
                  </span>
                ) : null}
                {item.accent === 'dots' ? <KpiDots count={value} /> : null}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
