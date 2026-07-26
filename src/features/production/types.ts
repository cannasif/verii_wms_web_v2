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
