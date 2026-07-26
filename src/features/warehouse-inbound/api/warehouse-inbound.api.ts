import { api } from '@/lib/axios';
import { resolveStockTrackingPolicy } from '@/features/stock-tracking/effective-stock-tracking.service';
import type { DropdownPage, DropdownPageRequest } from '@/hooks/useDropdownInfiniteSearch';
import type { GridPage as AdvancedGridPage, GridRequest } from '@/components/shared/AdvancedDataGrid';
import type { OperationCancellationResult } from '@/features/shared/api/operation-cancellation';
import type { ActiveUserOption, CreateWarehouseInboundResult, CustomerOption, WarehouseInboundDetail, WarehouseInboundGridRow, WarehouseInboundLabelBatchDetail, WarehouseInboundLabelBatchRow, WarehouseInboundLabelRow, WarehouseInboundLifecycleResult, WarehouseInboundTaskDetail, WarehouseInboundTaskGridRow, LocationOption, ManualWarehouseInboundResult, OpenOrderHeader, OpenOrderLine, PutawayLocationSuggestion, ReceiveWarehouseInboundTaskResult, SeriesOption, StockOption, WarehouseOption, YapCodeOption } from '../types/warehouse-inbound.types';

interface Envelope<T> { success: boolean; data: T; message?: string }
type GridPage<T> = DropdownPage<T>;
const unwrap = <T,>(value: Envelope<T>): T => { if (!value.success) throw new Error(value.message || 'İşlem başarısız.'); return value.data; };
const pagedBody = (request: DropdownPageRequest, filters: unknown[] = []) => ({ pageNumber: request.pageNumber, pageSize: request.pageSize, search: request.search ?? null, sortBy: request.sortBy, sortDirection: request.sortDirection, filterLogic: 'and', filters });

