import { queryOptions } from '@tanstack/react-query';
import { productionApi } from './api';
import type { ProductionSourceWorkOrder } from './types';

type WorkOrderRecipeIdentity = Pick<
  ProductionSourceWorkOrder,
  'workOrderNumber' | 'sourceType' | 'sourceSystemCode' | 'listingKind' | 'transferId' | 'kalanTaskId'
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
] as const;

export const productionWorkOrderListQueryOptions = (
  branchCode: string,
  search?: string,
) => {
  const normalizedSearch = search?.trim() || '';
  return queryOptions({
    queryKey: ['production', 'source-work-orders', branchCode, normalizedSearch] as const,
    queryFn: () => productionApi.sourceWorkOrders(normalizedSearch || undefined),
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
  queryFn: () => productionApi.prepareSourceWorkOrder(row),
  staleTime: 5 * 60 * 1000,
  gcTime: 15 * 60 * 1000,
  retry: 1,
});
