import { steelReceiptApi } from '../api/steel-receipt.api';
import type { SteelLineRow, SteelReceiptSource } from '../types/steel-receipt.types';

export interface SteelReceiptReceiptDraft {
  importReferenceNo: string;
  reference: string;
  selectedLineIds: number[];
  note: string;
  isElectronic: boolean;
  receiptNo: string;
  documentDate: string;
}

export function hasSteelReceiptReceiptDraft(draft: SteelReceiptReceiptDraft): boolean {
  return Boolean(draft.importReferenceNo.trim()) && (
    draft.selectedLineIds.length > 0
    || Boolean(draft.note.trim())
    || Boolean(draft.receiptNo.trim())
    || Boolean(draft.reference.trim())
  );
}

export type LoadReceiptSourceOptions = {
  preserveResult?: boolean;
  silent?: boolean;
  restoreSelectedIds?: number[];
  keepWaybillFields?: boolean;
};

export function hasPendingReceiptLines(source: SteelReceiptSource): boolean {
  return source.lines.some((line) => line.conversionStatus === 'NotCreated');
}

export function restoreSelectedLines(
  lines: SteelLineRow[],
  selectedLineIds: number[],
  isEligible: (row: SteelLineRow) => boolean,
): Record<number, SteelLineRow> {
  const ids = new Set(selectedLineIds);
  const restored: Record<number, SteelLineRow> = {};
  for (const row of lines) {
    if (ids.has(row.id) && isEligible(row)) {
      restored[row.id] = row;
    }
  }
  return restored;
}

export async function isReceiptSourceStillPending(
  branchCode: string,
  importReferenceNo: string,
): Promise<boolean> {
  const normalized = importReferenceNo.trim();
  if (!normalized) return false;

  const page = await steelReceiptApi.pendingReceiptSourcesPaged({
    pageNumber: 1,
    pageSize: 20,
    search: normalized,
    searchFields: ['importReferenceNo'],
    sortBy: 'importedAtUtc',
    sortDirection: 'desc',
    filterLogic: 'and',
    filters: [{ column: 'branchCode', operator: 'equals', value: branchCode }],
  });

  const items = page.items ?? page.data ?? [];
  return items.some(
    (item) =>
      item.importReferenceNo === normalized
      && item.pendingLineCount > 0,
  );
}
