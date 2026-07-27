import { type ReactElement, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type OpsStatusTone = 'active' | 'pending' | 'done' | 'danger' | 'quality';

const TONE_CLASS: Record<OpsStatusTone, string> = {
  active: 'wms-ops-status-badge--active',
  pending: 'wms-ops-status-badge--pending',
  done: 'wms-ops-status-badge--done',
  danger: 'wms-ops-status-badge--danger',
  quality: 'wms-ops-status-badge--quality',
};

export function OpsStatusBadge({
  tone = 'active',
  children,
  className,
}: {
  tone?: OpsStatusTone;
  children: ReactNode;
  className?: string;
}): ReactElement {
  return (
    <span className={cn('wms-ops-status-badge', TONE_CLASS[tone], className)}>
      {children}
    </span>
  );
}

export function OpsCodeBadge({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}): ReactElement {
  return <span className={cn('wms-ops-code-badge', className)}>{children}</span>;
}

/** Heuristic tone from free-form status strings (lists/dialogs). */
export function inferOpsStatusTone(status: string | null | undefined): OpsStatusTone {
  const value = String(status ?? '').toLowerCase();
  if (!value) return 'active';
  if (/(cancel|reject|fail|error|danger|invalid)/.test(value)) return 'danger';
  if (/(complete|done|closed|posted|pass|ok|success|active|linked|parsed|confirmed)/.test(value)) return 'done';
  if (/(quality|inspect|qc)/.test(value)) return 'quality';
  if (/(pend|wait|hold|draft|approval|warn)/.test(value)) return 'pending';
  return 'active';
}
