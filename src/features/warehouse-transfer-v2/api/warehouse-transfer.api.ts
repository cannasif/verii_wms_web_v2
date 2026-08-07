import type { GridPage, GridRequest } from '@/components/shared/AdvancedDataGrid';
import type { DropdownPage, DropdownPageRequest } from '@/hooks/useDropdownInfiniteSearch';
import { api } from '@/lib/axios';
import { buildDropdownPagedBody } from '@/lib/dropdown-paging';
import { requireCompletedCancellation, type OperationCancellationResult } from '@/features/shared/api/operation-cancellation';
import { productionTransferApi } from '@/features/production-transfer/api';
import type {
  LocationOption,
  ActiveUserOption,
  CustomerOption,
  SeriesOption,
  StockOption,
  WarehouseOption,
  YapCodeOption,
} from '@/features/goods-receipt-v2/types/goods-receipt.types';
import type {
  CreateTransferDraftResult,
  WarehouseTransferDetail,
  WarehouseTransferGridRow,
  TransferOrderHeader,
  TransferOrderLine,
  WarehouseTransferPolicy,
  UpdateWarehouseTransferDraft,
  EffectiveTrackingPolicy,
} from '../types/warehouse-transfer.types';

interface Envelope<T> { success: boolean; data: T; message?: string }
export interface SerialLocationMatch {
  serialNo: string;
  locationId?: number;
  locationCode?: string;
  locationName?: string;
  availableQuantity: number;
}
export interface StockLocationBalance {
  locationId: number;
  locationCode: string;
  locationName: string;
  availableQuantity: number;
}
export interface WarehouseTransferOperationLinePayload {
  lineId: number;
  quantity: number;
  sourceLocationId: number | null;
  targetLocationId: number | null;
  lotNo: string | null;
  serialNo: string | null;
}
export interface WarehouseTransferOperationResult {
  transferId: number;
  documentNo: string;
  status: string;
  stockMovementOperationId?: number;
  pickedQuantity: number;
  shippedQuantity: number;
  receivedQuantity: number;
  putawayQuantity: number;
  replayed: boolean;
}
const unwrap = <T,>(value: Envelope<T>): T => {
  if (!value.success) throw new Error(value.message || 'İşlem başarısız.');
  return value.data;
};
const pagedBody = (request: DropdownPageRequest, filters: unknown[] = []) =>
  buildDropdownPagedBody(request, { filters });

