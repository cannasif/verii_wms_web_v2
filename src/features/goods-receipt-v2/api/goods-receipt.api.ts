import { api } from '@/lib/axios';
import { resolveStockTrackingPolicy } from '@/features/stock-tracking/effective-stock-tracking.service';
import type { DropdownPage, DropdownPageRequest } from '@/hooks/useDropdownInfiniteSearch';
import type { GridPage as AdvancedGridPage, GridRequest } from '@/components/shared/AdvancedDataGrid';
import { normalizeGridPage } from '@/lib/paged';
import type { ActiveUserOption, CreateGoodsReceiptResult, CustomerOption, ErpPostingResult, GoodsReceiptDetail, GoodsReceiptGridRow, GoodsReceiptLabelBatchDetail, GoodsReceiptLabelBatchRow, GoodsReceiptLabelRow, GoodsReceiptLifecycleResult, GoodsReceiptPolicy, GoodsReceiptQualityRequirementResult, GoodsReceiptRoutingResult, GoodsReceiptSplitRoutingResult, GoodsReceiptTaskDetail, GoodsReceiptTaskGridRow, GoodsReceiptWarehouseDefault, LocationOption, ManualGoodsReceiptResult, OpenOrderHeader, OpenOrderLine, PutawayLocationSuggestion, ReceiveGoodsReceiptTaskResult, SeriesOption, StockOption, UserWarehouseAccess, WarehouseOption, YapCodeOption } from '../types/goods-receipt.types';
import type { OperationCancellationResult } from '@/features/shared/api/operation-cancellation';
import { buildDropdownPagedBody } from '@/lib/dropdown-paging';
import { normalizeGoodsReceiptWaybillFields } from '../utils/goods-receipt-waybill';
import { normalizeGoodsReceiptRoutes } from '../utils/goods-receipt-routes';
import axios from 'axios';

interface Envelope<T> { success: boolean; data: T; message?: string }
type GridPage<T> = DropdownPage<T>;
const unwrap = <T,>(value: Envelope<T>): T => { if (!value.success) throw new Error(value.message || 'İşlem başarısız.'); return value.data; };
const pagedBody = (request: DropdownPageRequest, filters: unknown[] = []) =>
  buildDropdownPagedBody(request, { filters });

function readDetailRoutes(detail: GoodsReceiptDetail & Record<string, unknown>): GoodsReceiptRoutingResult[] {
  return normalizeGoodsReceiptRoutes(
    detail.routes
      ?? detail.Routes
      ?? detail.routingResults
      ?? detail.RoutingResults
      ?? detail.routeHistory
      ?? detail.RouteHistory,
  );
}

