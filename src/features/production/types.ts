import type { GridPage, GridRequest } from '@/components/shared/AdvancedDataGrid';

export type ProductionPlanType = 'MakeToStock' | 'MakeToOrder' | 'Rework' | 'Disassembly';
export type ProductionExecutionMode = 'Serial' | 'Parallel';
export type ProductionPlanStatus = 'Draft' | 'Released' | 'InProgress' | 'PartiallyCompleted' | 'Completed' | 'Cancelled';

export interface ProductionMaterialDraft {
  stockId: number;
  yapCodeId: number | null;
  requiredQuantity: number;
  sourceWarehouseId: number;
  preferredSourceLocationId: number | null;
  issueMode: 'Manual' | 'Backflush';
  isMandatory: boolean;
}

export interface ProductionOrderDraft {
  localKey: string;
  externalOrderNo: string | null;
  externalSourceSystemCode: string | null;
  sequenceNo: number;
  parallelGroupNo: number | null;
  bomReference: string | null;
  routingReference: string | null;
  workCenterCode: string | null;
  producedStockId: number;
  producedYapCodeId: number | null;
  plannedQuantity: number;
  sourceWarehouseId: number;
  targetWarehouseId: number;
  requireMaterialTransferBeforeStart: boolean;
  plannedStartAtUtc: string | null;
  plannedEndAtUtc: string | null;
  description: string | null;
  assignedUserIds: number[];
  materials: ProductionMaterialDraft[];
  outputs: Array<{
    stockId: number;
    yapCodeId: number | null;
    plannedQuantity: number;
    targetWarehouseId: number;
    preferredTargetLocationId: number | null;
    isPrimary: boolean;
  }>;
}

export interface CreateProductionPlanRequest {
  idempotencyKey: string;
  branchCode: string;
  documentSeriesId: number;
  documentDate: string;
  planType: ProductionPlanType;
  executionMode: ProductionExecutionMode;
  priority: number;
  customerId: number | null;
  plannedStartAtUtc: string | null;
  plannedEndAtUtc: string | null;
  description: string | null;
  orders: ProductionOrderDraft[];
  dependencies: unknown[];
}

export interface CreateProductionPlanResult {
  id: number;
  documentNo: string;
  orderCount: number;
  materialCount: number;
  outputCount: number;
  replayed: boolean;
}

export type ProductionSourceWorkOrderListingKind =
  | 'Standard'
  | 'CancellationReturnRemainder'
  | 'ManagerCancelledAssignment';

export interface ProductionSourceWorkOrder {
  sourceType: 'NetsisErpFunctions' | 'WmsIntegrationTables';
  sourceSystemCode: string;
  revisionNumber: number;
  workOrderNumber: string;
  branchCode: number;
  stockCode: string;
  stockName: string;
  configurationCode?: string;
  workOrderQuantity: number;
  unitSequence: number;
  unitCode?: string;
  recipeTotal: number;
  workOrderDate?: string;
  deliveryDate?: string;
  orderNumber?: string;
  orderLineSequence: number;
  projectCode?: string;
  warehouseCode: number;
  issueWarehouseCode: number;
  isClosed: boolean;
  listingKind?: ProductionSourceWorkOrderListingKind;
  transferId?: number;
  kalanTaskId?: number;
  cancellationId?: number;
  assignedRecipeLineCount?: number;
  recipeLineCount?: number;
}

export interface CancelProductionWorkOrderAssignmentRequest {
  idempotencyKey: string;
  workOrderNumber: string;
  sourceType?: ProductionSourceWorkOrder['sourceType'];
  sourceSystemCode?: string;
  reason: string;
  transferId?: number | null;
}

export interface RestoreProductionWorkOrderAssignmentRequest {
  idempotencyKey: string;
  workOrderNumber: string;
  reason?: string | null;
}

export interface ProductionWorkOrderAssignmentCancellationResult {
  cancellationId: number;
  workOrderNumber: string;
  status: 'Active' | 'Restored';
  cancelledQuantityTotal: number;
  replayed: boolean;
}

