import {api} from '@/lib/axios';
import type {GridPage,GridRequest} from '@/components/shared/AdvancedDataGrid';
import type {SaveVehicleCheckInRequest,VehicleCheckInDetail,VehicleCheckInImage,VehicleCheckInRow} from '../types';
interface Envelope<T>{success:boolean;data:T;message?:string}
const unwrap=<T,>(x:Envelope<T>):T=>{if(!x.success)throw new Error(x.message||'İşlem başarısız.');return x.data};
export const vehicleCheckInApi={
  today:async(branchCode:string,plateNo:string):Promise<VehicleCheckInDetail|null>=>unwrap(await api.get<Envelope<VehicleCheckInDetail|null>>('/api/vehicle-check-ins/today-by-plate',{params:{branchCode,plateNo}})),
  save:async(request:SaveVehicleCheckInRequest):Promise<VehicleCheckInDetail>=>unwrap(await api.post<Envelope<VehicleCheckInDetail>>('/api/vehicle-check-ins',request)),
  get:async(id:number):Promise<VehicleCheckInDetail>=>unwrap(await api.get<Envelope<VehicleCheckInDetail>>(`/api/vehicle-check-ins/${id}`)),
  paged:async(request:GridRequest):Promise<GridPage<VehicleCheckInRow>>=>unwrap(await api.post<Envelope<GridPage<VehicleCheckInRow>>>('/api/vehicle-check-ins/paged',request)),
  upload:async(id:number,files:File[]):Promise<VehicleCheckInImage[]>=>{const body=new FormData();files.forEach(file=>body.append('files',file));return unwrap(await api.post<Envelope<VehicleCheckInImage[]>>(`/api/vehicle-check-ins/${id}/images`,body))},
  download:async(id:number):Promise<Blob>=>await api.get<Blob>(`/api/vehicle-check-ins/images/${id}/file`,{responseType:'blob'}),
  removeImage:async(id:number):Promise<boolean>=>unwrap(await api.delete<Envelope<boolean>>(`/api/vehicle-check-ins/images/${id}`)),
};
