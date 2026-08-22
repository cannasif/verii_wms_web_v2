import type { SteelLineRow } from '../types/steel-receipt.types';

export interface SteelReceiptPlacementDraft {
  importReferenceNo: string;
  reference: string;
  selectedLineId?: number | null;
  selectedLineIds?: number[];
  locationId?: string | null;
  search: string;
}

export function hasSteelReceiptPlacementDraft(draft: SteelReceiptPlacementDraft): boolean {
  return Boolean(draft.importReferenceNo.trim()) && (
    draft.selectedLineId != null
    || Boolean(draft.selectedLineIds?.length)
    || Boolean(draft.locationId)
    || Boolean(draft.search.trim())
    || Boolean(draft.reference.trim())
  );
}

export type LoadPlacementSourceOptions = {
  silent?: boolean;
  restoreSelectedLineId?: number | null;
  restoreSelectedLineIds?: number[];
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
  const restored = restoreSelectedLines(lines, selectedLineId == null ? [] : [selectedLineId]);
  return restored[0] ?? null;
}

export function restoreSelectedLines(
  lines: SteelLineRow[],
  selectedLineIds?: number[] | null,
  selectedLineId?: number | null,
): SteelLineRow[] {
  const ids = selectedLineIds?.length
    ? selectedLineIds
    : selectedLineId != null ? [selectedLineId] : [];
  const byId = new Map(lines.map((line) => [line.id, line]));
  return ids.flatMap((id) => {
    const line = byId.get(id);
    return line ? [line] : [];
  });
}

export function togglePlacementSheetSelection(
  current: SteelLineRow[],
  row: SteelLineRow,
): SteelLineRow[] {
  if (current.some((item) => item.id === row.id)) {
    return current.filter((item) => item.id !== row.id);
  }
  return [...current, row];
}

export function keepPendingPlacementSelection(
  current: SteelLineRow[],
  pendingLines: SteelLineRow[],
): SteelLineRow[] {
  const byId = new Map(pendingLines.map((line) => [line.id, line]));
  return current.flatMap((row) => {
    const line = byId.get(row.id);
    return line ? [line] : [];
  });
}

export function areAllPlacementSheetsSelected(
  current: SteelLineRow[],
  visibleLines: SteelLineRow[],
): boolean {
  return visibleLines.length > 0 && visibleLines.every((row) => current.some((item) => item.id === row.id));
}

export function compatiblePlacementSheetsForSelection(
  current: SteelLineRow[],
  visibleLines: SteelLineRow[],
  resolveWarehouseId: (row: SteelLineRow) => number,
  preferredWarehouseId = 0,
): SteelLineRow[] {
  if (!visibleLines.length) return [];
  const anchorWarehouse = (current[0] ? resolveWarehouseId(current[0]) : 0)
    || (current.length ? preferredWarehouseId : 0)
    || visibleLines.map(resolveWarehouseId).find((id) => id > 0)
    || 0;
  return visibleLines.filter((row) => {
    const warehouse = resolveWarehouseId(row);
    return !(anchorWarehouse > 0 && warehouse > 0 && warehouse !== anchorWarehouse);
  });
}

export function toggleAllPlacementSheetSelection(
  current: SteelLineRow[],
  visibleLines: SteelLineRow[],
  resolveWarehouseId: (row: SteelLineRow) => number,
  preferredWarehouseId = 0,
): { selected: SteelLineRow[]; skippedWarehouseMismatch: boolean } {
  const compatible = compatiblePlacementSheetsForSelection(
    current,
    visibleLines,
    resolveWarehouseId,
    preferredWarehouseId,
  );
  if (!compatible.length) {
    return { selected: current, skippedWarehouseMismatch: visibleLines.length > 0 };
  }

  if (areAllPlacementSheetsSelected(current, compatible)) {
    const compatibleIds = new Set(compatible.map((row) => row.id));
    return {
      selected: current.filter((row) => !compatibleIds.has(row.id)),
      skippedWarehouseMismatch: false,
    };
  }

  const selectedIds = new Set(current.map((row) => row.id));
  const selected = [...current];
  for (const row of compatible) {
    if (selectedIds.has(row.id)) continue;
    selected.push(row);
    selectedIds.add(row.id);
  }

  return {
    selected,
    skippedWarehouseMismatch: compatible.length !== visibleLines.length,
  };
}
