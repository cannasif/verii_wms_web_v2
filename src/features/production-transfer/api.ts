import { api } from '@/lib/axios';
import { requireCompletedCancellation, type OperationCancellationResult } from '@/features/shared/api/operation-cancellation';

interface Envelope<T> { success: boolean; data: T; message?: string }
const unwrap = <T,>(result: Envelope<T>) => {
  if (!result.success) throw new Error(result.message || 'İşlem başarısız.');
  return result.data;
};

export interface ProductionTransferPolicy {
  id: number;
  branchCode: string;
  rowVersion: string;
  requireProductionOrderReference: boolean;
  allowManualTransfer: boolean;
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
  sourceLocationId?: number; sourceLocationCode?: string; sourceLocationName?: string;
}
export interface ProductionTask {
  taskId: number; taskNo: string; taskType: string; warehouseId: number; status: string; acceptedAtUtc?: string; acceptedBy?: number;
  startedAtUtc?: string; startedBy?: number; completedAtUtc?: string; completedBy?: number; assignments: ProductionTaskAssignment[]; lines: ProductionTaskLine[];
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
export interface WarehouseTransferReturnSetting { warehouseId: number; defaultTransferReturnLocationId?: number }

export const productionTransferApi = {
  policy: async (branchCode: string): Promise<ProductionTransferPolicy> =>
    unwrap(await api.get<Envelope<ProductionTransferPolicy>>('/api/production-transfers/policy', { params: { branchCode } })),
  updatePolicy: async (payload: ProductionTransferPolicy): Promise<ProductionTransferPolicy> =>
    unwrap(await api.put<Envelope<ProductionTransferPolicy>>('/api/production-transfers/policy', payload)),
  taskBoard: async (id: number): Promise<ProductionTaskBoard> =>
    unwrap(await api.get<Envelope<ProductionTaskBoard>>(`/api/production-transfers/${id}/tasks`)),
  taskPool: async (): Promise<ProductionTaskPoolRow[]> =>
    unwrap(await api.get<Envelope<ProductionTaskPoolRow[]>>('/api/production-transfers/task-pool')),
  assignTask: async (id: number, taskId: number, userId: number): Promise<ProductionTaskBoard> =>
    unwrap(await api.post<Envelope<ProductionTaskBoard>>(`/api/production-transfers/${id}/tasks/${taskId}/assign`, { userId })),
  removeAssignment: async (id: number, taskId: number, userId: number): Promise<ProductionTaskBoard> =>
    unwrap(await api.post<Envelope<ProductionTaskBoard>>(`/api/production-transfers/${id}/tasks/${taskId}/assignments/${userId}/remove`, {})),
  handoffTask: async (id: number, taskId: number, targetUserId: number, reason?: string): Promise<ProductionTaskBoard> =>
    unwrap(await api.post<Envelope<ProductionTaskBoard>>(`/api/production-transfers/${id}/tasks/${taskId}/handoff`, { targetUserId, reason: reason?.trim() || null })),
  refreshRoute: async (id: number, taskId: number): Promise<ProductionTaskBoard> =>
    unwrap(await api.post<Envelope<ProductionTaskBoard>>(`/api/production-transfers/${id}/tasks/${taskId}/refresh-route`, {})),
  startTask: async (id: number, taskId: number): Promise<ProductionTaskBoard> =>
    unwrap(await api.post<Envelope<ProductionTaskBoard>>(`/api/production-transfers/${id}/tasks/${taskId}/start`, {})),
  completeCancellationReturn: async (id: number, taskId: number): Promise<ProductionTaskBoard> =>
    unwrap(await api.post<Envelope<ProductionTaskBoard>>(`/api/production-transfers/${id}/tasks/${taskId}/complete-cancellation-return`, { idempotencyKey: crypto.randomUUID() })),
  returnSetting: async (warehouseId: number): Promise<WarehouseTransferReturnSetting> =>
    unwrap(await api.get<Envelope<WarehouseTransferReturnSetting>>('/api/production-transfers/warehouse-return-setting', { params: { warehouseId } })),
  updateReturnSetting: async (warehouseId: number, defaultTransferReturnLocationId?: number): Promise<WarehouseTransferReturnSetting> =>
    unwrap(await api.put<Envelope<WarehouseTransferReturnSetting>>('/api/production-transfers/warehouse-return-setting', {
      warehouseId, defaultTransferReturnLocationId: defaultTransferReturnLocationId || null,
    })),
  cancel: async (id: number, reason: string, returnLocationId?: number): Promise<OperationCancellationResult> =>
    requireCompletedCancellation(unwrap(await api.post<Envelope<OperationCancellationResult>>(`/api/production-transfers/${id}/cancel`, {
      idempotencyKey: crypto.randomUUID(), reason: reason.trim(), returnLocationId: returnLocationId || null,
    }))),
};
