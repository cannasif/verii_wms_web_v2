import { describe, expect, it } from 'vitest';
import { analyzeProductionCancellationReadiness } from './production-transfer-cancellation';
import type { ProductionTaskBoard } from './api';

const baseBoard = (tasks: ProductionTaskBoard['tasks']): ProductionTaskBoard => ({
  transferId: 1,
  documentNo: 'PT-001',
  transferStatus: 'InProgress',
  sourceWarehouseId: 10,
  tasks,
  workloads: [],
  eligibleAssignees: [],
});

describe('analyzeProductionCancellationReadiness', () => {
  it('allows cancel when nothing was picked', () => {
    const result = analyzeProductionCancellationReadiness(baseBoard([
      {
        taskId: 1, taskNo: 'T-1', taskType: 'Pick', warehouseId: 1, status: 'InProgress',
        assignments: [{ userId: 5, username: 'Ali', isPrimary: true, assignedAtUtc: '2026-01-01' }],
        lines: [{ taskLineId: 1, transferLineId: 1, stockCode: 'STK', requestedQuantity: 10, reservedQuantity: 10, missingQuantity: 0, processedQuantity: 0, totalRequestedQuantity: 10 }],
      },
    ]), { transferPickedQuantity: 0 });
    expect(result.canCancel).toBe(true);
    expect(result.hasPickedStock).toBe(false);
  });

  it('blocks cancel when transfer detail shows picked stock but task board is empty', () => {
    const result = analyzeProductionCancellationReadiness(baseBoard([]), { transferPickedQuantity: 7 });
    expect(result.canCancel).toBe(false);
    expect(result.hasPickedStock).toBe(true);
    expect(result.unresolvedPickedStock).toBe(true);
    expect(result.pickedQuantity).toBe(7);
  });

  it('blocks cancel when picked stock has no cancellation return task', () => {
    const result = analyzeProductionCancellationReadiness(baseBoard([
      {
        taskId: 1, taskNo: 'T-1', taskType: 'Pick', warehouseId: 1, status: 'InProgress', startedBy: 5,
        assignments: [{ userId: 5, username: 'Ali', isPrimary: true, assignedAtUtc: '2026-01-01' }],
        lines: [{ taskLineId: 1, transferLineId: 1, stockCode: 'STK', requestedQuantity: 10, reservedQuantity: 10, missingQuantity: 0, processedQuantity: 4, totalRequestedQuantity: 10 }],
      },
    ]), { transferPickedQuantity: 4 });
    expect(result.canCancel).toBe(false);
    expect(result.needsCancellationReturn).toBe(true);
    expect(result.missingReturnTasks).toHaveLength(1);
    expect(result.missingReturnTasks[0]?.username).toBe('Ali');
  });

  it('detects picker via primary assignee when startedBy is missing', () => {
    const result = analyzeProductionCancellationReadiness(baseBoard([
      {
        taskId: 1, taskNo: 'T-1', taskType: 'Pick', warehouseId: 1, status: 'InProgress',
        assignments: [{ userId: 8, username: 'Veli', isPrimary: true, assignedAtUtc: '2026-01-01' }],
        lines: [{ taskLineId: 1, transferLineId: 1, stockCode: 'STK', requestedQuantity: 10, reservedQuantity: 10, missingQuantity: 0, processedQuantity: 3, totalRequestedQuantity: 10 }],
      },
    ]), { transferPickedQuantity: 3 });
    expect(result.pickers).toHaveLength(1);
    expect(result.pickers[0]?.username).toBe('Veli');
    expect(result.canCancel).toBe(false);
  });

  it('allows cancel when all cancellation returns are completed', () => {
    const result = analyzeProductionCancellationReadiness(baseBoard([
      {
        taskId: 1, taskNo: 'T-1', taskType: 'Pick', warehouseId: 1, status: 'InProgress', startedBy: 5,
        assignments: [{ userId: 5, username: 'Ali', isPrimary: true, assignedAtUtc: '2026-01-01' }],
        lines: [{ taskLineId: 1, transferLineId: 1, stockCode: 'STK', requestedQuantity: 10, reservedQuantity: 10, missingQuantity: 0, processedQuantity: 4, totalRequestedQuantity: 10 }],
      },
      {
        taskId: 2, taskNo: 'PT-001-IPTALIADE1', taskType: 'CancellationReturn', warehouseId: 1, status: 'Completed', startedBy: 5,
        assignments: [], lines: [],
      },
    ]), { transferPickedQuantity: 4 });
    expect(result.canCancel).toBe(true);
    expect(result.pendingReturns).toHaveLength(0);
  });
});
