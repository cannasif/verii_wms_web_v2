import { isInstantInCreatedPeriod, type CreatedPeriod } from '@/lib/created-period';
import { productionTransferApi } from '@/features/production-transfer/api';
import { productionApi } from './api';
import type { ProductionWorkOrderPageTab } from './components/ProductionWorkOrderTransferTabPanel';

export type ProductionWorkOrderTabCounts = Record<ProductionWorkOrderPageTab, number>;

function matchesTransferPeriod(
  row: { documentDate?: string; createdDate?: string },
  createdPeriod: CreatedPeriod | null,
  periodAnchor: Date,
): boolean {
  return isInstantInCreatedPeriod(row.documentDate ?? row.createdDate, createdPeriod, periodAnchor);
}

function matchesCancelledWorkOrderPeriod(
  row: { workOrderDate?: string; documentDate?: string },
  createdPeriod: CreatedPeriod | null,
  periodAnchor: Date,
): boolean {
  return isInstantInCreatedPeriod(row.workOrderDate ?? row.documentDate, createdPeriod, periodAnchor);
}

export async function fetchProductionWorkOrderTabCounts(
  createdPeriod: CreatedPeriod | null,
  createdPeriodAnchor: Date,
): Promise<ProductionWorkOrderTabCounts> {
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
    picking: pickingRows.filter((row) => matchesTransferPeriod(row, createdPeriod, createdPeriodAnchor)).length,
    completed: completedRows.filter((row) => matchesTransferPeriod(row, createdPeriod, createdPeriodAnchor)).length,
    cancelled:
      cancelledTransfers.filter((row) => matchesTransferPeriod(row, createdPeriod, createdPeriodAnchor)).length
      + cancelledAssignments.filter((row) => matchesCancelledWorkOrderPeriod(row, createdPeriod, createdPeriodAnchor)).length,
    mine: mineRows.filter((row) => matchesTransferPeriod(row, createdPeriod, createdPeriodAnchor)).length,
  };
}
