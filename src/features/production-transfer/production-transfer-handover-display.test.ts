import { describe, expect, it } from 'vitest';
import type { ProductionTransferExecutionLine } from './api';
import { groupProductionTransferHandoverDisplayLines } from './production-transfer-handover-display';

function line(
  overrides: Partial<ProductionTransferExecutionLine> & Pick<ProductionTransferExecutionLine, 'lineId'>,
): ProductionTransferExecutionLine {
  return {
    lineNo: overrides.lineId,
    stockId: 13,
    stockCode: 'STK-1',
    stockName: 'Cıvata',
    unitCode: 'ADET',
    requestedQuantity: 0,
    pickedQuantity: 0,
    handedOverQuantity: 0,
    remainingToPickQuantity: 0,
    shortageQuantity: 0,
    overIssueQuantity: 0,
    trackingType: 'None',
    ...overrides,
  };
}

describe('groupProductionTransferHandoverDisplayLines', () => {
  it('merges the same stock picked from different shelves into one display row', () => {
    const grouped = groupProductionTransferHandoverDisplayLines([
      line({ lineId: 1, requestedQuantity: 5, pickedQuantity: 5 }),
      line({ lineId: 2, requestedQuantity: 3, pickedQuantity: 3 }),
    ]);

    expect(grouped).toHaveLength(1);
    expect(grouped[0]?.requestedQuantity).toBe(8);
    expect(grouped[0]?.pickedQuantity).toBe(8);
    expect(grouped[0]?.shortageQuantity).toBe(0);
  });

  it('keeps different stocks on separate rows', () => {
    const grouped = groupProductionTransferHandoverDisplayLines([
      line({ lineId: 1, stockId: 13, pickedQuantity: 2, requestedQuantity: 2 }),
      line({ lineId: 2, stockId: 14, stockCode: 'STK-2', pickedQuantity: 1, requestedQuantity: 1 }),
    ]);

    expect(grouped.map((item) => item.stockId)).toEqual([13, 14]);
  });

  it('hides lines with no picked quantity', () => {
    const grouped = groupProductionTransferHandoverDisplayLines([
      line({ lineId: 1, requestedQuantity: 4, pickedQuantity: 0, shortageQuantity: 4 }),
      line({ lineId: 2, requestedQuantity: 2, pickedQuantity: 2 }),
    ]);

    expect(grouped).toHaveLength(1);
    expect(grouped[0]?.pickedQuantity).toBe(2);
  });
});
