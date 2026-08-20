import type {GridRequest} from '@/components/shared/AdvancedDataGrid';
import type {DropdownPage,DropdownPageRequest} from '@/hooks/useDropdownInfiniteSearch';
import type {ActiveUserOption,CustomerOption,LocationOption,SeriesOption,StockOption,WarehouseOption,YapCodeOption} from '@/features/goods-receipt-v2/types/goods-receipt.types';
import {api} from '@/lib/axios';
import {resolveStockTrackingPolicy} from '@/features/stock-tracking/effective-stock-tracking.service';
import {requireCompletedCancellation,type OperationCancellationResult} from '@/features/shared/api/operation-cancellation';
import {buildDropdownPagedBody} from '@/lib/dropdown-paging';
import type {ShipmentDetail,ShipmentGridRow,ShipmentOrderHeader,ShipmentOrderLine,ShipmentPolicy,ShipmentResult,UpdateShipmentDraft} from './types';
interface Envelope<T>{success:boolean;data:T;message?:string}const unwrap=<T,>(x:Envelope<T>)=>{if(!x.success)throw new Error(x.message||'İşlem başarısız.');return x.data};
export interface ShipmentOperationLinePayload{lineId:number;quantity:number;sourceLocationId:number|null;targetLocationId:number|null;lotNo:string|null;serialNo:string|null;handlingUnitNo:string|null}
export interface ShipmentOperationResult{shipmentId:number;documentNo:string;status:string;stockMovementOperationId?:number;pickedQuantity:number;packedQuantity:number;loadedQuantity:number;shippedQuantity:number;replayed:boolean}
export interface ErpPostingResult{postingRecordId:number;sourceEntityId:number;sourceDocumentNo:string;status:'Pending'|'Processing'|'Succeeded'|'Failed'|'CommitUncertain';attemptCount:number;erpDocumentNo?:string;erpWaybillNo?:string;errorCode?:string;errorMessage?:string;completedAtUtc?:string}
const body=(r:DropdownPageRequest,filters:unknown[]=[])=>buildDropdownPagedBody(r,{filters});
export const warehouseOutboundApi={
 warehouses:async(r:DropdownPageRequest,b:string):Promise<DropdownPage<WarehouseOption>>=>unwrap(await api.post('/api/erp-mirror/warehouses/paged',body({...r,sortBy:r.sortBy??'warehouseCode'},[{column:'branchCode',operator:'equals',value:b}]),{signal:r.signal})),
 customers:async(r:DropdownPageRequest,b:string):Promise<DropdownPage<CustomerOption>>=>unwrap(await api.post('/api/erp-mirror/customers/paged',body({...r,sortBy:r.sortBy??'customerCode'},[{column:'branchCode',operator:'equals',value:b}]),{signal:r.signal})),
 stocks:async(r:DropdownPageRequest,b:string):Promise<DropdownPage<StockOption>>=>unwrap(await api.post('/api/erp-mirror/stocks/paged',body({...r,sortBy:r.sortBy??'erpStockCode'},[{column:'branchCode',operator:'equals',value:b}]),{signal:r.signal})),
 yaps:async(r:DropdownPageRequest,b:string):Promise<DropdownPage<YapCodeOption>>=>unwrap(await api.post('/api/erp-mirror/yap-codes/paged',body({...r,sortBy:r.sortBy??'configurationCode'},[{column:'branchCode',operator:'equals',value:b}]),{signal:r.signal})),
 locations:async(r:DropdownPageRequest,w:number):Promise<DropdownPage<LocationOption>>=>unwrap(await api.post('/api/locations/paged',body({...r,sortBy:r.sortBy??'code'},[{column:'warehouseId',operator:'equals',value:String(w)},{column:'isActive',operator:'equals',value:'true'}]),{signal:r.signal})),
 users:async(r:DropdownPageRequest):Promise<DropdownPage<ActiveUserOption>>=>unwrap(await api.post('/api/users/paged',body({...r,sortBy:r.sortBy??'username'},[{column:'isActive',operator:'equals',value:'true'}]),{signal:r.signal})),
 series:async():Promise<SeriesOption[]>=>unwrap(await api.get('/api/document-series/lookup?documentType=Shipment')),
 orderHeaders:async(c:string,b:string):Promise<ShipmentOrderHeader[]>=>unwrap(await api.get('/api/netsis-read/warehouseOutbound/open-orders/headers',{params:{customerCode:c,branchCode:b}})),
 orderLines:async(o:string[],b:string):Promise<ShipmentOrderLine[]>=>unwrap(await api.get('/api/netsis-read/warehouseOutbound/open-orders/lines',{params:{orderNumbersCsv:o.join(','),branchCode:b}})),
 policy:async(b:string):Promise<ShipmentPolicy>=>unwrap(await api.get('/api/warehouse-outbound-policy',{params:{branchCode:b}})),
 trackingPolicy:resolveStockTrackingPolicy,
 updatePolicy:async(p:ShipmentPolicy):Promise<ShipmentPolicy>=>unwrap(await api.put('/api/warehouse-outbound-policy',p)),
 create:async(p:unknown):Promise<ShipmentResult>=>unwrap(await api.post('/api/warehouse-outbounds/drafts',p)),
 paged:async(r:GridRequest)=>unwrap<import('@/components/shared/AdvancedDataGrid').GridPage<ShipmentGridRow>>(await api.post('/api/warehouse-outbounds/paged',r)),
 detail:async(id:number):Promise<ShipmentDetail>=>unwrap(await api.get(`/api/warehouse-outbounds/${id}`)),
 update:async(id:number,p:UpdateShipmentDraft):Promise<ShipmentDetail>=>unwrap(await api.post(`/api/warehouse-outbounds/${id}/update`,p)),
 deleteDraft:async(id:number):Promise<boolean>=>unwrap(await api.post(`/api/warehouse-outbounds/${id}/delete`)),
 cancel:async(id:number,reason:string):Promise<OperationCancellationResult>=>requireCompletedCancellation(
  unwrap(await api.post(`/api/warehouse-outbounds/${id}/cancel`,{idempotencyKey:crypto.randomUUID(),reason:reason.trim()})),
 ),
 transition:async(id:number,action:'approve'|'release',reason?:string):Promise<ShipmentOperationResult>=>unwrap(await api.post(`/api/warehouse-outbounds/${id}/${action}`,{idempotencyKey:crypto.randomUUID(),reason:reason?.trim()||null})),
 operate:async(id:number,action:'pick'|'pack'|'load'|'ship',payload:{lines:ShipmentOperationLinePayload[];reason?:string;vehiclePlate?:string;driverName?:string;waybillNo?:string;trackingNo?:string}):Promise<ShipmentOperationResult>=>unwrap(await api.post(`/api/warehouse-outbounds/${id}/${action}`,{idempotencyKey:crypto.randomUUID(),occurredAtUtc:new Date().toISOString(),lines:payload.lines,reason:payload.reason?.trim()||null,vehiclePlate:payload.vehiclePlate?.trim()||null,driverName:payload.driverName?.trim()||null,waybillNo:payload.waybillNo?.trim()||null,trackingNo:payload.trackingNo?.trim()||null})),
 /** Sevk WMS'te tamamlanmış ama Netsis belgesi oluşmamışsa gönderimi tekrar dener; mal kabuldeki davranışın aynısı. */
 postErp:async(id:number):Promise<ErpPostingResult>=>unwrap(await api.post(`/api/warehouse-outbounds/${id}/erp/post`,{idempotencyKey:crypto.randomUUID()})),
};