export const goodsReceiptV2Api = {
  trackingPolicy: resolveStockTrackingPolicy,
  qualityRequirements: async (
    branchCode: string,
    stockIds: number[],
  ): Promise<GoodsReceiptQualityRequirementResult> => {
    const params = new URLSearchParams({ branchCode });
    for (const stockId of [...new Set(stockIds)]) {
      params.append('stockIds', String(stockId));
    }
    return unwrap(await api.get<Envelope<GoodsReceiptQualityRequirementResult>>(
      '/api/goods-receipts/quality-requirements',
      { params },
    ));
  },
  warehouseAccess: async (): Promise<UserWarehouseAccess> =>
    unwrap(await api.get<Envelope<UserWarehouseAccess>>('/api/goods-receipts/warehouse-access')),
  policy: async (branchCode: string): Promise<GoodsReceiptPolicy> => {
    const value = unwrap(await api.get<Envelope<GoodsReceiptPolicy>>('/api/goods-receipt-policy', {
      params: { branchCode },
    }));
    return {
      ...value,
      showAllocatedOpenOrderLines: Boolean(value.showAllocatedOpenOrderLines),
    };
  },
  updateWarehouseDefaultLocation: async (request: {
    branchCode: string;
    warehouseId: number;
    defaultLocationId?: number;
  }): Promise<GoodsReceiptWarehouseDefault> =>
    unwrap(await api.put<Envelope<GoodsReceiptWarehouseDefault>>(
      '/api/goods-receipt-policy/warehouse-default-location',
      {
        ...request,
        defaultLocationId: request.defaultLocationId ?? null,
      },
    )),
  customers: async (request: DropdownPageRequest, branchCode: string): Promise<GridPage<CustomerOption>> => unwrap(await api.post<Envelope<GridPage<CustomerOption>>>('/api/erp-mirror/customers/paged', pagedBody({ ...request, sortBy: request.sortBy ?? 'customerCode' }, [{ column: 'branchCode', operator: 'equals', value: branchCode }]), { signal: request.signal })),
  warehouses: async (request: DropdownPageRequest, branchCode: string): Promise<GridPage<WarehouseOption>> => {
    const [page, access] = await Promise.all([
      api.post<Envelope<GridPage<WarehouseOption>>>('/api/erp-mirror/warehouses/paged', pagedBody({ ...request, pageSize: Math.max(request.pageSize ?? 20, 500), sortBy: request.sortBy ?? 'warehouseCode' }, [{ column: 'branchCode', operator: 'equals', value: branchCode }]), { signal: request.signal }).then(unwrap),
      goodsReceiptV2Api.warehouseAccess(),
    ]);
    if (!access.isRestricted) return page;
    const allowed = new Set(access.warehouseIds);
    const items = page.items.filter((item) => allowed.has(item.id));
    return { ...page, items, totalCount: items.length, totalPages: 1, pageNumber: 1, hasNextPage: false };
  },
  stocks: async (request: DropdownPageRequest, branchCode: string): Promise<GridPage<StockOption>> => unwrap(await api.post<Envelope<GridPage<StockOption>>>('/api/erp-mirror/stocks/paged', pagedBody({ ...request, sortBy: request.sortBy ?? 'erpStockCode' }, [{ column: 'branchCode', operator: 'equals', value: branchCode }]), { signal: request.signal })),
  yapCodes: async (request: DropdownPageRequest, branchCode: string): Promise<GridPage<YapCodeOption>> => unwrap(await api.post<Envelope<GridPage<YapCodeOption>>>('/api/erp-mirror/yap-codes/paged', pagedBody({ ...request, sortBy: request.sortBy ?? 'configurationCode' }, [{ column: 'branchCode', operator: 'equals', value: branchCode }]), { signal: request.signal })),
  locations: async (request: DropdownPageRequest, warehouseId: number): Promise<GridPage<LocationOption>> => unwrap(await api.post<Envelope<GridPage<LocationOption>>>('/api/locations/paged', pagedBody({ ...request, sortBy: request.sortBy ?? 'code', filterLogic: 'and' }, [
    { column: 'warehouseId', operator: 'equals', value: String(warehouseId) }, { column: 'isActive', operator: 'equals', value: 'true' },
  ]), { signal: request.signal })),
  /** Mal kabul için yalnızca Receiving/Staging lokasyonları. */
  receivingLocations: async (request: DropdownPageRequest, warehouseId: number): Promise<GridPage<LocationOption>> => {
    const page = await goodsReceiptV2Api.locations({
      ...request,
      pageSize: Math.max(request.pageSize ?? 20, 100),
    }, warehouseId);
    const items = page.items.filter((item) => item.locationType === 'Receiving' || item.locationType === 'Staging');
    return {
      ...page,
      items,
      totalCount: items.length,
      totalPages: 1,
      pageNumber: 1,
      hasNextPage: false,
    };
  },
  putawaySuggestions: async (warehouseId: number, params: { stockId?: number; stockCode?: string; yapCodeId?: number; quantity: number; limit?: number }): Promise<PutawayLocationSuggestion[]> =>
    unwrap(await api.get<Envelope<PutawayLocationSuggestion[]>>('/api/locations/putaway-suggestions', {
      params: { warehouseId, stockId: params.stockId, stockCode: params.stockCode, yapCodeId: params.yapCodeId, quantity: params.quantity, limit: params.limit ?? 5 },
    })),
  series: async (): Promise<SeriesOption[]> => unwrap(await api.get<Envelope<SeriesOption[]>>('/api/document-series/lookup?documentType=GoodsReceipt')),
  transferSeries: async (): Promise<SeriesOption[]> => unwrap(await api.get<Envelope<SeriesOption[]>>('/api/document-series/lookup?documentType=InterWarehouseTransfer')),
  outboundSeries: async (): Promise<SeriesOption[]> => unwrap(await api.get<Envelope<SeriesOption[]>>('/api/document-series/lookup?documentType=WarehouseIssue')),
  orderHeaders: async (params: {
    branchCode: string;
    customerCode?: string;
    orderNumber?: string;
    projectCode?: string;
  }): Promise<OpenOrderHeader[]> => {
    const query = new URLSearchParams({ branchCode: params.branchCode });
    if (params.customerCode?.trim()) query.set('customerCode', params.customerCode.trim());
    if (params.orderNumber?.trim()) query.set('orderNumber', params.orderNumber.trim());
    if (params.projectCode?.trim()) query.set('projectCode', params.projectCode.trim());
    return unwrap(await api.get<Envelope<OpenOrderHeader[]>>(`/api/netsis-read/goods-receipt/open-orders/headers?${query}`));
  },
  orderLines: async (
    customerCode: string | undefined,
    branchCode: string,
    orderNumbers: string[],
    includeUnavailable = false,
  ): Promise<OpenOrderLine[]> => {
    const query = new URLSearchParams({
      branchCode,
      includeUnavailable: String(includeUnavailable),
    });
    if (customerCode?.trim()) query.set('customerCode', customerCode.trim());
    if (orderNumbers.length > 0) query.set('orderNumbersCsv', orderNumbers.join(','));
    return unwrap(
      await api.get<Envelope<OpenOrderLine[]>>(
        `/api/netsis-read/goods-receipt/open-orders/lines?${query}`,
      ),
    );
  },
  create: async (payload: unknown): Promise<CreateGoodsReceiptResult> => unwrap(await api.post<Envelope<CreateGoodsReceiptResult>>('/api/goods-receipts/from-orders', payload)),
  createOrderless: async (payload: unknown): Promise<ManualGoodsReceiptResult> => unwrap(await api.post<Envelope<ManualGoodsReceiptResult>>('/api/goods-receipts/orderless', payload)),
  createDirect: async (payload: unknown): Promise<ManualGoodsReceiptResult> => unwrap(await api.post<Envelope<ManualGoodsReceiptResult>>('/api/goods-receipts/direct', payload)),
  paged: async (request: GridRequest): Promise<AdvancedGridPage<GoodsReceiptGridRow>> => {
    const page = normalizeGridPage<GoodsReceiptGridRow>(
      unwrap(await api.post<Envelope<AdvancedGridPage<GoodsReceiptGridRow>>>('/api/goods-receipts/paged', request)),
    );
    const items = page.items.map((row) => normalizeGoodsReceiptWaybillFields(row));
    return { ...page, items, data: items };
  },
  detail: async (id: number): Promise<GoodsReceiptDetail> => {
    const detail = unwrap(await api.get<Envelope<GoodsReceiptDetail & Record<string, unknown>>>(`/api/goods-receipts/${id}`));
    return {
      ...detail,
      header: normalizeGoodsReceiptWaybillFields(detail.header),
      routes: readDetailRoutes(detail),
    };
  },
  listRoutes: async (id: number): Promise<GoodsReceiptRoutingResult[]> => {
    try {
      const data = unwrap(
        await api.get<Envelope<unknown>>(`/api/goods-receipts/${id}/routes`),
      );
      return normalizeGoodsReceiptRoutes(data);
    } catch (error) {
      if (axios.isAxiosError(error) && (error.response?.status === 404 || error.response?.status === 405)) {
        return [];
      }
      // Envelope success:false / network — yönlendirme özeti için sessiz fallback
      return [];
    }
  },
  erpPosting: async (id: number): Promise<ErpPostingResult> =>
    unwrap(await api.get<Envelope<ErpPostingResult>>(`/api/erp-postings/GoodsReceipt/${id}`)),
  testErpLogin: async (): Promise<boolean> =>
    unwrap(await api.post<Envelope<boolean>>('/api/erp-integration/test-login', {})),
  reconcileErpNotFound: async (id: number, reason: string): Promise<ErpPostingResult> =>
    unwrap(await api.post<Envelope<ErpPostingResult>>(`/api/erp-postings/GoodsReceipt/${id}/reconcile`, {
      erpDocumentExists: false,
      reason,
    })),
  postErp: async (id: number): Promise<ErpPostingResult> =>
    unwrap(await api.post<Envelope<ErpPostingResult>>(`/api/goods-receipts/${id}/erp/post`, {
      idempotencyKey: crypto.randomUUID(),
    })),
  routeToTransfer: async (id: number, payload: unknown): Promise<GoodsReceiptRoutingResult> => unwrap(await api.post<Envelope<GoodsReceiptRoutingResult>>(`/api/goods-receipts/${id}/routes/warehouse-transfer`, payload)),
  routeToOutbound: async (id: number, payload: unknown): Promise<GoodsReceiptRoutingResult> => unwrap(await api.post<Envelope<GoodsReceiptRoutingResult>>(`/api/goods-receipts/${id}/routes/warehouse-outbound`, payload)),
  routeSplit: async (id: number, payload: unknown): Promise<GoodsReceiptSplitRoutingResult> => unwrap(await api.post<Envelope<GoodsReceiptSplitRoutingResult>>(`/api/goods-receipts/${id}/routes/split`, payload)),
  approve: async (id: number, payload: { idempotencyKey: string; rowVersion: string; reason?: string }): Promise<GoodsReceiptLifecycleResult> =>
    unwrap(await api.post<Envelope<GoodsReceiptLifecycleResult>>(`/api/goods-receipts/${id}/approve`, payload)),
  shortClose: async (id: number, payload: { idempotencyKey: string; rowVersion: string; reason: string; lines: Array<{ lineId: number; quantity: number }> }): Promise<GoodsReceiptLifecycleResult> =>
    unwrap(await api.post<Envelope<GoodsReceiptLifecycleResult>>(`/api/goods-receipts/${id}/short-close`, payload)),
  putaway: async (id: number, payload: { idempotencyKey: string; rowVersion: string; reason?: string; occurredAtUtc?: string; lines: Array<{ lineId: number; quantity: number; sourceLocationId: number; targetLocationId: number; lotNo?: string; serialNo?: string }> }): Promise<GoodsReceiptLifecycleResult> =>
    unwrap(await api.post<Envelope<GoodsReceiptLifecycleResult>>(`/api/goods-receipts/${id}/putaway`, payload)),
  cancel: async (id: number, payload: { idempotencyKey: string; rowVersion: string; reason: string }): Promise<OperationCancellationResult> =>
    unwrap(await api.post<Envelope<OperationCancellationResult>>(`/api/goods-receipts/${id}/cancel`, payload)),
  tasksPaged: async (request: GridRequest): Promise<AdvancedGridPage<GoodsReceiptTaskGridRow>> => unwrap(await api.post<Envelope<AdvancedGridPage<GoodsReceiptTaskGridRow>>>('/api/goods-receipts/tasks/paged', request)),
  myTasksPaged: async (request: GridRequest): Promise<AdvancedGridPage<GoodsReceiptTaskGridRow>> => unwrap(await api.post<Envelope<AdvancedGridPage<GoodsReceiptTaskGridRow>>>('/api/goods-receipts/tasks/assigned/paged', request)),
  taskDetail: async (id: number): Promise<GoodsReceiptTaskDetail> => unwrap(await api.get<Envelope<GoodsReceiptTaskDetail>>(`/api/goods-receipts/tasks/${id}`)),
  replaceTaskAssignments: async (id: number, userIds: number[], rowVersion: string): Promise<GoodsReceiptTaskDetail> => unwrap(await api.put<Envelope<GoodsReceiptTaskDetail>>(`/api/goods-receipts/tasks/${id}/assignments`, { userIds, rowVersion })),
  acceptTask: async (id: number): Promise<GoodsReceiptTaskDetail> => unwrap(await api.post<Envelope<GoodsReceiptTaskDetail>>(`/api/goods-receipts/tasks/${id}/accept`)),
  startTask: async (id: number): Promise<GoodsReceiptTaskDetail> => unwrap(await api.post<Envelope<GoodsReceiptTaskDetail>>(`/api/goods-receipts/tasks/${id}/start`)),
  generateLabels: async (goodsReceiptId:number, taskId:number, lines:Array<{taskLineId:number;labelCount:number;quantityPerLabel?:number}>, description?:string, idempotencyKey:string=crypto.randomUUID()):Promise<GoodsReceiptLabelBatchDetail> => unwrap(await api.post<Envelope<GoodsReceiptLabelBatchDetail>>(`/api/goods-receipts/${goodsReceiptId}/label-batches`, { idempotencyKey, taskId, lines, description })),
  labelBatchesPaged: async (request:GridRequest):Promise<AdvancedGridPage<GoodsReceiptLabelBatchRow>> => unwrap(await api.post<Envelope<AdvancedGridPage<GoodsReceiptLabelBatchRow>>>('/api/goods-receipts/label-batches/paged',request)),
  labelBatch: async (id:number):Promise<GoodsReceiptLabelBatchDetail> => unwrap(await api.get<Envelope<GoodsReceiptLabelBatchDetail>>(`/api/goods-receipts/label-batches/${id}`)),
  receiptLabels: async (id:number,lineId?:number):Promise<GoodsReceiptLabelRow[]> => unwrap(await api.get<Envelope<GoodsReceiptLabelRow[]>>(`/api/goods-receipts/${id}/labels`,{params:{lineId}})),
  markLabelsPrinted: async (labelIds:number[]):Promise<boolean> => unwrap(await api.post<Envelope<boolean>>('/api/goods-receipts/labels/printed',{labelIds})),
  voidLabel: async (id:number,reason:string,rowVersion:string):Promise<boolean> => unwrap(await api.post<Envelope<boolean>>(`/api/goods-receipts/labels/${id}/void`,{reason,rowVersion})),
  receiveTaskScan: async (taskId:number,payload:{idempotencyKey:string;taskLineId:number;barcode:string;quantity?:number;lotNo?:string;serialNo?:string;manufacturingDate?:string;expirationDate?:string;toLocationId?:number;occurredAtUtc?:string;deviceId?:string}):Promise<ReceiveGoodsReceiptTaskResult> => unwrap(await api.post<Envelope<ReceiveGoodsReceiptTaskResult>>(`/api/goods-receipts/tasks/${taskId}/receive`,payload)),
  activeUsersPaged: async (request: DropdownPageRequest): Promise<GridPage<ActiveUserOption>> => unwrap(await api.post<Envelope<GridPage<ActiveUserOption>>>('/api/users/paged', pagedBody({ ...request, sortBy: request.sortBy ?? 'username' }, [{ column: 'isActive', operator: 'equals', value: 'true' }]), { signal: request.signal })),
  activeUsers: async (): Promise<ActiveUserOption[]> => (unwrap(await api.post<Envelope<AdvancedGridPage<ActiveUserOption>>>('/api/users/paged', { pageNumber: 1, pageSize: 500, search: null, sortBy: 'username', sortDirection: 'asc', filterLogic: 'and', filters: [{ column: 'isActive', operator: 'equals', value: 'true' }] }))).items,
};
