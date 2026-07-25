import type { GridPage, GridRequest } from '@/components/shared/AdvancedDataGrid';
import { api } from '@/lib/axios';
import type { DropdownPage, DropdownPageRequest } from '@/hooks/useDropdownInfiniteSearch';
import type { LocationLookupRow, LocationRow, LocationUpsertPayload, WarehouseOption } from '../types/location.types';

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

function unwrap<T>(response: ApiEnvelope<T>): T {
  if (!response.success) throw new Error(response.message || 'Raf tanımları alınamadı.');
  return response.data;
}

export const locationsApi = {
  getPaged: async (request: GridRequest): Promise<GridPage<LocationRow>> =>
    unwrap(await api.post<ApiEnvelope<GridPage<LocationRow>>>('/api/locations/paged', request)),
  getById: async (id: number): Promise<LocationRow> =>
    unwrap(await api.get<ApiEnvelope<LocationRow>>(`/api/locations/${id}`)),
  getLookup: async (warehouseId: number): Promise<LocationLookupRow[]> =>
    unwrap(await api.get<ApiEnvelope<LocationLookupRow[]>>(`/api/locations/lookup?warehouseId=${warehouseId}&includeInactive=false`)),
  getLocationsPaged: async (request: DropdownPageRequest, warehouseId: number): Promise<DropdownPage<LocationLookupRow>> =>
    unwrap(await api.post<ApiEnvelope<GridPage<LocationLookupRow>>>('/api/locations/paged', {
      pageNumber: request.pageNumber,
      pageSize: request.pageSize,
      search: request.search ?? null,
      sortBy: request.sortBy ?? 'code',
      sortDirection: request.sortDirection ?? 'asc',
      filterLogic: 'and',
      filters: [
        ...(Array.isArray(request.filters) ? request.filters : []),
        { column: 'warehouseId', operator: 'equals', value: String(warehouseId) },
        { column: 'isActive', operator: 'equals', value: 'true' },
      ],
    }, { signal: request.signal })),
  getWarehousesPaged: async (request: DropdownPageRequest): Promise<DropdownPage<WarehouseOption>> =>
    unwrap(await api.post<ApiEnvelope<GridPage<WarehouseOption>>>('/api/erp-mirror/warehouses/paged', {
      pageNumber: request.pageNumber,
      pageSize: request.pageSize,
      search: request.search ?? null,
      sortBy: request.sortBy ?? 'warehouseCode',
      sortDirection: request.sortDirection ?? 'asc',
      filterLogic: request.filterLogic ?? 'or',
      filters: Array.isArray(request.filters) ? request.filters : [],
    }, { signal: request.signal })),
  getWarehouses: async (): Promise<WarehouseOption[]> => {
    const page = unwrap(await api.post<ApiEnvelope<GridPage<WarehouseOption>>>('/api/erp-mirror/warehouses/paged', {
      pageNumber: 1, pageSize: 100, search: null, sortBy: 'warehouseCode', sortDirection: 'asc', filterLogic: 'and', filters: [],
    }));
    return page.items;
  },
  create: async (request: LocationUpsertPayload): Promise<number> => {
    const result = unwrap(await api.post<ApiEnvelope<{ id: number }>>('/api/locations', request));
    return result.id;
  },
  update: async (id: number, request: LocationUpsertPayload): Promise<void> => {
    unwrap(await api.put<ApiEnvelope<boolean>>(`/api/locations/${id}`, request));
  },
  delete: async (id: number): Promise<void> => {
    unwrap(await api.delete<ApiEnvelope<boolean>>(`/api/locations/${id}`));
  },
};
