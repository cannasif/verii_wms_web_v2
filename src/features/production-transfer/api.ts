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
  cancellationReturnPolicy: 'OriginalSourceLocation' | 'WarehouseDefaultReturnLocation' | 'ManagerSelectionRequired';
}

export interface ProductionTaskAssignment { userId: number; username: string; isPrimary: boolean; assignedAtUtc: string; acceptedAtUtc?: string }
export interface ProductionTaskLine {
  taskLineId: number; transferLineId: number; stockCode: string; stockName?: string;
  requestedQuantity: number; reservedQuantity: number; missingQuantity: number; processedQuantity: number;
  totalRequestedQuantity: number;
  sourceLocationId?: number; sourceLocationCode?: string; sourceLocationName?: string;
}
export interface ProductionTask {
  taskId: number; taskNo: string; taskType: string; warehouseId: number; status: string; acceptedAtUtc?: string; acceptedBy?: number;
  startedAtUtc?: string; startedBy?: number; completedAtUtc?: string; completedBy?: number; assignments: ProductionTaskAssignment[]; lines: ProductionTaskLine[];
  originTaskId?: number; originUserId?: number; previousTaskId?: number;
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
  remainingToPickQuantity: number; shortageQuantity: number; trackingType: string;
  suggestedSourceLocationId?: number; suggestedSourceLocationCode?: string; suggestedSourceLocationName?: string;
}

export interface ProductionTransferExecution {
  transferId: number; documentNo: string; workflowStatus: ProductionTransferWorkflowStatus; transferStatus: string;
  sourceWarehouseId: number; sourceWarehouseCode: number; sourceWarehouseName: string;
  targetWarehouseId: number; targetWarehouseCode: number; targetWarehouseName: string;
  waitingLocationId?: number; waitingLocationCode?: string; waitingLocationName?: string;
  requestedByUserId?: number; requestedByName?: string; handoverConfirmedBy?: number; handoverConfirmedAtUtc?: string;
  handoverShortageReason?: string; parentTransferId?: number; residualTransferId?: number; residualDocumentNo?: string;
  requestedQuantity: number; pickedQuantity: number; handedOverQuantity: number; shortageQuantity: number;
  canCompletePicking: boolean; canConfirmHandover: boolean;
  excludedSourceLocationIds: number[];
  lines: ProductionTransferExecutionLine[];
}

export interface ProductionTransferScanPickResult {
  execution: ProductionTransferExecution; lineId: number; stockCode: string; acceptedQuantity: number;
  serialNo?: string; lotNo?: string; barcodeSource: string;
  sourceLocationId: number; sourceLocationCode: string; sourceLocationName: string;
  remainingBarcodeQuantity?: number;
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

  execution: async (id: number): Promise<ProductionTransferExecution> =>
    unwrap(await api.get<Envelope<ProductionTransferExecution>>(`/api/production-transfers/${id}/execution`)),
  scanPick: async (id: number, expectedLineId: number, barcode: string, sourceLocationId?: number): Promise<ProductionTransferScanPickResult> =>
    unwrap(await api.post<Envelope<ProductionTransferScanPickResult>>(`/api/production-transfers/${id}/scan-pick`, {
      idempotencyKey: crypto.randomUUID(), expectedLineId, barcode: barcode.trim(), sourceLocationId: sourceLocationId || null,
    })),
  completePicking: async (id: number, confirmPartialPicking: boolean, reason?: string): Promise<ProductionTransferExecution> =>
    unwrap(await api.post<Envelope<ProductionTransferExecution>>(`/api/production-transfers/${id}/complete-picking`, {
      idempotencyKey: crypto.randomUUID(), confirmPartialPicking, reason: reason?.trim() || null,
    })),
  confirmHandover: async (id: number, confirmShortage: boolean, shortageReason?: string): Promise<ProductionTransferExecution> =>
    unwrap(await api.post<Envelope<ProductionTransferExecution>>(`/api/production-transfers/${id}/confirm-handover`, {
      idempotencyKey: crypto.randomUUID(), confirmShortage, shortageReason: shortageReason?.trim() || null,
    })),

  // — Atama ve devir —
  assignTask: async (id: number, taskId: number, userId: number): Promise<ProductionTaskBoard> =>
    unwrap(await api.post<Envelope<ProductionTaskBoard>>(`${taskPath(id, taskId)}/assign`, { userId })),
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

  // — İade görevleri (atama kaldırma / iptal) —
  requestAssignmentReturn: async (id: number, taskId: number, userId: number): Promise<ProductionTaskBoard> =>
    unwrap(await api.post<Envelope<ProductionTaskBoard>>(`${assignmentPath(id, taskId, userId)}/request-return`, {})),
  requestCancellationReturn: async (id: number, taskId: number, userId: number): Promise<ProductionTaskBoard> =>
    unwrap(await api.post<Envelope<ProductionTaskBoard>>(`${assignmentPath(id, taskId, userId)}/request-cancellation-return`, {})),
  completeAssignmentReturn: async (id: number, taskId: number): Promise<ProductionTaskBoard> =>
    unwrap(await api.post<Envelope<ProductionTaskBoard>>(`${taskPath(id, taskId)}/complete-assignment-return`, { idempotencyKey: crypto.randomUUID() })),
  completeCancellationReturn: async (id: number, taskId: number): Promise<ProductionTaskBoard> =>
    unwrap(await api.post<Envelope<ProductionTaskBoard>>(`${taskPath(id, taskId)}/complete-cancellation-return`, { idempotencyKey: crypto.randomUUID() })),

  // — Depo raf ayarları —
  defaultTargetLocation: async (warehouseId: number, branchCode: string): Promise<DefaultProductionTargetLocation> =>
    unwrap(await api.get<Envelope<DefaultProductionTargetLocation>>(`/api/production-transfers/warehouses/${warehouseId}/default-target-location`, { params: { branchCode } })),
  returnSetting: async (warehouseId: number): Promise<WarehouseTransferReturnSetting> =>
    unwrap(await api.get<Envelope<WarehouseTransferReturnSetting>>('/api/production-transfers/warehouse-return-setting', { params: { warehouseId } })),
  updateReturnSetting: async (
    warehouseId: number,
    defaultTransferReturnLocationId?: number,
    defaultProductionTransferLocationId?: number,
  ): Promise<WarehouseTransferReturnSetting> =>
    unwrap(await api.put<Envelope<WarehouseTransferReturnSetting>>('/api/production-transfers/warehouse-return-setting', {
      warehouseId, defaultTransferReturnLocationId: defaultTransferReturnLocationId || null,
      defaultProductionTransferLocationId: defaultProductionTransferLocationId || null,
    })),

  // — İptal (toplanmış stok iadesi tamamlandıktan sonra) —
  cancel: async (id: number, reason: string, returnLocationId?: number): Promise<OperationCancellationResult> =>
    requireCompletedCancellation(unwrap(await api.post<Envelope<OperationCancellationResult>>(`/api/production-transfers/${id}/cancel`, {
      idempotencyKey: crypto.randomUUID(), reason: reason.trim(), returnLocationId: returnLocationId || null,
    }))),
};
