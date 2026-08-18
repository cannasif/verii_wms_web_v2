import {api} from '@/lib/axios';
import type {GridPage,GridRequest} from '@/components/shared/AdvancedDataGrid';
import type {SteelAttachment,SteelImportPreview,SteelImportRequest,SteelLineRow,SteelPendingReceiptSource,SteelPlacementOccupancy,SteelPlanRow,SteelReceiptSource,ConvertResult,NetsisImportOpenFile,SteelReceiptConversionMode,SteelReceiptTradeType} from '../types/steel-receipt.types';
import {createSteelImportCommitPayload} from '../steel-import-result';
interface Envelope<T>{success:boolean;data:T;message?:string}
const unwrap=<T,>(x:Envelope<T>):T=>{if(!x.success)throw new Error(x.message||'İşlem başarısız.');return x.data};
export const steelReceiptApi={
  preview:async(importRequest:SteelImportRequest):Promise<SteelImportPreview>=>unwrap(await api.post<Envelope<SteelImportPreview>>('/api/steel-receipts/import/preview',importRequest)),
  commit:async(importRequest:SteelImportRequest,idempotencyKey:string):Promise<number>=>unwrap(await api.post<Envelope<number>>('/api/steel-receipts/import/commit',createSteelImportCommitPayload(importRequest,idempotencyKey))),
  plansPaged:async(request:GridRequest):Promise<GridPage<SteelPlanRow>>=>unwrap(await api.post<Envelope<GridPage<SteelPlanRow>>>('/api/steel-receipts/paged',request)),
  linesPaged:async(request:GridRequest):Promise<GridPage<SteelLineRow>>=>unwrap(await api.post<Envelope<GridPage<SteelLineRow>>>('/api/steel-receipts/lines/paged',request)),
  receiptCandidatesPaged:async(request:GridRequest):Promise<GridPage<SteelLineRow>>=>unwrap(await api.post<Envelope<GridPage<SteelLineRow>>>('/api/steel-receipts/receipt/candidates/paged',request)),
  pendingReceiptSourcesPaged:async(request:GridRequest):Promise<GridPage<SteelPendingReceiptSource>>=>unwrap(await api.post<Envelope<GridPage<SteelPendingReceiptSource>>>('/api/steel-receipts/receipt/sources/paged',request)),
  receiptSource:async(reference:string):Promise<SteelReceiptSource>=>unwrap(await api.get<Envelope<SteelReceiptSource>>('/api/steel-receipts/receipt/source',{params:{reference}})),
  openImportFiles:async():Promise<NetsisImportOpenFile[]>=>unwrap(await api.get<Envelope<NetsisImportOpenFile[]>>('/api/netsis-read/imports/open-files')),
  placementCandidatesPaged:async(request:GridRequest):Promise<GridPage<SteelLineRow>>=>unwrap(await api.post<Envelope<GridPage<SteelLineRow>>>('/api/steel-receipts/placement/candidates/paged',request)),
  line:async(id:number):Promise<SteelLineRow>=>unwrap(await api.get<Envelope<SteelLineRow>>(`/api/steel-receipts/lines/${id}`)),
  inspect:async(id:number,payload:{isArrived:boolean;arrivedQuantity:number;approvedQuantity:number;rejectedQuantity:number;rejectReason?:string;note?:string;rowVersion:string}):Promise<SteelLineRow>=>unwrap(await api.put<Envelope<SteelLineRow>>(`/api/steel-receipts/lines/${id}/inspection`,payload)),
  convert:async(planId:number,lineIds:number[],options:{
    idempotencyKey:string;mode:SteelReceiptConversionMode;documentDate:string;
    waybillNo?:string;electronicWaybillNo?:string;description?:string;priority?:number;
    tradeType:SteelReceiptTradeType;importFileNumber?:string;
    assignedUserIds?:number[];assignToAllActiveUsers?:boolean;
  }):Promise<ConvertResult>=>unwrap(await api.post<Envelope<ConvertResult>>(`/api/steel-receipts/${planId}/convert`,{
    idempotencyKey:options.idempotencyKey,documentDate:options.documentDate,lineIds,
    assignedUserIds:options.mode==='Task'?(options.assignedUserIds??null):null,
    assignToAllActiveUsers:options.mode==='Task'?(options.assignToAllActiveUsers??false):false,
    priority:options.priority??3,description:options.description||'SAC kontrolünden mal kabule aktarım',
    mode:options.mode,waybillNo:options.waybillNo??null,
    electronicWaybillNo:options.electronicWaybillNo??null,waybillDate:options.documentDate,
    tradeType:options.tradeType,importFileNumber:options.importFileNumber??null,
  })),
  place:async(id:number,payload:{locationId:number;rowVersion:string})=>
    unwrap(await api.post<Envelope<{placementId:number;stockMovementOperationId:number;replayed:boolean;locationId:number;placementType:'Stacked';rowNo:number;positionNo:number;stackOrderNo:number}>>(`/api/steel-receipts/lines/${id}/place`,{idempotencyKey:crypto.randomUUID(),...payload})),
  attachments:async(id:number):Promise<SteelAttachment[]>=>unwrap(await api.get<Envelope<SteelAttachment[]>>(`/api/steel-receipts/lines/${id}/attachments`)),
  uploadAttachment:async(id:number,file:File,caption?:string):Promise<SteelAttachment>=>{
    const body=new FormData();body.append('file',file);if(caption)body.append('caption',caption);
    return unwrap(await api.post<Envelope<SteelAttachment>>(`/api/steel-receipts/lines/${id}/attachments`,body));
  },
  removeAttachment:async(id:number):Promise<boolean>=>unwrap(await api.delete<Envelope<boolean>>(`/api/steel-receipts/attachments/${id}`)),
  downloadAttachment:async(id:number):Promise<Blob>=>await api.get<Blob>(`/api/steel-receipts/attachments/${id}/file`,{responseType:'blob'}),
  occupancy:async(locationId:number):Promise<SteelPlacementOccupancy[]>=>unwrap(await api.get<Envelope<SteelPlacementOccupancy[]>>('/api/steel-receipts/placement/occupancy',{params:{locationId}})),
};
