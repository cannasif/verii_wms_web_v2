import { api } from '@/lib/axios';
import type { GridPage, GridRequest } from '@/components/shared/AdvancedDataGrid';
import type { CreateUserPayload, PermissionGroupOption, UpdateUserPayload, UserDetail, UserImportResult, UserRow, WarehouseOption } from '../types/user-management.types';

type Envelope<T> = { success: boolean; data: T; message?: string };
const unwrap = <T>(value: Envelope<T>): T => { if (!value.success) throw new Error(value.message || 'İşlem başarısız.'); return value.data; };

export const userManagementApi = {
  getPaged: async (request: GridRequest) => unwrap(await api.post<Envelope<GridPage<UserRow>>>('/api/users/paged', request)),
  getById: async (id: number) => unwrap(await api.get<Envelope<UserDetail>>(`/api/users/${id}`)),
  create: async (payload: CreateUserPayload) => unwrap(await api.post<Envelope<{ id: number }>>('/api/users', payload)),
  update: async (id: number, payload: UpdateUserPayload) => unwrap(await api.put<Envelope<boolean>>(`/api/users/${id}`, payload)),
  deactivate: async (id: number) => unwrap(await api.delete<Envelope<boolean>>(`/api/users/${id}`)),
  downloadImportTemplate: async (): Promise<Blob> =>
    await api.get<Blob>('/api/users/import-template', { responseType: 'blob' }),
  importUsers: async (file: File): Promise<UserImportResult> => {
    const form = new FormData();
    form.append('file', file);
    return unwrap(await api.post<Envelope<UserImportResult>>('/api/users/import', form));
  },
  getActiveGroups: async (): Promise<PermissionGroupOption[]> => {
    const page = unwrap(await api.post<Envelope<GridPage<PermissionGroupOption>>>('/api/access-control/groups/paged', { pageNumber: 1, pageSize: 500, search: null, sortBy: 'name', sortDirection: 'asc', filterLogic: 'and', filters: [{ column: 'isActive', operator: 'equals', value: 'true' }] }));
    return page.items;
  },
  getWarehouses: async (branchCode: string): Promise<WarehouseOption[]> => {
    const page = unwrap(await api.post<Envelope<GridPage<WarehouseOption>>>('/api/erp-mirror/warehouses/paged', {
      pageNumber: 1, pageSize: 500, search: null, sortBy: 'warehouseCode', sortDirection: 'asc',
      filterLogic: 'and', filters: [{ column: 'branchCode', operator: 'equals', value: branchCode }],
    }));
    return page.items;
  },
};
