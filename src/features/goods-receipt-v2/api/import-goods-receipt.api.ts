import type { ManualGoodsReceiptResult } from '../types/goods-receipt.types';

type ImportDirectLine = {
  quantity?: number;
};

type ImportDirectPayload = {
  electronicWaybillNo?: string | null;
  waybillNo?: string | null;
  requireQualityControl?: boolean;
  lines?: ImportDirectLine[];
};

function asPayload(value: unknown): ImportDirectPayload {
  return value && typeof value === 'object' ? (value as ImportDirectPayload) : {};
}

/**
 * İthalat mal kabul API iskeleti.
 *
 * SQL FN / backend uçları henüz bağlanmadı. `createDirect` kayıt atmaz;
 * yalnızca devam sonrası kaliteye gönder / irsaliye oluştur ekranının
 * görsel olarak açılması için yerel sonuç döner.
 *
 * Bağlanacak uçlar (örnek):
 * - POST /api/goods-receipts/import (veya FN: ithalat mal kabul oluştur)
 * - kaliteye gönder / doğrudan mal kabulü tamamla aynı payload ile ayrışır
 *   (`requireQualityControl`)
 */
export const importGoodsReceiptApi = {
  createDirect: async (payload: unknown): Promise<ManualGoodsReceiptResult> => {
    const data = asPayload(payload);
    const lines = Array.isArray(data.lines) ? data.lines : [];
    const quantity = lines.reduce((sum, line) => sum + (Number(line.quantity) || 0), 0);
    const documentNo =
      (data.electronicWaybillNo || data.waybillNo || '').trim() || 'ITH-PENDING';

    return {
      id: 0,
      documentNo,
      initiationMode: 'Direct',
      status: data.requireQualityControl ? 'AwaitingQuality' : 'Completed',
      qualityInspectionId: data.requireQualityControl ? 0 : undefined,
      lineCount: lines.length,
      quantity,
      replayed: false,
    };
  },
};
