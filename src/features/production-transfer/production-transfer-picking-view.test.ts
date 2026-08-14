import { describe, expect, it } from 'vitest';
import type { ProductionTransferPickingRow } from './api';
import {
  canSelectProductionTransferPickingRow,
  countProductionTransferPickingRows,
  filterProductionTransferPickingRows,
  isProductionTransferPickingRowCompleted,
} from './production-transfer-picking-view';

function row(
  taskLineId: number,
  remainingQuantity: number,
  processedQuantity: number,
): ProductionTransferPickingRow {
  return {
    taskLineId,
    wtLineId: taskLineId,
    lineNo: taskLineId,
    stockId: taskLineId,
    stockCode: `STK-${taskLineId}`,
    requestedQuantity: remainingQuantity + processedQuantity,
    remainingQuantity,
    processedQuantity,
    canPick: remainingQuantity > 0,
  };
}

describe('production transfer picking view', () => {
  const rows = [
    row(1, 4, 0),
    row(2, 0, 2),
    row(3, 0.0000001, 1),
  ];

  it('keeps both pending and collected rows in all tab', () => {
    expect(filterProductionTransferPickingRows(rows, 'all').map((item) => item.taskLineId))
      .toEqual([1, 2, 3]);
  });

  it('shows only rows with remaining quantity in pending tab', () => {
    expect(filterProductionTransferPickingRows(rows, 'pending').map((item) => item.taskLineId))
      .toEqual([1]);
  });

  it('shows only actually collected rows in completed tab', () => {
    expect(filterProductionTransferPickingRows(rows, 'completed').map((item) => item.taskLineId))
      .toEqual([2, 3]);
    expect(isProductionTransferPickingRowCompleted(row(4, 0, 0))).toBe(false);
  });

  it('keeps transferred picks visible and actionable for the current assignee', () => {
    const historical = { ...row(5, 0, 1), isHistorical: true, canPick: false };
    const withHistory = [...rows, historical];

    expect(filterProductionTransferPickingRows(withHistory, 'pending')).not.toContain(historical);
    expect(filterProductionTransferPickingRows(withHistory, 'completed')).toContain(historical);
    expect(canSelectProductionTransferPickingRow(historical, 'completed', false)).toBe(true);
    expect(canSelectProductionTransferPickingRow(row(6, 0, 1), 'completed', false)).toBe(true);
  });

  it('reports stable tab counts', () => {
    expect(countProductionTransferPickingRows(rows)).toEqual({ all: 3, pending: 1, completed: 2 });
  });
});
