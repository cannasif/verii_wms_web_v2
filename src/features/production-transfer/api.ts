import { api } from '@/lib/axios';
import { requireCompletedCancellation, type OperationCancellationResult } from '@/features/shared/api/operation-cancellation';
import type { WarehouseTransferPickedSourceLocation } from '@/features/warehouse-transfer-v2/types/warehouse-transfer.types';

interface Envelope<T> { success: boolean; data: T; message?: string }
const unwrap = <T,>(result: Envelope<T>) => {
  if (!result.success) throw new Error(result.message || 'İşlem başarısız.');
  return result.data;
};

export interface ProductionTransferPolicy {
  id: number;
  branchCode: string;
  rowVersion: string;
  productionOrderSource: 'NetsisErpFunctions' | 'WmsIntegrationTables' | 'ErpAndWms';
  wmsSourceSystemCode: string;
  requireProductionOrderReference: boolean;
  allowManualTransfer: boolean;
  requireErpMasterDataForManualTransfer: boolean;
  allowAutomaticGeneration: boolean;
  checkMaterialAvailability: boolean;
  blockOnShortage: boolean;
  requireTaskAssignment: boolean;
  requireSourceProductionLocation: boolean;
  requireTargetProductionLocation: boolean;
  allowPartialSupply: boolean;
  allowOverIssue: boolean;
  overIssueTolerancePercent: number;
  requireApproval: boolean;
  erpPostingPolicy: 'Disabled' | 'Manual' | 'AfterHandover';
  cancellationReturnPolicy: 'OriginalSourceLocation' | 'WarehouseDefaultReturnLocation' | 'ManagerSelectionRequired';
}

export interface ProductionTaskAssignment { userId: number; username: string; isPrimary: boolean; assignedAtUtc: string; acceptedAtUtc?: string }
export interface ProductionTaskLine {
  taskLineId: number; transferLineId: number; stockCode: string; stockName?: string;
  requestedQuantity: number; reservedQuantity: number; missingQuantity: number; processedQuantity: number;
  totalRequestedQuantity: number;
  sourceLocationId?: number; sourceLocationCode?: string; sourceLocationName?: string;
  targetLocationId?: number; targetLocationCode?: string; targetLocationName?: string;
  serialNo?: string;
}
export interface ProductionTask {
  taskId: number; taskNo: string; taskType: string; warehouseId: number; status: string; acceptedAtUtc?: string; acceptedBy?: number;
  startedAtUtc?: string; startedBy?: number; completedAtUtc?: string; completedBy?: number; assignments: ProductionTaskAssignment[]; lines: ProductionTaskLine[];
  originTaskId?: number; originUserId?: number; previousTaskId?: number;
  assignedUsernames?: string[];
}
export interface ProductionTaskBoard {
  transferId: number; documentNo: string; transferStatus: string; sourceWarehouseId: number;
  tasks: ProductionTask[];
  workloads: { userId: number; username: string; assignedTaskCount: number; completedTaskCount: number; plannedQuantity: number; processedQuantity: number; completionPercent: number }[];
  eligibleAssignees: { userId: number; username: string; warehouseIds: number[] }[];
}
export interface ProductionTaskPoolRow {
  transferId: number; documentNo: string; businessContext: string; transferStatus: string;
  taskId: number; taskNo: string; taskType: string; warehouseId: number; taskStatus: string;
  plannedQuantity: number; processedQuantity: number; remainingQuantity: number;
  assignedUsers: string[]; createdDate?: string;
}

export type ProductionWorkOrderTransferTab = 'Picking' | 'Completed' | 'Cancelled' | 'MyAssignments';

export interface ProductionWorkOrderTransferTaskRow {
  taskId: number;
  taskNo: string;
  displayLabel: string;
  displaySuffix?: string;
  taskType: string;
  status: string;
  warehouseId: number;
  plannedQuantity: number;
  processedQuantity: number;
  remainingQuantity: number;
  assignedUsernames: string[];
  previousTaskId?: number;
  originTaskId?: number;
  originUserId?: number;
  completedAtUtc?: string;
}

