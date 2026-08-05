/** ERP statuses that block WMS-side cancel (mirrors GoodsReceiptLifecycleService). */
const ERP_STATUSES_BLOCKING_CANCEL = [
  'Processing',
  'Succeeded',
  'CommitUncertain',
  'Cancelled',
] as const;

export function isGoodsReceiptErpBlockingCancel(erpIntegrationStatus: string): boolean {
  return (ERP_STATUSES_BLOCKING_CANCEL as readonly string[]).includes(erpIntegrationStatus);
}

/** True when the receipt can still be cancelled from WMS (not cancelled, not ERP-posted/in-flight). */
export function canCancelGoodsReceiptFromWms(params: {
  status: string;
  erpIntegrationStatus: string;
}): boolean {
  if (params.status === 'Cancelled') return false;
  return !isGoodsReceiptErpBlockingCancel(params.erpIntegrationStatus);
}
