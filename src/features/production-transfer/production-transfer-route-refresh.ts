import { productionTransferApi, type ProductionTaskBoard } from './api';

const PICK_TASK_TYPES = new Set(['Pick']);

export type ProductionReturnCompleteLine = {
  taskLineId: number;
  targetLocationId: number;
};

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

export async function completeCancellationReturnAndRefresh(
  transferId: number,
  taskId: number,
  lines: ProductionReturnCompleteLine[],
): Promise<ProductionTaskBoard> {
  const board = await productionTransferApi.completeCancellationReturn(transferId, taskId, lines);
  return refreshActiveProductionPickRoutes(transferId, board);
}
