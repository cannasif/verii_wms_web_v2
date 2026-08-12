import type { GridPage, GridRequest } from '@/components/shared/AdvancedDataGrid';
import { api } from '@/lib/axios';
import { buildDropdownPagedBody } from '@/lib/dropdown-paging';
import type { DropdownPage, DropdownPageRequest } from '@/hooks/useDropdownInfiniteSearch';
import type { LocationLookupRow, WarehouseOption } from '@/features/locations/types/location.types';
import type {
  CreateInventoryCountDraftRequest,
  InventoryCountGridRow,
  InventoryCountPreviewResult,
  ReleaseInventoryCountResult,
} from './types';

interface Envelope<T> { success: boolean; data: T; message?: string }

function unwrap<T>(value: Envelope<T>): T {
  if (!value.success) throw new Error(value.message || 'Inventory count operation failed.');
  return value.data;
}

export const inventoryCountApi = {
  warehouses: async (request: DropdownPageRequest, branchCode: string): Promise<DropdownPage<WarehouseOption>> =>
    unwrap(await api.post<Envelope<DropdownPage<WarehouseOption>>>('/api/erp-mirror/warehouses/paged', buildDropdownPagedBody(
      { ...request, sortBy: request.sortBy ?? 'warehouseCode' },
      { filters: [{ column: 'branchCode', operator: 'equals', value: branchCode }] },
    ), { signal: request.signal })),
  locations: async (request: DropdownPageRequest, warehouseId: number): Promise<DropdownPage<LocationLookupRow>> =>
    unwrap(await api.post<Envelope<DropdownPage<LocationLookupRow>>>('/api/locations/paged', buildDropdownPagedBody(
      { ...request, sortBy: request.sortBy ?? 'code', filterLogic: 'and' },
      { filters: [
        { column: 'warehouseId', operator: 'equals', value: String(warehouseId) },
        { column: 'isActive', operator: 'equals', value: 'true' },
        { column: 'allowCycleCount', operator: 'equals', value: 'true' },
      ] },
    ), { signal: request.signal })),
  paged: async (request: GridRequest): Promise<GridPage<InventoryCountGridRow>> =>
    unwrap(await api.post<Envelope<GridPage<InventoryCountGridRow>>>('/api/inventory-counts/paged', request)),
  createDraft: async (request: CreateInventoryCountDraftRequest): Promise<number> =>
    unwrap(await api.post<Envelope<number>>('/api/inventory-counts/drafts', request)),
  preview: async (id: number): Promise<InventoryCountPreviewResult> =>
    unwrap(await api.get<Envelope<InventoryCountPreviewResult>>(`/api/inventory-counts/${id}/preview`)),
  release: async (id: number, concurrencyToken: string): Promise<ReleaseInventoryCountResult> =>
    unwrap(await api.post<Envelope<ReleaseInventoryCountResult>>(`/api/inventory-counts/${id}/release`, {
      idempotencyKey: crypto.randomUUID(),
      concurrencyToken,
    })),
  deleteDraft: async (id: number): Promise<void> => {
    unwrap(await api.post<Envelope<boolean>>(`/api/inventory-counts/${id}/delete`, {}));
  },
};