export interface ProductionWorkOrderTransferHeaderRow {
  transferId: number;
  documentNo: string;
  externalReferenceNo?: string;
  transferStatus: string;
  workflowStatus: ProductionTransferWorkflowStatus;
  productionOrderId?: number;
  productionOrderNo?: string;
  productionHeaderId?: number;
  parentTransferId?: number;
  residualTransferId?: number;
  residualDocumentNo?: string;
  isResidualHeader: boolean;
  sourceWarehouseId: number;
  sourceWarehouseCode: number;
  sourceWarehouseName: string;
  targetWarehouseId: number;
  targetWarehouseCode: number;
  targetWarehouseName: string;
  requestedQuantity: number;
  pickedQuantity: number;
  documentDate: string;
  initiationMode: string;
  lineCount: number;
  shippedQuantity: number;
  receivedQuantity: number;
  putawayQuantity: number;
  createdBy?: number;
  updatedBy?: number;
  updatedDate?: string;
  createdDate?: string;
  erpPostingPolicy?: 'Disabled' | 'Manual' | 'AfterHandover';
  erpIntegrationStatus?: ProductionTransferExecution['erpIntegrationStatus'];
  erpPostingStatus?: ProductionTransferExecution['erpPostingStatus'];
  erpDocumentNo?: string;
  erpErrorCode?: string;
  erpErrorMessage?: string;
  tasks: ProductionWorkOrderTransferTaskRow[];
}

/** Görev başlatmadan önce depo-geneli stok yeterlilik kontrolü sonucu. */
export interface ProductionTaskStockShortage {
  taskLineId: number;
  transferLineId: number;
  stockCode: string;
  stockName?: string;
  requestedQuantity: number;
  availableQuantity: number;
  shortageQuantity: number;
}

export interface ProductionTaskStartCheck {
  canStartFully: boolean;
  shortages: ProductionTaskStockShortage[];
}

export interface ProductionTaskStartOptions {
  allowPartialStart?: boolean;
}
export interface WarehouseTransferReturnSetting {
  warehouseId: number;
  defaultTransferReturnLocationId?: number;
  defaultProductionTransferLocationId?: number;
  productionPickingStagingLocationId?: number;
  autoPickWithoutConfirmMaxQuantity?: number;
}
export interface DefaultProductionTargetLocation {
  locationId?: number;
  locationCode?: string;
  locationName?: string;
}

export type ProductionTransferWorkflowStatus =
  | 'Planned' | 'Picking' | 'AwaitingHandover' | 'Completed' | 'CompletedWithShortage' | 'Cancelled';

export interface ProductionTransferExecutionLine {
  lineId: number; lineNo: number; stockId: number; stockCode: string; stockName?: string; unitCode: string;
  requestedQuantity: number; pickedQuantity: number; handedOverQuantity: number;
  remainingToPickQuantity: number; shortageQuantity: number; overIssueQuantity: number; trackingType: string;
  suggestedSourceLocationId?: number; suggestedSourceLocationCode?: string; suggestedSourceLocationName?: string;
}

export interface ProductionTransferExecution {
  transferId: number; documentNo: string; workflowStatus: ProductionTransferWorkflowStatus; transferStatus: string;
  erpPostingPolicy: 'Disabled' | 'Manual' | 'AfterHandover';
  erpIntegrationStatus: 'Pending' | 'Processing' | 'Succeeded' | 'Failed' | 'CommitUncertain' | 'Cancelled';
  erpPostingStatus?: 'Pending' | 'Processing' | 'Succeeded' | 'Failed' | 'CommitUncertain';
  erpDocumentNo?: string; erpErrorCode?: string; erpErrorMessage?: string;
  sourceWarehouseId: number; sourceWarehouseCode: number; sourceWarehouseName: string;
  targetWarehouseId: number; targetWarehouseCode: number; targetWarehouseName: string;
  waitingLocationId?: number; waitingLocationCode?: string; waitingLocationName?: string;
  requestedByUserId?: number; requestedByName?: string; handoverConfirmedBy?: number; handoverConfirmedAtUtc?: string;
  handoverShortageReason?: string; parentTransferId?: number; residualTransferId?: number; residualDocumentNo?: string;
  requestedQuantity: number; pickedQuantity: number; handedOverQuantity: number; shortageQuantity: number;
  overIssueQuantity: number;
  canCompletePicking: boolean; canConfirmHandover: boolean;
  overIssueLines: ProductionTransferOverIssueLine[];
  excludedSourceLocationIds: number[];
  lines: ProductionTransferExecutionLine[];
}

