export interface VehicleCheckInImage {id:number;headerId:number;fileName:string;contentType:string;fileSize:number;sortOrder:number;createdDate?:string}
export interface VehicleCheckInRow {
  id:number;branchCode:string;plateNo:string;trailerPlateNo?:string;driverFirstName?:string;driverLastName?:string;driverPhone?:string;
  carrierName?:string;steelSheetCount:number;customerId?:number;customerCode?:string;customerName?:string;checkedInAtUtc:string;businessDate:string;
  status:string;note?:string;imageCount:number;createdBy?:number;createdDate?:string;updatedBy?:number;updatedDate?:string;rowVersion:string;
}
export interface VehicleCheckInDetail {header:VehicleCheckInRow;images:VehicleCheckInImage[]}
export interface SaveVehicleCheckInRequest {
  id?:number;rowVersion?:string;
  branchCode:string;plateNo:string;trailerPlateNo?:string;driverFirstName?:string;driverLastName?:string;driverPhone?:string;
  carrierName?:string;steelSheetCount:number;customerId?:number;note?:string;
}

export interface SteelVehicleAcceptanceCandidate {
  id:number;planId:number;importReferenceNo:string;sourceFileName:string;lineNo:number;dCode:string;netsisOrderNo?:string;
  stockCode:string;stockName?:string;supplierSerialNo:string;secondarySerialNo?:string;combinedSize?:string;materialGrade?:string;
  heatNumber?:string;certificateNumber?:string;expectedQuantity:number;unitCode:string;targetWarehouseId:number;
  warehouseCode:number;warehouseName:string;receivingLocationId:number;receivingLocationCode:string;receivingLocationName:string;
  attachmentCount:number;rowVersion:string;
}

export interface AcceptSteelPlateRequest {
  planLineId:number;
  receivingLocationId:number;
  rowVersion:string;
  note?:string;
}

export interface CompleteSteelVehicleAcceptanceRequest {
  idempotencyKey:string;
  vehicle:SaveVehicleCheckInRequest;
  plates:AcceptSteelPlateRequest[];
  note?:string;
}

export interface AcceptedSteelPlate {
  planLineId:number;planId:number;importReferenceNo:string;dCode:string;stockCode:string;supplierSerialNo:string;
  acceptedQuantity:number;unitCode:string;receivingLocationId:number;acceptedAtUtc:string;
}

export interface CompleteSteelVehicleAcceptanceResult {
  acceptanceId:number;
  replayed:boolean;
  vehicle:VehicleCheckInDetail;
  plates:AcceptedSteelPlate[];
}
