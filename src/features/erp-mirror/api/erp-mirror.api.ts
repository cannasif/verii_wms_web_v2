import { api } from '@/lib/axios';
import type { ApiEnvelope, PagedRequest, PagedResponse } from '../types/erp-mirror.types';

export async function getErpMirrorPage<T>(resource: string, request: PagedRequest): Promise<PagedResponse<T>> {
  const response = await api.post<ApiEnvelope<PagedResponse<T>>>(`/api/erp-mirror/${resource}/paged`, request);
  if (!response.success) throw new Error(response.message || 'ERP mirror verisi alınamadı.');
  return response.data;
}

export async function syncErpMirror(resource: string): Promise<void> {
  await api.post(`/api/erp-mirror/sync/${resource}`);
}
