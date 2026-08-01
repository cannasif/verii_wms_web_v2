import type {
  SaveVehicleCheckInRequest,
  VehicleCheckInRow,
} from './types';

export function hydrateVehicleCheckInForm(
  header:VehicleCheckInRow,
):SaveVehicleCheckInRequest {
  return {
    id:header.id,
    rowVersion:header.rowVersion,
    branchCode:header.branchCode,
    plateNo:header.plateNo,
    trailerPlateNo:header.trailerPlateNo,
    driverFirstName:header.driverFirstName,
    driverLastName:header.driverLastName,
    driverPhone:header.driverPhone,
    carrierName:header.carrierName,
    steelSheetCount:header.steelSheetCount||1,
    customerId:header.customerId,
    note:header.note,
  };
}

export const acceptanceTargetMatches=(
  savedSlotCount:number,
  newSlotCount:number,
  targetSteelSheetCount:number,
):boolean=>savedSlotCount+newSlotCount===targetSteelSheetCount;
