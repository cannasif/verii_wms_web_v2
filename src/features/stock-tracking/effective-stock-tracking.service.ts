import { api } from '@/lib/axios';

export type StockTrackingType = 'None' | 'Lot' | 'Serial' | 'LotAndSerial';

export interface EffectiveStockTrackingPolicy {
  stockId: number;
  stockCode: string;
  stockGroupCode?: string | null;
  trackingType: StockTrackingType;
  requireSerial: boolean;
  serialQuantityRule: 'NotApplicable' | 'OneSerialPerLine' | 'OneSerialPerBaseUnit';
  autoGenerateSerials: boolean;
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

interface Envelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

export async function resolveStockTrackingPolicy(
  branchCode: string,
  stockId: number,
): Promise<EffectiveStockTrackingPolicy> {
  const response = await api.get<Envelope<EffectiveStockTrackingPolicy>>(
    '/api/stock-tracking-policies/resolve',
    { params: { branchCode, stockId } },
  );
  if (!response.success) throw new Error(response.message || 'Stok takip politikası alınamadı.');
  return response.data;
}

export function trackingTypeLabel(type: StockTrackingType): string {
  switch (type) {
    case 'Lot': return 'Lot takibi';
    case 'Serial': return 'Seri takibi';
    case 'LotAndSerial': return 'Lot + seri takibi';
    default: return 'Takip yok';
  }
}
