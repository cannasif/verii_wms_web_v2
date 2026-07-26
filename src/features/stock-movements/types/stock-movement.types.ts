export interface StockMovementGridRow {
  id: number; operationCode: string; operationType: string; status: string; referenceType?: string; referenceNo?: string;
  occurredAt: string; entryCount: number; inboundQuantity: number; outboundQuantity: number; reason?: string;
  reversalOfOperationId?: number; createdBy?: number; createdDate?: string; updatedBy?: number; updatedDate?: string;
}
export interface StockMovementEntryRow { id:number; lineNo:number; stockId:number; stockCode:string; stockName:string; yapCodeId?:number; yapCode?:string; warehouseId:number; warehouseCode:number; warehouseName:string; locationId:number; locationCode:string; locationName:string; quantityDelta:number; unitCode:string; lotNo?:string; serialNo?:string; stockStatus:string; occurredAt:string }
export interface StockMovementDetail extends StockMovementGridRow { idempotencyKey:string; referenceId?:number; description?:string; entries:StockMovementEntryRow[] }
export interface StockMovementLineRequest { stockId:number; yapCodeId:number|null; quantity:number; sourceWarehouseId:number|null; sourceLocationId:number|null; targetWarehouseId:number|null; targetLocationId:number|null; unitCode:string; lotNo:string|null; serialNo:string|null; stockStatus:string }
export interface PostStockMovementRequest { idempotencyKey:string; operationType:string; referenceType:string|null; referenceNo:string|null; referenceId:number|null; occurredAt:string|null; reason:string|null; description:string|null; lines:StockMovementLineRequest[] }
export interface StockOption { id:number; erpStockCode:string; stockName:string; unitCode:string }
export interface WarehouseOption { id:number; warehouseCode:number; warehouseName:string }
export interface LocationOption { id:number; warehouseId:number; code:string; name:string; locationType:string }
export interface YapCodeOption { id:number; configurationCode:string; description:string; stockId?:number }
