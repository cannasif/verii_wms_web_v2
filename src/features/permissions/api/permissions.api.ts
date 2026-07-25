import type { GridPage, GridRequest } from '@/components/shared/AdvancedDataGrid';
import { api } from '@/lib/axios';

type Envelope<T> = { success: boolean; data: T; message?: string };
const unwrap = <T>(response: Envelope<T>): T => {
  if (!response.success) throw new Error(response.message || 'İşlem başarısız.');
  return response.data;
};

export interface PermissionRow { id: number; code: string; name: string; description?: string; isActive: boolean; availableOnWeb: boolean; availableOnMobile: boolean; createdBy?: number | null; createdDate?: string | null; updatedBy?: number | null; updatedDate?: string | null }
export interface CreatePermissionRequest { code: string; name: string; description?: string; isActive: boolean; availableOnWeb: boolean; availableOnMobile: boolean }

export const permissionsApi = {
  permissions: async (request: GridRequest) => unwrap(await api.post<Envelope<GridPage<PermissionRow>>>('/api/access-control/permissions/paged', request)),
  createPermission: async (request: CreatePermissionRequest) => unwrap(await api.post<Envelope<unknown>>('/api/access-control/permissions', request)),
  updatePermission: async (id: number, request: CreatePermissionRequest) => unwrap(await api.post<Envelope<unknown>>(`/api/access-control/permissions/${id}/update`, request)),
  deletePermission: async (id: number) => unwrap(await api.post<Envelope<unknown>>(`/api/access-control/permissions/${id}/delete`, {})),
};
