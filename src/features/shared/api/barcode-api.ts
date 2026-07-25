import { api } from '@/lib/axios';
import type { ApiRequestOptions } from '@/lib/request-utils';
import type { ApiResponse } from '@/types/api';
import type {
  BarcodeDefinitionResponse,
  BarcodeDefinitionsResponse,
  ResolvedBarcodeResponse,
  ResolvedBarcode,
  SaveBarcodeDefinitionRequest,
} from './barcode-types';
import { BarcodeResolutionError } from './barcode-types';

export const barcodeApi = {
  async getDefinitions(options?: ApiRequestOptions): Promise<BarcodeDefinitionsResponse> {
    return await api.get<BarcodeDefinitionsResponse>('/api/Barcode/definitions', options);
  },

  async getDefinition(moduleKey: string, options?: ApiRequestOptions): Promise<BarcodeDefinitionResponse> {
    return await api.get<BarcodeDefinitionResponse>(`/api/Barcode/definitions/${moduleKey}`, options);
  },

  async createDefinition(payload: SaveBarcodeDefinitionRequest, options?: ApiRequestOptions): Promise<BarcodeDefinitionResponse> {
    return await api.post<BarcodeDefinitionResponse>('/api/Barcode/definitions', payload, options);
  },

  async updateDefinition(id: number, payload: SaveBarcodeDefinitionRequest, options?: ApiRequestOptions): Promise<BarcodeDefinitionResponse> {
    return await api.put<BarcodeDefinitionResponse>(`/api/Barcode/definitions/${id}`, payload, options);
  },

  async deleteDefinition(id: number, options?: ApiRequestOptions): Promise<ApiResponse<boolean>> {
    return await api.delete<ApiResponse<boolean>>(`/api/Barcode/definitions/${id}`, options);
  },

  async resolve(
    moduleKey: string,
    barcode: string,
    options?: ApiRequestOptions,
  ): Promise<ResolvedBarcodeResponse> {
    try {
      return await api.post<ResolvedBarcodeResponse>('/api/Barcode/resolve', { moduleKey, barcode }, options);
    } catch (error) {
      const responseData = (error as { response?: { data?: { message?: string; statusCode?: number; data?: ResolvedBarcode } } }).response?.data;
      const resolved = responseData?.data;
      if (responseData?.message) {
        throw new BarcodeResolutionError(responseData.message, {
          statusCode: responseData.statusCode,
          reasonCode: resolved?.reasonCode,
          candidates: resolved?.candidates ?? [],
        });
      }
      throw error;
    }
  },
};

export function toLegacyBarcodeStock(result: ResolvedBarcode) {
  return {
    barkod: result.barcode,
    stokKodu: result.stockCode ?? '',
    stokAdi: result.stockName ?? '',
    depoKodu: null,
    depoAdi: null,
    rafKodu: null,
    yapilandir: '',
    olcuBr: 0,
    olcuAdi: '',
    yapKod: result.yapKod ?? null,
    yapAcik: result.yapAcik ?? null,
    cevrim: 0,
    seriBarkodMu: Boolean(result.serialNumber),
    sktVarmi: null,
    isemriNo: null,
  };
}
