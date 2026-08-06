import { productionTransferApi, type ProductionTaskBoard } from './api';

const PICK_TASK_TYPES = new Set(['Pick']);

/** İade sonrası aktif toplama görevlerinin rotasını ve rezervasyonlarını yeniler. */
export async function refreshActiveProductionPickRoutes(
  transferId: number,
  board: ProductionTaskBoard,
): Promise<ProductionTaskBoard> {
  let current = board;
  for (const task of current.tasks) {
    if (!PICK_TASK_TYPES.has(task.taskType) || ['Completed', 'Cancelled'].includes(task.status)) continue;
    try {
      current = await productionTransferApi.refreshRoute(transferId, task.taskId);
    } catch {
      // Rota yenileme opsiyonel; rezervasyon backend'de de düzeltilir.
    }
  }
  return current;
}

export async function completeAssignmentReturnAndRefresh(
  transferId: number,
  taskId: number,
): Promise<ProductionTaskBoard> {
  const board = await productionTransferApi.completeAssignmentReturn(transferId, taskId);
  return refreshActiveProductionPickRoutes(transferId, board);
}

export async function completeCancellationReturnAndRefresh(
  transferId: number,
  taskId: number,
): Promise<ProductionTaskBoard> {
  const board = await productionTransferApi.completeCancellationReturn(transferId, taskId);
  return refreshActiveProductionPickRoutes(transferId, board);
}
