import { RefreshCw, Send } from 'lucide-react';
import { OpsActionButton } from '@/components/shared/OpsActionButton';
import { ResponsiveDialog } from '@/components/shared/ResponsiveDialog';
import { cn } from '@/lib/utils';
import type { ProductionTransferErpIntegrationStatus, ProductionTransferErpPanelSource } from '../production-transfer-erp-posting';

export function ErpPostingTriggerButton({
  status,
  label,
  onClick,
  className,
}: {
  status: ProductionTransferErpIntegrationStatus;
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold transition-colors',
        status === 'Failed' && 'border-red-500/50 text-red-600 hover:bg-red-500/10',
        status === 'CommitUncertain' && 'border-amber-500/50 text-amber-600 hover:bg-amber-500/10',
        status === 'Pending' && 'border-amber-500/50 text-amber-600 hover:bg-amber-500/10',
        status === 'Processing' && 'border-[var(--wms-brand-primary)]/50 text-[var(--wms-brand-primary)] hover:bg-[var(--wms-brand-soft)]',
        status === 'Succeeded' && 'border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10',
        status === 'Cancelled' && 'border-[var(--wms-app-border)] text-[var(--wms-app-text-muted)] hover:bg-black/5 dark:hover:bg-white/5',
        className,
      )}
    >
      <Send className="size-4" aria-hidden />
      {label}
    </button>
  );
}

export function ErpPostingPanel({
  erp,
  canRetry,
  erpBusy,
  onClose,
  onRetry,
  t,
}: {
  erp: ProductionTransferErpPanelSource;
  canRetry: boolean;
  erpBusy: boolean;
  onClose: () => void;
  onRetry: () => void;
  t: (key: string) => string;
}) {
  const status = erp.erpIntegrationStatus;

  return (
    <ResponsiveDialog
      onClose={onClose}
      title={t('execution.erp.title')}
      description={t(`execution.erp.status.${status}`)}
      className="!max-w-lg"
    >
      <div
        className={cn(
          'rounded-xl border p-4',
          status === 'Succeeded' && 'border-emerald-500/40 bg-emerald-500/10',
          status === 'Failed' && 'border-red-500/40 bg-red-500/10',
          status === 'CommitUncertain' && 'border-amber-500/50 bg-amber-500/10',
          status === 'Pending' && 'border-amber-500/50 bg-amber-500/10',
          status === 'Processing' && 'border-[var(--wms-brand-primary)]/40 bg-[var(--wms-brand-soft)]',
          status === 'Cancelled' && 'border-[var(--wms-app-border)] bg-[var(--wms-app-surface)]',
        )}
      >
        <div className="space-y-3 text-sm">
          <div>
            <span className="text-xs font-bold uppercase tracking-wide text-[var(--wms-app-text-muted)]">Durum</span>
            <p className="mt-1 font-semibold text-[var(--wms-app-text)]">{t(`execution.erp.status.${status}`)}</p>
          </div>
          {erp.erpDocumentNo ? (
            <div>
              <span className="text-xs font-bold uppercase tracking-wide text-[var(--wms-app-text-muted)]">{t('execution.erp.documentNo')}</span>
              <p className="mt-1 font-mono font-bold text-[var(--wms-brand-primary)]">{erp.erpDocumentNo}</p>
            </div>
          ) : null}
          {erp.erpErrorCode ? (
            <div>
              <span className="text-xs font-bold uppercase tracking-wide text-[var(--wms-app-text-muted)]">Hata kodu</span>
              <p className="mt-1 font-mono text-xs text-red-600">{erp.erpErrorCode}</p>
            </div>
          ) : null}
          {erp.erpErrorMessage ? (
            <div>
              <span className="text-xs font-bold uppercase tracking-wide text-[var(--wms-app-text-muted)]">Hata mesajı</span>
              <p className="mt-1 whitespace-pre-wrap text-sm text-red-600">{erp.erpErrorMessage}</p>
            </div>
          ) : null}
          {status === 'CommitUncertain' ? (
            <p className="text-sm text-amber-700 dark:text-amber-300">{t('execution.erp.uncertainAfterCompletion')}</p>
          ) : null}
          {status === 'Failed' ? (
            <p className="text-sm text-[var(--wms-app-text-muted)]">{t('execution.erp.failedAfterCompletion')}</p>
          ) : null}
        </div>
      </div>
      {canRetry ? (
        <div className="mt-5 flex justify-end">
          <OpsActionButton variant="primary" loading={erpBusy} onClick={onRetry}>
            <RefreshCw className="size-4" />
            {t('execution.erp.retry')}
          </OpsActionButton>
        </div>
      ) : null}
    </ResponsiveDialog>
  );
}
