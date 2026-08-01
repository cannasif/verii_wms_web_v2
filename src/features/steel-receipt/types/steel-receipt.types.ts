export interface SteelImportLine {
  rowNumber:number; netsisOrderNo?:string; netsisOrderLineNo?:string; stockId?:number; stockCode:string;
  yapCodeId?:number; yapCode?:string; supplierSerialNo:string; secondarySerialNo?:string;
  expectedQuantity:number; unitCode:string; combinedSize?:string; materialGrade?:string;
  heatNumber?:string; certificateNumber?:string; targetWarehouseId?:number; receivingLocationId?:number;
}
export interface SteelImportRequest {
  branchCode:string; importReferenceNo:string; sourceFileName:string; exportReferenceNo?:string;
  vehicleCheckInId?:number;
  supplierId:number; targetWarehouseId:number; receivingLocationId?:number; documentSeriesId:number;
  waybillNo?:string; waybillDate?:string; plannedArrivalAtUtc?:string; lines:SteelImportLine[];
}
export interface SteelImportPreviewLine {rowNumber:number;supplierSerialNo:string;stockCode?:string;action:string;existingDCode?:string;errors:string[]}
export interface SteelImportPreview {totalRows:number;newRows:number;existingRows:number;errorRows:number;totalExpectedQuantity:number;lines:SteelImportPreviewLine[]}
export interface SteelPlanRow {id:number;branchCode:string;importReferenceNo:string;sourceFileName:string;exportReferenceNo?:string;
  vehicleCheckInId?:number;vehiclePlateNo?:string;driverName?:string;
  supplierId:number;supplierCode:string;supplierName:string;targetWarehouseId:number;warehouseCode:number;warehouseName:string;
  status:string;totalLineCount:number;totalExpectedQuantity:number;importedAtUtc:string;createdBy?:number;createdDate?:string;updatedBy?:number;updatedDate?:string}
export interface SteelLineRow {id:number;planId:number;importReferenceNo:string;lineNo:number;dCode:string;netsisOrderNo?:string;
  stockCode:string;stockName?:string;supplierSerialNo:string;secondarySerialNo?:string;combinedSize?:string;materialGrade?:string;
  heatNumber?:string;certificateNumber?:string;expectedQuantity:number;arrivedQuantity:number;approvedQuantity:number;
  rejectedQuantity:number;unitCode:string;arrivalStatus:string;inspectionStatus:string;conversionStatus:string;
  putawayStatus:string;goodsReceiptNo?:string;goodsReceiptId?:number;targetWarehouseId:number;warehouseCode?:number;warehouseName?:string;receivingLocationId:number;receivingLocationCode?:string;receivingLocationName?:string;
  erpIntegrationStatus?:string;goodsReceiptLineId?:number;createdBy?:number;createdDate?:string;updatedBy?:number;updatedDate?:string;
  vehiclePlateNo?:string;driverName?:string;conversionWaybillNo?:string;convertedAtUtc?:string;rowVersion:string}
export interface SteelReceiptSource {
  planId:number;importReferenceNo:string;sourceFileName:string;waybillNo?:string;waybillDate?:string;
  supplierId:number;supplierCode:string;supplierName:string;status:string;totalLineCount:number;
  totalExpectedQuantity:number;lines:SteelLineRow[];
}
export interface SteelPendingReceiptSource {
  planId:number;branchCode:string;importReferenceNo:string;sourceFileName:string;
  waybillNo?:string;waybillDate?:string;supplierCode:string;supplierName:string;
  pendingLineCount:number;totalLineCount:number;importedAtUtc:string;
}
export type SteelReceiptConversionMode='Task'|'Direct';
export interface ConvertResult {
  goodsReceiptId:number;documentNo:string;taskId?:number;taskNo?:string;
  executionId?:number;stockMovementOperationId?:number;generatedLabelIds?:number[];
  convertedLineCount:number;convertedQuantity:number;mode:SteelReceiptConversionMode;replayed:boolean;
}
export interface SteelAttachment {id:number;planLineId:number;fileName:string;contentType:string;url:string;caption?:string;fileSize:number;createdBy?:number;createdDate?:string}
export interface SteelPlacementOccupancy {placementId:number;planLineId:number;dCode:string;stockCode:string;supplierSerialNo:string;combinedSize?:string;
  materialGrade?:string;quantity:number;unitCode:string;warehouseId:number;locationId:number;placementType:'SideBySide'|'Stacked';
  rowNo:number;positionNo:number;stackOrderNo?:number;placedAtUtc:string}
