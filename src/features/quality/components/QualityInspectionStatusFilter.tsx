import { useMemo, type CSSProperties, type ReactElement } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OpsCreatedPeriodTabs } from '@/components/shared/OpsCreatedPeriodTabs';
import { useModuleTranslation } from '@/hooks/useModuleTranslation';
import { localizeQualityInspectionStatus } from '../utils/quality-inspection-status-label';
import { cn } from '@/lib/utils';
import {
  QUALITY_INSPECTION_STATUS_ALL,
  type QualityInspectionCreatedPeriod,
} from '../utils/quality-inspection-list-filters';
import type { QualityInspectionStatusOption } from '../api/quality.api';

export function QualityInspectionStatusFilter({
  value,
  statusOptions,
  onChange,
}: {
  value: string;
  statusOptions: QualityInspectionStatusOption[];
  onChange: (value: string) => void;
}): ReactElement {
  const { t, moduleReady } = useModuleTranslation('quality');

  const tabs = useMemo(() => {
    void moduleReady;
    return [
      { value: QUALITY_INSPECTION_STATUS_ALL, label: t('list.facetAll') },
      ...statusOptions.map((status) => ({
        value: status.value,
        label: localizeQualityInspectionStatus(status.value, t),
      })),
    ];
  }, [moduleReady, statusOptions, t]);

  const activeIndex = Math.max(tabs.findIndex((tab) => tab.value === value), 0);

  return (
    <div className="wms-ops-production-work-order-tabs wms-ops-detail-dialog mb-4">
      <Tabs value={value} onValueChange={onChange}>
        <TabsList
          className={cn('w-full', 'wms-ops-detail-main-tabs', 'wms-ops-detail-main-tabs--dynamic')}
          style={{
            '--tab-count': tabs.length,
            '--active-index': activeIndex,
          } as CSSProperties}
          data-active-index={activeIndex}
          aria-label={t('list.facetStatus')}
        >
          <span className="wms-ops-detail-tab-indicator" aria-hidden />
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="wms-ops-detail-main-tab">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}

export function QualityInspectionCreatedPeriodTabs({
  value,
  onChange,
  anchor,
  onAnchorChange,
}: {
  value: QualityInspectionCreatedPeriod | null;
  onChange: (period: QualityInspectionCreatedPeriod | null) => void;
  anchor: Date;
  onAnchorChange: (anchor: Date) => void;
}): ReactElement {
  const { t, moduleReady } = useModuleTranslation('quality');
  void moduleReady;

  return (
    <OpsCreatedPeriodTabs
      value={value}
      onChange={onChange}
      anchor={anchor}
      onAnchorChange={onAnchorChange}
      labels={{
        title: t('list.createdPeriodTitle'),
        prev: t('list.createdPeriodPrev'),
        next: t('list.createdPeriodNext'),
        now: {
          day: t('list.createdPeriodNow.day'),
          week: t('list.createdPeriodNow.week'),
          month: t('list.createdPeriodNow.month'),
          year: t('list.createdPeriodNow.year'),
        },
        periods: {
          day: t('list.createdPeriod.day'),
          week: t('list.createdPeriod.week'),
          month: t('list.createdPeriod.month'),
          year: t('list.createdPeriod.year'),
        },
      }}
    />
  );
}
