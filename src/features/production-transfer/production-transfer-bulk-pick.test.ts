import { describe, expect, it } from 'vitest';
import type { ProductionTransferPickingRow } from './api';
import { buildProductionTransferBulkPickPlan } from './production-transfer-bulk-pick';

function row(
  taskLineId: number,
  sourceLocationId: number,
  sourceLocationCode: string,
  remainingQuantity: number,
): ProductionTransferPickingRow {
  return {
    taskLineId,
    wtLineId: taskLineId + 100,
    lineNo: taskLineId,
    sourceLocationId,
    sourceLocationCode,
    stockId: 42,
    stockCode: 'STK-001',
    stockName: 'Test stoğu',
    requestedQuantity: remainingQuantity,
    remainingQuantity,
    processedQuantity: 0,
    canPick: true,
  };
}

describe('buildProductionTransferBulkPickPlan', () => {
  it('plans the complete 37 quantity across three shelves', () => {
    const plan = buildProductionTransferBulkPickPlan([
      row(1, 101, 'A-01', 15),
      row(2, 102, 'A-02', 10),
      row(3, 103, 'A-03', 12),
    ], 'stk-001');

    expect(plan).toHaveLength(3);
    expect(plan.map((item) => item.quantity)).toEqual([15, 10, 12]);
    expect(plan.reduce((total, item) => total + item.quantity, 0)).toBe(37);
  });

  it('excludes serial, historical, unavailable and unrelated rows', () => {
    const serial = { ...row(2, 102, 'A-02', 1), serialNo: 'SN-1' };
    const historical = { ...row(3, 103, 'A-03', 4), isHistorical: true };
    const unavailable = { ...row(4, 104, 'A-04', 5), canPick: false };
    const unrelated = { ...row(5, 105, 'A-05', 6), stockCode: 'STK-002' };

    const plan = buildProductionTransferBulkPickPlan([
      row(1, 101, 'A-01', 15), serial, historical, unavailable, unrelated,
    ], 'STK-001');

    expect(plan).toHaveLength(1);
    expect(plan[0].row.taskLineId).toBe(1);
  });
});
