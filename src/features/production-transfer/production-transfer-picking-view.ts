import type { ProductionTransferPickingRow } from './api';

export type ProductionTransferPickTab = 'all' | 'pending' | 'completed';

const QUANTITY_TOLERANCE = 0.000001;

export function isProductionTransferPickingRowCompleted(
  row: ProductionTransferPickingRow,
): boolean {
  return row.processedQuantity > QUANTITY_TOLERANCE
    && row.remainingQuantity <= QUANTITY_TOLERANCE;
}

export function isProductionTransferPickingRowPending(
  row: ProductionTransferPickingRow,
): boolean {
  return row.remainingQuantity > QUANTITY_TOLERANCE;
}

export function filterProductionTransferPickingRows(
  rows: ProductionTransferPickingRow[],
  tab: ProductionTransferPickTab,
): ProductionTransferPickingRow[] {
  if (tab === 'pending') return rows.filter(isProductionTransferPickingRowPending);
  if (tab === 'completed') return rows.filter(isProductionTransferPickingRowCompleted);
  return rows;
}

export function countProductionTransferPickingRows(rows: ProductionTransferPickingRow[]) {
  return {
    all: rows.length,
    pending: rows.filter(isProductionTransferPickingRowPending).length,
    completed: rows.filter(isProductionTransferPickingRowCompleted).length,
  };
}