export const warehouseTransferApi = {
  warehouses: async (request: DropdownPageRequest, branchCode: string): Promise<DropdownPage<WarehouseOption>> =>
    unwrap(await api.post<Envelope<DropdownPage<WarehouseOption>>>(
      '/api/erp-mirror/warehouses/paged',
      pagedBody({ ...request, sortBy: request.sortBy ?? 'warehouseCode' }, [
        { column: 'branchCode', operator: 'equals', value: branchCode },
      ]),
      { signal: request.signal },
    )),
  customers: async (request: DropdownPageRequest, branchCode: string): Promise<DropdownPage<CustomerOption>> =>
    unwrap(await api.post<Envelope<DropdownPage<CustomerOption>>>(
      '/api/erp-mirror/customers/paged',
      pagedBody({ ...request, sortBy: request.sortBy ?? 'customerCode' }, [
        { column: 'branchCode', operator: 'equals', value: branchCode },
      ]),
      { signal: request.signal },
    )),
  stocks: async (request: DropdownPageRequest, branchCode: string): Promise<DropdownPage<StockOption>> =>
    unwrap(await api.post<Envelope<DropdownPage<StockOption>>>(
      '/api/erp-mirror/stocks/paged',
      pagedBody({ ...request, sortBy: request.sortBy ?? 'erpStockCode' }, [
        { column: 'branchCode', operator: 'equals', value: branchCode },
      ]),
      { signal: request.signal },
    )),
  yapCodes: async (request: DropdownPageRequest, branchCode: string): Promise<DropdownPage<YapCodeOption>> =>
    unwrap(await api.post<Envelope<DropdownPage<YapCodeOption>>>(
      '/api/erp-mirror/yap-codes/paged',
      pagedBody({ ...request, sortBy: request.sortBy ?? 'configurationCode' }, [
        { column: 'branchCode', operator: 'equals', value: branchCode },
      ]),
      { signal: request.signal },
    )),
  resolveStockLocations: async (
    branchCode: string,
    warehouseId: number,
    stockId: number,
    yapCodeId: number | undefined,
    excludeLocationIds?: number[],
  ): Promise<StockLocationBalance[]> =>
    unwrap(await api.get<Envelope<StockLocationBalance[]>>(
      `/api/stock-balances/stocks/${stockId}/locations`,
      { params: {
        warehouseId,
        branchCode,
        yapCodeId: yapCodeId ?? undefined,
        excludeLocationIds: excludeLocationIds?.length ? excludeLocationIds.join(',') : undefined,
      } },
    )),
  stockLocationsPage: async (
    request: DropdownPageRequest,
    branchCode: string,
    warehouseId: number,
    stockId: number,
    yapCodeId: number | undefined,
    excludeLocationIds?: number[],
  ): Promise<DropdownPage<StockLocationBalance>> => {
    const all = await warehouseTransferApi.resolveStockLocations(branchCode, warehouseId, stockId, yapCodeId, excludeLocationIds);
    const search = (request.search ?? '').trim().toLowerCase();
    const filtered = search
      ? all.filter((x) => x.locationCode.toLowerCase().includes(search) || x.locationName.toLowerCase().includes(search))
      : all;
    const pageSize = request.pageSize || filtered.length || 1;
    const pageNumber = request.pageNumber || 1;
    const start = (pageNumber - 1) * pageSize;
    return {
      items: filtered.slice(start, start + pageSize),
      pageNumber,
      pageSize,
      totalCount: filtered.length,
      totalPages: Math.max(1, Math.ceil(filtered.length / pageSize)),
      hasNextPage: start + pageSize < filtered.length,
    };
  },
  resolveSerialLocations: async (
    branchCode: string,
    warehouseId: number,
    stockId: number,
    yapCodeId: number | undefined,
    serialNumbers: string[],
  ): Promise<SerialLocationMatch[]> =>
    unwrap(await api.post<Envelope<SerialLocationMatch[]>>('/api/stock-balances/resolve-serial-locations', {
      branchCode, warehouseId, stockId, yapCodeId: yapCodeId ?? null, serialNumbers,
    })),
  locations: async (request: DropdownPageRequest, warehouseId: number): Promise<DropdownPage<LocationOption>> =>
    unwrap(await api.post<Envelope<DropdownPage<LocationOption>>>(
      '/api/locations/paged',
      pagedBody({ ...request, sortBy: request.sortBy ?? 'code', filterLogic: 'and' }, [
        { column: 'warehouseId', operator: 'equals', value: String(warehouseId) },
        { column: 'isActive', operator: 'equals', value: 'true' },
      ]),
      { signal: request.signal },
    )),
  series: async (
    documentType: 'InterWarehouseTransfer' | 'ProductionTransfer' | 'SubcontractingIssue' | 'SubcontractingReceipt' | 'ProductionOrder' = 'InterWarehouseTransfer',
  ): Promise<SeriesOption[]> =>
    unwrap(await api.get<Envelope<SeriesOption[]>>(
      `/api/document-series/lookup?documentType=${documentType}`,
    )),
  createDraft: async (payload: unknown): Promise<CreateTransferDraftResult> =>
    unwrap(await api.post<Envelope<CreateTransferDraftResult>>('/api/warehouse-transfers/drafts', payload)),
  createProductionDraft: async (payload: unknown): Promise<CreateTransferDraftResult> =>
    unwrap(await api.post<Envelope<CreateTransferDraftResult>>('/api/production-transfers/drafts', payload)),
  createSubcontractingDraft: async (payload: unknown): Promise<CreateTransferDraftResult> =>
    unwrap(await api.post<Envelope<CreateTransferDraftResult>>('/api/subcontracting-transfers/drafts', payload)),
  paged: async (request: GridRequest): Promise<GridPage<WarehouseTransferGridRow>> =>
    unwrap(await api.post<Envelope<GridPage<WarehouseTransferGridRow>>>('/api/warehouse-transfers/paged', request)),
  detail: async (id: number): Promise<WarehouseTransferDetail> =>
    unwrap(await api.get<Envelope<WarehouseTransferDetail>>(`/api/warehouse-transfers/${id}`)),
  updateDraft: async (id: number, payload: UpdateWarehouseTransferDraft): Promise<WarehouseTransferDetail> =>
    unwrap(await api.post<Envelope<WarehouseTransferDetail>>(`/api/warehouse-transfers/${id}/update`, payload)),
  deleteDraft: async (id: number): Promise<boolean> =>
    unwrap(await api.post<Envelope<boolean>>(`/api/warehouse-transfers/${id}/delete`)),
  cancel: async (id: number, reason: string): Promise<OperationCancellationResult> =>
    requireCompletedCancellation(unwrap(await api.post<Envelope<OperationCancellationResult>>(
      `/api/warehouse-transfers/${id}/cancel`,
      { idempotencyKey: crypto.randomUUID(), reason: reason.trim() },
    ))),
  activeUsers: async (request: DropdownPageRequest): Promise<DropdownPage<ActiveUserOption>> =>
    unwrap(await api.post<Envelope<DropdownPage<ActiveUserOption>>>('/api/users/paged', pagedBody(
      { ...request, sortBy: request.sortBy ?? 'username' },
      [{ column: 'isActive', operator: 'equals', value: 'true' }],
    ), { signal: request.signal })),
  orderHeaders: async (customerCode: string, branchCode: string): Promise<TransferOrderHeader[]> =>
    unwrap(await api.get<Envelope<TransferOrderHeader[]>>('/api/netsis-read/warehouse-transfer/open-orders/headers', {
      params: { customerCode, branchCode },
    })),
  orderLines: async (orderNumbers: string[], branchCode: string): Promise<TransferOrderLine[]> =>
    unwrap(await api.get<Envelope<TransferOrderLine[]>>('/api/netsis-read/warehouse-transfer/open-orders/lines', {
      params: { orderNumbersCsv: orderNumbers.join(','), branchCode },
    })),
  policy: async (branchCode: string): Promise<WarehouseTransferPolicy> =>
    unwrap(await api.get<Envelope<WarehouseTransferPolicy>>('/api/warehouse-transfer-policy', { params: { branchCode } })),
  trackingPolicy: async (branchCode: string, stockId: number): Promise<EffectiveTrackingPolicy> =>
    unwrap(await api.get<Envelope<EffectiveTrackingPolicy>>('/api/stock-tracking-policies/resolve', {
      params: { branchCode, stockId },
    })),
  updatePolicy: async (payload: WarehouseTransferPolicy): Promise<WarehouseTransferPolicy> =>
    unwrap(await api.put<Envelope<WarehouseTransferPolicy>>('/api/warehouse-transfer-policy', payload)),
  transition: async (id: number, action: 'approve' | 'release', reason?: string): Promise<WarehouseTransferOperationResult> =>
    unwrap(await api.post<Envelope<WarehouseTransferOperationResult>>(`/api/warehouse-transfers/${id}/${action}`, {
      idempotencyKey: crypto.randomUUID(),
      reason: reason?.trim() || null,
    })),
  operate: async (
    id: number,
    action: 'pick' | 'dispatch' | 'receive' | 'putaway',
    payload: {
      lines: WarehouseTransferOperationLinePayload[];
      reason?: string;
      vehiclePlate?: string;
      driverName?: string;
      waybillNo?: string;
    },
  ): Promise<WarehouseTransferOperationResult> =>
    unwrap(await api.post<Envelope<WarehouseTransferOperationResult>>(`/api/warehouse-transfers/${id}/${action}`, {
      idempotencyKey: crypto.randomUUID(),
      occurredAtUtc: new Date().toISOString(),
      lines: payload.lines,
      reason: payload.reason?.trim() || null,
      vehiclePlate: payload.vehiclePlate?.trim() || null,
      driverName: payload.driverName?.trim() || null,
      waybillNo: payload.waybillNo?.trim() || null,
    })),
};

