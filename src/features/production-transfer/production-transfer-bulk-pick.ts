import type { ProductionTransferPickingRow } from './api';

export interface ProductionTransferBulkPickRow {
  row: ProductionTransferPickingRow;
  quantity: number;
}

function normalizeStockCode(value: string): string {
  return value.trim().toLocaleUpperCase('tr-TR');
}

/**
 * Builds one deterministic pick plan from all open shelf rows of a non-serial stock.
 * The server still validates every shelf balance while committing the plan.
 */
export function buildProductionTransferBulkPickPlan(
  rows: ProductionTransferPickingRow[],
  stockCode: string,
): ProductionTransferBulkPickRow[] {
  const normalizedStockCode = normalizeStockCode(stockCode);
  const seenTaskLines = new Set<number>();

  return rows
    .filter((row) =>
      row.canPick
      && !row.isHistorical
      && row.remainingQuantity > 0
      && !row.serialNo?.trim()
      && row.sourceLocationId != null
      && normalizeStockCode(row.stockCode) === normalizedStockCode)
    .sort((left, right) =>
      (left.sourceLocationCode ?? '').localeCompare(right.sourceLocationCode ?? '', 'tr', { sensitivity: 'base' })
      || left.lineNo - right.lineNo
      || left.taskLineId - right.taskLineId)
    .filter((row) => {
      if (seenTaskLines.has(row.taskLineId)) return false;
      seenTaskLines.add(row.taskLineId);
      return true;
    })
    .map((row) => ({
      row,
      quantity: Math.floor(row.remainingQuantity),
    }))
    .filter((item) => item.quantity > 0);
}

