import type { GridFilter } from '@/components/shared/AdvancedDataGrid';

export type GoodsReceiptListFacetKey =
  | 'status'
  | 'qualityStatus'
  | 'erpIntegrationStatus'
  | 'processType';

/** Boş string = filtre yok (Tümü). */
export type GoodsReceiptListFacets = Record<GoodsReceiptListFacetKey, string>;

export const EMPTY_GOODS_RECEIPT_LIST_FACETS: GoodsReceiptListFacets = {
  status: '',
  qualityStatus: '',
  erpIntegrationStatus: '',
  processType: '',
};

export const GOODS_RECEIPT_STATUS_OPTIONS = [
  'Draft',
  'Released',
  'InProgress',
  'PartiallyProcessed',
  'Processed',
  'Completed',
  'Cancelled',
] as const;

export const GOODS_RECEIPT_QUALITY_OPTIONS = [
  'NotRequired',
  'Pending',
  'InProgress',
  'PartiallyCompleted',
  'Passed',
  'Failed',
] as const;

export const GOODS_RECEIPT_ERP_OPTIONS = [
  'NotRequired',
  'Pending',
  'Processing',
  'Succeeded',
  'Failed',
  'CommitUncertain',
] as const;

export const GOODS_RECEIPT_PROCESS_TYPE_OPTIONS = [
  'OrderBasedTask',
  'OrderlessTask',
  'OrderBasedDirectReceipt',
  'OrderlessDirectReceipt',
] as const;

export function countGoodsReceiptListFacets(facets: GoodsReceiptListFacets): number {
  return (Object.values(facets) as string[]).filter(Boolean).length;
}

export function setGoodsReceiptFacetValue(
  facets: GoodsReceiptListFacets,
  key: GoodsReceiptListFacetKey,
  value: string,
): GoodsReceiptListFacets {
  return { ...facets, [key]: value };
}

function facetFilter(column: GoodsReceiptListFacetKey, value: string): GridFilter | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return { column, operator: 'equals', value: trimmed };
}

export function buildGoodsReceiptListFacetFilters(facets: GoodsReceiptListFacets): GridFilter[] {
  return [
    facetFilter('status', facets.status),
    facetFilter('qualityStatus', facets.qualityStatus),
    facetFilter('erpIntegrationStatus', facets.erpIntegrationStatus),
    facetFilter('processType', facets.processType),
  ].filter((filter): filter is GridFilter => filter != null);
}
