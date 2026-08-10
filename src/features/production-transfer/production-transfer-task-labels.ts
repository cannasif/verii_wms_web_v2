import type { TFunction } from 'i18next';
import i18n from '@/lib/i18n';
import type { ProductionWorkOrderTransferHeaderRow, ProductionWorkOrderTransferTaskRow } from './api';
import { productionTransferEnumLabel } from './localization/enum-labels';

export function productionTaskTypeLabel(type: string, t?: TFunction): string {
  const translate = t ?? i18n.getFixedT(null, 'production-transfer');
  return productionTransferEnumLabel(translate, 'taskType', type);
}

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
