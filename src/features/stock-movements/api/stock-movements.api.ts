import type { GridPage, GridRequest } from '@/components/shared/AdvancedDataGrid';
import { api } from '@/lib/axios';
import type { DropdownPage, DropdownPageRequest } from '@/hooks/useDropdownInfiniteSearch';
import type { LocationOption, PostStockMovementRequest, StockMovementDetail, StockMovementGridRow, StockOption, WarehouseOption, YapCodeOption } from '../types/stock-movement.types';

interface Envelope<T> { success:boolean; data:T; message?:string }
const unwrap = <T>(response:Envelope<T>):T => { if (!response.success) throw new Error(response.message || 'İşlem başarısız.'); return response.data; };
const pageRequest = { pageNumber:1, pageSize:100, search:null, sortDirection:'asc' as const, filterLogic:'and' as const, filters:[] };
const toPagedRequest = (request:DropdownPageRequest, sortBy:string, extraFilters:unknown[] = []) => ({
  pageNumber:request.pageNumber,
  pageSize:request.pageSize,
  search:request.search ?? null,
  sortBy:request.sortBy ?? sortBy,
  sortDirection:request.sortDirection ?? 'asc',
  filterLogic:request.filterLogic ?? 'or',
  filters:[...(Array.isArray(request.filters) ? request.filters : []), ...extraFilters],
});

export const stockMovementsApi = {
  getPaged: async (request:GridRequest):Promise<GridPage<StockMovementGridRow>> => unwrap(await api.post<Envelope<GridPage<StockMovementGridRow>>>('/api/stock-movements/paged', request)),
  getById: async (id:number):Promise<StockMovementDetail> => unwrap(await api.get<Envelope<StockMovementDetail>>(`/api/stock-movements/${id}`)),
  post: async (request:PostStockMovementRequest):Promise<void> => { unwrap(await api.post<Envelope<unknown>>('/api/stock-movements', request)); },
  reverse: async (id:number, idempotencyKey:string, reason:string):Promise<void> => { unwrap(await api.post<Envelope<unknown>>(`/api/stock-movements/${id}/reverse`, { idempotencyKey, reason, occurredAt:null })); },
  getStocks: async ():Promise<StockOption[]> => (unwrap(await api.post<Envelope<GridPage<StockOption>>>('/api/erp-mirror/stocks/paged', { ...pageRequest, sortBy:'erpStockCode' }))).items,
  getWarehouses: async ():Promise<WarehouseOption[]> => (unwrap(await api.post<Envelope<GridPage<WarehouseOption>>>('/api/erp-mirror/warehouses/paged', { ...pageRequest, sortBy:'warehouseCode' }))).items,
  getLocations: async (warehouseId:number):Promise<LocationOption[]> => unwrap(await api.get<Envelope<LocationOption[]>>(`/api/locations/lookup?warehouseId=${warehouseId}&includeInactive=false`)),
  getStocksPaged: async (request:DropdownPageRequest):Promise<DropdownPage<StockOption>> =>
    unwrap(await api.post<Envelope<GridPage<StockOption>>>('/api/erp-mirror/stocks/paged', toPagedRequest(request, 'erpStockCode'), { signal:request.signal })),
  getWarehousesPaged: async (request:DropdownPageRequest):Promise<DropdownPage<WarehouseOption>> =>
    unwrap(await api.post<Envelope<GridPage<WarehouseOption>>>('/api/erp-mirror/warehouses/paged', toPagedRequest(request, 'warehouseCode'), { signal:request.signal })),
  getLocationsPaged: async (request:DropdownPageRequest, warehouseId:number):Promise<DropdownPage<LocationOption>> =>
    unwrap(await api.post<Envelope<GridPage<LocationOption>>>('/api/locations/paged', toPagedRequest(request, 'code', [
      { column:'warehouseId', operator:'equals', value:String(warehouseId) },
      { column:'isActive', operator:'equals', value:'true' },
    ]), { signal:request.signal })),
  getYapCodes: async ():Promise<YapCodeOption[]> => (unwrap(await api.post<Envelope<GridPage<YapCodeOption>>>('/api/erp-mirror/yap-codes/paged', { ...pageRequest, sortBy:'configurationCode' }))).items,
};
