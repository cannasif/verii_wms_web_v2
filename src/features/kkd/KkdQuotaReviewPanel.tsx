import { useMemo, useState, type ReactElement } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, CheckCircle2, TriangleAlert, X } from 'lucide-react';
import { toast } from 'sonner';
import { AppDropdown } from '@/components/shared/AppDropdown';
import { AppInput } from '@/components/shared/AppInput';
import { OpsActionButton } from '@/components/shared/OpsActionButton';
import { ResponsiveDialog } from '@/components/shared/ResponsiveDialog';
import { StockIdentityCell } from '@/components/shared/StockIdentityCell';
import { useModuleTranslation } from '@/hooks/useModuleTranslation';
import { cn } from '@/lib/utils';
import { kkdApi, type KkdQuotaDecision, type KkdRequestLine } from './kkd-api';
import { KkdField } from './kkd-ops-ui';
import {
  lineQuotaBucket,
  useKkdQuotaDecide,
  useKkdQuotaExcess,
  type QuotaLineScope,
} from './kkd-quota-review';

export function QuotaDecisionBadge({
  decision,
  isExcess,
}: {
  decision: KkdQuotaDecision;
  isExcess: boolean;
}): ReactElement {
  const { t } = useModuleTranslation('kkd');
  const bucket = lineQuotaBucket(decision, isExcess);
  if (bucket === 'approved') {
    return (
      <span className="inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600">
        <CheckCircle2 className="size-3 shrink-0" aria-hidden />
        {t('prepareDialog.quotaApproved')}
      </span>
    );
  }
  if (bucket === 'rejected') {
    return (
      <span className="inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-full bg-rose-500/10 px-2 py-0.5 text-xs font-semibold text-rose-600">
        <X className="size-3 shrink-0" aria-hidden />
        {t('quotaReview.rejectedBadge')}
      </span>
    );
  }
  if (bucket === 'pending') {
    return (
      <span className="inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-600">
        <TriangleAlert className="size-3 shrink-0" aria-hidden />
        {t('prepareDialog.quotaExceeded')}
      </span>
    );
  }
  return <span className="text-xs text-[var(--wms-app-text-muted)]">—</span>;
}

export function QuotaLineActions({
  line,
  canDecide,
  disabled,
  onApprove,
  onReject,
}: {
  line: KkdRequestLine;
  canDecide: boolean;
  disabled: boolean;
  onApprove: (line: KkdRequestLine) => void;
  onReject: (line: KkdRequestLine, reason: string) => void;
}): ReactElement {
  const { t } = useModuleTranslation('kkd');
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');

  if (!canDecide) {
    return <span className="text-xs text-[var(--wms-app-text-muted)]">—</span>;
  }

  return (
    <>
      <div className="flex items-center justify-center gap-1">
        <button
          type="button"
          className="wms-kkd-quota-icon-btn wms-kkd-quota-icon-btn--approve"
          title={t('prepareDialog.quotaApprove')}
          aria-label={t('prepareDialog.quotaApprove')}
          disabled={disabled}
          onClick={() => onApprove(line)}
        >
          <Check className="size-3.5" strokeWidth={2.25} />
        </button>
        <button
          type="button"
          className="wms-kkd-quota-icon-btn wms-kkd-quota-icon-btn--reject"
          title={t('prepareDialog.quotaReject')}
          aria-label={t('prepareDialog.quotaReject')}
          disabled={disabled}
          onClick={() => { setReason(''); setRejectOpen(true); }}
        >
          <X className="size-3.5" strokeWidth={2.25} />
        </button>
      </div>
      {rejectOpen ? (
        <ResponsiveDialog
          onClose={() => setRejectOpen(false)}
          title={t('quotaReview.rejectTitle')}
          description={t('quotaReview.rejectDescription', {
            group: line.groupCode,
            stock: line.stockCode ?? line.groupCode,
          })}
          className="!max-w-lg"
        >
          <div className="space-y-4">
            <KkdField label={t('quotaReview.rejectReason')}>
              <AppInput
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={1000}
                placeholder={t('quotaReview.rejectPlaceholder')}
              />
            </KkdField>
            <div className="flex justify-end gap-2 border-t border-[var(--wms-ops-card-border)] pt-4">
              <OpsActionButton
                type="button"
                variant="secondary"
                className="wms-ops-list-toolbar-btn"
                onClick={() => setRejectOpen(false)}
              >
                {t('actions.close')}
              </OpsActionButton>
              <OpsActionButton
                type="button"
                variant="primary"
                className="wms-ops-list-toolbar-btn"
                disabled={disabled || reason.trim().length < 3}
                onClick={() => {
                  if (reason.trim().length < 3) {
                    toast.error(t('validation.reason'));
                    return;
                  }
                  onReject(line, reason.trim());
                  setRejectOpen(false);
                }}
              >
                {t('prepareDialog.quotaReject')}
              </OpsActionButton>
            </div>
          </div>
        </ResponsiveDialog>
      ) : null}
    </>
  );
}

