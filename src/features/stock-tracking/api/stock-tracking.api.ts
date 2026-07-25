import { api } from '@/lib/axios';

type Envelope<T> = { success: boolean; data: T; message?: string };
const unwrap = <T,>(value: Envelope<T>): T => {
  if (!value.success) throw new Error(value.message || 'İşlem başarısız.');
  return value.data;
};

export type TrackingType = 'None' | 'Lot' | 'Serial' | 'LotAndSerial';
export type SerialQuantityRule = 'NotApplicable' | 'OneSerialPerLine' | 'OneSerialPerBaseUnit';

export interface EffectiveStockTrackingPolicy {
  stockId: number;
  stockCode: string;
  stockGroupCode?: string | null;
  trackingType: TrackingType;
  requireSerial: boolean;
  serialQuantityRule: SerialQuantityRule;
  requireLot: boolean;
  requireManufacturingDate: boolean;
  requireExpirationDate: boolean;
  minimumRemainingShelfLifeDays?: number | null;
  hasPolicy: boolean;
  source: string;
  policyId?: number | null;
  policyVersion?: number | null;
  policyCode?: string | null;
}

export interface StockTrackingSettings {
  stockId: number;
  stockCode: string;
  stockName: string;
  branchCode: string;
  stockGroupCode?: string | null;
  trackingType: TrackingType;
  requireSerial: boolean;
  serialQuantityRule: SerialQuantityRule;
  requireLot: boolean;
  requireManufacturingDate: boolean;
  requireExpirationDate: boolean;
  minimumRemainingShelfLifeDays?: number | null;
  hasStockOverride: boolean;
  source: string;
  version?: number | null;
  concurrencyToken?: string | null;
}

export interface UpdateStockTrackingSettingsInput {
  branchCode: string;
  requireSerial: boolean;
  serialQuantityRule: SerialQuantityRule;
  requireLot: boolean;
  requireManufacturingDate: boolean;
  requireExpirationDate: boolean;
  minimumRemainingShelfLifeDays: number | null;
  concurrencyToken: string | null;
}

export const stockTrackingApi = {
  getStockSettings: async (stockId: number, branchCode: string): Promise<StockTrackingSettings> =>
    unwrap(await api.get<Envelope<StockTrackingSettings>>(`/api/stocks/${stockId}/tracking-settings`, {
      params: { branchCode },
    })),
  updateStockSettings: async (
    stockId: number,
    value: UpdateStockTrackingSettingsInput,
  ): Promise<StockTrackingSettings> =>
    unwrap(await api.put<Envelope<StockTrackingSettings>>(`/api/stocks/${stockId}/tracking-settings`, value)),
  resolve: async (branchCode: string, stockId: number): Promise<EffectiveStockTrackingPolicy> =>
    unwrap(await api.get<Envelope<EffectiveStockTrackingPolicy>>('/api/stock-tracking-policies/resolve', {
      params: { branchCode, stockId },
    })),
};
