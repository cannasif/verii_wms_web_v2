import type { ProductionTransferPolicy } from '@/features/production-transfer/api';
import type { WarehouseTransferPolicy } from './types/warehouse-transfer.types';

export type TransferDraftPolicyVariant = 'warehouse' | 'production' | 'subcontracting';
export type TransferDraftPolicySource = 'OrderBased' | 'StockBased';
export type TransferDraftPolicyExecution = 'TaskBased' | 'Direct';

export interface EffectiveTransferDraftPolicy {
  loaded: boolean;
  combinationAllowed: boolean;
  requireAssignee: boolean;
  allowMultipleAssignees: boolean;
  requireSourceLocation: boolean;
  requireTargetLocation: boolean;
}

export function resolveTransferDraftPolicy({
  variant,
  sourceKind,
  executionKind,
  warehousePolicy,
  productionPolicy,
  autoAssignSources,
}: {
  variant: TransferDraftPolicyVariant;
  sourceKind: TransferDraftPolicySource;
  executionKind: TransferDraftPolicyExecution;
  warehousePolicy: WarehouseTransferPolicy | null;
  productionPolicy: ProductionTransferPolicy | null;
  autoAssignSources: boolean;
}): EffectiveTransferDraftPolicy {
  if (variant === 'production') {
    if (!productionPolicy) return unloaded();
    const manualSourceAllowed = sourceKind === 'OrderBased' || productionPolicy.allowManualTransfer;
    const executionAllowed = !productionPolicy.requireTaskAssignment || executionKind === 'TaskBased';
    return {
      loaded: true,
      combinationAllowed: manualSourceAllowed && executionAllowed,
      // A production task can be assigned after draft creation. Requiring task execution
      // must not be confused with requiring an assignee during draft creation.
      requireAssignee: false,
      allowMultipleAssignees: false,
      requireSourceLocation: productionPolicy.requireSourceProductionLocation && !autoAssignSources,
      requireTargetLocation: productionPolicy.requireTargetProductionLocation,
    };
  }

  if (!warehousePolicy) return unloaded();
  const combinationAllowed = sourceKind === 'OrderBased'
    ? executionKind === 'TaskBased'
      ? warehousePolicy.allowOrderBasedTask
      : warehousePolicy.allowOrderBasedDirect
    : executionKind === 'TaskBased'
      ? warehousePolicy.allowStockBasedTask
      : warehousePolicy.allowStockBasedDirect;
  return {
    loaded: true,
    combinationAllowed,
    requireAssignee: executionKind === 'TaskBased' && warehousePolicy.requireAssigneeForTask,
    allowMultipleAssignees: warehousePolicy.allowMultipleAssignees,
    requireSourceLocation: warehousePolicy.requireSourceLocation,
    requireTargetLocation: warehousePolicy.requireTargetLocation,
  };
}

function unloaded(): EffectiveTransferDraftPolicy {
  return {
    loaded: false,
    combinationAllowed: false,
    requireAssignee: false,
    allowMultipleAssignees: false,
    requireSourceLocation: false,
    requireTargetLocation: false,
  };
}
