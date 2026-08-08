import { describe, expect, it } from 'vitest';
import { describeHandoffRelation, orderTasksForDisplay } from './production-transfer-task-chain';

describe('orderTasksForDisplay', () => {
  it('orders handoff chain as -1 then -2', () => {
    const tasks = [
      { taskId: 20, taskNo: 'TR-1-2', previousTaskId: 10, taskType: 'Pick', status: 'Assigned', processedQuantity: 0, plannedQuantity: 5, remainingQuantity: 5 },
      { taskId: 10, taskNo: 'TR-1-1', taskType: 'Pick', status: 'Completed', processedQuantity: 3, plannedQuantity: 10, remainingQuantity: 0 },
    ];

    const ordered = orderTasksForDisplay(tasks);
    expect(ordered.map((task) => task.taskId)).toEqual([10, 20]);
  });

  it('keeps return task after its origin pick task', () => {
    const tasks = [
      { taskId: 30, taskNo: 'TR-1-1-IADE', originTaskId: 10, taskType: 'AssignmentReturn', status: 'Assigned', processedQuantity: 0, plannedQuantity: 7, remainingQuantity: 7 },
      { taskId: 10, taskNo: 'TR-1-1', taskType: 'Pick', status: 'InProgress', processedQuantity: 3, plannedQuantity: 10, remainingQuantity: 7 },
    ];

    const ordered = orderTasksForDisplay(tasks);
    expect(ordered.map((task) => task.taskId)).toEqual([10, 30]);
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
