import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useModuleTranslation } from '@/hooks/useModuleTranslation';
import { kkdApi, type KkdQuotaDecision, type KkdRequestLine } from './kkd-api';

export type QuotaLineScope = 'all' | 'excess';

export function lineQuotaBucket(
  decision: KkdQuotaDecision,
  isExcess: boolean,
): 'pending' | 'approved' | 'rejected' | 'none' {
  if (decision === 'Approved') return 'approved';
  if (decision === 'Rejected') return 'rejected';
  if (decision === 'Pending' || isExcess) return 'pending';
  return 'none';
}

export function useKkdQuotaExcess(
  requestId: number | null,
  employeeId: number | undefined,
  lines: KkdRequestLine[],
) {
  const openLines = useMemo(
    () => lines.filter((line) => line.status !== 'Cancelled'),
    [lines],
  );
  const excessCheckKey = openLines
    .filter((line) => line.stockId)
    .map((line) => `${line.id}:${line.stockId}:${line.remainingQuantity}`)
    .join('|');
  const excessQuery = useQuery({
    queryKey: ['kkd', 'requests', requestId, 'quota-review-excess', employeeId, excessCheckKey],
    queryFn: async () => {
      const entries = await Promise.all(
        openLines.filter((line) => line.stockId).map(async (line) => {
          const result = await kkdApi.check({
            employeeId: employeeId!,
            stockId: line.stockId!,
            quantity: line.remainingQuantity,
          });
          return [line.id, result.isAllowed] as const;
        }),
      );
      return new Map(entries);
    },
    enabled: Boolean(requestId && employeeId && excessCheckKey.length > 0),
  });
  const excessLineIds = useMemo(() => new Set(
    [...(excessQuery.data?.entries() ?? [])]
      .filter(([, isAllowed]) => !isAllowed)
      .map(([lineId]) => lineId),
  ), [excessQuery.data]);

  return { openLines, excessLineIds, excessQuery };
}

export function useKkdQuotaDecide(requestId: number | null, onBoardChanged: () => void) {
  const { t } = useModuleTranslation('kkd');
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      lineId: number;
      approve: boolean;
      reason: string;
      remainingPendingAfter: number;
    }) => {
      const result = await kkdApi.decideQuota(payload.lineId, {
        approve: payload.approve,
        reason: payload.reason,
      });
      return { ...result, ...payload };
    },
    onSuccess: async (value) => {
      if (requestId != null) {
        await queryClient.invalidateQueries({ queryKey: ['kkd', 'requests', requestId] });
        await queryClient.invalidateQueries({ queryKey: ['kkd', 'requests', requestId, 'quota-review-excess'] });
      }
      const leftQueue = value.remainingPendingAfter <= 0;
      if (value.approve) {
        toast.success(leftQueue
          ? t('quotaReview.approvedLeftQueue')
          : (value.quotaOverrideId
            ? t('quotaReview.approvedOverride')
            : t('quotaReview.approved')));
      } else {
        toast.success(leftQueue ? t('quotaReview.rejectedLeftQueue') : t('quotaReview.rejected'));
      }
      if (leftQueue) onBoardChanged();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t('quotaReview.decideFailed')),
  });
}