export type TransferApiVariant = 'warehouse' | 'production' | 'subcontracting';
export type SubcontractingTransferDirection = 'IssueToSupplier' | 'ReceiptFromSupplier' | 'SupplierToSupplier';

export const transferApiFor = (
  variant: TransferApiVariant,
  subcontractingDirection?: SubcontractingTransferDirection,
) => {
  if (variant === 'warehouse') {
    return {
      paged: warehouseTransferApi.paged,
      detail: warehouseTransferApi.detail,
      updateDraft: warehouseTransferApi.updateDraft,
      deleteDraft: warehouseTransferApi.deleteDraft,
      cancel: async (id: number, reason: string) => warehouseTransferApi.cancel(id, reason),
      transition: warehouseTransferApi.transition,
      operate: warehouseTransferApi.operate,
    };
  }
  const base = variant === 'production' ? '/api/production-transfers' : '/api/subcontracting-transfers';
  return {
    paged: async (request: GridRequest): Promise<GridPage<WarehouseTransferGridRow>> =>
      unwrap(await api.post<Envelope<GridPage<WarehouseTransferGridRow>>>(
        variant === 'subcontracting' && subcontractingDirection
          ? `${base}/paged/${subcontractingDirection}`
          : `${base}/paged`,
        request,
      )),
    detail: async (id: number): Promise<WarehouseTransferDetail> => {
      const result = unwrap(await api.get<Envelope<{ transfer: WarehouseTransferDetail }>>(`${base}/${id}`));
      return result.transfer;
    },
    updateDraft: async (id: number, payload: UpdateWarehouseTransferDraft): Promise<WarehouseTransferDetail> => {
      const result = unwrap(await api.post<Envelope<{ transfer: WarehouseTransferDetail }>>(`${base}/${id}/update`, payload));
      return result.transfer;
    },
    deleteDraft: async (id: number): Promise<boolean> =>
      unwrap(await api.post<Envelope<boolean>>(`${base}/${id}/delete`)),
    cancel: variant === 'production'
      ? async (id: number, reason: string) => productionTransferApi.cancel(id, reason)
      : async (id: number, reason: string): Promise<WarehouseTransferOperationResult> =>
        unwrap(await api.post<Envelope<WarehouseTransferOperationResult>>(`${base}/${id}/cancel`, {
          idempotencyKey: crypto.randomUUID(),
          reason: reason.trim(),
        })),
    transition: async (id: number, action: 'approve' | 'release', reason?: string): Promise<WarehouseTransferOperationResult> =>
      unwrap(await api.post<Envelope<WarehouseTransferOperationResult>>(`${base}/${id}/${action}`, {
        idempotencyKey: crypto.randomUUID(),
        reason: reason?.trim() || null,
      })),
    operate: async (
      id: number,
      action: 'pick' | 'dispatch' | 'receive' | 'putaway',
      payload: {
        lines: WarehouseTransferOperationLinePayload[];
        reason?: string;
        vehiclePlate?: string;
        driverName?: string;
        waybillNo?: string;
      },
    ): Promise<WarehouseTransferOperationResult> =>
      unwrap(await api.post<Envelope<WarehouseTransferOperationResult>>(`${base}/${id}/${action}`, {
        idempotencyKey: crypto.randomUUID(),
        occurredAtUtc: new Date().toISOString(),
        lines: payload.lines,
        reason: payload.reason?.trim() || null,
        vehiclePlate: payload.vehiclePlate?.trim() || null,
        driverName: payload.driverName?.trim() || null,
        waybillNo: payload.waybillNo?.trim() || null,
      })),
  };
};
