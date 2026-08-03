export type TransferInitiationMode = 'OrderBased' | 'StockBased' | 'Direct';
export type TransferProcessType = 'PlannedTask' | 'DirectTransfer';
export type StockTrackingType = 'None' | 'Lot' | 'Serial' | 'LotAndSerial';
export type TransferSourceKind = 'OrderBased' | 'StockBased';
export type TransferExecutionKind = 'TaskBased' | 'Direct';
export type WarehouseTransferBusinessContext =
  | 'InterWarehouse'
  | 'ProductionMaterialSupply'
  | 'ProductionWipMove'
  | 'ProductionOutputMove'
  | 'SubcontractingIssue'
  | 'SubcontractingReceipt'
  | 'SubcontractorToSubcontractor';

export type EffectiveTrackingPolicy = EffectiveStockTrackingPolicy;

export interface TransferOrderHeader {
  mode: string;
  orderNumber: string;
  customerCode?: string;
  customerName?: string;
  branchCode?: number;
  targetWarehouseCode?: number;
  projectCode?: string;
  orderDate?: string;
  orderedQuantity?: number;
  deliveredQuantity?: number;
  remainingQuantity?: number;
  plannedQuantity?: number;
  availableQuantity?: number;
}

export interface TransferOrderLine extends TransferOrderHeader {
  orderId: number;
  stockCode?: string;
  stockName?: string;
  yapCode?: string;
  yapDescription?: string;
}

export interface TransferLineSource {
  orderNumber: string;
  externalLineId: string;
  externalLineNo?: number;
  externalStockCode: string;
  externalYapCode?: string;
  orderDate?: string;
  orderedQuantity: number;
  previouslyTransferredQuantity: number;
  availableQuantity: number;
  externalStatus?: string;
}

export interface TransferDraftLine {
  localId: string;
  stockId?: number;
  stockCode?: string;
  stockName?: string;
  yapCodeId?: number;
  yapCode?: string;
  quantity: number;
  unitCode: string;
  trackingType: StockTrackingType;
  trackingPolicy?: EffectiveTrackingPolicy;
  requireHandlingUnit: boolean;
  sourceLocationId?: number;
  sourceLocationValue?: string | null;
  targetLocationId?: number;
  targetLocationValue?: string | null;
  trackings: TransferDraftTracking[];
  source?: TransferLineSource;
}

export interface TransferDraftTracking {
  localId: string;
  quantity: number;
  handlingUnitNo?: string;
  lotNo?: string;
  serialNo?: string;
  manufacturingDate?: string;
  expirationDate?: string;
}

export interface WarehouseTransferPolicy {
  id: number;
  branchCode: string;
  allowOrderBasedTask: boolean;
  allowStockBasedTask: boolean;
  allowOrderBasedDirect: boolean;
  allowStockBasedDirect: boolean;
  requireApproval: boolean;
  requireAssigneeForTask: boolean;
  allowMultipleAssignees: boolean;
  autoReleaseTaskBased: boolean;
  reservationPolicy: 'None' | 'OnCreate' | 'OnRelease';
  minimumFulfillmentPercent: number;
  allowPartialPicking: boolean;
  allowPartialShipment: boolean;
  allowPartialReceipt: boolean;
  requireDestinationAcceptance: boolean;
  createTransitInventory: boolean;
  requirePutaway: boolean;
  requireSourceLocation: boolean;
  requireTargetLocation: boolean;
  requireShipmentInformation: boolean;
  directPostingPolicy: 'OneStep' | 'TwoStepTransit';
  discrepancyPolicy: 'Block' | 'AllowWithReason' | 'RequireApproval';
  cancellationReturnPolicy: 'OriginalSourceLocation' | 'WarehouseDefaultReturnLocation' | 'ManagerSelectionRequired';
}

export interface WarehouseTransferGridRow {
  id: number;
  branchCode: string;
  documentNo: string;
  documentDate: string;
  businessContext: WarehouseTransferBusinessContext;
  initiationMode: TransferInitiationMode;
  processType: TransferProcessType;
  status: string;
  approvalStatus: string;
  erpIntegrationStatus: string;
  sourceWarehouseId: number;
  sourceWarehouseCode: number;
  sourceWarehouseName: string;
  targetWarehouseId: number;
  targetWarehouseCode: number;
  targetWarehouseName: string;
  lineCount: number;
  requestedQuantity: number;
  pickedQuantity: number;
  shippedQuantity: number;
  receivedQuantity: number;
  putawayQuantity: number;
  priority: number;
  plannedDispatchAtUtc?: string;
  plannedArrivalAtUtc?: string;
  createdBy?: number;
  createdDate?: string;
  updatedBy?: number;
  updatedDate?: string;
}

export interface WarehouseTransferDetailLine {
  id: number;
  lineNo: number;
  stockId: number;
  stockCode: string;
  stockName?: string;
  yapCode?: string;
  requestedQuantity: number;
  reservedQuantity: number;
  pickedQuantity: number;
  shippedQuantity: number;
  receivedQuantity: number;
  putawayQuantity: number;
  trackingType: StockTrackingType;
  status: string;
  trackingCount: number;
}

export interface WarehouseTransferDetail {
  header: WarehouseTransferGridRow;
  lines: WarehouseTransferDetailLine[];
  rowVersion: string;
  draft: {
    sourceStagingLocationId?: number;
    targetReceivingLocationId?: number;
    targetPutawayLocationId?: number;
    externalReferenceNo?: string;
    description?: string;
    projectCode?: string;
  };
}

export interface UpdateWarehouseTransferDraft {
  rowVersion: string;
  documentDate: string;
  sourceStagingLocationId: number | null;
  targetReceivingLocationId: number | null;
  targetPutawayLocationId: number | null;
  plannedDispatchAtUtc: string | null;
  plannedArrivalAtUtc: string | null;
  priority: number;
  externalReferenceNo: string | null;
  description: string | null;
  projectCode?: string | null;
}

export interface CreateTransferDraftResult {
  id: number;
  documentNo: string;
  lineCount: number;
  requestedQuantity: number;
  replayed: boolean;
  taskId?: number;
  taskNo?: string;
}
import type { EffectiveStockTrackingPolicy } from '@/features/stock-tracking/effective-stock-tracking.service';
