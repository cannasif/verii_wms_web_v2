export interface LocationBalanceRow { id:number; branchCode:string; warehouseId:number; warehouseCode:number; warehouseName:string; locationId:number; locationCode:string; locationName:string; stockId:number; stockCode:string; stockName:string; yapCodeId?:number; yapCode?:string; unitCode:string; lotNo?:string; serialNo?:string; stockStatus:string; quantity:number; reservedQuantity:number; availableQuantity:number; lastMovementEntryId:number; lastTransactionDate:string; createdBy?:number; createdDate?:string; updatedBy?:number; updatedDate?:string }
export interface WarehouseBalanceRow { id:number; branchCode:string; warehouseId:number; warehouseCode:number; warehouseName:string; stockId:number; stockCode:string; stockName:string; yapCodeId?:number; yapCode?:string; unitCode:string; stockStatus:string; quantity:number; reservedQuantity:number; availableQuantity:number; distinctLocationCount:number; distinctLotCount:number; distinctSerialCount:number; lastMovementEntryId:number; lastTransactionDate:string; createdBy?:number; createdDate?:string; updatedBy?:number; updatedDate?:string }
export interface SerialBalanceRow { id:number; branchCode:string; warehouseId:number; warehouseCode:number; warehouseName:string; locationId:number; locationCode:string; locationName:string; stockId:number; stockCode:string; stockName:string; yapCodeId?:number; yapCode?:string; unitCode:string; lotNo?:string; serialNo:string; stockStatus:string; quantity:number; reservedQuantity:number; availableQuantity:number; lastMovementEntryId:number; lastTransactionDate:string; createdBy?:number; createdDate?:string; updatedBy?:number; updatedDate?:string }
export interface SerialMovementHistoryRow { id:number; operationId:number; operationCode:string; operationType:string; operationStatus:string; referenceType?:string; referenceNo?:string; warehouseId:number; warehouseCode:number; warehouseName:string; locationId:number; locationCode:string; locationName:string; stockId:number; stockCode:string; stockName:string; yapCodeId?:number; yapCode?:string; unitCode:string; lotNo?:string; serialNo:string; stockStatus:string; quantityDelta:number; occurredAt:string; createdBy?:number; createdDate?:string; updatedBy?:number; updatedDate?:string }
export interface StockBalanceDrillDown { summary:WarehouseBalanceRow; locations:LocationBalanceRow[] }
export interface ReconciliationSummary { ledgerGroupCount:number; projectionGroupCount:number; mismatchCount:number; missingProjectionCount:number; extraProjectionCount:number; ledgerLastEntryId:number; projectionLastEntryId:number; checkedAt:string }
export interface ProjectionRebuildResult { locationRows:number; warehouseRows:number; lastMovementEntryId:number; rebuiltAt:string }

export interface WarehouseInventoryLookup {
  warehouseId: number;
  warehouseCode: number;
  warehouseName: string;
  branchCode: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  distinctStockCount: number;
  distinctLocationCount: number;
  linesTruncated: boolean;
  lines: LocationBalanceRow[];
}

export interface LocationInventoryLookup {
  locationId: number;
  locationCode: string;
  locationName: string;
  locationType: string;
  warehouseId: number;
  warehouseCode: number;
  warehouseName: string;
  branchCode: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  distinctStockCount: number;
  linesTruncated: boolean;
  lines: LocationBalanceRow[];
}

export interface SerialInventoryLookup {
  balance: SerialBalanceRow;
  recentMovements: SerialMovementHistoryRow[];
}

export interface LotInventoryLookup {
  lotNo: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  distinctStockCount: number;
  distinctLocationCount: number;
  linesTruncated: boolean;
  lines: LocationBalanceRow[];
}