export function KkdQuotaReviewPanel({
  requestId,
  canManageQuota,
  formatQuantity,
  onBoardChanged,
}: {
  requestId: number;
  canManageQuota: boolean;
  formatQuantity: (value: number) => string;
  onBoardChanged: () => void;
}): ReactElement {
  const { t } = useModuleTranslation('kkd');
  const [lineScope, setLineScope] = useState<QuotaLineScope>('all');

  const detail = useQuery({
    queryKey: ['kkd', 'requests', requestId],
    queryFn: () => kkdApi.requestDetail(requestId),
  });
  const { openLines, excessLineIds, excessQuery } = useKkdQuotaExcess(
    requestId,
    detail.data?.employeeId,
    detail.data?.lines ?? [],
  );
  const decide = useKkdQuotaDecide(requestId, onBoardChanged);

  const counts = useMemo(() => {
    const next = { pending: 0, approved: 0, rejected: 0 };
    for (const line of openLines) {
      const bucket = lineQuotaBucket(line.quotaDecision, excessLineIds.has(line.id));
      if (bucket === 'pending') next.pending += 1;
      else if (bucket === 'approved') next.approved += 1;
      else if (bucket === 'rejected') next.rejected += 1;
    }
    return next;
  }, [excessLineIds, openLines]);

  const visibleLines = useMemo(() => {
    if (lineScope === 'all') return openLines;
    return openLines.filter((line) =>
      lineQuotaBucket(line.quotaDecision, excessLineIds.has(line.id)) !== 'none');
  }, [excessLineIds, lineScope, openLines]);

  const submit = (line: KkdRequestLine, approve: boolean, reason: string): void => {
    const pendingNow = openLines.filter((item) =>
      lineQuotaBucket(item.quotaDecision, excessLineIds.has(item.id)) === 'pending').length;
    decide.mutate({
      lineId: line.id,
      approve,
      reason,
      remainingPendingAfter: Math.max(0, pendingNow - 1),
    });
  };

  if (detail.isLoading) {
    return <p className="px-3 py-3 text-sm text-[var(--wms-app-text-muted)]">{t('messages.loading')}</p>;
  }
  if (detail.isError || !detail.data) {
    return <p className="px-3 py-3 text-sm text-rose-600">{t('messages.detailFailed')}</p>;
  }

  return (
    <div className="wms-kkd-quota-review">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--wms-app-border)] px-3 py-2">
        <div>
          <h3 className="text-sm font-semibold">{t('quotaReview.lines')}</h3>
          <p className="mt-0.5 text-xs text-[var(--wms-app-text-muted)]">
            {t('quotaReview.counts', {
              pending: counts.pending,
              approved: counts.approved,
              rejected: counts.rejected,
            })}
          </p>
        </div>
        <div className="w-44 min-w-0">
          <AppDropdown
            value={lineScope}
            onValueChange={(value) => setLineScope(value as QuotaLineScope)}
            options={[
              { value: 'all', label: t('quotaReview.filter.allLines') },
              { value: 'excess', label: t('quotaReview.filter.excessOnly') },
            ]}
            ariaLabel={t('quotaReview.filter.label')}
          />
        </div>
      </div>
      {excessQuery.isLoading ? (
        <p className="px-3 py-2 text-xs text-[var(--wms-app-text-muted)]">{t('quotaReview.checking')}</p>
      ) : null}

      {visibleLines.length === 0 ? (
        <p className="px-3 py-3 text-sm text-[var(--wms-app-text-muted)]">{t(`quotaReview.empty.${lineScope}`)}</p>
      ) : (
        <table className="wms-kkd-quota-review-table text-sm">
          <colgroup>
            <col className="wms-kkd-quota-review-table__col-idx" />
            <col />
            <col />
            <col className="wms-kkd-quota-review-table__col-num" />
            <col className="wms-kkd-quota-review-table__col-num" />
            <col className="wms-kkd-quota-review-table__col-quota" />
            <col className="wms-kkd-quota-review-table__col-actions" />
          </colgroup>
          <thead>
            <tr>
              <th>#</th>
              <th>{t('quotaReview.colLine')}</th>
              <th>{t('quotaReview.colStock')}</th>
              <th className="wms-kkd-quota-review-table__num">{t('grid.requested')}</th>
              <th className="wms-kkd-quota-review-table__num">{t('detail.remaining')}</th>
              <th className="text-center">{t('prepareDialog.colQuota')}</th>
              <th className="text-center">{t('grid.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {visibleLines.map((line) => {
              const isExcess = excessLineIds.has(line.id) || line.quotaDecision !== 'None';
              const needsDecision = lineQuotaBucket(line.quotaDecision, excessLineIds.has(line.id)) === 'pending'
                && Boolean(line.stockId);
              return (
                <tr key={line.id} className={cn(isExcess && 'wms-kkd-quota-excess')}>
                  <td className="font-mono text-xs">{line.lineNo}</td>
                  <td>
                    <div className="font-semibold">{line.groupCode}</div>
                    {line.groupName ? (
                      <div className="wms-ops-gr-detail-lines-table__muted text-xs">{line.groupName}</div>
                    ) : null}
                  </td>
                  <td>
                    {line.stockId ? (
                      <StockIdentityCell
                        stockId={line.stockId}
                        stockCode={line.stockCode}
                        stockName={line.stockName}
                        nameClassName="wms-ops-gr-detail-lines-table__muted text-xs"
                      />
                    ) : (
                      <span className="text-amber-600">{t('detail.stockAwaiting')}</span>
                    )}
                  </td>
                  <td className="wms-kkd-quota-review-table__num">{formatQuantity(line.requestedQuantity)}</td>
                  <td className="wms-kkd-quota-review-table__num">{formatQuantity(line.remainingQuantity)}</td>
                  <td className="text-center">
                    <div className="flex justify-center">
                      <QuotaDecisionBadge decision={line.quotaDecision} isExcess={excessLineIds.has(line.id)} />
                    </div>
                  </td>
                  <td>
                    <QuotaLineActions
                      line={line}
                      canDecide={needsDecision && canManageQuota}
                      disabled={decide.isPending}
                      onApprove={(item) => submit(item, true, t('quotaReview.approveReason'))}
                      onReject={(item, reason) => submit(item, false, reason)}
                    />
                    {needsDecision && !canManageQuota ? (
                      <span className="text-[0.68rem] text-[var(--wms-app-text-muted)]">
                        {t('prepareDialog.quotaNeedsManager')}
                      </span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
