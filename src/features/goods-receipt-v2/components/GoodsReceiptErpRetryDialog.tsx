import { useEffect, useState, type ReactElement } from 'react';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { OpsActionButton } from '@/components/shared/OpsActionButton';
import { useModuleTranslation } from '@/hooks/useModuleTranslation';
import { cn } from '@/lib/utils';
import { goodsReceiptV2Api } from '../api/goods-receipt.api';
import type { ErpPostingResult, GoodsReceiptGridRow } from '../types/goods-receipt.types';
import { resolveGoodsReceiptWaybillNo } from '../utils/goods-receipt-waybill';

export function GoodsReceiptErpRetryDialog({
  header,
  close,
  completed,
}: {
  header: GoodsReceiptGridRow;
  close: () => void;
  completed: (result: ErpPostingResult) => Promise<void>;
}): ReactElement {
  const { t } = useModuleTranslation('goods-receipt-v2');
  const [posting, setPosting] = useState<ErpPostingResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [reason, setReason] = useState('');
  const [confirmedNotFound, setConfirmedNotFound] = useState(false);

  useEffect(() => {
    let active = true;
    goodsReceiptV2Api.erpPosting(header.id)
      .then((value) => {
        if (active) setPosting(value);
      })
      .catch((error) => {
        if (active && header.erpIntegrationStatus !== 'Pending') {
          toast.error(message(error, t('list.erpRetryDialog.fetchFailed')));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [header.erpIntegrationStatus, header.id, t]);

  const uncertain = posting?.status === 'CommitUncertain'
    || header.erpIntegrationStatus === 'CommitUncertain';
  const canSubmit = !loading
    && !working
    && (!uncertain || (confirmedNotFound && reason.trim().length >= 5));
  const submitLabel = uncertain
    ? t('list.erpRetryDialog.submitReconcileAndResend')
    : posting?.status === 'Failed'
      ? t('list.erpRetryDialog.submitResend')
      : t('list.erpSendToErp');
  const waybillRef = resolveGoodsReceiptWaybillNo(header) || t('list.erpRetryDialog.waybillNumberFallback');

  const retry = async () => {
    if (!canSubmit) return;
    setWorking(true);
    try {
      if (uncertain) {
        await goodsReceiptV2Api.reconcileErpNotFound(header.id, reason.trim());
      }
      const result = await goodsReceiptV2Api.postErp(header.id);
      if (result.status === 'Succeeded') {
        toast.success(
          t('list.erpRetryDialog.successToast', {
            documentNo: result.erpDocumentNo || result.sourceDocumentNo,
          }),
        );
      } else if (result.status === 'CommitUncertain') {
        toast.warning(t('list.erpRetryDialog.uncertainToast'));
      } else {
        toast.error(result.errorMessage || t('list.erpRetryDialog.failedToast'));
      }
      await completed(result);
    } catch (error) {
      toast.error(message(error, t('list.erpRetryDialog.retryFailed')));
    } finally {
      setWorking(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !working) close(); }}>
      <DialogContent
        showCloseButton
        portalRoot="body"
        tone="ops"
        className={cn(
          'wms-ops-form wms-ops-detail-dialog wms-ops-erp-retry-dialog max-w-xl gap-0 overflow-hidden border-0 p-0 shadow-none',
          uncertain && 'wms-ops-erp-retry-dialog--uncertain',
        )}
      >
        <DialogHeader className="wms-ops-erp-retry-dialog__header wms-ops-detail-dialog__header relative border-b px-6 py-4 pr-14 text-left">
          <DialogTitle className="wms-ops-detail-dialog__title wms-ops-erp-retry-dialog__title min-w-0 pr-2">
            {t('list.erpRetryDialog.title')}
          </DialogTitle>
          <DialogDescription className="wms-ops-detail-dialog__description wms-ops-erp-retry-dialog__description mt-1.5">
            {t('list.erpRetryDialog.description', { documentNo: waybillRef })}
          </DialogDescription>
        </DialogHeader>

        <div className="wms-ops-erp-retry-dialog__body wms-ops-dialog__body wms-ops-scrollbar min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="grid min-h-28 place-items-center text-[var(--wms-ops-accent,#06b6d4)]" aria-busy="true">
              <Loader2 className="wms-ops-erp-retry-dialog__loading size-6 animate-spin" aria-hidden />
            </div>
          ) : (
            <div className="space-y-4">
              <section className="wms-ops-erp-retry-dialog__status" aria-label={t('list.erpRetryDialog.submissionStatus')}>
                <dl className="wms-ops-erp-retry-dialog__status-grid">
                  <div className="wms-ops-erp-retry-dialog__status-row">
                    <dt>{t('list.erpRetryDialog.localStatus')}</dt>
                    <dd>
                      <span className="wms-ops-erp-retry-dialog__code">{header.erpIntegrationStatus}</span>
                    </dd>
                  </div>
                  <div className="wms-ops-erp-retry-dialog__status-row">
                    <dt>{t('list.erpRetryDialog.submissionStatus')}</dt>
                    <dd>
                      <span className="wms-ops-erp-retry-dialog__code">
                        {posting?.status || t('list.erpRetryDialog.recordNotFound')}
                      </span>
                    </dd>
                  </div>
                  <div className="wms-ops-erp-retry-dialog__status-row">
                    <dt>{t('list.erpRetryDialog.attempt')}</dt>
                    <dd>
                      <span className="wms-ops-erp-retry-dialog__code">{posting?.attemptCount ?? 0}</span>
                    </dd>
                  </div>
                </dl>
                {posting?.errorMessage ? (
                  <p className="wms-ops-erp-retry-dialog__error" role="alert">
                    {posting.errorMessage}
                  </p>
                ) : null}
              </section>

              {uncertain ? (
                <section className="wms-ops-erp-retry-dialog__reconcile" aria-live="polite">
                  <div className="wms-ops-erp-retry-dialog__warn">
                    <AlertTriangle className="wms-ops-erp-retry-dialog__warn-icon" aria-hidden />
                    <p>
                      {t('list.erpRetryDialog.uncertainWarningPrefix')}{' '}
                      <strong className="wms-ops-erp-retry-dialog__ref">{waybillRef}</strong>{' '}
                      {t('list.erpRetryDialog.uncertainWarningSuffix')}
                    </p>
                  </div>

                  <label className="wms-ops-erp-retry-dialog__check">
                    <input
                      type="checkbox"
                      className="wms-ops-erp-retry-dialog__checkbox"
                      checked={confirmedNotFound}
                      onChange={(event) => setConfirmedNotFound(event.target.checked)}
                    />
                    <span>{t('list.erpRetryDialog.confirmedCheckbox')}</span>
                  </label>

                  <label className="wms-ops-erp-retry-dialog__note">
                    <span className="wms-ops-prelabel-form-label wms-ops-erp-retry-dialog__note-label">
                      {t('list.erpRetryDialog.reconciliationNoteLabel')}
                    </span>
                    <textarea
                      className="input wms-ops-field wms-ops-erp-retry-dialog__textarea min-h-24 w-full resize-y"
                      value={reason}
                      maxLength={1000}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder={t('list.erpRetryDialog.reconciliationPlaceholder')}
                    />
                    <span className="wms-ops-erp-retry-dialog__hint">
                      {t('list.erpRetryDialog.reconciliationHint')}
                    </span>
                  </label>
                </section>
              ) : null}
            </div>
          )}
        </div>

        <DialogFooter className="wms-ops-actions wms-ops-detail-dialog__footer wms-ops-erp-retry-dialog__footer gap-2 border-t px-6 py-4 sm:justify-end sm:gap-2">
          <OpsActionButton
            type="button"
            variant="secondary"
            disabled={working}
            onClick={close}
          >
            {t('list.erpRetryDialog.cancel')}
          </OpsActionButton>
          <OpsActionButton
            type="button"
            variant="primary"
            loading={working}
            disabled={!canSubmit}
            onClick={() => void retry()}
          >
            <RefreshCw className="size-4" aria-hidden />
            {submitLabel}
          </OpsActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function message(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
