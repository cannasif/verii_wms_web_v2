import { useMemo, useState, type ReactElement } from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { useTranslation } from 'react-i18next';
import { OpsStatusBadge, type OpsStatusTone } from '@/components/shared/OpsStatusBadge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatProjectNumber } from '@/lib/project-format';
import type { ProductionWorkOrderTransferHeaderRow } from '@/features/production-transfer/api';
import { productionTransferEnumLabel } from '@/features/production-transfer/localization/enum-labels';
import {
  hasOpenCancellationReturnTask,
  productionWorkOrderTransferPickingStatusLabel,
} from '@/features/production-transfer/production-transfer-task-labels';

const RING_SIZE = 20;
const STROKE_WIDTH = 2.5;

const RING_COLORS: Record<OpsStatusTone, string> = {
  neutral: '#64748b',
  pending: '#f59e0b',
  active: '#06b6d4',
  done: '#10b981',
  danger: '#f43f5e',
  quality: '#8b5cf6',
};

function resolvePickingProgress(
  pickedQuantity: number,
  requestedQuantity: number,
): { picked: number; planned: number; percent: number } | null {
  const planned = requestedQuantity ?? 0;
  if (planned <= 0) return null;
  const picked = Math.min(Math.max(pickedQuantity ?? 0, 0), planned);
  const percent = picked <= 0 ? 0 : Math.round((picked / planned) * 100);
  return { picked, planned, percent };
}

function resolvePickingProgressTone(
  source: ProductionWorkOrderTransferHeaderRow,
  progress: { percent: number },
): OpsStatusTone {
  const { transferStatus, workflowStatus, tasks } = source;

  if (
    transferStatus === 'Cancelled'
    && (tasks.length === 0 || hasOpenCancellationReturnTask(tasks))
  ) {
    return 'danger';
  }

  if (transferStatus === 'AwaitingHandover' || workflowStatus === 'AwaitingHandover') {
    return 'pending';
  }

  if (progress.percent >= 100) {
    return 'done';
  }

  if (progress.percent > 0 || transferStatus === 'Released') {
    return 'active';
  }

  return 'neutral';
}

function pickingProgressHintKey(tone: OpsStatusTone): string {
  switch (tone) {
    case 'done':
      return 'dataGrid.transferRecords.pickedProgressHintDone';
    case 'pending':
      return 'dataGrid.transferRecords.pickedProgressHintPending';
    case 'danger':
      return 'dataGrid.transferRecords.pickedProgressHintDanger';
    case 'active':
      return 'dataGrid.transferRecords.pickedProgressHintActive';
    default:
      return 'dataGrid.transferRecords.pickedProgressHintNeutral';
  }
}

export function TransferPickingProgressRing({
  source,
}: {
  source: ProductionWorkOrderTransferHeaderRow;
}): ReactElement | null {
  const { t } = useTranslation('common');
  const { t: pt } = useTranslation('production-transfer');
  const [open, setOpen] = useState(false);

  const progress = resolvePickingProgress(source.pickedQuantity, source.requestedQuantity);
  const statusLabel = useMemo(
    () => productionWorkOrderTransferPickingStatusLabel(
      source,
      productionTransferEnumLabel(pt, 'transferStatus', source.transferStatus),
    ),
    [pt, source],
  );

  if (!progress) return null;

  const tone = resolvePickingProgressTone(source, progress);
  const ringColor = RING_COLORS[tone];
  const radius = (RING_SIZE - STROKE_WIDTH) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress.percent / 100);
  const hoverLabel = t('dataGrid.transferRecords.pickedProgressHover', { percent: progress.percent });
  const progressLabel = t('dataGrid.transferRecords.pickedProgress', {
    picked: formatProjectNumber(progress.picked),
    planned: formatProjectNumber(progress.planned),
    percent: progress.percent,
  });
  const hint = t(pickingProgressHintKey(tone));
  const ariaLabel = `${statusLabel}. ${progressLabel}. ${hint}`;

  const ringButton = (
    <button
      type="button"
      className="inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full p-0.5 transition hover:bg-[var(--wms-brand-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wms-brand-ring)]"
      aria-label={ariaLabel}
      aria-expanded={open}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <svg
        width={RING_SIZE}
        height={RING_SIZE}
        viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
        className="-rotate-90"
        aria-hidden
      >
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={radius}
          fill="none"
          stroke={`color-mix(in oklab, ${ringColor} 16%, var(--wms-ops-card-border))`}
          strokeWidth={STROKE_WIDTH}
        />
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={radius}
          fill="none"
          stroke={ringColor}
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
    </button>
  );

  return (
    <TooltipProvider delayDuration={120}>
      <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
        <Tooltip open={open ? false : undefined}>
          <PopoverPrimitive.Trigger asChild>
            <TooltipTrigger asChild>
              {ringButton}
            </TooltipTrigger>
          </PopoverPrimitive.Trigger>
          <TooltipContent side="top" className="font-semibold tabular-nums">
            {hoverLabel}
          </TooltipContent>
        </Tooltip>

        <PopoverPrimitive.Portal container={typeof document !== 'undefined' ? document.body : undefined}>
          <PopoverPrimitive.Content
            align="start"
            side="top"
            sideOffset={8}
            collisionPadding={12}
            className="wms-ops-list-popover pointer-events-auto z-[5000] w-[min(18rem,calc(100vw-1rem))] border-0 p-0 shadow-none outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95"
            onOpenAutoFocus={(event) => event.preventDefault()}
            onCloseAutoFocus={(event) => event.preventDefault()}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="wms-ops-list-popover__body space-y-3 p-3">
              <div className="flex items-center justify-between gap-2">
                <OpsStatusBadge tone={tone}>{statusLabel}</OpsStatusBadge>
                <span className="font-mono text-sm font-bold tabular-nums text-[var(--wms-ops-shell-fg)]">
                  {hoverLabel}
                </span>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-[0.68rem] text-[var(--wms-app-text-muted)]">
                  <span>{t('dataGrid.transferRecords.picked')}</span>
                  <span className="font-mono font-semibold text-[var(--wms-ops-shell-fg)]">
                    {formatProjectNumber(progress.picked)}
                  </span>
                </div>
                <div
                  className="h-2 overflow-hidden rounded-full border border-[var(--wms-ops-card-border)] bg-[var(--wms-ops-field-bg)]"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress.percent}
                  aria-label={progressLabel}
                >
                  <span
                    className="block h-full rounded-full transition-[width] duration-300 ease-out"
                    style={{
                      width: `${Math.max(progress.percent, progress.percent > 0 ? 4 : 0)}%`,
                      background: `linear-gradient(90deg, color-mix(in oklab, ${ringColor} 78%, #ffffff), ${ringColor})`,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between gap-2 text-[0.68rem] text-[var(--wms-app-text-muted)]">
                  <span>{t('dataGrid.transferRecords.planned')}</span>
                  <span className="font-mono font-semibold text-[var(--wms-ops-shell-fg)]">
                    {formatProjectNumber(progress.planned)}
                  </span>
                </div>
              </div>

              <p className="text-[0.68rem] leading-relaxed text-[var(--wms-app-text-muted)]">{hint}</p>
            </div>
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    </TooltipProvider>
  );
}
