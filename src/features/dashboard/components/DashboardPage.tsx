import { type ComponentProps, type ReactElement, useEffect, useMemo, useState } from 'react';
import {
  ArrowDataTransferHorizontalIcon,
  ClipboardIcon,
  DeliveryTruck01Icon,
  PackageSearchIcon,
  UserCheck01Icon,
  WarehouseIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/components/theme-provider';
import { useUIStore } from '@/stores/ui-store';
import { usePermissionAccess } from '@/features/access-control/hooks/usePermissionAccess';
import { useDashboardMetrics } from '../hooks/useDashboardMetrics';
import {
  DashboardOpsActivityFeed,
  DashboardOpsHero,
  DashboardOpsMetricTile,
  DashboardOpsPanel,
  DashboardOpsQuickLink,
  DashboardOpsSection,
  DashboardOpsStatusBar,
} from './dashboard-ops-ui';

type HugeIcon = ComponentProps<typeof HugeiconsIcon>['icon'];

interface QuickLinkConfig {
  permission: string;
  moduleCode: string;
  titleKey: string;
  descriptionKey: string;
  href: string;
  icon: HugeIcon;
}

const QUICK_LINKS: QuickLinkConfig[] = [
  {
    permission: 'wms.goods-receipt.create',
    moduleCode: 'CMD-GR-NEW',
    titleKey: 'dashboard.newGoodsReceipt',
    descriptionKey: 'dashboard.terminal.quickGrDescription',
    href: '/warehouse/goods-receipts/new',
    icon: ClipboardIcon,
  },
  {
    permission: 'wms.goods-receipt.view',
    moduleCode: 'CMD-GR-ASN',
    titleKey: 'dashboard.terminal.assignedGoodsReceipt',
    descriptionKey: 'dashboard.terminal.quickAssignedDescription',
    href: '/warehouse/goods-receipts/assigned',
    icon: UserCheck01Icon,
  },
  {
    permission: 'wms.shipment.create',
    moduleCode: 'CMD-SH-NEW',
    titleKey: 'dashboard.newShipment',
    descriptionKey: 'dashboard.terminal.quickShipmentDescription',
    href: '/warehouse/warehouse-outbounds/new',
    icon: DeliveryTruck01Icon,
  },
  {
    permission: 'wms.transfer.view',
    moduleCode: 'CMD-TR-LST',
    titleKey: 'dashboard.terminal.transferList',
    descriptionKey: 'dashboard.terminal.quickTransferDescription',
    href: '/warehouse/transfers/list',
    icon: ArrowDataTransferHorizontalIcon,
  },
  {
    permission: 'wms.warehouse-balance.view',
    moduleCode: 'CMD-STK-QRY',
    titleKey: 'dashboard.stockQuery',
    descriptionKey: 'dashboard.terminal.quickStockDescription',
    href: '/warehouse/stock-balances',
    icon: WarehouseIcon,
  },
  {
    permission: 'wms.reports.view',
    moduleCode: 'CMD-RPT-HUB',
    titleKey: 'dashboard.terminal.reportsHub',
    descriptionKey: 'dashboard.terminal.quickReportsDescription',
    href: '/warehouse/goods-receipts/steel/reports',
    icon: PackageSearchIcon,
  },
];

function formatRelativeTimestamp(
  value: string,
  language: string,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60_000));
  if (diffMinutes < 60) {
    return t('dashboard.terminal.minutesAgo', { defaultValue: '{{minutes}} dk önce', minutes: diffMinutes });
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 48) {
    return t('dashboard.hoursAgo', { hours: diffHours });
  }

  return date.toLocaleString(language);
}

function getDaypartGreetingKey(date: Date): 'goodMorning' | 'goodAfternoon' | 'goodEvening' {
  const hour = date.getHours();
  if (hour < 12) return 'goodMorning';
  if (hour < 18) return 'goodAfternoon';
  return 'goodEvening';
}

