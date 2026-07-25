import { api } from '@/lib/axios';

type Envelope<T> = { success: boolean; data: T; message?: string };

export type WarehouseBarcodePurpose = 'Lookup' | 'Inbound' | 'Outbound';

export interface WarehouseBarcodeBalanceCandidate {
  balanceId: number;
  warehouseId: number;
  locationId: number;
  locationCode: string;
  locationName: string;
  stockId: number;
  yapCodeId?: number | null;
  unitCode: string;
  lotNo?: string | null;
  serialNo?: string | null;
  stockStatus: string;
  availableQuantity: number;
}

export interface ResolvedWarehouseBarcode {
  rawBarcode: string;
  source: string;
  stockId: number;
  stockCode: string;
  stockName: string;
  yapCodeId?: number | null;
  yapCode?: string | null;
  quantity?: number | null;
  unitCode: string;
  lotNo?: string | null;
  serialNo?: string | null;
  manufacturingDate?: string | null;
  expirationDate?: string | null;
  requireSerial: boolean;
  requireLot: boolean;
  requireManufacturingDate: boolean;
  requireExpirationDate: boolean;
  missingFields: string[];
  balanceCandidates: WarehouseBarcodeBalanceCandidate[];
  suggestedLocationId?: number | null;
  canExecute: boolean;
}

const unwrap = <T,>(value: Envelope<T>): T => {
  if (!value.success) throw new Error(value.message || 'Barkod çözümlenemedi.');
  return value.data;
};

export const warehouseBarcodeApi = {
  resolve: async (payload: {
    barcode: string;
    branchCode: string;
    purpose: WarehouseBarcodePurpose;
    warehouseId?: number | null;
    expectedStockId?: number | null;
  }): Promise<ResolvedWarehouseBarcode> =>
    unwrap(await api.post<Envelope<ResolvedWarehouseBarcode>>('/api/barcodes/resolve', payload)),
};
