import type { ReactElement } from 'react';
import type { ProductionSourceWorkOrder } from '../types';

const RING_SIZE = 20;
const STROKE_WIDTH = 2.5;

function resolveAssignmentProgress(row: ProductionSourceWorkOrder): { assigned: number; total: number; percent: number } | null {
  const total = row.recipeLineCount ?? 0;
  if (total <= 0) return null;
  const assigned = Math.min(Math.max(row.assignedRecipeLineCount ?? 0, 0), total);
  const percent = assigned <= 0 ? 0 : Math.round((assigned / total) * 100);
  return { assigned, total, percent };
}

export function WorkOrderAssignmentProgressRing({ row }: { row: ProductionSourceWorkOrder }): ReactElement | null {
  const progress = resolveAssignmentProgress(row);
  if (!progress) return null;

  const radius = (RING_SIZE - STROKE_WIDTH) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress.percent / 100);
  const label = `${progress.assigned} / ${progress.total} reçete satırı atandı (%${progress.percent})`;

  return (
    <span
      className="inline-flex shrink-0 items-center justify-center"
      role="img"
      aria-label={label}
      title={label}
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
          stroke="color-mix(in oklab, var(--wms-brand-primary) 16%, var(--wms-ops-card-border))"
          strokeWidth={STROKE_WIDTH}
        />
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={radius}
          fill="none"
          stroke="var(--wms-brand-primary)"
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
    </span>
  );
}
