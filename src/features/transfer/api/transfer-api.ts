import { api } from '@/lib/axios';
import type {
  TransferOrdersResponse,
  TransferOrderItemsResponse,
  TransferFormData,
  SelectedTransferOrderItem,
  SelectedTransferStockItem,
  TransferHeadersResponse,
  TransferLinesResponse,
  TransferLineSerialsResponse,
  AssignedTransferOrderLinesResponse,
  StokBarcodeResponse,
  AddBarcodeRequest,
  AddBarcodeResponse,
  CollectedBarcodesResponse,
  TransferHeader,
  AwaitingApprovalHeader,
  TransferLine,
  TransferLineSerial,
} from '../types/transfer';
import { buildTransferGenerateRequest, buildTransferProcessRequest } from '../utils/transfer-generate';
import type { ApiResponse, PagedParams, PagedResponse } from '@/types/api';
import { buildPagedRequest } from '@/lib/paged';
import { getLocalizedText } from '@/lib/localized-error';
import { barcodeApi, toLegacyBarcodeStock } from '@/features/shared/api/barcode-api';
import type { ApiRequestOptions } from '@/lib/request-utils';
import { fetchAllPagedData } from '@/lib/fetch-all-paged-data';

function toLegacyCollectionResponse<T>(data: PagedResponse<T> | T[], message: string): ApiResponse<T[]> {
  return {
    success: true,
    message,
    exceptionMessage: '',
    data: Array.isArray(data) ? data : data.data,
    errors: [],
    timestamp: new Date().toISOString(),
    statusCode: 200,
    className: 'ApiResponse',
  };
}

async function getAllPagedData<T>(url: string, options: ApiRequestOptions | undefined, errorKey: string): Promise<T[]> {
  return fetchAllPagedData({
    fetchPage: async (pageNumber, pageSize) => {
      const response = await api.post<ApiResponse<PagedResponse<T>>>(url, buildPagedRequest({ pageNumber, pageSize, sortBy: 'Id', sortDirection: 'asc' }), options);
      if (response.success && response.data) return response.data;
      throw new Error(response.message || getLocalizedText(errorKey));
    },
  });
}

