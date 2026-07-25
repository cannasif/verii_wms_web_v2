import { api } from '@/lib/axios';
import { buildPagedRequest } from '@/lib/paged';
import { fetchAllPagedData } from '@/lib/fetch-all-paged-data';
import { getLocalizedText } from '@/lib/localized-error';
import { barcodeApi, toLegacyBarcodeStock } from '@/features/shared/api/barcode-api';
import type { ApiResponse, PagedParams, PagedResponse } from '@/types/api';
import type {
  Order,
  OrderItem,
  GoodsReceiptFormData,
  SelectedOrderItem,
  SelectedStockItem,
  GrHeader,
  GrLine,
  GrImportLine,
  CollectedBarcodeItem,
  AssignedGrOrderLinesResponse,
  StokBarcodeResponse,
  AddBarcodeRequest,
  AddBarcodeResponse,
  CollectedBarcodesResponse,
  CreateGrPreReceiptLabelBatchRequest,
  GrPreReceiptLabel,
  GrPreReceiptLabelBatch,
  StartGoodsReceiptFromScannedLabelsRequest,
} from '../types/goods-receipt';
import { lookupApi } from '@/features/shared/api/lookup-api';
import {
  buildGoodsReceiptGenerateOrderRequest,
  buildGoodsReceiptProcessRequest,
} from '../utils/goods-receipt-create';
import type { ApiRequestOptions } from '@/lib/request-utils';

