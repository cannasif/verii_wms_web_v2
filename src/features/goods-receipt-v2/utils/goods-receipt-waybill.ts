import type { GoodsReceiptGridRow } from '../types/goods-receipt.types';

type WaybillSource = object | null | undefined;

const ELECTRONIC_KEYS = [
  'electronicWaybillNo',
  'ElectronicWaybillNo',
  'eWaybillNo',
  'EWaybillNo',
  'gibWaybillNo',
  'GibWaybillNo',
] as const;

const REGULAR_KEYS = [
  'waybillNo',
  'WaybillNo',
  'sourceWaybillNo',
  'SourceWaybillNo',
] as const;

export type GoodsReceiptWaybillReference = {
  number: string;
  kind: 'electronic' | 'regular';
};

function asTrimmed(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function asRecord(row: object): Record<string, unknown> {
  return row as Record<string, unknown>;
}

function firstValue(record: Record<string, unknown>, keys: readonly string[]): string {
  for (const key of keys) {
    const value = asTrimmed(record[key]);
    if (value) return value;
  }
  return '';
}

/** Kullanıcıya gösterilecek irsaliye numarasını ve normal/e-irsaliye türünü çözer. */
export function resolveGoodsReceiptWaybillReference(
  row: WaybillSource,
): GoodsReceiptWaybillReference | null {
  if (!row || typeof row !== 'object') return null;
  const record = asRecord(row);

  const electronic = firstValue(record, ELECTRONIC_KEYS);
  if (electronic) return { number: electronic, kind: 'electronic' };

  const regular = firstValue(record, REGULAR_KEYS);
  if (regular) return { number: regular, kind: 'regular' };

  for (const [key, value] of Object.entries(record)) {
    if (!/waybill/i.test(key) || /date/i.test(key) || /status/i.test(key)) continue;
    const text = asTrimmed(value);
    if (text) {
      return {
        number: text,
        kind: /electronic|eWaybill|gib/i.test(key) ? 'electronic' : 'regular',
      };
    }
  }

  return null;
}

/** Liste/detay satırından kullanıcıya gösterilecek irsaliye numarasını döndürür. */
export function resolveGoodsReceiptWaybillNo(row: WaybillSource): string {
  return resolveGoodsReceiptWaybillReference(row)?.number ?? '';
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
