import { productionTransferApi } from '@/features/production-transfer/api';
import { productionApi } from './api';
import type { ProductionWorkOrderPageTab } from './components/ProductionWorkOrderTransferTabPanel';

export type ProductionWorkOrderTabCounts = Record<ProductionWorkOrderPageTab, number>;

export async function fetchProductionWorkOrderTabCounts(): Promise<ProductionWorkOrderTabCounts> {
  const [
    pendingRows,
    pickingRows,
    completedRows,
    cancelledTransfers,
    cancelledAssignments,
    mineRows,
  ] = await Promise.all([
    productionApi.sourceWorkOrders(),
    productionTransferApi.workOrderTransferGroups('Picking'),
    productionTransferApi.workOrderTransferGroups('Completed'),
    productionTransferApi.workOrderTransferGroups('Cancelled'),
    productionApi.cancelledWorkOrderAssignments(),
    productionTransferApi.workOrderTransferGroups('MyAssignments'),
  ]);

  return {
    pending: pendingRows.filter((row) => row.listingKind !== 'ManagerCancelledAssignment').length,
    picking: pickingRows.length,
    completed: completedRows.length,
    cancelled: cancelledTransfers.length + cancelledAssignments.length,
    mine: mineRows.length,
  };
}
