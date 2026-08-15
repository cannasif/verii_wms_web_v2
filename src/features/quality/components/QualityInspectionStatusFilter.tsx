import { useMemo, type CSSProperties, type ReactElement } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useModuleTranslation } from '@/hooks/useModuleTranslation';
import { localizeQualityInspectionStatus } from '../utils/quality-inspection-status-label';
import { cn } from '@/lib/utils';
import {
  canAdvanceQualityInspectionCreatedPeriod,
  isCurrentQualityInspectionCreatedPeriod,
  QUALITY_INSPECTION_CREATED_PERIODS,
  QUALITY_INSPECTION_STATUS_ALL,
  shiftQualityInspectionCreatedAnchor,
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
  const navPeriod = value ?? 'day';
  const isCurrent = isCurrentQualityInspectionCreatedPeriod(navPeriod, anchor);
  const canGoNext = canAdvanceQualityInspectionCreatedPeriod(navPeriod, anchor);

  return (
    <div className="wms-ops-quality-created-period-row">
      <div className="wms-ops-quality-created-period-nav" data-no-auto-localize="true">
        <button
          type="button"
          className="wms-ops-quality-created-period-nav__arrow"
          aria-label={t('list.createdPeriodPrev')}
          onClick={() => {
            if (!value) onChange(navPeriod);
            onAnchorChange(shiftQualityInspectionCreatedAnchor(navPeriod, anchor, -1));
          }}
        >
          <ChevronLeft className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          className={cn(
            'wms-ops-quality-created-period-nav__now',
            isCurrent && 'wms-ops-quality-created-period-nav__now--active',
          )}
          onClick={() => {
            onChange(navPeriod);
            onAnchorChange(new Date());
          }}
        >
          {t(`list.createdPeriodNow.${navPeriod}`)}
        </button>
        <button
          type="button"
          className="wms-ops-quality-created-period-nav__arrow"
          aria-label={t('list.createdPeriodNext')}
          disabled={!canGoNext}
          onClick={() => {
            if (!canGoNext) return;
            if (!value) onChange(navPeriod);
            onAnchorChange(shiftQualityInspectionCreatedAnchor(navPeriod, anchor, 1));
          }}
        >
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>
      <div
        className="wms-ops-quality-created-periods"
        role="tablist"
        aria-label={t('list.createdPeriodTitle')}
        data-no-auto-localize="true"
      >
        {QUALITY_INSPECTION_CREATED_PERIODS.map((period) => (
          <button
            key={period}
            type="button"
            role="tab"
            className={cn(
              'wms-ops-quality-created-periods__tab',
              value === period && 'wms-ops-quality-created-periods__tab--active',
            )}
            aria-selected={value === period}
            onClick={() => {
              onChange(value === period ? null : period);
              onAnchorChange(new Date());
            }}
          >
            {t(`list.createdPeriod.${period}`)}
          </button>
        ))}
      </div>
    </div>
  );
}
