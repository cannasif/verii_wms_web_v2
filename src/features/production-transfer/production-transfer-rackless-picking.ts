import type { ProductionTransferPickingRow, ResolveProductionTransferBarcodeResult } from './api';

export type RacklessStockBalanceTone = 'shortage' | 'stocked';

export function hasRacklessRowShortage(
  row: ProductionTransferPickingRow,
): boolean {
  return row.remainingQuantity > 0 && !row.canPick;
}

export function resolveRacklessStockBalanceTone(
  row: ProductionTransferPickingRow,
): RacklessStockBalanceTone | null {
  if (row.remainingQuantity <= 0) return null;
  return row.canPick ? 'stocked' : 'shortage';
}

/** Rafsız: bakiyeli / bakiyesiz parçayı güncel bakiyeye göre ayır (yalnızca UI). API canPick donmuş kalsa da bakiye kullanılır. */
export function expandRacklessPartialShortageRows(
  rows: ProductionTransferPickingRow[],
  availableLookup: ReadonlyMap<string, number>,
): ProductionTransferPickingRow[] {
  const expanded: ProductionTransferPickingRow[] = [];
  for (const row of rows) {
    if (Boolean(row.serialNo?.trim()) || row.remainingQuantity <= 0 || row.displaySplit) {
      expanded.push(row);
      continue;
    }
    const available = row.sourceLocationId
      ? availableLookup.get(`${row.stockId}|${row.sourceLocationId}`) ?? 0
      : 0;
    const pickable = Math.max(0, Math.min(row.remainingQuantity, available));
    const missing = Math.max(0, row.remainingQuantity - available);
    if (pickable > 0 && missing > 0) {
      expanded.push({
        ...row,
        requestedQuantity: pickable,
        remainingQuantity: pickable,
        processedQuantity: 0,
        canPick: true,
        displaySplit: 'stocked',
      });
      expanded.push({
        ...row,
        sourceLocationId: undefined,
        sourceLocationCode: undefined,
        requestedQuantity: missing,
        remainingQuantity: missing,
        processedQuantity: 0,
        canPick: false,
        displaySplit: 'shortage',
      });
      continue;
    }
    if (pickable > 0) {
      expanded.push(row.canPick ? row : { ...row, canPick: true });
      continue;
    }
    expanded.push(row);
  }
  return expanded;
}

/** Rafsız: toplama üst sınırını tablodaki gibi kullanılabilir bakiyeyle sınırla. Rezerv (available 0) ve raflıya dokunmaz. */
export function applyRacklessPickQuantityCap(
  match: ResolveProductionTransferBarcodeResult,
  availableLookup: ReadonlyMap<string, number>,
  enabled: boolean,
): ResolveProductionTransferBarcodeResult {
  if (!enabled || match.isSerial) return match;
  const available = match.sourceLocationId
    ? availableLookup.get(`${match.stockId}|${match.sourceLocationId}`) ?? 0
    : 0;
  if (available <= 0) return match;
  const cappedMax = Math.max(0, Math.min(match.maxPickQuantity, available));
  const cappedDefault = Math.max(0, Math.min(match.defaultQuantity, cappedMax));
  const cappedRemaining = Math.max(0, Math.min(match.remainingQuantity, available));
  if (cappedMax === match.maxPickQuantity
    && cappedDefault === match.defaultQuantity
    && cappedRemaining === match.remainingQuantity) {
    return match;
  }
  return {
    ...match,
    remainingQuantity: cappedRemaining,
    maxPickQuantity: cappedMax,
    defaultQuantity: cappedDefault,
  };
}
