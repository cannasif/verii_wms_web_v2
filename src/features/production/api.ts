import type { GridPage, GridRequest } from '@/components/shared/AdvancedDataGrid';
import { api } from '@/lib/axios';
import type {
  CreateProductionPlanRequest,
  CreateProductionPlanResult,
  ProductionPlanDetail,
  ProductionPlanGridRow,
} from './types';

interface Envelope<T> { success: boolean; data: T; message?: string }
const unwrap = <T,>(result: Envelope<T>): T => {
  if (!result.success) throw new Error(result.message || 'İşlem başarısız.');
  return result.data;
};

export const productionApi = {
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
