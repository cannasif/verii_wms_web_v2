import type { ProductionTask, ProductionTaskBoard } from './api';
import { taskLineageHasProgress } from './production-transfer-task-progress';

export interface PickerReturnStatus {
  userId: number;
  username: string;
  pickTaskId: number;
  pickTaskNo: string;
  processedQuantity: number;
  processedLineCount: number;
  returnTask?: ProductionTask;
}

export interface ProductionCancellationReadiness {
  hasPickedStock: boolean;
  pickedQuantity: number;
  pickers: PickerReturnStatus[];
  pendingReturns: PickerReturnStatus[];
  missingReturnTasks: PickerReturnStatus[];
  unresolvedPickedStock: boolean;
  canCancel: boolean;
}

export interface ProductionCancellationInput {
  /** Grid satırındaki toplanan miktar (paged API). */
  pickedQuantityHint?: number;
  /** Transfer detayındaki satır toplamları — detay penceresindeki "Toplanan" ile aynı kaynak. */
  transferPickedQuantity?: number;
}

const RETURN_TASK_TYPES = new Set(['CancellationReturn', 'AssignmentReturn']);

function taskProcessedQuantity(task: ProductionTask): number {
  return task.lines.reduce((sum, line) => sum + line.processedQuantity, 0);
}

function taskBoardPickedQuantity(board: ProductionTaskBoard): number {
  return board.tasks
    .filter((t) => !RETURN_TASK_TYPES.has(t.taskType) && t.status !== 'Cancelled')
    .flatMap((t) => t.lines)
    .reduce((sum, line) => sum + line.processedQuantity, 0);
}

function resolvePickerUserIds(task: ProductionTask): number[] {
  if (task.startedBy) return [task.startedBy];
  if (taskProcessedQuantity(task) <= 0) return [];
  const primary = task.assignments.find((a) => a.isPrimary);
  if (primary) return [primary.userId];
  if (task.assignments.length > 0) return [task.assignments[0].userId];
  return [];
}

function pickerProcessedQuantity(userId: number, pickTask: ProductionTask, tasks: ProductionTask[]): number {
  const userTasks = tasks.filter(
    (t) => t.taskType === pickTask.taskType && t.status !== 'Cancelled' && (t.startedBy === userId || resolvePickerUserIds(t).includes(userId)),
  );
  if (userTasks.length === 0 && resolvePickerUserIds(pickTask).includes(userId)) {
    return taskProcessedQuantity(pickTask);
  }
  return userTasks
    .flatMap((t) => t.lines)
    .reduce((sum, line) => sum + line.processedQuantity, 0);
}

function findCancellationReturn(board: ProductionTaskBoard, userId: number, pickTaskId: number): ProductionTask | undefined {
  return board.tasks.find((t) =>
    t.taskType === 'CancellationReturn'
    && t.status !== 'Cancelled'
    && (t.originUserId === userId || t.startedBy === userId)
    && (t.originTaskId === pickTaskId || t.originTaskId == null),
  );
}

function usernameFor(board: ProductionTaskBoard, userId: number, pickTask: ProductionTask): string {
  return pickTask.assignments.find((a) => a.userId === userId)?.username
    ?? board.workloads.find((w) => w.userId === userId)?.username
    ?? `Kullanıcı #${userId}`;
}

export function analyzeProductionCancellationReadiness(
  board: ProductionTaskBoard,
  input: ProductionCancellationInput | number = {},
): ProductionCancellationReadiness {
  const options: ProductionCancellationInput = typeof input === 'number'
    ? { pickedQuantityHint: input }
    : input;
  const pickedQuantityHint = options.pickedQuantityHint ?? 0;
  const transferPickedQuantity = options.transferPickedQuantity ?? 0;

  const pickTasks = board.tasks.filter((t) => !RETURN_TASK_TYPES.has(t.taskType) && t.status !== 'Cancelled');
  const pickerMap = new Map<number, PickerReturnStatus>();

  for (const task of pickTasks) {
    if (!taskLineageHasProgress(task, board.tasks) && taskProcessedQuantity(task) <= 0) continue;
    const userIds = resolvePickerUserIds(task);
    for (const userId of userIds) {
      const processedQuantity = pickerProcessedQuantity(userId, task, board.tasks);
      if (processedQuantity <= 0) continue;
      const existing = pickerMap.get(userId);
      if (existing && existing.processedQuantity >= processedQuantity) continue;
      const processedLineCount = task.lines.filter((line) => line.processedQuantity > 0).length;
      pickerMap.set(userId, {
        userId,
        username: usernameFor(board, userId, task),
        pickTaskId: task.taskId,
        pickTaskNo: task.taskNo,
        processedQuantity,
        processedLineCount,
        returnTask: findCancellationReturn(board, userId, task.taskId),
      });
    }
  }

  const pickers = [...pickerMap.values()].sort((a, b) => a.username.localeCompare(b.username, 'tr'));
  const pickedQuantity = Math.max(
    pickedQuantityHint,
    transferPickedQuantity,
    taskBoardPickedQuantity(board),
    pickers.reduce((sum, p) => sum + p.processedQuantity, 0),
  );
  const hasPickedStock = pickedQuantity > 0;
  const unresolvedPickedStock = hasPickedStock && pickers.length === 0;
  const missingReturnTasks = pickers.filter((p) => !p.returnTask);
  const pendingReturns = pickers.filter((p) => p.returnTask && p.returnTask.status !== 'Completed');
  const canCancel = !hasPickedStock || (
    !unresolvedPickedStock
    && missingReturnTasks.length === 0
    && pendingReturns.length === 0
  );

  return {
    hasPickedStock,
    pickedQuantity,
    pickers,
    pendingReturns,
    missingReturnTasks,
    unresolvedPickedStock,
    canCancel,
  };
}
