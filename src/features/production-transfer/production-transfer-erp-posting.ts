import type {
  ProductionTransferExecution,
  ProductionWorkOrderTransferHeaderRow,
} from './api';

export type ProductionTransferErpIntegrationStatus =
  ProductionTransferExecution['erpIntegrationStatus'];

export function productionTransferNeedsErpAttention(
  row: Pick<
    ProductionWorkOrderTransferHeaderRow,
    'erpPostingPolicy' | 'workflowStatus' | 'erpIntegrationStatus'
  >,
): boolean {
  if (row.erpPostingPolicy === 'Disabled') return false;
  if (row.workflowStatus !== 'Completed' && row.workflowStatus !== 'CompletedWithShortage') return false;
  return row.erpIntegrationStatus === 'Failed' || row.erpIntegrationStatus === 'CommitUncertain';
}

export function productionTransferShowErpControls(
  info: Pick<
    ProductionWorkOrderTransferHeaderRow | ProductionTransferExecution,
    'erpPostingPolicy' | 'workflowStatus' | 'erpIntegrationStatus'
  >,
): boolean {
  if (info.erpPostingPolicy === 'Disabled') return false;
  if (info.workflowStatus !== 'Completed' && info.workflowStatus !== 'CompletedWithShortage') return false;
  return info.erpIntegrationStatus !== 'Succeeded';
}

export function productionTransferCanRetryErp(
  erpIntegrationStatus: ProductionTransferErpIntegrationStatus,
  erpPostingPolicy: ProductionWorkOrderTransferHeaderRow['erpPostingPolicy'],
  canApprove: boolean,
): boolean {
  return canApprove
    && erpPostingPolicy !== 'Disabled'
    && (erpIntegrationStatus === 'Pending' || erpIntegrationStatus === 'Failed');
}

export function productionTransferErpErrorMessage(
  row: Pick<ProductionWorkOrderTransferHeaderRow, 'erpErrorMessage' | 'erpErrorCode'>,
): string | undefined {
  if (row.erpErrorMessage?.trim()) return row.erpErrorMessage.trim();
  if (row.erpErrorCode?.trim()) return row.erpErrorCode.trim();
  return undefined;
}

export type ProductionTransferErpPanelSource = Pick<
  ProductionTransferExecution,
  'erpIntegrationStatus' | 'erpDocumentNo' | 'erpErrorCode' | 'erpErrorMessage'
>;

export function productionTransferErpPanelSource(
  execution: ProductionTransferExecution | undefined,
  summary: ProductionWorkOrderTransferHeaderRow | undefined,
): ProductionTransferErpPanelSource | null {
  if (!execution && !summary) return null;

  return {
    erpIntegrationStatus: execution?.erpIntegrationStatus
      ?? summary?.erpIntegrationStatus
      ?? 'Pending',
    erpDocumentNo: execution?.erpDocumentNo ?? summary?.erpDocumentNo,
    erpErrorCode: execution?.erpErrorCode ?? summary?.erpErrorCode,
    erpErrorMessage: execution?.erpErrorMessage ?? summary?.erpErrorMessage,
  };
}