export interface ProductionTransferScanPickSummaryDelta {
  workflowStatus: ProductionTransferWorkflowStatus;
  pickedQuantity: number;
  shortageQuantity: number;
  overIssueQuantity: number;
  canCompletePicking: boolean;
}

export interface ProductionTransferScanPickExecutionLineDelta {
  lineId: number;
  pickedQuantity: number;
  remainingToPickQuantity: number;
  overIssueQuantity: number;
}

export interface ProductionTransferScanPickResult {
  row: ProductionTransferPickingRow;
  summary: ProductionTransferScanPickSummaryDelta;
  executionLine: ProductionTransferScanPickExecutionLineDelta;
  lineId: number;
  stockCode: string;
  acceptedQuantity: number;
  serialNo?: string;
  lotNo?: string;
  barcodeSource: string;
  sourceLocationId: number;
  sourceLocationCode: string;
  sourceLocationName: string;
  remainingBarcodeQuantity?: number;
}

export interface ProductionTransferPickingRow {
  taskLineId: number;
  wtLineId: number;
  lineNo: number;
  sourceLocationId?: number;
  sourceLocationCode?: string;
  stockId: number;
  stockCode: string;
  stockName?: string;
  serialNo?: string;
  requestedQuantity: number;
  remainingQuantity: number;
  processedQuantity: number;
  canPick: boolean;
  isHistorical?: boolean;
}

export interface ProductionTransferOverIssueLine {
  lineId: number;
  lineNo: number;
  stockCode: string;
  stockName?: string;
  unitCode: string;
  requestedQuantity: number;
  pickedQuantity: number;
  overIssueQuantity: number;
}

export interface ProductionTransferPickingTable {
  transferId: number;
  documentNo: string;
  externalReferenceNo?: string;
  workflowStatus: ProductionTransferWorkflowStatus;
  pickTaskId: number;
  pickTaskNo: string;
  isLocked: boolean;
  canCompletePicking: boolean;
  requestedQuantity: number;
  pickedQuantity: number;
  shortageQuantity: number;
  allowOverIssue: boolean;
  overIssueTolerancePercent: number;
  overIssueQuantity: number;
  overIssueLines: ProductionTransferOverIssueLine[];
  rows: ProductionTransferPickingRow[];
}

export interface ResolveProductionTransferBarcodeResult {
  taskLineId: number;
  wtLineId: number;
  sourceLocationId?: number;
  sourceLocationCode?: string;
  stockId: number;
  stockCode: string;
  stockName?: string;
  serialNo?: string;
  lotNo?: string;
  remainingQuantity: number;
  maxPickQuantity: number;
  defaultQuantity: number;
  isSerial: boolean;
  canPick: boolean;
}

export interface ProductionTransferRouteRefreshCandidate {
  locationId: number;
  locationCode: string;
  availableQuantity: number;
  suggestedQuantity: number;
  serialNo?: string | null;
}

export interface ProductionTransferRouteRefreshCandidates {
  taskLineId: number;
  remainingQuantity: number;
  isSerial: boolean;
  currentSerialNo?: string | null;
  candidates: ProductionTransferRouteRefreshCandidate[];
}

export interface WithdrawProductionTransferDraftLinesRequest {
  transferLineIds: number[];
  reason?: string | null;
}

export interface WithdrawnProductionTransferDraftLine {
  transferLineId: number;
  stockId: number;
  stockCode: string;
  stockName?: string;
  quantity: number;
  requirementReference?: string;
}

export interface WithdrawProductionTransferDraftLinesResult {
  transferDeleted: boolean;
  transferId?: number | null;
  documentNo?: string | null;
  workOrderNumber?: string | null;
  withdrawnLineCount: number;
  withdrawnQuantity: number;
  remainingLineCount: number;
  withdrawnLines: WithdrawnProductionTransferDraftLine[];
}

