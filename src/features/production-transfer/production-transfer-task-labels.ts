import type { ProductionWorkOrderTransferHeaderRow, ProductionWorkOrderTransferTaskRow } from './api';

export const PRODUCTION_TASK_TYPE_LABELS: Record<string, string> = {
  Pick: 'Toplama',
  Dispatch: 'Sevk',
  Receive: 'Kabul',
  Putaway: 'Yerleştirme',
  CancellationReturn: 'İptal İadesi',
  AssignmentReturn: 'İade',
};

export const productionTaskTypeLabel = (type: string): string =>
  PRODUCTION_TASK_TYPE_LABELS[type] ?? type;

const CLOSED_CANCELLATION_RETURN_STATUSES = new Set(['Completed', 'Cancelled']);

export function hasOpenCancellationReturnTask(
  tasks: ProductionWorkOrderTransferTaskRow[],
): boolean {
  return tasks.some(
    (task) =>
      task.taskType === 'CancellationReturn'
      && !CLOSED_CANCELLATION_RETURN_STATUSES.has(task.status),
  );
}

/** Toplamada sekmesindeki üst satırlar için; diğer sekmelerde fallback kullanın. */
export function productionWorkOrderTransferPickingStatusLabel(
  row: Pick<ProductionWorkOrderTransferHeaderRow, 'transferStatus' | 'workflowStatus' | 'tasks'>,
  fallback: string,
): string {
  const { transferStatus, workflowStatus, tasks } = row;

  if (
    transferStatus === 'AwaitingHandover'
    || workflowStatus === 'AwaitingHandover'
  ) {
    return fallback;
  }

  if (transferStatus === 'Released') {
    return 'Toplanıyor';
  }

  if (
    transferStatus === 'Cancelled'
    && (tasks.length === 0 || hasOpenCancellationReturnTask(tasks))
  ) {
    return 'İptal — İade Bekliyor';
  }

  return fallback;
}
