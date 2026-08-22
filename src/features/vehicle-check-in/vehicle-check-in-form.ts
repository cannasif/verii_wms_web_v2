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

export function formatDriverName(firstName?:string,lastName?:string){
  if(!firstName&&!lastName)return'';
  if(!lastName)return firstName??'';
  if(!firstName)return lastName;
  return `${firstName} ${lastName}`;
}

export function parseDriverName(value:string){
  if(!value)return{driverFirstName:'',driverLastName:''};
  const space=value.indexOf(' ');
  if(space===-1)return{driverFirstName:value,driverLastName:''};
  const lastName=value.slice(space+1);
  if(!lastName){
    return{driverFirstName:value,driverLastName:''};
  }
  return{driverFirstName:value.slice(0,space),driverLastName:lastName};
}

export function sanitizeSteelSheetCountInput(raw:string){
  const digits=raw.replace(/\D/g,'').replace(/^0+(?=\d)/,'');
  if(!digits||digits==='0')return'';
  return digits;
}

export function parseSteelSheetCountInput(text:string){
  if(!text)return null;
  const next=Number(text);
  if(!Number.isInteger(next)||next<1)return null;
  return next;
}

export type VehicleCheckInExcelIdentity = {
  importReferenceNo?: string | null;
  sourceFileName?: string | null;
};

export function vehicleCheckInExcelKey(row: VehicleCheckInExcelIdentity): string {
  const reference = row.importReferenceNo?.trim() ?? '';
  if (reference) return reference;
  return row.sourceFileName?.trim() ?? '';
}

export function resolveVehicleCheckInSelectAll<T extends {id: number} & VehicleCheckInExcelIdentity>(
  visibleRows: T[],
  selectedRows: VehicleCheckInExcelIdentity[],
  reservedIds: ReadonlySet<number>,
): {targets: T[]; mixedExcel: boolean} {
  const available = visibleRows.filter((row) => !reservedIds.has(row.id));
  const excelKey = vehicleCheckInExcelKey(selectedRows.find((row) => vehicleCheckInExcelKey(row)) ?? {})
    || vehicleCheckInExcelKey(available.find((row) => vehicleCheckInExcelKey(row)) ?? {});
  const targets = available.filter((row) => vehicleCheckInExcelKey(row) === excelKey);
  return {targets, mixedExcel: available.length > targets.length};
}
