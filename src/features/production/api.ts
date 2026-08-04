import type { GridPage, GridRequest } from '@/components/shared/AdvancedDataGrid';
import { api } from '@/lib/axios';
import type {
  CreateProductionPlanRequest,
  CreateProductionPlanResult,
  ProductionPlanDetail,
  ProductionPlanGridRow,
  NetsisProductionWorkOrder,
  PreparedNetsisProductionWorkOrder,
} from './types';

interface Envelope<T> { success: boolean; data: T; message?: string }
const unwrap = <T,>(result: Envelope<T>): T => {
  if (!result.success) throw new Error(result.message || 'İşlem başarısız.');
  return result.data;
};

export const productionApi = {
  netsisWorkOrders: async (workOrderNumber?: string): Promise<NetsisProductionWorkOrder[]> =>
    unwrap(await api.get<Envelope<NetsisProductionWorkOrder[]>>('/api/netsis-read/production/work-orders', {
      params: { workOrderNumber: workOrderNumber?.trim() || undefined, includeClosed: false, take: 200 },
    })),
  prepareNetsisWorkOrder: async (workOrderNumber: string): Promise<PreparedNetsisProductionWorkOrder> =>
    unwrap(await api.get<Envelope<PreparedNetsisProductionWorkOrder>>(
      `/api/production/netsis-work-orders/${encodeURIComponent(workOrderNumber)}/prepare`,
    )),
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