export function DashboardPage(): ReactElement {
  const { t, i18n } = useTranslation('common');
  const { skin } = useTheme();
  const isPremium = skin === 'premium';
  const { setPageTitle } = useUIStore();
  const permissionAccess = usePermissionAccess();
  const { user, branch, metrics, isLoading } = useDashboardMetrics();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    setPageTitle(t('dashboard.title'));
    return () => setPageTitle(null);
  }, [setPageTitle, t]);

  useEffect(() => {
    if (!isPremium) return;
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, [isPremium]);

  const displayName = user?.name || user?.email || t('dashboard.user');
  const branchLabel = branch?.name || branch?.code || t('dashboard.terminal.branchFallback');
  const greetingKey = getDaypartGreetingKey(now);

  const visibleQuickLinks = useMemo(
    () => QUICK_LINKS.filter((link) => permissionAccess.can(link.permission)),
    [permissionAccess],
  );

  const clockTime = now.toLocaleTimeString(i18n.language, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const clockDate = now.toLocaleDateString(i18n.language, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="wms-ops-dashboard-page wms-ops-erp-skin">
      <div className="wms-ops-dashboard-terminal">
        <div className="wms-ops-dashboard-terminal__scanlines" aria-hidden />

        <DashboardOpsHero
          eyebrow={
            isPremium
              ? t('dashboard.premium.eyebrow', { defaultValue: 'Operasyon Merkezi' })
              : t('dashboard.terminal.eyebrow', { defaultValue: 'WMS / KOMUT MERKEZİ' })
          }
          greeting={
            isPremium
              ? t(`dashboard.premium.${greetingKey}`, {
                  defaultValue:
                    greetingKey === 'goodMorning'
                      ? 'Günaydın'
                      : greetingKey === 'goodAfternoon'
                        ? 'İyi günler'
                        : 'İyi akşamlar',
                })
              : undefined
          }
          title={
            isPremium
              ? t('dashboard.premium.welcome', { defaultValue: 'Hoş geldiniz, {{name}}', name: displayName })
              : t('dashboard.terminal.welcome', { defaultValue: 'Hoş geldin, {{name}}', name: displayName })
          }
          subtitle={
            isPremium
              ? t('dashboard.premium.subtitle', { defaultValue: 'Depo operasyonlarınızı tek bakışta yönetin.' })
              : t('dashboard.subtitle')
          }
          operatorLabel={
            isPremium
              ? t('dashboard.premium.operator', { defaultValue: 'Operatör' })
              : t('dashboard.terminal.operator', { defaultValue: 'OPERATÖR' })
          }
          operatorValue={displayName}
          branchLabel={
            isPremium
              ? t('dashboard.premium.branch', { defaultValue: 'Şube' })
              : t('dashboard.terminal.branch', { defaultValue: 'ŞUBE' })
          }
          branchValue={branchLabel}
          clockLabel={isPremium ? t('dashboard.premium.systemClock', { defaultValue: 'Sistem saati' }) : undefined}
          clockTime={isPremium ? clockTime : undefined}
          clockDate={isPremium ? clockDate : undefined}
          clockDateTime={isPremium ? now.toISOString() : undefined}
        />

        <DashboardOpsPanel>
          <DashboardOpsStatusBar
            pulseLabel={
              isPremium
                ? t('dashboard.premium.systemPulse', { defaultValue: 'Sistem durumu' })
                : t('dashboard.terminal.systemPulse', { defaultValue: 'SİSTEM DURUMU' })
            }
            pulseValue={
              isLoading
                ? t(isPremium ? 'dashboard.premium.syncing' : 'dashboard.terminal.syncing', {
                    defaultValue: isPremium ? 'Senkronize ediliyor' : 'SENKRONİZE',
                  })
                : t(isPremium ? 'dashboard.premium.online' : 'dashboard.terminal.online', {
                    defaultValue: isPremium ? 'Çevrimiçi' : 'ÇEVRİMİÇİ',
                  })
            }
            tasksLabel={
              isPremium
                ? t('dashboard.premium.myTasks', { defaultValue: 'Görevlerim' })
                : t('dashboard.terminal.myTasks', { defaultValue: 'GÖREVLERİM' })
            }
            tasksValue={String(metrics.myTasksCount).padStart(2, '0')}
            hint={
              isPremium
                ? t('dashboard.premium.statusHint', {
                    defaultValue: 'Güncel metrikler, son hareketler ve hızlı erişim aşağıda.',
                  })
                : t('dashboard.terminal.statusHint', {
                    defaultValue: 'Canlı operasyon metrikleri ve son hareketler aşağıda.',
                  })
            }
          />
        </DashboardOpsPanel>

        <DashboardOpsPanel className="wms-ops-dashboard-panel--metrics">
          <div className="wms-ops-dashboard-panel__heading">
            <span className="wms-ops-subtitle-prefix" aria-hidden>{'> '}</span>
            <span>
              {isPremium
                ? t('dashboard.premium.metricsPanel', { defaultValue: 'Operasyon metrikleri' })
                : t('dashboard.terminal.metricsPanel', { defaultValue: 'OPERASYON METRİKLERİ' })}
            </span>
          </div>
          <div className="wms-ops-dashboard-metrics">
            <DashboardOpsMetricTile
              label={t('dashboard.terminal.stockSkuCount', { defaultValue: 'Stok Kalemi' })}
              value={metrics.stockSkuCount.toLocaleString(i18n.language)}
              hint={t('dashboard.terminal.stockSkuHint', { defaultValue: 'Depo bakiye kayıtları' })}
              tone="accent"
              isLoading={isLoading}
            />
            <DashboardOpsMetricTile
              label={t('dashboard.goodsReceipt')}
              value={metrics.goodsReceiptCount.toLocaleString(i18n.language)}
              hint={t('dashboard.terminal.openGoodsReceiptHint', { defaultValue: 'Toplam mal kabul emri' })}
              isLoading={isLoading}
            />
            <DashboardOpsMetricTile
              label={t('dashboard.shipment')}
              value={metrics.shipmentCount.toLocaleString(i18n.language)}
              hint={t('dashboard.terminal.openShipmentHint', { defaultValue: 'Toplam sevkiyat emri' })}
              isLoading={isLoading}
            />
            <DashboardOpsMetricTile
              label={t('dashboard.terminal.pendingApproval', { defaultValue: 'Onay Bekleyen' })}
              value={metrics.pendingApprovalCount.toLocaleString(i18n.language)}
              hint={t('dashboard.terminal.pendingApprovalHint', { defaultValue: 'Mal kabul onay kuyruğu' })}
              tone="warn"
              isLoading={isLoading}
            />
            <DashboardOpsMetricTile
              label={t('dashboard.terminal.myAssignments', { defaultValue: 'Bana Atanan' })}
              value={metrics.myTasksCount.toLocaleString(i18n.language)}
              hint={t('dashboard.terminal.myAssignmentsHint', { defaultValue: 'Mal kabul + sevkiyat görevleri' })}
              tone="success"
              isLoading={isLoading}
            />
            <DashboardOpsMetricTile
              label={t('dashboard.terminal.transferCount', { defaultValue: 'Transfer' })}
              value={metrics.transferCount.toLocaleString(i18n.language)}
              hint={t('dashboard.terminal.transferHint', { defaultValue: 'Aktif transfer emirleri' })}
              isLoading={isLoading}
            />
          </div>
        </DashboardOpsPanel>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,1fr)]">
          <DashboardOpsSection
            title={t('dashboard.recentTransactions')}
            description={t('dashboard.recentTransactionsSubtitle')}
            sectionCode="FEED-OPS"
          >
            <DashboardOpsActivityFeed
              items={metrics.activityItems}
              emptyText={t('dashboard.terminal.activityEmpty', { defaultValue: 'Henüz görüntülenecek hareket yok.' })}
              kindLabels={{
                'goods-receipt': t('dashboard.goodsReceipt'),
                shipment: t('dashboard.shipment'),
              }}
              statusLabels={{
                completed: t('dashboard.completed'),
                preparing: t('dashboard.preparing'),
                pending: t('dashboard.terminal.pending', { defaultValue: 'Bekliyor' }),
              }}
              formatTimestamp={(value) => formatRelativeTimestamp(value, i18n.language, t)}
            />
          </DashboardOpsSection>

          <DashboardOpsSection
            title={t('dashboard.quickAccess')}
            description={t('dashboard.quickAccessSubtitle')}
            sectionCode="CMD-QUICK"
          >
            <div className="wms-ops-dashboard-quick-grid">
              {visibleQuickLinks.length === 0 ? (
                <p className="wms-ops-dashboard-activity__empty">
                  {t('dashboard.terminal.quickLinksEmpty', {
                    defaultValue: 'Bu kullanıcı için hızlı komut bulunamadı.',
                  })}
                </p>
              ) : (
                visibleQuickLinks.map((link, index) => (
                  <DashboardOpsQuickLink
                    key={link.href}
                    index={index + 1}
                    moduleCode={link.moduleCode}
                    title={t(link.titleKey)}
                    description={t(link.descriptionKey, { defaultValue: link.titleKey })}
                    href={link.href}
                    icon={link.icon}
                    openLabel={
                      isPremium
                        ? t('dashboard.premium.launch', { defaultValue: 'Devam et' })
                        : t('dashboard.terminal.launch', { defaultValue: 'Başlat' })
                    }
                  />
                ))
              )}
            </div>
          </DashboardOpsSection>
        </div>
      </div>
    </div>
  );
}