export const goodsReceiptApi = {
  getCustomers: lookupApi.getCustomers,
  getProjects: lookupApi.getProjects,
  getWarehouses: lookupApi.getWarehouses,
  getProducts: lookupApi.getProducts,

  // RII_FN-backed source: keep this as a full-read function call, not a fake server-paged lookup.
  getOrdersByCustomer: async (customerCode: string, options?: ApiRequestOptions): Promise<Order[]> => {
    const response = await api.get<ApiResponse<Order[]>>(`/api/GoodReciptFunctions/headers/customer/${customerCode}`, options);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || getLocalizedText('common.errors.goodsReceiptOrdersLoadFailed'));
  },

  // RII_FN-backed source: item loading remains function-based and should not be wrapped as true API paging.
  getOrderItems: async (customerCode: string, siparisNoCsv: string, options?: ApiRequestOptions): Promise<OrderItem[]> => {
    const response = await api.get<ApiResponse<OrderItem[]>>(`/api/GoodReciptFunctions/lines/customer/${customerCode}/orders/${siparisNoCsv}`, options);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || getLocalizedText('common.errors.goodsReceiptOrderItemsLoadFailed'));
  },

  createGoodsReceiptOrder: async (formData: GoodsReceiptFormData, selectedItems: SelectedOrderItem[]): Promise<number> => {
    const request = buildGoodsReceiptGenerateOrderRequest(formData, selectedItems);
    const response = await api.post<ApiResponse<GrHeader>>('/api/GrHeader/generate', request);
    if (response.success) {
      return response.data?.id || 0;
    }
    throw new Error(response.message || getLocalizedText('common.errors.goodsReceiptCreateFailed'));
  },

  createStockBasedGoodsReceiptOrder: async (formData: GoodsReceiptFormData, selectedItems: SelectedStockItem[]): Promise<number> => {
    const request = buildGoodsReceiptGenerateOrderRequest(formData, selectedItems, true);
    const response = await api.post<ApiResponse<GrHeader>>('/api/GrHeader/generate', request);
    if (response.success) {
      return response.data?.id || 0;
    }
    throw new Error(response.message || getLocalizedText('common.errors.goodsReceiptCreateFailed'));
  },

  processGoodsReceipt: async (
    formData: GoodsReceiptFormData,
    selectedItems: Array<SelectedOrderItem | SelectedStockItem>,
    isStockBased: boolean = true,
  ): Promise<number> => {
    const request = buildGoodsReceiptProcessRequest(formData, selectedItems, isStockBased);
    const response = await api.post<ApiResponse<number>>('/api/GrHeader/process', request);
    if (response.success) {
      return response.data || 0;
    }
    throw new Error(response.message || getLocalizedText('common.errors.goodsReceiptCreateFailed'));
  },

  getGrHeadersPaged: async (params: PagedParams = {}, options?: ApiRequestOptions): Promise<PagedResponse<GrHeader>> => {
    const requestBody = buildPagedRequest(params, { pageNumber: 1, sortBy: 'createdDate' });

    const response = await api.post<ApiResponse<PagedResponse<GrHeader>>>('/api/GrHeader/paged', requestBody, options);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || getLocalizedText('common.errors.goodsReceiptHeadersLoadFailed'));
  },

  getGrHeaderById: async (id: number, options?: ApiRequestOptions): Promise<GrHeader> => {
    const response = await api.get<ApiResponse<GrHeader>>(`/api/GrHeader/${id}`, options);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || getLocalizedText('common.errors.goodsReceiptHeaderDetailLoadFailed'));
  },

  updateGoodsReceiptHeader: async (id: number, formData: GoodsReceiptFormData): Promise<ApiResponse<GrHeader>> => {
    return await api.put<ApiResponse<GrHeader>>(`/api/GrHeader/${id}`, {
      documentNo: formData.documentNo,
      documentDate: formData.receiptDate,
      plannedDate: formData.receiptDate,
      projectCode: formData.projectCode || '',
      customerId: formData.customerRefId,
      customerCode: formData.customerId,
      returnCode: false,
      ocrSource: false,
      description1: formData.notes || '',
      description2: '',
      isPlanned: true,
      documentType: 'GR',
      allowLessQuantityBasedOnOrder: formData.allowLessQuantityBasedOnOrder ?? false,
      allowMoreQuantityBasedOnOrder: formData.allowMoreQuantityBasedOnOrder ?? false,
    });
  },

  getGrLines: async (headerId: number, options?: ApiRequestOptions): Promise<GrLine[]> => {
    return fetchAllPagedData({
      fetchPage: async (pageNumber, pageSize) => {
        const response = await api.post<ApiResponse<PagedResponse<GrLine>>>(
          `/api/GrLine/by-header/${headerId}/paged`,
          buildPagedRequest({ pageNumber, pageSize, sortBy: 'Id', sortDirection: 'asc' }),
          options,
        );
        if (response.success && response.data) return response.data;
        throw new Error(response.message || getLocalizedText('common.errors.goodsReceiptLinesLoadFailed'));
      },
    });
  },

  getGrImportLinesWithRoutes: async (headerId: number, options?: ApiRequestOptions): Promise<GrImportLine[]> => {
    const response = await api.get<ApiResponse<CollectedBarcodeItem[]>>(`/api/GrImportLine/by-header-with-routes/${headerId}`, options);
    if (response.success && response.data) {
      return response.data.map(({ importLine, routes }) => ({
        ...importLine,
        routes,
      }));
    }
    throw new Error(response.message || getLocalizedText('common.errors.goodsReceiptImportLinesLoadFailed'));
  },

  getAssignedHeaders: async (userId: number, params: PagedParams = {}, options?: ApiRequestOptions): Promise<PagedResponse<GrHeader>> => {
    const response = await api.post<ApiResponse<PagedResponse<GrHeader>>>(
      `/api/GrHeader/assigned/${userId}/paged`,
      buildPagedRequest(params, { pageNumber: 1, sortBy: 'Id', sortDirection: 'desc' }),
      options,
    );
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || getLocalizedText('common.errors.goodsReceiptAssignedHeadersLoadFailed'));
  },

  getAwaitingApprovalHeaders: async (params: PagedParams = {}, options?: ApiRequestOptions): Promise<PagedResponse<GrHeader>> => {
    const response = await api.post<ApiResponse<PagedResponse<GrHeader>>>(
      '/api/GrHeader/completed-awaiting-erp-approval',
      buildPagedRequest(params, { pageNumber: 1, sortBy: 'Id', sortDirection: 'desc' }),
      options,
    );
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || getLocalizedText('common.errors.goodsReceiptApprovalLoadFailed'));
  },

  approveGoodsReceipt: async (id: number, approved: boolean): Promise<ApiResponse<unknown>> => {
    return await api.post<ApiResponse<unknown>>(`/api/GrHeader/approval/${id}`, null, {
      params: { approved, id },
    });
  },

  getAssignedOrderLines: async (headerId: number, options?: ApiRequestOptions): Promise<AssignedGrOrderLinesResponse> => {
    return await api.get<AssignedGrOrderLinesResponse>(`/api/GrHeader/assigned-lines/${headerId}`, options);
  },

  getStokBarcode: async (barcode: string, options?: ApiRequestOptions): Promise<StokBarcodeResponse> => {
    const response = await barcodeApi.resolve('goods-receipt-assigned', barcode, options);
    return {
      ...response,
      data: response.success && response.data ? [toLegacyBarcodeStock(response.data)] : [],
    };
  },

  addBarcodeToOrder: async (request: AddBarcodeRequest): Promise<AddBarcodeResponse> => {
    return await api.post<AddBarcodeResponse>('/api/GrImportLine/addBarcodeBasedonAssignedOrder', request);
  },

  getCollectedBarcodes: async (headerId: number, options?: ApiRequestOptions): Promise<CollectedBarcodesResponse> => {
    return await api.get<CollectedBarcodesResponse>(`/api/GrImportLine/goodReceiptOrderCollectedBarcodes/${headerId}`, options);
  },

  completeGoodsReceipt: async (headerId: number): Promise<ApiResponse<unknown>> => {
    return await api.post<ApiResponse<unknown>>(`/api/GrHeader/complete/${headerId}`);
  },

  deleteGoodsReceiptHeader: async (id: number): Promise<ApiResponse<boolean>> => {
    return await api.delete<ApiResponse<boolean>>(`/api/GrHeader/${id}`);
  },

  getPreReceiptLabelBatchesPaged: async (params: PagedParams = {}, options?: ApiRequestOptions): Promise<PagedResponse<GrPreReceiptLabelBatch>> => {
    const response = await api.post<ApiResponse<PagedResponse<GrPreReceiptLabelBatch>>>(
      '/api/GrPreReceiptLabel/paged',
      buildPagedRequest(params, { pageNumber: 1, sortBy: 'Id', sortDirection: 'desc' }),
      options,
    );
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || getLocalizedText('common.errors.goodsReceiptHeadersLoadFailed'));
  },

  getPreReceiptLabelsByBatchId: async (batchId: number, options?: ApiRequestOptions): Promise<GrPreReceiptLabel[]> => {
    const response = await api.get<ApiResponse<GrPreReceiptLabel[]>>(`/api/GrPreReceiptLabel/batches/${batchId}/labels`, options);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || getLocalizedText('common.errors.goodsReceiptLinesLoadFailed'));
  },

  getPreReceiptLabelsByOrder: async (siparisNo: string, options?: ApiRequestOptions): Promise<GrPreReceiptLabel[]> => {
    const response = await api.get<ApiResponse<GrPreReceiptLabel[]>>(`/api/GrPreReceiptLabel/orders/${encodeURIComponent(siparisNo)}/labels`, options);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || getLocalizedText('common.errors.goodsReceiptLinesLoadFailed'));
  },

  createPreReceiptLabelBatch: async (request: CreateGrPreReceiptLabelBatchRequest): Promise<GrPreReceiptLabelBatch> => {
    const response = await api.post<ApiResponse<GrPreReceiptLabelBatch>>('/api/GrPreReceiptLabel/batches', request);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || getLocalizedText('common.errors.goodsReceiptCreateFailed'));
  },

  startGoodsReceiptFromPreReceiptBatch: async (batchId: number): Promise<number> => {
    const response = await api.post<ApiResponse<number>>(`/api/GrPreReceiptLabel/batches/${batchId}/start-goods-receipt`);
    if (response.success && typeof response.data === 'number') {
      return response.data;
    }
    throw new Error(response.message || getLocalizedText('common.errors.goodsReceiptCreateFailed'));
  },

  startGoodsReceiptFromScannedPreReceiptLabels: async (batchId: number, request: StartGoodsReceiptFromScannedLabelsRequest): Promise<number> => {
    const response = await api.post<ApiResponse<number>>(`/api/GrPreReceiptLabel/batches/${batchId}/start-goods-receipt-from-scans`, request);
    if (response.success && typeof response.data === 'number') {
      return response.data;
    }
    throw new Error(response.message || getLocalizedText('common.errors.goodsReceiptCreateFailed'));
  },

  markPreReceiptLabelsPrinted: async (labelIds: number[]): Promise<ApiResponse<boolean>> => {
    return await api.post<ApiResponse<boolean>>('/api/GrPreReceiptLabel/labels/mark-printed', { labelIds });
  },

  voidPreReceiptLabel: async (labelId: number, reason: string): Promise<ApiResponse<boolean>> => {
    return await api.post<ApiResponse<boolean>>(`/api/GrPreReceiptLabel/labels/${labelId}/void`, { reason });
  },
};
