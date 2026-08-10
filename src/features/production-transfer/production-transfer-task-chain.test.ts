import { describe, expect, it } from 'vitest';
import {
  describeHandoffRelation,
  formatTaskAssignees,
  orderTasksForDisplay,
  resolveTaskAssignedUsernames,
} from './production-transfer-task-chain';

describe('orderTasksForDisplay', () => {
  it('orders handoff chain as -1 then -2', () => {
    const tasks = [
      { taskId: 20, taskNo: 'TR-1-2', previousTaskId: 10, taskType: 'Pick', status: 'Assigned', processedQuantity: 0, plannedQuantity: 5, remainingQuantity: 5 },
      { taskId: 10, taskNo: 'TR-1-1', taskType: 'Pick', status: 'Completed', processedQuantity: 3, plannedQuantity: 10, remainingQuantity: 0 },
    ];

    const ordered = orderTasksForDisplay(tasks);
    expect(ordered.map((task) => task.taskId)).toEqual([10, 20]);
  });

  it('keeps cancellation return task after its origin pick task', () => {
    const tasks = [
      { taskId: 30, taskNo: 'TR-1-IPTALIADE1', originTaskId: 10, taskType: 'CancellationReturn', status: 'Assigned', processedQuantity: 0, plannedQuantity: 7, remainingQuantity: 7 },
      { taskId: 10, taskNo: 'TR-1-1', taskType: 'Pick', status: 'InProgress', processedQuantity: 3, plannedQuantity: 10, remainingQuantity: 7 },
    ];

    const ordered = orderTasksForDisplay(tasks);
    expect(ordered.map((task) => task.taskId)).toEqual([10, 30]);
  });

  it('orders completed cancellation return before kalan pick task', () => {
    const tasks = [
      { taskId: 10, taskNo: 'TR-1-P01', taskType: 'Pick', status: 'Completed', processedQuantity: 3, plannedQuantity: 10, remainingQuantity: 0 },
      { taskId: 20, taskNo: 'TR-1-1', previousTaskId: 10, taskType: 'Pick', status: 'Completed', processedQuantity: 2, plannedQuantity: 7, remainingQuantity: 0 },
      { taskId: 30, taskNo: 'TR-1-IPTALIADE1', originTaskId: 20, taskType: 'CancellationReturn', status: 'Completed', processedQuantity: 5, plannedQuantity: 5, remainingQuantity: 0 },
      { taskId: 40, taskNo: 'TR-1-2', previousTaskId: 30, taskType: 'Pick', status: 'Open', processedQuantity: 0, plannedQuantity: 15, remainingQuantity: 15 },
    ];

    const ordered = orderTasksForDisplay(tasks);
    expect(ordered.map((task) => task.taskId)).toEqual([10, 20, 30, 40]);
  });
});

describe('describeHandoffRelation', () => {
  it('explains reassignment on unprocessed task', () => {
    const task = {
      taskId: 10,
      taskNo: 'TR-1-1',
      taskType: 'Pick',
      status: 'Assigned',
      processedQuantity: 0,
      plannedQuantity: 10,
      remainingQuantity: 10,
      assignedUsernames: ['ali'],
    };

    expect(describeHandoffRelation(task, [task])).toContain('aynı görev');
  });

  it('explains child task created after partial progress', () => {
    const parent = {
      taskId: 10,
      taskNo: 'TR-1-1',
      taskType: 'Pick',
      status: 'Completed',
      processedQuantity: 4,
      plannedQuantity: 10,
      remainingQuantity: 0,
      assignedUsernames: ['ali'],
    };
    const child = {
      taskId: 11,
      taskNo: 'TR-1-2',
      previousTaskId: 10,
      taskType: 'Pick',
      status: 'Assigned',
      processedQuantity: 0,
      plannedQuantity: 6,
      remainingQuantity: 6,
      assignedUsernames: ['veli'],
    };

    expect(describeHandoffRelation(child, [parent, child])).toContain('devredildi');
    expect(describeHandoffRelation(parent, [parent, child])).toContain('TR-1-2');
  });
});

describe('resolveTaskAssignedUsernames', () => {
  it('uses assignedUsernames from api when present', () => {
    expect(resolveTaskAssignedUsernames({
      assignedUsernames: ['ali'],
      assignments: [],
    })).toEqual(['ali']);
  });

  it('falls back to active assignments', () => {
    expect(resolveTaskAssignedUsernames({
      assignments: [{ userId: 1, username: 'veli', isPrimary: true, assignedAtUtc: '2026-01-01' }],
    })).toEqual(['veli']);
  });
});

describe('formatTaskAssignees', () => {
  it('shows unassigned label when empty', () => {
    expect(formatTaskAssignees([])).toBe('Atanmamış');
    expect(formatTaskAssignees(undefined)).toBe('Atanmamış');
  });
});
