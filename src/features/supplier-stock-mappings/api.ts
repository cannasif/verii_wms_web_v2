import type { GridPage, GridRequest } from '@/components/shared/AdvancedDataGrid';
import { api } from '@/lib/axios';
import type { SaveSupplierStockMappingInput, SupplierStockMappingRow } from './types';

interface Envelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

const unwrap = <T,>(value: Envelope<T>): T => {
  if (!value.success) throw new Error(value.message || 'İşlem tamamlanamadı.');
  return value.data;
};

const baseUrl = '/api/goods-receipts/supplier-stock-mappings';

export const supplierStockMappingsApi = {
  paged: async (
    branchCode: string,
    request: GridRequest,
  ): Promise<GridPage<SupplierStockMappingRow>> =>
    unwrap(await api.post<Envelope<GridPage<SupplierStockMappingRow>>>(
      `${baseUrl}/paged`,
      request,
      { params: { branchCode } },
    )),

  create: async (
    input: SaveSupplierStockMappingInput,
  ): Promise<SupplierStockMappingRow> =>
    unwrap(await api.post<Envelope<SupplierStockMappingRow>>(baseUrl, input)),

  update: async (
    id: number,
    input: SaveSupplierStockMappingInput,
  ): Promise<SupplierStockMappingRow> =>
    unwrap(await api.put<Envelope<SupplierStockMappingRow>>(
      `${baseUrl}/${id}`,
      input,
    )),

  delete: async (id: number, branchCode: string): Promise<void> => {
    unwrap(await api.delete<Envelope<boolean>>(
      `${baseUrl}/${id}`,
      { params: { branchCode } },
    ));
  },
};