const taskPath = (transferId: number, taskId: number) => `/api/production-transfers/${transferId}/tasks/${taskId}`;
const assignmentPath = (transferId: number, taskId: number, userId: number) =>
  `${taskPath(transferId, taskId)}/assignments/${userId}`;

export const productionTransferApi = {
  // — Politika —
  policy: async (branchCode: string): Promise<ProductionTransferPolicy> =>
    unwrap(await api.get<Envelope<ProductionTransferPolicy>>('/api/production-transfers/policy', { params: { branchCode } })),
  updatePolicy: async (payload: ProductionTransferPolicy): Promise<ProductionTransferPolicy> =>
    unwrap(await api.put<Envelope<ProductionTransferPolicy>>('/api/production-transfers/policy', payload, { useNativeHttpMethod: true })),

  // — Görev panosu —
  taskBoard: async (id: number): Promise<ProductionTaskBoard> =>
    unwrap(await api.get<Envelope<ProductionTaskBoard>>(`/api/production-transfers/${id}/tasks`)),
  taskPool: async (): Promise<ProductionTaskPoolRow[]> =>
    unwrap(await api.get<Envelope<ProductionTaskPoolRow[]>>('/api/production-transfers/task-pool')),
  workOrderTransferGroups: async (
    tab: ProductionWorkOrderTransferTab,
    search?: string,
  ): Promise<ProductionWorkOrderTransferHeaderRow[]> =>
    unwrap(await api.get<Envelope<ProductionWorkOrderTransferHeaderRow[]>>(
      '/api/production-transfers/work-order-transfer-groups',
      { params: { tab, search: search?.trim() || undefined } },
    )),
  workOrderTransferGroupTasks: async (
    transferId: number,
  ): Promise<ProductionWorkOrderTransferTaskRow[]> =>
    unwrap(await api.get<Envelope<ProductionWorkOrderTransferTaskRow[]>>(
      `/api/production-transfers/work-order-transfer-groups/${transferId}/tasks`,
    )),

  execution: async (id: number): Promise<ProductionTransferExecution> =>
    unwrap(await api.get<Envelope<ProductionTransferExecution>>(`/api/production-transfers/${id}/execution`)),
  withdrawDraftLines: async (
    id: number,
    payload: WithdrawProductionTransferDraftLinesRequest,
  ): Promise<WithdrawProductionTransferDraftLinesResult> =>
    unwrap(await api.post<Envelope<WithdrawProductionTransferDraftLinesResult>>(
      `/api/production-transfers/${id}/withdraw-draft-lines`,
      payload,
    )),
  pickingTable: async (id: number): Promise<ProductionTransferPickingTable> =>
    unwrap(await api.get<Envelope<ProductionTransferPickingTable>>(`/api/production-transfers/${id}/picking-table`)),
  resolveBarcode: async (id: number, barcode: string): Promise<ResolveProductionTransferBarcodeResult> =>
    unwrap(await api.post<Envelope<ResolveProductionTransferBarcodeResult>>(`/api/production-transfers/${id}/resolve-barcode`, {
      barcode: barcode.trim(),
    })),
  scanPick: async (
    id: number,
    expectedTaskLineId: number,
    barcode: string,
    options?: {
      quantity?: number;
      sourceLocationId?: number;
      idempotencyKey?: string;
      confirmAboveThreshold?: boolean;
    },
  ): Promise<ProductionTransferScanPickResult> =>
    unwrap(await api.post<Envelope<ProductionTransferScanPickResult>>(`/api/production-transfers/${id}/scan-pick`, {
      idempotencyKey: options?.idempotencyKey ?? crypto.randomUUID(),
      expectedTaskLineId,
      barcode: barcode.trim(),
      quantity: options?.quantity ?? null,
      sourceLocationId: options?.sourceLocationId || null,
      confirmAboveThreshold: options?.confirmAboveThreshold ?? false,
    })),
  routeRefreshCandidates: async (id: number, taskLineId: number, serialNo?: string | null): Promise<ProductionTransferRouteRefreshCandidates> =>
    unwrap(await api.get<Envelope<ProductionTransferRouteRefreshCandidates>>(
      `/api/production-transfers/${id}/task-lines/${taskLineId}/route-candidates`,
      { params: serialNo?.trim() ? { serialNo: serialNo.trim() } : undefined },
    )),
  applyRouteSplit: async (
    id: number,
    taskLineId: number,
    splits: { locationId: number; quantity: number; serialNo?: string | null }[],
    currentSerialNo?: string | null,
  ): Promise<ProductionTransferPickingTable> =>
    unwrap(await api.post<Envelope<ProductionTransferPickingTable>>(
      `/api/production-transfers/${id}/task-lines/${taskLineId}/route-split`,
      {
        idempotencyKey: crypto.randomUUID(),
        currentSerialNo: currentSerialNo?.trim() || null,
        splits,
      },
    )),
  unpickToLocation: async (
    id: number,
    payload: {
      taskLineId: number;
      targetLocationId: number;
      quantity?: number | null;
      serialNo?: string | null;
    },
  ): Promise<ProductionTransferPickingTable> =>
    unwrap(await api.post<Envelope<ProductionTransferPickingTable>>(
      `/api/production-transfers/${id}/unpick-to-location`,
      {
        idempotencyKey: crypto.randomUUID(),
        taskLineId: payload.taskLineId,
        targetLocationId: payload.targetLocationId,
        quantity: payload.quantity ?? null,
        serialNo: payload.serialNo?.trim() || null,
      },
    )),
  completePicking: async (
    id: number,
    confirmPartialPicking: boolean,
    confirmOverIssuePicking: boolean,
    reason?: string,
  ): Promise<ProductionTransferExecution> =>
    unwrap(await api.post<Envelope<ProductionTransferExecution>>(`/api/production-transfers/${id}/complete-picking`, {
      idempotencyKey: crypto.randomUUID(), confirmPartialPicking, confirmOverIssuePicking, reason: reason?.trim() || null,
    })),
  resumePicking: async (id: number): Promise<ProductionTransferExecution> =>
    unwrap(await api.post<Envelope<ProductionTransferExecution>>(`/api/production-transfers/${id}/resume-picking`, {
      idempotencyKey: crypto.randomUUID(),
    })),
  confirmHandover: async (id: number, confirmShortage: boolean, shortageReason?: string): Promise<ProductionTransferExecution> =>
    unwrap(await api.post<Envelope<ProductionTransferExecution>>(`/api/production-transfers/${id}/confirm-handover`, {
      idempotencyKey: crypto.randomUUID(), confirmShortage, shortageReason: shortageReason?.trim() || null,
    })),
  postErp: async (id: number): Promise<ProductionTransferExecution> =>
    unwrap(await api.post<Envelope<ProductionTransferExecution>>(`/api/production-transfers/${id}/erp/post`, {
      idempotencyKey: crypto.randomUUID(),
    })),

  // — Atama ve devir —
  assignTask: async (id: number, taskId: number, userId: number): Promise<ProductionTaskBoard> =>
    unwrap(await api.post<Envelope<ProductionTaskBoard>>(`${taskPath(id, taskId)}/assign`, { userId })),
  releaseTaskToPool: async (id: number, taskId: number, warehouseId: number): Promise<ProductionTaskBoard> =>
    unwrap(await api.post<Envelope<ProductionTaskBoard>>(`${taskPath(id, taskId)}/release-to-pool`, { warehouseId })),
  claimTask: async (id: number, taskId: number): Promise<ProductionTaskBoard> =>
    unwrap(await api.post<Envelope<ProductionTaskBoard>>(`${taskPath(id, taskId)}/claim`, { idempotencyKey: crypto.randomUUID() })),
  eligibleAssignees: async (): Promise<ProductionTaskBoard['eligibleAssignees']> =>
    unwrap(await api.get<Envelope<ProductionTaskBoard['eligibleAssignees']>>('/api/production-transfers/eligible-assignees')),
  removeAssignment: async (id: number, taskId: number, userId: number): Promise<ProductionTaskBoard> =>
    unwrap(await api.post<Envelope<ProductionTaskBoard>>(`${assignmentPath(id, taskId, userId)}/remove`, {})),
  handoffTask: async (id: number, taskId: number, targetUserId: number, reason?: string): Promise<ProductionTaskBoard> =>
    unwrap(await api.post<Envelope<ProductionTaskBoard>>(`${taskPath(id, taskId)}/handoff`, { targetUserId, reason: reason?.trim() || null })),
  refreshRoute: async (id: number, taskId: number): Promise<ProductionTaskBoard> =>
    unwrap(await api.post<Envelope<ProductionTaskBoard>>(`${taskPath(id, taskId)}/refresh-route`, {})),
  checkTaskStart: async (id: number, taskId: number): Promise<ProductionTaskStartCheck> =>
    unwrap(await api.get<Envelope<ProductionTaskStartCheck>>(`${taskPath(id, taskId)}/start-check`)),
  startTask: async (id: number, taskId: number, options?: ProductionTaskStartOptions): Promise<ProductionTaskBoard> =>
    unwrap(await api.post<Envelope<ProductionTaskBoard>>(`${taskPath(id, taskId)}/start`, {
      allowPartialStart: options?.allowPartialStart ?? false,
    })),
  linePickedSources: async (id: number, lineId: number): Promise<WarehouseTransferPickedSourceLocation[]> =>
    unwrap(await api.get<Envelope<WarehouseTransferPickedSourceLocation[]>>(
      `/api/production-transfers/${id}/lines/${lineId}/picked-sources`,
    )),

  // — İptal iade görevleri —
  requestCancellationReturn: async (id: number): Promise<ProductionTaskBoard> =>
    unwrap(await api.post<Envelope<ProductionTaskBoard>>(`/api/production-transfers/${id}/request-cancellation-return`, {})),
  completeCancellationReturn: async (
    id: number,
    taskId: number,
    lines: { taskLineId: number; targetLocationId: number }[],
  ): Promise<ProductionTaskBoard> =>
    unwrap(await api.post<Envelope<ProductionTaskBoard>>(`${taskPath(id, taskId)}/complete-cancellation-return`, {
      idempotencyKey: crypto.randomUUID(),
      lines,
    })),
  processReturnTaskLine: async (
    id: number,
    taskId: number,
    taskLineId: number,
    targetLocationId: number,
  ): Promise<ProductionTaskBoard> =>
    unwrap(await api.post<Envelope<ProductionTaskBoard>>(`${taskPath(id, taskId)}/task-lines/${taskLineId}/process-return`, {
      idempotencyKey: crypto.randomUUID(),
      targetLocationId,
    })),

  // — Depo raf ayarları —
  defaultTargetLocation: async (warehouseId: number, branchCode: string): Promise<DefaultProductionTargetLocation> =>
    unwrap(await api.get<Envelope<DefaultProductionTargetLocation>>(`/api/production-transfers/warehouses/${warehouseId}/default-target-location`, { params: { branchCode } })),
  returnSetting: async (warehouseId: number): Promise<WarehouseTransferReturnSetting> =>
    unwrap(await api.get<Envelope<WarehouseTransferReturnSetting>>('/api/production-transfers/warehouse-return-setting', { params: { warehouseId } })),
  updateReturnSetting: async (
    warehouseId: number,
    defaultTransferReturnLocationId?: number,
    defaultProductionTransferLocationId?: number,
    productionPickingStagingLocationId?: number,
    autoPickWithoutConfirmMaxQuantity?: number | null,
  ): Promise<WarehouseTransferReturnSetting> =>
    unwrap(await api.put<Envelope<WarehouseTransferReturnSetting>>('/api/production-transfers/warehouse-return-setting', {
      warehouseId,
      defaultTransferReturnLocationId: defaultTransferReturnLocationId || null,
      defaultProductionTransferLocationId: defaultProductionTransferLocationId || null,
      productionPickingStagingLocationId: productionPickingStagingLocationId || null,
      autoPickWithoutConfirmMaxQuantity: autoPickWithoutConfirmMaxQuantity ?? null,
    })),

  // — İptal (toplanmış stok iadesi tamamlandıktan sonra) —
  cancel: async (id: number, reason: string, returnLocationId?: number): Promise<OperationCancellationResult> =>
    requireCompletedCancellation(unwrap(await api.post<Envelope<OperationCancellationResult>>(`/api/production-transfers/${id}/cancel`, {
      idempotencyKey: crypto.randomUUID(), reason: reason.trim(), returnLocationId: returnLocationId || null,
    }))),
};
