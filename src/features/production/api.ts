import type { GridPage, GridRequest } from '@/components/shared/AdvancedDataGrid';
import { api } from '@/lib/axios';
import type {
  CreateProductionPlanRequest,
  CreateProductionPlanResult,
  ProductionPlanDetail,
  ProductionPlanGridRow,
  ProductionSourceWorkOrder,
  ProductionReturnedWorkOrder,
  PreparedNetsisProductionWorkOrder,
  CancelProductionWorkOrderAssignmentRequest,
  RestoreProductionWorkOrderAssignmentRequest,
  ProductionWorkOrderAssignmentCancellationResult,
} from './types';

interface Envelope<T> { success: boolean; data: T; message?: string }
const unwrap = <T,>(result: Envelope<T>): T => {
  if (!result.success) throw new Error(result.message || 'İşlem başarısız.');
  return result.data;
};

export const productionApi = {
  sourceWorkOrders: async (search?: string): Promise<ProductionSourceWorkOrder[]> =>
    unwrap(await api.get<Envelope<ProductionSourceWorkOrder[]>>('/api/production/work-orders', {
      params: { search: search?.trim() || undefined, take: 200 },
    })),
  returnedWorkOrders: async (search?: string): Promise<ProductionReturnedWorkOrder[]> =>
    unwrap(await api.get<Envelope<ProductionReturnedWorkOrder[]>>('/api/production/work-orders/returned', {
      params: { search: search?.trim() || undefined, take: 200 },
    })),
  cancelledWorkOrderAssignments: async (search?: string): Promise<ProductionSourceWorkOrder[]> =>
    unwrap(await api.get<Envelope<ProductionSourceWorkOrder[]>>('/api/production/work-orders/cancelled-assignments', {
      params: { search: search?.trim() || undefined, take: 200 },
    })),
  cancelWorkOrderAssignment: async (payload: CancelProductionWorkOrderAssignmentRequest): Promise<ProductionWorkOrderAssignmentCancellationResult> =>
    unwrap(await api.post<Envelope<ProductionWorkOrderAssignmentCancellationResult>>('/api/production/work-orders/cancel-assignment', payload)),
  restoreWorkOrderAssignment: async (payload: RestoreProductionWorkOrderAssignmentRequest): Promise<ProductionWorkOrderAssignmentCancellationResult> =>
    unwrap(await api.post<Envelope<ProductionWorkOrderAssignmentCancellationResult>>('/api/production/work-orders/restore-assignment', payload)),
  prepareSourceWorkOrder: async (row: Pick<ProductionSourceWorkOrder, 'workOrderNumber' | 'sourceType' | 'sourceSystemCode' | 'listingKind' | 'transferId' | 'kalanTaskId'>): Promise<PreparedNetsisProductionWorkOrder> => {
    const useKalanScope = row.listingKind === 'CancellationReturnRemainder'
      || row.listingKind === 'PartialTransferRemainder'
      || (Number.isFinite(row.transferId) && (row.transferId ?? 0) > 0
        && Number.isFinite(row.kalanTaskId) && (row.kalanTaskId ?? 0) > 0);
    return unwrap(await api.get<Envelope<PreparedNetsisProductionWorkOrder>>(
      `/api/production/work-orders/${encodeURIComponent(row.workOrderNumber)}/prepare`,
      {
        params: {
          sourceType: row.sourceType,
          sourceSystemCode: row.sourceSystemCode,
          transferId: useKalanScope ? row.transferId : undefined,
          kalanTaskId: useKalanScope ? row.kalanTaskId : undefined,
        },
      },
    ));
  },
  create: async (payload: CreateProductionPlanRequest): Promise<CreateProductionPlanResult> =>
    unwrap(await api.post<Envelope<CreateProductionPlanResult>>('/api/production/plans', payload)),
  paged: async (request: GridRequest): Promise<GridPage<ProductionPlanGridRow>> =>
    unwrap(await api.post<Envelope<GridPage<ProductionPlanGridRow>>>('/api/production/plans/paged', request)),
  detail: async (id: number): Promise<ProductionPlanDetail> =>
    unwrap(await api.get<Envelope<ProductionPlanDetail>>(`/api/production/plans/${id}`)),
  release: async (id: number, rowVersion: string, reason?: string): Promise<ProductionPlanDetail> =>
    unwrap(await api.post<Envelope<ProductionPlanDetail>>(`/api/production/plans/${id}/release`, {
      rowVersion,
      reason: reason?.trim() || null,
    })),
  deleteDraft: async (id: number): Promise<boolean> =>
    unwrap(await api.post<Envelope<boolean>>(`/api/production/plans/${id}/delete`)),
};
