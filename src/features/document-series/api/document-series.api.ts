import type { GridPage, GridRequest } from '@/components/shared/AdvancedDataGrid';
import { api } from '@/lib/axios';
import type { DocumentSeriesRow, DocumentSeriesUpsertPayload } from '../types/document-series.types';

interface ApiEnvelope<T> { success: boolean; data: T; message?: string }
const unwrap = <T,>(response: ApiEnvelope<T>): T => {
  if (!response.success) throw new Error(response.message || 'Belge serisi işlemi başarısız.');
  return response.data;
};

export const documentSeriesApi = {
  getPaged: async (request: GridRequest): Promise<GridPage<DocumentSeriesRow>> =>
    unwrap(await api.post<ApiEnvelope<GridPage<DocumentSeriesRow>>>('/api/document-series/paged', request)),
  getById: async (id: number): Promise<DocumentSeriesRow> =>
    unwrap(await api.get<ApiEnvelope<DocumentSeriesRow>>(`/api/document-series/${id}`)),
  create: async (request: DocumentSeriesUpsertPayload): Promise<number> => {
    const result = unwrap(await api.post<ApiEnvelope<{ id: number }>>('/api/document-series', request));
    return result.id;
  },
  update: async (id: number, request: DocumentSeriesUpsertPayload): Promise<void> => {
    unwrap(await api.put<ApiEnvelope<boolean>>(`/api/document-series/${id}`, request));
  },
  delete: async (id: number): Promise<void> => {
    unwrap(await api.delete<ApiEnvelope<boolean>>(`/api/document-series/${id}`));
  },
};