export const warehouseInboundV2Api = {
  trackingPolicy: resolveStockTrackingPolicy,
  customers: async (request: DropdownPageRequest, branchCode: string): Promise<GridPage<CustomerOption>> => unwrap(await api.post<Envelope<GridPage<CustomerOption>>>('/api/erp-mirror/customers/paged', pagedBody({ ...request, sortBy: request.sortBy ?? 'customerCode' }, [{ column: 'branchCode', operator: 'equals', value: branchCode }]), { signal: request.signal })),
  warehouses: async (request: DropdownPageRequest, branchCode: string): Promise<GridPage<WarehouseOption>> => unwrap(await api.post<Envelope<GridPage<WarehouseOption>>>('/api/erp-mirror/warehouses/paged', pagedBody({ ...request, sortBy: request.sortBy ?? 'warehouseCode' }, [{ column: 'branchCode', operator: 'equals', value: branchCode }]), { signal: request.signal })),
  stocks: async (request: DropdownPageRequest, branchCode: string): Promise<GridPage<StockOption>> => unwrap(await api.post<Envelope<GridPage<StockOption>>>('/api/erp-mirror/stocks/paged', pagedBody({ ...request, sortBy: request.sortBy ?? 'erpStockCode' }, [{ column: 'branchCode', operator: 'equals', value: branchCode }]), { signal: request.signal })),
  yapCodes: async (request: DropdownPageRequest, branchCode: string): Promise<GridPage<YapCodeOption>> => unwrap(await api.post<Envelope<GridPage<YapCodeOption>>>('/api/erp-mirror/yap-codes/paged', pagedBody({ ...request, sortBy: request.sortBy ?? 'configurationCode' }, [{ column: 'branchCode', operator: 'equals', value: branchCode }]), { signal: request.signal })),
  locations: async (request: DropdownPageRequest, warehouseId: number): Promise<GridPage<LocationOption>> => unwrap(await api.post<Envelope<GridPage<LocationOption>>>('/api/locations/paged', pagedBody({ ...request, sortBy: request.sortBy ?? 'code' }, [
    { column: 'warehouseId', operator: 'equals', value: String(warehouseId) }, { column: 'isActive', operator: 'equals', value: 'true' },
  ]), { signal: request.signal })),
  putawaySuggestions: async (warehouseId: number, params: { stockId?: number; stockCode?: string; yapCodeId?: number; quantity: number; limit?: number }): Promise<PutawayLocationSuggestion[]> =>
    unwrap(await api.get<Envelope<PutawayLocationSuggestion[]>>('/api/locations/putaway-suggestions', {
      params: { warehouseId, stockId: params.stockId, stockCode: params.stockCode, yapCodeId: params.yapCodeId, quantity: params.quantity, limit: params.limit ?? 5 },
    })),
  series: async (warehouseId: number): Promise<SeriesOption[]> => unwrap(await api.get<Envelope<SeriesOption[]>>(`/api/document-series/lookup?documentType=WarehouseReceipt&warehouseId=${warehouseId}`)),
  orderHeaders: async (customerCode: string, branchCode: string): Promise<OpenOrderHeader[]> => unwrap(await api.get<Envelope<OpenOrderHeader[]>>(`/api/netsis-read/goods-receipt/open-orders/headers?customerCode=${encodeURIComponent(customerCode)}&branchCode=${encodeURIComponent(branchCode)}`)),
  orderLines: async (customerCode: string, branchCode: string, orderNumbers: string[]): Promise<OpenOrderLine[]> => unwrap(await api.get<Envelope<OpenOrderLine[]>>(`/api/netsis-read/goods-receipt/open-orders/lines?customerCode=${encodeURIComponent(customerCode)}&branchCode=${encodeURIComponent(branchCode)}&orderNumbersCsv=${encodeURIComponent(orderNumbers.join(','))}`)),
  create: async (payload: unknown): Promise<CreateWarehouseInboundResult> => unwrap(await api.post<Envelope<CreateWarehouseInboundResult>>('/api/warehouse-inbounds/from-orders', payload)),
  createOrderless: async (payload: unknown): Promise<ManualWarehouseInboundResult> => unwrap(await api.post<Envelope<ManualWarehouseInboundResult>>('/api/warehouse-inbounds/orderless', payload)),
  createDirect: async (payload: unknown): Promise<ManualWarehouseInboundResult> => unwrap(await api.post<Envelope<ManualWarehouseInboundResult>>('/api/warehouse-inbounds/direct', payload)),
  paged: async (request: GridRequest): Promise<AdvancedGridPage<WarehouseInboundGridRow>> => unwrap(await api.post<Envelope<AdvancedGridPage<WarehouseInboundGridRow>>>('/api/warehouse-inbounds/paged', request)),
  detail: async (id: number): Promise<WarehouseInboundDetail> => unwrap(await api.get<Envelope<WarehouseInboundDetail>>(`/api/warehouse-inbounds/${id}`)),
  approve: async (id: number, payload: { idempotencyKey: string; rowVersion: string; reason?: string }): Promise<WarehouseInboundLifecycleResult> =>
    unwrap(await api.post<Envelope<WarehouseInboundLifecycleResult>>(`/api/warehouse-inbounds/${id}/approve`, payload)),
  shortClose: async (id: number, payload: { idempotencyKey: string; rowVersion: string; reason: string; lines: Array<{ lineId: number; quantity: number }> }): Promise<WarehouseInboundLifecycleResult> =>
    unwrap(await api.post<Envelope<WarehouseInboundLifecycleResult>>(`/api/warehouse-inbounds/${id}/short-close`, payload)),
  putaway: async (id: number, payload: { idempotencyKey: string; rowVersion: string; reason?: string; occurredAtUtc?: string; lines: Array<{ lineId: number; quantity: number; sourceLocationId: number; targetLocationId: number; lotNo?: string; serialNo?: string }> }): Promise<WarehouseInboundLifecycleResult> =>
    unwrap(await api.post<Envelope<WarehouseInboundLifecycleResult>>(`/api/warehouse-inbounds/${id}/putaway`, payload)),
  cancel: async (id: number, payload: { idempotencyKey: string; rowVersion: string; reason: string }): Promise<OperationCancellationResult> =>
    unwrap(await api.post<Envelope<OperationCancellationResult>>(`/api/warehouse-inbounds/${id}/cancel`, payload)),
  tasksPaged: async (request: GridRequest): Promise<AdvancedGridPage<WarehouseInboundTaskGridRow>> => unwrap(await api.post<Envelope<AdvancedGridPage<WarehouseInboundTaskGridRow>>>('/api/warehouse-inbounds/tasks/paged', request)),
  myTasksPaged: async (request: GridRequest): Promise<AdvancedGridPage<WarehouseInboundTaskGridRow>> => unwrap(await api.post<Envelope<AdvancedGridPage<WarehouseInboundTaskGridRow>>>('/api/warehouse-inbounds/tasks/assigned/paged', request)),
  taskDetail: async (id: number): Promise<WarehouseInboundTaskDetail> => unwrap(await api.get<Envelope<WarehouseInboundTaskDetail>>(`/api/warehouse-inbounds/tasks/${id}`)),
  replaceTaskAssignments: async (id: number, userIds: number[], rowVersion: string): Promise<WarehouseInboundTaskDetail> => unwrap(await api.put<Envelope<WarehouseInboundTaskDetail>>(`/api/warehouse-inbounds/tasks/${id}/assignments`, { userIds, rowVersion })),
  acceptTask: async (id: number): Promise<WarehouseInboundTaskDetail> => unwrap(await api.post<Envelope<WarehouseInboundTaskDetail>>(`/api/warehouse-inbounds/tasks/${id}/accept`)),
  startTask: async (id: number): Promise<WarehouseInboundTaskDetail> => unwrap(await api.post<Envelope<WarehouseInboundTaskDetail>>(`/api/warehouse-inbounds/tasks/${id}/start`)),
  generateLabels: async (warehouseInboundId:number, taskId:number, lines:Array<{taskLineId:number;labelCount:number;quantityPerLabel?:number}>, description?:string):Promise<WarehouseInboundLabelBatchDetail> => unwrap(await api.post<Envelope<WarehouseInboundLabelBatchDetail>>(`/api/warehouse-inbounds/${warehouseInboundId}/label-batches`, { idempotencyKey: crypto.randomUUID(), taskId, lines, description })),
  labelBatchesPaged: async (request:GridRequest):Promise<AdvancedGridPage<WarehouseInboundLabelBatchRow>> => unwrap(await api.post<Envelope<AdvancedGridPage<WarehouseInboundLabelBatchRow>>>('/api/warehouse-inbounds/label-batches/paged',request)),
  labelBatch: async (id:number):Promise<WarehouseInboundLabelBatchDetail> => unwrap(await api.get<Envelope<WarehouseInboundLabelBatchDetail>>(`/api/warehouse-inbounds/label-batches/${id}`)),
  receiptLabels: async (id:number,lineId?:number):Promise<WarehouseInboundLabelRow[]> => unwrap(await api.get<Envelope<WarehouseInboundLabelRow[]>>(`/api/warehouse-inbounds/${id}/labels`,{params:{lineId}})),
  markLabelsPrinted: async (labelIds:number[]):Promise<boolean> => unwrap(await api.post<Envelope<boolean>>('/api/warehouse-inbounds/labels/printed',{labelIds})),
  voidLabel: async (id:number,reason:string,rowVersion:string):Promise<boolean> => unwrap(await api.post<Envelope<boolean>>(`/api/warehouse-inbounds/labels/${id}/void`,{reason,rowVersion})),
  receiveTaskScan: async (taskId:number,payload:{idempotencyKey:string;taskLineId:number;barcode:string;quantity?:number;lotNo?:string;serialNo?:string;manufacturingDate?:string;expirationDate?:string;toLocationId?:number;occurredAtUtc?:string;deviceId?:string}):Promise<ReceiveWarehouseInboundTaskResult> => unwrap(await api.post<Envelope<ReceiveWarehouseInboundTaskResult>>(`/api/warehouse-inbounds/tasks/${taskId}/receive`,payload)),
  activeUsersPaged: async (request: DropdownPageRequest): Promise<GridPage<ActiveUserOption>> => unwrap(await api.post<Envelope<GridPage<ActiveUserOption>>>('/api/users/paged', pagedBody({ ...request, sortBy: request.sortBy ?? 'username' }, [{ column: 'isActive', operator: 'equals', value: 'true' }]), { signal: request.signal })),
  activeUsers: async (): Promise<ActiveUserOption[]> => (unwrap(await api.post<Envelope<AdvancedGridPage<ActiveUserOption>>>('/api/users/paged', { pageNumber: 1, pageSize: 500, search: null, sortBy: 'username', sortDirection: 'asc', filterLogic: 'and', filters: [{ column: 'isActive', operator: 'equals', value: 'true' }] }))).items,
};
