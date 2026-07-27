import {api} from '@/lib/axios';
import type {GridPage,GridRequest} from '@/components/shared/AdvancedDataGrid';
import type {DropdownPageRequest} from '@/hooks/useDropdownInfiniteSearch';
import type {CustomerOption,HandlingUnit,LocationOption,MaterialRow,PackingPolicy,PackingPrintJob,PackingSourceDocumentOption,PackingSourceLine,PackingSourceType,ScaleReading,SessionDetail,SessionRow,SpecificationRow,StationRow,StockOption,WarehouseOption} from './types';
import {buildDropdownPagedBody} from '@/lib/dropdown-paging';
type Envelope<T>={success:boolean;data:T;message?:string};
const unwrap=<T,>(r:Envelope<T>)=>{if(!r.success)throw new Error(r.message||'İşlem başarısız.');return r.data};
const pagedBody=(r:DropdownPageRequest,filters:unknown[]=[])=>buildDropdownPagedBody(r,{filters});
export const packingApi={
 materials:async(r:GridRequest):Promise<GridPage<MaterialRow>>=>unwrap(await api.post('/api/packing/materials/paged',r)),
 createMaterial:async(r:unknown):Promise<{id:number}>=>unwrap(await api.post('/api/packing/materials',r)),
 updateMaterial:async(id:number,r:unknown):Promise<boolean>=>unwrap(await api.put(`/api/packing/materials/${id}`,r)),
 deleteMaterial:async(id:number):Promise<boolean>=>unwrap(await api.delete(`/api/packing/materials/${id}`)),
 stations:async(r:GridRequest):Promise<GridPage<StationRow>>=>unwrap(await api.post('/api/packing/stations/paged',r)),
 createStation:async(r:unknown):Promise<{id:number}>=>unwrap(await api.post('/api/packing/stations',r)),
 updateStation:async(id:number,r:unknown):Promise<boolean>=>unwrap(await api.put(`/api/packing/stations/${id}`,r)),
 deleteStation:async(id:number):Promise<boolean>=>unwrap(await api.delete(`/api/packing/stations/${id}`)),
 specifications:async(r:GridRequest):Promise<GridPage<SpecificationRow>>=>unwrap(await api.post('/api/packing/specifications/paged',r)),
 createSpecification:async(r:unknown):Promise<{id:number}>=>unwrap(await api.post('/api/packing/specifications',r)),
 updateSpecification:async(id:number,r:unknown):Promise<boolean>=>unwrap(await api.put(`/api/packing/specifications/${id}`,r)),
 deleteSpecification:async(id:number):Promise<boolean>=>unwrap(await api.delete(`/api/packing/specifications/${id}`)),
 materialOptions:async(r:DropdownPageRequest,branchCode:string):Promise<GridPage<MaterialRow>>=>unwrap(await api.post('/api/packing/materials/paged',pagedBody({...r,sortBy:r.sortBy??'code'},[{column:'branchCode',operator:'equals',value:branchCode},{column:'isActive',operator:'equals',value:'true'}]),{signal:r.signal})),
 stockOptions:async(r:DropdownPageRequest,branchCode:string):Promise<GridPage<StockOption>>=>unwrap(await api.post('/api/erp-mirror/stocks/paged',pagedBody({...r,sortBy:r.sortBy??'erpStockCode'},[{column:'branchCode',operator:'equals',value:branchCode}]),{signal:r.signal})),
 customerOptions:async(r:DropdownPageRequest,branchCode:string):Promise<GridPage<CustomerOption>>=>unwrap(await api.post('/api/erp-mirror/customers/paged',pagedBody({...r,sortBy:r.sortBy??'customerCode'},[{column:'branchCode',operator:'equals',value:branchCode}]),{signal:r.signal})),
 warehouseOptions:async(r:DropdownPageRequest,branchCode:string):Promise<GridPage<WarehouseOption>>=>unwrap(await api.post('/api/erp-mirror/warehouses/paged',pagedBody({...r,sortBy:r.sortBy??'warehouseCode'},[{column:'branchCode',operator:'equals',value:branchCode}]),{signal:r.signal})),
 locationOptions:async(r:DropdownPageRequest,warehouseId:number):Promise<GridPage<LocationOption>>=>unwrap(await api.post('/api/locations/paged',pagedBody({...r,sortBy:r.sortBy??'code'},[{column:'warehouseId',operator:'equals',value:String(warehouseId)},{column:'isActive',operator:'equals',value:'true'}]),{signal:r.signal})),
 policy:async(branchCode:string):Promise<PackingPolicy>=>unwrap(await api.get('/api/packing/policy',{params:{branchCode}})),
 updatePolicy:async(r:PackingPolicy):Promise<PackingPolicy>=>unwrap(await api.put('/api/packing/policy',r)),
 sessions:async(r:GridRequest):Promise<GridPage<SessionRow>>=>unwrap(await api.post('/api/packing/sessions/paged',r)),
 sourceDocuments:async(type:PackingSourceType,r:GridRequest):Promise<GridPage<PackingSourceDocumentOption>>=>{
  const endpoint=type==='WarehouseOutbound'?'/api/warehouse-outbounds/paged':type==='Shipment'?'/api/shipments/paged':'/api/warehouse-transfers/paged';
  const page=unwrap<GridPage<Record<string,unknown>>>(await api.post(endpoint,r));
  const items=page.items.map(x=>({id:Number(x.id),documentNo:String(x.documentNo),sourceWarehouseId:Number(x.sourceWarehouseId),status:String(x.status),sourceType:type}));
  return {...page,items,data:items};
 },
 detail:async(id:number):Promise<SessionDetail>=>unwrap(await api.get(`/api/packing/sessions/${id}`)),
 sourceLines:async(id:number):Promise<PackingSourceLine[]>=>unwrap(await api.get(`/api/packing/sessions/${id}/source-lines`)),
 createSession:async(r:unknown):Promise<SessionDetail>=>unwrap(await api.post('/api/packing/sessions',r)),
 createUnit:async(id:number,r:unknown):Promise<HandlingUnit>=>unwrap(await api.post(`/api/packing/sessions/${id}/handling-units`,r)),
 pack:async(id:number,r:unknown):Promise<HandlingUnit>=>unwrap(await api.post(`/api/packing/handling-units/${id}/pack`,r)),
 unpack:async(id:number,r:unknown):Promise<HandlingUnit>=>unwrap(await api.post(`/api/packing/handling-units/${id}/unpack`,r)),
 move:async(id:number,r:unknown):Promise<HandlingUnit>=>unwrap(await api.post(`/api/packing/handling-units/${id}/move`,r)),
 close:async(id:number,r:unknown):Promise<HandlingUnit>=>unwrap(await api.post(`/api/packing/handling-units/${id}/close`,r)),
 reopen:async(id:number,reason?:string):Promise<HandlingUnit>=>unwrap(await api.post(`/api/packing/handling-units/${id}/reopen`,{idempotencyKey:crypto.randomUUID(),reason:reason||null})),
 print:async(id:number,copies=1):Promise<PackingPrintJob>=>unwrap(await api.post(`/api/packing/handling-units/${id}/print`,{idempotencyKey:crypto.randomUUID(),copies})),
 readScale:async(id:number):Promise<ScaleReading>=>unwrap(await api.post(`/api/packing/handling-units/${id}/read-scale`,{idempotencyKey:crypto.randomUUID()})),
 printJobs:async(r:GridRequest):Promise<GridPage<PackingPrintJob>>=>unwrap(await api.post('/api/packing/print-jobs/paged',r)),
};
