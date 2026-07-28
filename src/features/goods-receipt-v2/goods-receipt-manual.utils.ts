import type { EffectiveStockTrackingPolicy } from '@/features/stock-tracking/effective-stock-tracking.service';
import type { ManualReceiptLine } from './types/goods-receipt.types';

export function buildManualLineTrackings(
  line: Pick<ManualReceiptLine, 'trackingType' | 'quantity' | 'lotNo' | 'serialNo' | 'manufacturingDate' | 'expirationDate' | 'description'>,
) {
  if (line.trackingType === 'None') return [];
  return [{
    quantity: line.quantity,
    lotNo: line.lotNo?.trim() || null,
    serialNo: line.serialNo?.trim() || null,
    manufacturingDate: line.manufacturingDate || null,
    expirationDate: line.expirationDate || null,
    description: line.description?.trim() || null,
  }];
}

export function validateManualLineTracking(
  line: Pick<ManualReceiptLine, 'stockCode' | 'trackingType' | 'quantity' | 'lotNo' | 'serialNo' | 'manufacturingDate' | 'expirationDate'>,
  policy?: EffectiveStockTrackingPolicy | null,
): string | null {
  const name = line.stockCode;
  if (line.trackingType === 'None') {
    if (line.lotNo?.trim() || line.serialNo?.trim()) return `${name}: takipsiz stokta lot/seri girilemez.`;
    return null;
  }
  const needsSerial = line.trackingType === 'Serial' || line.trackingType === 'LotAndSerial';
  const needsLot = line.trackingType === 'Lot' || line.trackingType === 'LotAndSerial';
  if (needsSerial && !line.serialNo?.trim()) return `${name}: seri numarası zorunludur.`;
  if (needsLot && !line.lotNo?.trim()) return `${name}: lot numarası zorunludur.`;
  if (needsSerial && line.quantity !== 1) return `${name}: seri takipli satırın miktarı 1 olmalıdır.`;
  if (policy?.requireManufacturingDate && !line.manufacturingDate) return `${name}: üretim tarihi zorunludur.`;
  if (policy?.requireExpirationDate && !line.expirationDate) return `${name}: son kullanma tarihi zorunludur.`;
  return null;
}

export function buildOrderlessLinePayload(line: ManualReceiptLine) {
  return {
    stockId: line.stockId,
    yapCodeId: line.yapCodeId ?? null,
    quantity: line.quantity,
    unitCode: line.unitCode,
    trackingType: line.trackingType,
    trackings: buildManualLineTrackings(line),
    lotNo: line.lotNo ?? null,
    serialNo: line.serialNo ?? null,
    manufacturingDate: line.manufacturingDate ?? null,
    expirationDate: line.expirationDate ?? null,
    scannedBarcode: line.scannedBarcode ?? null,
    goodsReceiptLabelId: null,
    description: line.description ?? null,
    targetWarehouseId: line.targetWarehouseId,
    receivingLocationId: line.receivingLocationId,
    sourceOrderNumber: line.sourceOrderNumber ?? null,
    sourceOrderId: line.sourceOrderId ?? null,
  };
}
