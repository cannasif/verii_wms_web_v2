import type { ReactElement } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  canAdvanceCreatedPeriod,
  CREATED_PERIODS,
  isCurrentCreatedPeriod,
  shiftCreatedPeriodAnchor,
  type CreatedPeriod,
} from '@/lib/created-period';

export function OpsCreatedPeriodTabs({
  value,
  onChange,
  anchor,
  onAnchorChange,
  labels,
}: {
  value: CreatedPeriod | null;
  onChange: (period: CreatedPeriod | null) => void;
  anchor: Date;
  onAnchorChange: (anchor: Date) => void;
  labels: {
    title: string;
    prev: string;
    next: string;
    now: Record<CreatedPeriod, string>;
    periods: Record<CreatedPeriod, string>;
  };
}): ReactElement {
  const navPeriod = value ?? 'day';
  const isCurrent = isCurrentCreatedPeriod(navPeriod, anchor);
  const canGoNext = canAdvanceCreatedPeriod(navPeriod, anchor);

  return (
    <div className="wms-ops-quality-created-period-row">
      <div className="wms-ops-quality-created-period-nav" data-no-auto-localize="true">
        <button
          type="button"
          className="wms-ops-quality-created-period-nav__arrow"
          aria-label={labels.prev}
          data-wms-api-loading="off"
          onClick={() => {
            if (!value) onChange(navPeriod);
            onAnchorChange(shiftCreatedPeriodAnchor(navPeriod, anchor, -1));
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
          data-wms-api-loading="off"
          onClick={() => {
            onChange(navPeriod);
            onAnchorChange(new Date());
          }}
        >
          {labels.now[navPeriod]}
        </button>
        <button
          type="button"
          className="wms-ops-quality-created-period-nav__arrow"
          aria-label={labels.next}
          data-wms-api-loading="off"
          disabled={!canGoNext}
          onClick={() => {
            if (!canGoNext) return;
            if (!value) onChange(navPeriod);
            onAnchorChange(shiftCreatedPeriodAnchor(navPeriod, anchor, 1));
          }}
        >
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>
      <div
        className="wms-ops-quality-created-periods"
        role="tablist"
        aria-label={labels.title}
        data-no-auto-localize="true"
      >
        {CREATED_PERIODS.map((period) => (
          <button
            key={period}
            type="button"
            role="tab"
            className={cn(
              'wms-ops-quality-created-periods__tab',
              value === period && 'wms-ops-quality-created-periods__tab--active',
            )}
            data-wms-api-loading="off"
            aria-selected={value === period}
            onClick={() => {
              onChange(value === period ? null : period);
              onAnchorChange(new Date());
            }}
          >
            {labels.periods[period]}
          </button>
        ))}
      </div>
    </div>
  );
}
