import { queryOptions } from '@tanstack/react-query';
import { productionApi } from './api';
import type { ProductionSourceWorkOrder } from './types';

type WorkOrderRecipeIdentity = Pick<
  ProductionSourceWorkOrder,
  'workOrderNumber' | 'sourceType' | 'sourceSystemCode' | 'listingKind' | 'transferId' | 'kalanTaskId' | 'cancellationId'
>;

export const productionWorkOrderRecipeQueryKey = (row: WorkOrderRecipeIdentity) => [
  'production',
  'work-order-recipe',
  row.sourceType,
  row.sourceSystemCode,
  row.workOrderNumber,
  row.listingKind,
  row.transferId ?? null,
  row.kalanTaskId ?? null,
  row.cancellationId ?? null,
] as const;

export const productionWorkOrderListQueryOptions = (
  branchCode: string,
  search?: string,
  range?: { fromDate?: string; toDate?: string },
) => {
  const normalizedSearch = search?.trim() || '';
  const fromDate = range?.fromDate ?? '';
  const toDate = range?.toDate ?? '';
  return queryOptions({
    queryKey: ['production', 'source-work-orders', branchCode, normalizedSearch, fromDate, toDate] as const,
    queryFn: () => productionApi.sourceWorkOrders(
      normalizedSearch || undefined,
      fromDate || toDate ? { fromDate: fromDate || undefined, toDate: toDate || undefined } : undefined,
    ),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });
};

/**
 * Recipe data is intentionally lazy: the list endpoint only returns work-order summaries.
 * The selected work order is cached briefly so detail -> assignment transitions do not
 * execute the same ERP/WMS recipe query twice.
 */
export const productionWorkOrderRecipeQueryOptions = (row: WorkOrderRecipeIdentity) => queryOptions({
  queryKey: productionWorkOrderRecipeQueryKey(row),
  queryFn: () => (
    row.listingKind === 'ManagerCancelledAssignment' && (row.cancellationId ?? 0) > 0
      ? productionApi.cancelledWorkOrderAssignmentDetail(row.cancellationId!)
      : productionApi.prepareSourceWorkOrder(row)
  ),
  staleTime: 5 * 60 * 1000,
  gcTime: 15 * 60 * 1000,
  retry: 1,
});
