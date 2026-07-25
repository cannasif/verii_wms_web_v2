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
