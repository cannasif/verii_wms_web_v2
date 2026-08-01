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

export type SteelPlateIdentityStatus='Known'|'Unknown'|'Resolved';

export interface AcceptSteelPlateSlot {
  identityStatus:'Known'|'Unknown';
  planLineId?:number;
  receivingLocationId?:number;
  rowVersion?:string;
  note?:string;
}

export interface CompleteSteelVehicleAcceptanceRequest {
  idempotencyKey:string;
  vehicle:SaveVehicleCheckInRequest;
  slots:AcceptSteelPlateSlot[];
  note?:string;
}

export interface AcceptedSteelPlatePlanLineSummary {
  id:number;
  planId:number;
  stockCode:string;
  stockName?:string;
}

export interface AcceptedSteelPlateAttachment {
  id:number;
  planLineId:number;
  fileName:string;
  contentType:string;
  url:string;
  caption?:string;
  fileSize:number;
  createdBy?:number;
  createdDate?:string;
}

export interface AcceptedSteelPlate {
  id:number;sequenceNo:number;identityStatus:SteelPlateIdentityStatus;planLineId?:number;planId?:number;importReferenceNo?:string;
  dCode?:string;stockCode?:string;supplierSerialNo?:string;acceptedQuantity?:number;unitCode?:string;
  receivingLocationId?:number;acceptedAtUtc:string;rowVersion:string;canResolve:boolean;
  planLineSummary?:AcceptedSteelPlatePlanLineSummary|null;
  attachments:AcceptedSteelPlateAttachment[];
}

export interface ResolveUnknownPlateRequest {
  planLineId:number;
  receivingLocationId?:number;
  rowVersion:string;
  planLineRowVersion:string;
  note?:string;
}

export interface CompleteSteelVehicleAcceptanceResult {
  acceptanceId:number;
  replayed:boolean;
  vehicle:VehicleCheckInDetail;
  plates:AcceptedSteelPlate[];
  unknownCount:number;
  containsUnknownPlates:boolean;
  canResolveUnknownPlates:boolean;
}
