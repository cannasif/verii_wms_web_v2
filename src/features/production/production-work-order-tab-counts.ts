import { productionTransferApi } from '@/features/production-transfer/api';
import { productionApi } from './api';
import type { ProductionWorkOrderPageTab } from './components/ProductionWorkOrderTransferTabPanel';

export type ProductionWorkOrderTabCounts = Record<ProductionWorkOrderPageTab, number>;

export async function fetchProductionWorkOrderTabCounts(): Promise<ProductionWorkOrderTabCounts> {
  const [
    pickingRows,
    completedRows,
    cancelledTransfers,
    cancelledAssignments,
    mineRows,
  ] = await Promise.all([
    productionTransferApi.workOrderTransferGroups('Picking'),
    productionTransferApi.workOrderTransferGroups('Completed'),
    productionTransferApi.workOrderTransferGroups('Cancelled'),
    productionApi.cancelledWorkOrderAssignments(),
    productionTransferApi.workOrderTransferGroups('MyAssignments'),
  ]);

  return {
    // Pending is derived from the already loaded page rows. Calling the source endpoint
    // again here doubled the initial ERP request and was refreshed every minute.
    pending: 0,
    picking: pickingRows.length,
    completed: completedRows.length,
    cancelled: cancelledTransfers.length + cancelledAssignments.length,
    mine: mineRows.length,
  };
}
