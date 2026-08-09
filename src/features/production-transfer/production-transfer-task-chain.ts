import type { ProductionTask, ProductionWorkOrderTransferTaskRow } from './api';

const RETURN_TASK_TYPES = new Set(['AssignmentReturn', 'CancellationReturn']);

export function isReturnTaskType(taskType: string): boolean {
  return RETURN_TASK_TYPES.has(taskType);
}

type ChainTask = {
  taskId: number;
  taskNo: string;
  displayLabel?: string;
  previousTaskId?: number;
  originTaskId?: number;
  taskType: string;
  status: string;
  processedQuantity: number;
  plannedQuantity: number;
  remainingQuantity: number;
  assignedUsernames?: string[];
};

/** Handoff / iade zincirini okunabilir sırada gösterir (-1, -IADE, -KALANTRANSFER). */
export function orderTasksForDisplay<T extends ChainTask>(tasks: readonly T[]): T[] {
  if (tasks.length <= 1) return [...tasks];

  const byId = new Map(tasks.map((task) => [task.taskId, task]));
  const attached = new Set<number>();
  const ordered: T[] = [];

  const appendReturnsForOrigin = (originTaskId: number) => {
    for (const task of tasks
      .filter((row) => isReturnTaskType(row.taskType)
        && row.originTaskId === originTaskId
        && !attached.has(row.taskId))
      .sort((left, right) => left.taskId - right.taskId)) {
      attached.add(task.taskId);
      ordered.push(task);
    }
  };

  const appendChain = (root: T) => {
    let cursor: T | undefined = root;
    while (cursor && !attached.has(cursor.taskId)) {
      attached.add(cursor.taskId);
      ordered.push(cursor);

      if (!isReturnTaskType(cursor.taskType)) {
        appendReturnsForOrigin(cursor.taskId);
      }

      cursor = tasks
        .filter((task) => task.previousTaskId === cursor!.taskId
          && !attached.has(task.taskId)
          && !isReturnTaskType(task.taskType))
        .sort((left, right) => left.taskId - right.taskId)[0];
    }
  };

  const roots = tasks
    .filter((task) => !isReturnTaskType(task.taskType))
    .filter((task) => !task.previousTaskId || !byId.has(task.previousTaskId))
    .sort((left, right) => left.taskId - right.taskId);

  for (const root of roots) appendChain(root);

  for (const task of tasks) {
    if (!attached.has(task.taskId)) ordered.push(task);
  }

  return ordered;
}

export function taskDisplayName(task: Pick<ChainTask, 'displayLabel' | 'taskNo'>): string {
  return task.displayLabel?.trim() || task.taskNo;
}

/** Devir sonrası aynı görev mi yoksa yeni -2 görevi mi oluştuğuna dair kısa açıklama. */
export function describeHandoffRelation(task: ChainTask, tasks: readonly ChainTask[]): string | null {
  if (task.taskType === 'AssignmentReturn' || task.taskType === 'CancellationReturn') {
    const origin = tasks.find((row) => row.taskId === task.originTaskId);
    return origin
      ? `${taskDisplayName(origin)} görevinden oluşturulan iade`
      : 'İade görevi';
  }

  if (task.previousTaskId) {
    const previous = tasks.find((row) => row.taskId === task.previousTaskId);
    return previous
      ? `${taskDisplayName(previous)} görevindeki kalan işten devredildi`
      : 'Devir görevi';
  }

  const child = tasks.find((row) => row.previousTaskId === task.taskId);
  if (child && task.processedQuantity > 0) {
    return `${taskDisplayName(child)} görevine kalan miktar devredildi`;
  }

  if (task.processedQuantity <= 0 && task.assignedUsernames && task.assignedUsernames.length > 0) {
    return 'Henüz işlenmedi; devir aynı görev üzerinde kullanıcı değiştirir';
  }

  return null;
}

export function formatTaskAssignees(usernames: readonly string[] | undefined): string {
  return usernames?.length ? usernames.join(', ') : 'Atanmamış';
}

export function resolveTaskAssignedUsernames(task: Pick<ProductionTask, 'assignments' | 'assignedUsernames'>): string[] {
  if (task.assignedUsernames?.length) return [...task.assignedUsernames];
  return task.assignments.map((assignment) => assignment.username);
}

export function mapBoardTasksToChainRows(tasks: ProductionTask[]): ProductionWorkOrderTransferTaskRow[] {
  return tasks.map((task) => ({
    taskId: task.taskId,
    taskNo: task.taskNo,
    displayLabel: task.taskNo,
    taskType: task.taskType,
    status: task.status,
    warehouseId: task.warehouseId,
    plannedQuantity: task.lines.reduce((sum, line) => sum + line.requestedQuantity, 0),
    processedQuantity: task.lines.reduce((sum, line) => sum + line.processedQuantity, 0),
    remainingQuantity: task.lines.reduce(
      (sum, line) => sum + Math.max(0, line.requestedQuantity - line.processedQuantity),
      0,
    ),
    assignedUsernames: resolveTaskAssignedUsernames(task),
    previousTaskId: task.previousTaskId,
    originTaskId: task.originTaskId,
    originUserId: task.originUserId,
    completedAtUtc: task.completedAtUtc,
  }));
}
