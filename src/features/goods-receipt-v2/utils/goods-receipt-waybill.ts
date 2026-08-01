import type { GoodsReceiptGridRow } from '../types/goods-receipt.types';

type WaybillSource = object | null | undefined;

const PREFERRED_KEYS = [
  'electronicWaybillNo',
  'ElectronicWaybillNo',
  'eWaybillNo',
  'EWaybillNo',
  'gibWaybillNo',
  'GibWaybillNo',
  'waybillNo',
  'WaybillNo',
  'sourceWaybillNo',
  'SourceWaybillNo',
] as const;

function asTrimmed(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function asRecord(row: object): Record<string, unknown> {
  return row as Record<string, unknown>;
}

/** Liste/detay satırından irsaliye no — waybill / e-waybill hangisi doluysa o. */
export function resolveGoodsReceiptWaybillNo(row: WaybillSource): string {
  if (!row || typeof row !== 'object') return '';
  const record = asRecord(row);

  for (const key of PREFERRED_KEYS) {
    const value = asTrimmed(record[key]);
    if (value) return value;
  }

  for (const [key, value] of Object.entries(record)) {
    if (!/waybill/i.test(key) || /date/i.test(key) || /status/i.test(key)) continue;
    const text = asTrimmed(value);
    if (text) return text;
  }

  return '';
}

/** API satırındaki PascalCase / camelCase irsaliye alanlarını normalize eder. */
export function normalizeGoodsReceiptWaybillFields<T extends object>(
  row: T,
): T & Pick<GoodsReceiptGridRow, 'waybillNo' | 'electronicWaybillNo'> {
  const record = asRecord(row);
  const resolved = resolveGoodsReceiptWaybillNo(row);
  const waybillNo = asTrimmed(record.waybillNo) || asTrimmed(record.WaybillNo) || null;
  const electronicWaybillNo =
    asTrimmed(record.electronicWaybillNo) || asTrimmed(record.ElectronicWaybillNo) || null;
  return {
    ...row,
    waybillNo: waybillNo || resolved || null,
    electronicWaybillNo,
  };
}