export const transferApi = {
  // RII_FN-backed source: keep order header lookup as full-read and let UI handle client slicing if needed.
  getOrdersByCustomer: async (customerCode: string, options?: ApiRequestOptions): Promise<TransferOrdersResponse> => {
    return await api.get<TransferOrdersResponse>(`/api/WtFunction/headers/${customerCode}`, options);
  },

  // RII_FN-backed source: do not model this as true server paging.
  getOrderItems: async (orderNumbers: string, options?: ApiRequestOptions): Promise<TransferOrderItemsResponse> => {
    return await api.get<TransferOrderItemsResponse>(`/api/WtFunction/lines/${orderNumbers}`, options);
  },

  getAssignedHeaders: async (userId: number, params: PagedParams = {}, options?: ApiRequestOptions): Promise<PagedResponse<TransferHeader>> => {
    const requestBody = buildPagedRequest(params, {
      pageNumber: 1,
      sortBy: 'Id',
      sortDirection: 'desc',
    });

    const response = await api.post<ApiResponse<PagedResponse<TransferHeader>>>(
      `/api/WtHeader/assigned/${userId}/paged`,
      requestBody,
      options,
    );
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || getLocalizedText('common.errors.transferAssignedHeadersLoadFailed'));
  },

  getAssignedOrderLines: async (headerId: number, options?: ApiRequestOptions): Promise<AssignedTransferOrderLinesResponse> => {
    return await api.get<AssignedTransferOrderLinesResponse>(`/api/WtHeader/getAssignedTransferOrderLines/${headerId}`, options);
  },

  createTransferOrder: async (
    formData: TransferFormData,
    selectedItems: SelectedTransferOrderItem[],
  ): Promise<ApiResponse<unknown>> => {
    const request = buildTransferGenerateRequest(formData, selectedItems);
    return await api.post<ApiResponse<unknown>>('/api/WtHeader/generate', request);
  },

  createStockBasedTransferOrder: async (
    formData: TransferFormData,
    selectedItems: SelectedTransferStockItem[],
  ): Promise<ApiResponse<unknown>> => {
    const request = buildTransferGenerateRequest(formData, selectedItems, true);
    return await api.post<ApiResponse<unknown>>('/api/WtHeader/generate', request);
  },

  processTransfer: async (
    formData: TransferFormData,
    selectedItems: SelectedTransferStockItem[],
  ): Promise<ApiResponse<unknown>> => {
    const request = buildTransferProcessRequest(formData, selectedItems);
    return await api.post<ApiResponse<unknown>>('/api/WtHeader/process', request);
  },

  getHeaders: async (options?: ApiRequestOptions): Promise<TransferHeadersResponse> => {
    const data = await transferApi.getHeadersPaged({}, options);
    return toLegacyCollectionResponse(data, getLocalizedText('transfer.api.headersLoaded'));
  },

  getHeadersPaged: async (params: PagedParams = {}, options?: ApiRequestOptions): Promise<PagedResponse<TransferHeader>> => {
    const requestBody = buildPagedRequest(params);

    const response = await api.post<ApiResponse<PagedResponse<TransferHeader>>>('/api/WtHeader/paged', requestBody, options);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || getLocalizedText('common.errors.transferHeadersLoadFailed'));
  },

  getHeaderById: async (id: number, options?: ApiRequestOptions): Promise<TransferHeader> => {
    const response = await api.get<ApiResponse<TransferHeader>>(`/api/WtHeader/${id}`, options);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || getLocalizedText('common.errors.transferHeaderDetailLoadFailed'));
  },

  updateTransferHeader: async (id: number, formData: TransferFormData, type: number): Promise<ApiResponse<TransferHeader>> => {
    return await api.put<ApiResponse<TransferHeader>>(`/api/WtHeader/${id}`, {
      documentNo: formData.documentNo,
      documentDate: formData.transferDate,
      plannedDate: formData.transferDate,
      projectCode: formData.projectCode || '',
      customerId: formData.customerRefId,
      customerCode: formData.customerId || '',
      sourceWarehouseId: formData.sourceWarehouseId,
      sourceWarehouse: formData.sourceWarehouse || '',
      targetWarehouseId: formData.targetWarehouseId,
      targetWarehouse: formData.targetWarehouse || '',
      description1: formData.notes || '',
      description2: '',
      isPlanned: true,
      documentType: 'WT',
      type,
      allowLessQuantityBasedOnOrder: formData.allowLessQuantityBasedOnOrder ?? false,
      allowMoreQuantityBasedOnOrder: formData.allowMoreQuantityBasedOnOrder ?? false,
    });
  },

  getLines: async (headerId: number, options?: ApiRequestOptions): Promise<TransferLinesResponse> => {
    const data = await getAllPagedData<TransferLine>(`/api/WtLine/header/${headerId}/paged`, options, 'common.errors.transferLinesLoadFailed');
    return toLegacyCollectionResponse(data, getLocalizedText('transfer.api.linesLoaded'));
  },

  getLineSerials: async (lineId: number, options?: ApiRequestOptions): Promise<TransferLineSerialsResponse> => {
    const data = await getAllPagedData<TransferLineSerial>(`/api/WtLineSerial/line/${lineId}/paged`, options, 'common.errors.transferSerialsLoadFailed');
    return toLegacyCollectionResponse(data, getLocalizedText('transfer.api.serialsLoaded'));
  },

  getStokBarcode: async (barcode: string, options?: ApiRequestOptions): Promise<StokBarcodeResponse> => {
    const response = await barcodeApi.resolve('warehouse-transfer-assigned', barcode, options);
    return {
      ...response,
      data: response.success && response.data ? [toLegacyBarcodeStock(response.data)] : [],
    };
  },

  addBarcodeToOrder: async (request: AddBarcodeRequest): Promise<AddBarcodeResponse> => {
    return await api.post<AddBarcodeResponse>('/api/WtImportLine/addBarcodeBasedonAssignedOrder', request);
  },

  getCollectedBarcodes: async (headerId: number, options?: ApiRequestOptions): Promise<CollectedBarcodesResponse> => {
    return await api.get<CollectedBarcodesResponse>(`/api/WtImportLine/warehouseTransferOrderCollectedBarcodes/${headerId}`, options);
  },

  deleteRoute: async (routeId: number): Promise<ApiResponse<boolean>> => {
    return await api.delete<ApiResponse<boolean>>(`/api/WtRoute/${routeId}`);
  },

  completeTransfer: async (headerId: number): Promise<ApiResponse<unknown>> => {
    return await api.post<ApiResponse<unknown>>(`/api/WtHeader/complete/${headerId}`);
  },

  getAwaitingApprovalHeaders: async (params: PagedParams = {}, options?: ApiRequestOptions): Promise<PagedResponse<AwaitingApprovalHeader>> => {
    const requestBody = buildPagedRequest(params);

    const response = await api.post<ApiResponse<PagedResponse<AwaitingApprovalHeader>>>(
      '/api/WtHeader/completed-awaiting-erp-approval',
      requestBody,
      options,
    );
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || getLocalizedText('common.errors.transferApprovalLoadFailed'));
  },

  approveTransfer: async (id: number, approved: boolean): Promise<ApiResponse<unknown>> => {
    return await api.post<ApiResponse<unknown>>(`/api/WtHeader/approval/${id}`, null, {
      params: { approved, id },
    });
  },

  deleteTransferHeader: async (id: number): Promise<ApiResponse<boolean>> => {
    return await api.delete<ApiResponse<boolean>>(`/api/WtHeader/${id}`);
  },
};