export type ProductionReturnedWorkOrderKind =
  | 'CancellationReturnRemainder'
  | 'PartialTransferRemainder';

export interface ProductionReturnedWorkOrder {
  workOrderNumber: string;
  transferId: number;
  documentNo: string;
  kalanTaskId: number;
  kalanTaskNo: string;
  kalanTaskDisplayLabel: string;
  remainingQuantity: number;
  plannedQuantity: number;
  documentDate?: string;
  projectCode?: string;
  sourceWarehouseCode: number;
  targetWarehouseCode: number;
  sourceWarehouseId: number;
  taskWarehouseId: number;
  returnKind: ProductionReturnedWorkOrderKind;
}

export type NetsisProductionWorkOrder = ProductionSourceWorkOrder;

export interface PreparedNetsisProductionMaterial {
  stockId?: number;
  stockCode: string;
  stockName?: string;
  unitCode: string;
  yapCodeId?: number;
  configurationCode?: string;
  operationNumber: number;
  recipeQuantity: number;
  wasteQuantity: number;
  requiredQuantity: number;
  mappingError?: string;
}

export interface PreparedNetsisProductionWorkOrder {
  sourceType: 'NetsisErpFunctions' | 'WmsIntegrationTables';
  sourceSystemCode: string;
  workOrderNumber: string;
  branchCode: number;
  productCode: string;
  productName: string;
  unitCode: string;
  plannedQuantity: number;
  producedStockId?: number;
  producedYapCodeId?: number;
  configurationCode?: string;
  sourceWarehouseId?: number;
  sourceWarehouseCode: number;
  sourceWarehouseName?: string;
  targetWarehouseId?: number;
  targetWarehouseCode: number;
  targetWarehouseName?: string;
  workOrderDate?: string;
  deliveryDate?: string;
  projectCode?: string;
  isClosed: boolean;
  existingProductionHeaderId?: number;
  existingProductionOrderId?: number;
  existingProductionDocumentNo?: string;
  mappingErrors: string[];
  materials: PreparedNetsisProductionMaterial[];
  assignedMaterials?: PreparedNetsisProductionMaterial[];
  listingKind?: ProductionSourceWorkOrderListingKind;
  transferId?: number;
  kalanTaskId?: number;
}

export interface ProductionPlanGridRow {
  id: number;
  branchCode: string;
  documentNo: string;
  documentDate: string;
  planType: ProductionPlanType;
  executionMode: ProductionExecutionMode;
  status: ProductionPlanStatus;
  priority: number;
  customerCode?: string;
  customerName?: string;
  orderCount: number;
  materialCount: number;
  outputCount: number;
  plannedQuantity: number;
  completedQuantity: number;
  plannedStartAtUtc?: string;
  plannedEndAtUtc?: string;
  createdBy?: number;
  createdDate?: string;
  updatedBy?: number;
  updatedDate?: string;
}

export interface ProductionPlanDetail {
  header: ProductionPlanGridRow;
  rowVersion: string;
  description?: string;
  orders: Array<{
    id: number;
    orderNo: string;
    externalOrderNo?: string;
    externalSourceSystemCode?: string;
    status: string;
    sequenceNo: number;
    workCenterCode?: string;
    producedStockCode: string;
    producedStockName?: string;
    unitCode: string;
    plannedQuantity: number;
    completedQuantity: number;
    materials: Array<{
      id: number;
      stockCode: string;
      stockName?: string;
      unitCode: string;
      requiredQuantity: number;
      issuedQuantity: number;
      consumedQuantity: number;
      issueMode: string;
    }>;
    outputs: Array<{
      id: number;
      stockCode: string;
      stockName?: string;
      unitCode: string;
      plannedQuantity: number;
      producedQuantity: number;
      isPrimary: boolean;
    }>;
    assignments: Array<{ id: number; userId: number; username: string; displayName: string; isPrimary: boolean }>;
  }>;
}

export type ProductionPageFetcher = (request: GridRequest) => Promise<GridPage<ProductionPlanGridRow>>;
