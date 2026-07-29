import { type ReactElement, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type OpsStatusTone =
  | 'active'
  | 'pending'
  | 'done'
  | 'danger'
  | 'quality'
  | 'neutral';

const TONE_CLASS: Record<OpsStatusTone, string> = {
  active: 'wms-ops-status-badge--active',
  pending: 'wms-ops-status-badge--pending',
  done: 'wms-ops-status-badge--done',
  danger: 'wms-ops-status-badge--danger',
  quality: 'wms-ops-status-badge--quality',
  neutral: 'wms-ops-status-badge--neutral',
};

export function OpsStatusBadge({
  tone = 'active',
  children,
  className,
  title,
}: {
  tone?: OpsStatusTone;
  children: ReactNode;
  className?: string;
  /** Native hover tooltip (full description). */
  title?: string;
}): ReactElement {
  return (
    <span
      title={title}
      className={cn('wms-ops-status-badge', TONE_CLASS[tone], className)}
    >
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

/** Heuristic tone from free-form operation / generic status strings. */
export function inferOpsStatusTone(status: string | null | undefined): OpsStatusTone {
  const value = String(status ?? '').toLowerCase();
  if (!value) return 'neutral';
  if (/(cancel|reject|fail|error|danger|invalid)/.test(value)) return 'danger';
  if (/(notrequired|not_required|norequired)/.test(value)) return 'neutral';
  if (/(complete|done|closed|posted|pass|ok|success|linked|parsed|confirmed|processed)/.test(value)) {
    return 'done';
  }
  if (/(pend|wait|hold|draft|approval|warn|partial)/.test(value)) return 'pending';
  if (/(quarant|quality|inspect|qc)/.test(value)) return 'quality';
  if (/(progress|released|active|open|assigned)/.test(value)) return 'active';
  return 'active';
}

/** Document / source type chip tones (e.g. GoodsReceipt → mal kabul). */
export function inferDocumentTypeTone(type: string | null | undefined): OpsStatusTone {
  const value = String(type ?? '').toLowerCase();
  if (!value) return 'neutral';
  if (/(^gr$|goodsreceipt|goods_receipt|mal.?kabul|inbound|receipt)/.test(value)) return 'active';
  if (/(ship|outbound|transfer)/.test(value)) return 'pending';
  if (/(return|reject)/.test(value)) return 'danger';
  return 'neutral';
}

/** Quality-column tones: kontrol aşaması = violet, gerekmiyor = nötr. */
export function inferQualityStatusTone(status: string | null | undefined): OpsStatusTone {
  const value = String(status ?? '').toLowerCase();
  if (!value) return 'neutral';
  if (/(fail|reject)/.test(value)) return 'danger';
  if (/(pass|approved|ok)/.test(value)) return 'done';
  if (/(notrequired|not_required|norequired)/.test(value)) return 'neutral';
  if (/(partial)/.test(value)) return 'pending';
  if (/(pend|wait)/.test(value)) return 'pending';
  if (/(progress|inspect|quality|qc)/.test(value)) return 'quality';
  return 'quality';
}
