export type InventoryCountType = 'FullPhysical' | 'Cycle' | 'Spot' | 'ZeroCheck' | 'Partial';
export type InventoryCountMode = 'Blind' | 'Open' | 'DoubleBlind';
export type InventoryCountMovementPolicy = 'Snapshot' | 'SnapshotWithMovementReconciliation' | 'LocationFreeze';
export type InventoryCountStatus =
  | 'Draft'
  | 'Planned'
  | 'Released'
  | 'InProgress'
  | 'AwaitingReview'
  | 'RecountRequired'
  | 'AwaitingApproval'
  | 'Posting'
  | 'Completed'
  | 'Cancelled';

export interface InventoryCountGridRow {
  id: number;
  countCode: string;
  documentNo: string;
  branchCode: string;
  warehouseId: number;
  warehouseCode: number;
  warehouseName: string;
  countType: InventoryCountType;
  countMode: InventoryCountMode;
  movementPolicy: InventoryCountMovementPolicy;
  status: InventoryCountStatus;
  priority: number;
  plannedStartUtc?: string | null;
  plannedEndUtc?: string | null;
  snapshotAtUtc?: string | null;
  taskCount: number;
  completedTaskCount: number;
  lineCount: number;
  countedLineCount: number;
  varianceLineCount: number;
  description?: string | null;
  createdBy?: number | null;
  createdDate?: string | null;
  updatedBy?: number | null;
  updatedDate?: string | null;
  concurrencyToken: string;
}

export interface InventoryCountScopeRequest {
  locationId?: number | null;
  stockId?: number | null;
  yapCodeId?: number | null;
  stockGroupCode?: string | null;
  includeDescendantLocations: boolean;
  includeEmptyLocations: boolean;
}

export interface CreateInventoryCountDraftRequest {
  branchCode: string;
  warehouseId: number;
  documentSeriesId?: number | null;
  countType: InventoryCountType;
  countMode: InventoryCountMode;
  movementPolicy: InventoryCountMovementPolicy;
  priority: number;
  plannedStartUtc?: string | null;
  plannedEndUtc?: string | null;
  quantityTolerance: number;
  percentageTolerance: number;
  maxCountAttempts: number;
  requireIndependentRecount: boolean;
  allowUnexpectedStock: boolean;
  autoApproveWithinTolerance: boolean;
  includeEmptyLocations: boolean;
  description?: string | null;
  scopes: InventoryCountScopeRequest[];
}

export interface InventoryCountPreviewResult {
  locationCount: number;
  emptyLocationCount: number;
  balanceLineCount: number;
  distinctStockCount: number;
  distinctLotCount: number;
  distinctSerialCount: number;
  totalQuantity: number;
  warnings: string[];
}

export interface ReleaseInventoryCountResult {
  headerId: number;
  documentNo: string;
  taskCount: number;
  lineCount: number;
  snapshotMovementEntryId: number;
  snapshotAtUtc: string;
  isReplay: boolean;
}
