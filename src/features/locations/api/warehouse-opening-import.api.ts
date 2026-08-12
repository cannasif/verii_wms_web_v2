import { api } from '@/lib/axios';

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface WarehouseOpeningPreview {
  fileHash: string;
  balanceSnapshotHash: string;
  warehouseCount: number;
  newLocationCount: number;
  existingLocationCount: number;
  balanceRowCount: number;
  distinctStockCount: number;
  serialCount: number;
  totalQuantity: number;
  batchCount: number;
  existingMovementCount: number;
  currentBalanceRowCount: number;
  currentTotalQuantity: number;
  reservedBalanceRowCount: number;
  reservedQuantity: number;
  requiresBalanceReplacement: boolean;
  warnings: string[];
}

export interface WarehouseOpeningImportResult {
  fileHash: string;
  locations: {
    totalRows: number;
    createdRows: number;
    failedRows: number;
  } | null;
  balances: {
    operationId: number;
    operationCode: string;
    isReplay: boolean;
    totalRows: number;
    totalQuantity: number;
    batchCount: number;
    rowsTruncated: boolean;
  };
}

function unwrap<T>(response: ApiEnvelope<T>): T {
  if (!response.success) throw new Error(response.message || 'Depo açılış aktarımı tamamlanamadı.');
  return response.data;
}

function form(file: File): FormData {
  const value = new FormData();
  value.append('file', file);
  return value;
}

export const warehouseOpeningImportApi = {
  downloadTemplate: async (branchCode: string): Promise<Blob> =>
    await api.get<Blob>(
      `/api/warehouse-opening-import/template?branchCode=${encodeURIComponent(branchCode)}`,
      { responseType: 'blob' },
    ),
  preview: async (file: File, branchCode: string): Promise<WarehouseOpeningPreview> =>
    unwrap(await api.post<ApiEnvelope<WarehouseOpeningPreview>>(
      `/api/warehouse-opening-import/preview?branchCode=${encodeURIComponent(branchCode)}`,
      form(file),
    )),
  commit: async (
    file: File,
    branchCode: string,
    previewHash: string,
    idempotencyKey: string,
    replaceExistingBalances: boolean,
    balanceSnapshotHash: string,
  ): Promise<WarehouseOpeningImportResult> =>
    unwrap(await api.post<ApiEnvelope<WarehouseOpeningImportResult>>(
      `/api/warehouse-opening-import/commit?branchCode=${encodeURIComponent(branchCode)}&previewHash=${encodeURIComponent(previewHash)}&idempotencyKey=${encodeURIComponent(idempotencyKey)}&replaceExistingBalances=${replaceExistingBalances}&balanceSnapshotHash=${encodeURIComponent(balanceSnapshotHash)}`,
      form(file),
    )),
};
