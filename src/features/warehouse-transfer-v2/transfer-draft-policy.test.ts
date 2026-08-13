import { describe, expect, it } from 'vitest';
import type { ProductionTransferPolicy } from '@/features/production-transfer/api';
import type { WarehouseTransferPolicy } from './types/warehouse-transfer.types';
import { resolveTransferDraftPolicy } from './transfer-draft-policy';

describe('transfer draft policy isolation', () => {
  it('uses production raf requirements when warehouse requirements are opposite', () => {
    const result = resolveTransferDraftPolicy({
      variant: 'production',
      sourceKind: 'StockBased',
      executionKind: 'TaskBased',
      warehousePolicy: warehousePolicy(false, true),
      productionPolicy: productionPolicy(true, false),
      autoAssignSources: false,
    });

    expect(result.loaded).toBe(true);
    expect(result.requireSourceLocation).toBe(true);
    expect(result.requireTargetLocation).toBe(false);
  });

  it('uses warehouse raf requirements for an ordinary transfer', () => {
    const result = resolveTransferDraftPolicy({
      variant: 'warehouse',
      sourceKind: 'StockBased',
      executionKind: 'TaskBased',
      warehousePolicy: warehousePolicy(false, true),
      productionPolicy: productionPolicy(true, false),
      autoAssignSources: false,
    });

    expect(result.requireSourceLocation).toBe(false);
    expect(result.requireTargetLocation).toBe(true);
  });

  it('does not ask for a manual source raf when production auto assignment is enabled', () => {
    const result = resolveTransferDraftPolicy({
      variant: 'production',
      sourceKind: 'OrderBased',
      executionKind: 'TaskBased',
      warehousePolicy: warehousePolicy(true, true),
      productionPolicy: productionPolicy(true, false),
      autoAssignSources: true,
    });

    expect(result.requireSourceLocation).toBe(false);
    expect(result.requireTargetLocation).toBe(false);
  });
});

function productionPolicy(requireSource: boolean, requireTarget: boolean): ProductionTransferPolicy {
  return {
    id: 1,
    branchCode: '0',
    rowVersion: '',
    productionOrderSource: 'NetsisErpFunctions',
    wmsSourceSystemCode: 'WINDBOX',
    requireProductionOrderReference: true,
    allowManualTransfer: true,
    requireErpMasterDataForManualTransfer: true,
    allowAutomaticGeneration: true,
    checkMaterialAvailability: true,
    blockOnShortage: true,
    requireTaskAssignment: true,
    requireSourceProductionLocation: requireSource,
    requireTargetProductionLocation: requireTarget,
    allowPartialSupply: true,
    allowOverIssue: false,
    overIssueTolerancePercent: 0,
    requireApproval: false,
    erpPostingPolicy: 'AfterHandover',
    cancellationReturnPolicy: 'OriginalSourceLocation',
  };
}

function warehousePolicy(requireSource: boolean, requireTarget: boolean): WarehouseTransferPolicy {
  return {
    id: 1,
    branchCode: '0',
    allowOrderBasedTask: true,
    allowStockBasedTask: true,
    allowOrderBasedDirect: false,
    allowStockBasedDirect: true,
    requireApproval: false,
    requireAssigneeForTask: true,
    allowMultipleAssignees: true,
    autoReleaseTaskBased: false,
    reservationPolicy: 'OnRelease',
    minimumFulfillmentPercent: 100,
    allowPartialPicking: true,
    allowPartialShipment: true,
    allowPartialReceipt: true,
    requireDestinationAcceptance: true,
    createTransitInventory: true,
    requirePutaway: true,
    requireSourceLocation: requireSource,
    requireTargetLocation: requireTarget,
    requireShipmentInformation: false,
    directPostingPolicy: 'TwoStepTransit',
    discrepancyPolicy: 'RequireApproval',
    cancellationReturnPolicy: 'OriginalSourceLocation',
  };
}
