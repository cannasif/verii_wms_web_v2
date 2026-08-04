import type { SteelLineRow } from '../types/steel-receipt.types';

export interface SteelReceiptPlacementDraft {
  importReferenceNo: string;
  reference: string;
  selectedLineId?: number | null;
  locationId?: string | null;
  search: string;
}

export function hasSteelReceiptPlacementDraft(draft: SteelReceiptPlacementDraft): boolean {
  return Boolean(draft.importReferenceNo.trim()) && (
    draft.selectedLineId != null
    || Boolean(draft.locationId)
    || Boolean(draft.search.trim())
    || Boolean(draft.reference.trim())
  );
}

export type LoadPlacementSourceOptions = {
  silent?: boolean;
  restoreSelectedLineId?: number | null;
  restoreLocationId?: string | null;
  restoreSearch?: string;
};

export function hasPendingPlacementLines(lines: SteelLineRow[]): boolean {
  return lines.length > 0;
}

export function restoreSelectedLine(
  lines: SteelLineRow[],
  selectedLineId?: number | null,
): SteelLineRow | null {
  if (selectedLineId == null) return null;
  return lines.find((line) => line.id === selectedLineId) ?? null;
}
