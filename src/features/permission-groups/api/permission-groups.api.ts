import { api } from '@/lib/axios';
import type { GridPage, GridRequest } from '@/components/shared/AdvancedDataGrid';
import type { PermissionGroupDetail, PermissionGroupPayload, PermissionGroupRow, PermissionGroupStats, PermissionRow } from '../types/permission-groups.types';
type Envelope<T> = { success: boolean; data: T; message?: string };
const unwrap = <T>(value: Envelope<T>): T => { if (!value.success) throw new Error(value.message || 'İşlem başarısız.'); return value.data; };
export const permissionGroupsApi = {
  getPaged: async (request: GridRequest) => unwrap(await api.post<Envelope<GridPage<PermissionGroupRow>>>('/api/access-control/groups/paged', request)),
  getStats: async () => unwrap(await api.get<Envelope<PermissionGroupStats>>('/api/access-control/groups/stats')),
  getById: async (id: number) => unwrap(await api.get<Envelope<PermissionGroupDetail>>(`/api/access-control/groups/${id}`)),
  create: async (payload: PermissionGroupPayload) => unwrap(await api.post<Envelope<{ id: number }>>('/api/access-control/groups', payload)),
  update: async (id: number, payload: PermissionGroupPayload) => unwrap(await api.put<Envelope<boolean>>(`/api/access-control/groups/${id}`, payload)),
  delete: async (id: number) => unwrap(await api.delete<Envelope<boolean>>(`/api/access-control/groups/${id}`)),
  getActivePermissions: async () => unwrap(await api.post<Envelope<GridPage<PermissionRow>>>('/api/access-control/permissions/paged', { pageNumber: 1, pageSize: 500, search: null, sortBy: 'code', sortDirection: 'asc', filterLogic: 'and', filters: [{ column: 'isActive', operator: 'equals', value: 'true' }] })),
};
