import type { GoodsReceiptGridRow } from '../types/goods-receipt.types';
import { goodsReceiptV2Api } from '../api/goods-receipt.api';
import {
  normalizeGoodsReceiptWaybillFields,
  resolveGoodsReceiptWaybillNo,
} from './goods-receipt-waybill';

const waybillById = new Map<number, string>();
let detailHasNoWaybill = false;

function applyKnownWaybill(row: GoodsReceiptGridRow): GoodsReceiptGridRow {
  const resolved = resolveGoodsReceiptWaybillNo(row) || waybillById.get(row.id) || '';
  if (!resolved) return normalizeGoodsReceiptWaybillFields(row);
  waybillById.set(row.id, resolved);
  return normalizeGoodsReceiptWaybillFields({
    ...row,
    waybillNo: row.waybillNo || resolved,
  });
}

async function mapPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let index = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      await worker(current);
    }
  });
  await Promise.all(runners);
}

/**
 * Liste DTO irsaliye alanını boş bırakıyorsa detaydan tamamlar.
 * Detayda da yoksa aynı oturumda tekrar denemez.
 */
export async function enrichGoodsReceiptListWaybills(
  rows: GoodsReceiptGridRow[],
): Promise<GoodsReceiptGridRow[]> {
  if (!rows.length) return rows;

  const withKnown = rows.map(applyKnownWaybill);
  if (detailHasNoWaybill) return withKnown;

  const missing = withKnown.filter((row) => !resolveGoodsReceiptWaybillNo(row));
  if (!missing.length) return withKnown;

  const probe = missing[0];
  try {
    const detail = await goodsReceiptV2Api.detail(probe.id);
    const waybill = resolveGoodsReceiptWaybillNo(detail.header);
    if (!waybill) {
      detailHasNoWaybill = true;
      return withKnown;
    }
    waybillById.set(probe.id, waybill);
  } catch {
    return withKnown;
  }

  const remaining = missing.slice(1).filter((row) => !waybillById.has(row.id));
  await mapPool(remaining, 5, async (row) => {
    try {
      const detail = await goodsReceiptV2Api.detail(row.id);
      const waybill = resolveGoodsReceiptWaybillNo(detail.header);
      if (waybill) waybillById.set(row.id, waybill);
    } catch {
      // Satır boş kalır; liste yine açılır.
    }
  });

  return rows.map(applyKnownWaybill);
}
