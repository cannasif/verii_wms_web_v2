import {api} from '@/lib/axios';
import type {GridPage,GridRequest} from '@/components/shared/AdvancedDataGrid';
import type {SteelAttachment,SteelImportPreview,SteelImportRequest,SteelLineRow,SteelPlacementOccupancy,SteelPlanRow,ConvertResult} from '../types/steel-receipt.types';
interface Envelope<T>{success:boolean;data:T;message?:string}
const unwrap=<T,>(x:Envelope<T>):T=>{if(!x.success)throw new Error(x.message||'İşlem başarısız.');return x.data};
export const steelReceiptApi={
  preview:async(importRequest:SteelImportRequest):Promise<SteelImportPreview>=>unwrap(await api.post<Envelope<SteelImportPreview>>('/api/steel-receipts/import/preview',importRequest)),
  commit:async(importRequest:SteelImportRequest):Promise<number>=>unwrap(await api.post<Envelope<number>>('/api/steel-receipts/import/commit',{idempotencyKey:crypto.randomUUID(),import:importRequest})),
  plansPaged:async(request:GridRequest):Promise<GridPage<SteelPlanRow>>=>unwrap(await api.post<Envelope<GridPage<SteelPlanRow>>>('/api/steel-receipts/paged',request)),
  linesPaged:async(request:GridRequest):Promise<GridPage<SteelLineRow>>=>unwrap(await api.post<Envelope<GridPage<SteelLineRow>>>('/api/steel-receipts/lines/paged',request)),
  receiptCandidatesPaged:async(request:GridRequest):Promise<GridPage<SteelLineRow>>=>unwrap(await api.post<Envelope<GridPage<SteelLineRow>>>('/api/steel-receipts/receipt/candidates/paged',request)),
  placementCandidatesPaged:async(request:GridRequest):Promise<GridPage<SteelLineRow>>=>unwrap(await api.post<Envelope<GridPage<SteelLineRow>>>('/api/steel-receipts/placement/candidates/paged',request)),
  line:async(id:number):Promise<SteelLineRow>=>unwrap(await api.get<Envelope<SteelLineRow>>(`/api/steel-receipts/lines/${id}`)),
  inspect:async(id:number,payload:{isArrived:boolean;arrivedQuantity:number;approvedQuantity:number;rejectedQuantity:number;rejectReason?:string;note?:string;rowVersion:string}):Promise<SteelLineRow>=>unwrap(await api.put<Envelope<SteelLineRow>>(`/api/steel-receipts/lines/${id}/inspection`,payload)),
  convert:async(planId:number,lineIds:number[],options?:{description?:string;priority?:number;assignedUserIds?:number[];assignToAllActiveUsers?:boolean}):Promise<ConvertResult>=>unwrap(await api.post<Envelope<ConvertResult>>(`/api/steel-receipts/${planId}/convert`,{idempotencyKey:crypto.randomUUID(),documentDate:new Date().toLocaleDateString('en-CA'),lineIds,assignedUserIds:options?.assignedUserIds??null,assignToAllActiveUsers:options?.assignToAllActiveUsers??false,priority:options?.priority??3,description:options?.description||'SAC kontrolünden ortak mal kabule aktarım'})),
  place:async(id:number,payload:{locationId:number;placementType:'SideBySide'|'Stacked';rowNo?:number;positionNo?:number;stackOrderNo?:number;rowVersion:string})=>
    unwrap(await api.post<Envelope<{placementId:number;stockMovementOperationId:number}>>(`/api/steel-receipts/lines/${id}/place`,{idempotencyKey:crypto.randomUUID(),...payload})),
  attachments:async(id:number):Promise<SteelAttachment[]>=>unwrap(await api.get<Envelope<SteelAttachment[]>>(`/api/steel-receipts/lines/${id}/attachments`)),
  uploadAttachment:async(id:number,file:File,caption?:string):Promise<SteelAttachment>=>{
    const body=new FormData();body.append('file',file);if(caption)body.append('caption',caption);
    return unwrap(await api.post<Envelope<SteelAttachment>>(`/api/steel-receipts/lines/${id}/attachments`,body));
  },
  removeAttachment:async(id:number):Promise<boolean>=>unwrap(await api.delete<Envelope<boolean>>(`/api/steel-receipts/attachments/${id}`)),
  downloadAttachment:async(id:number):Promise<Blob>=>await api.get<Blob>(`/api/steel-receipts/attachments/${id}/file`,{responseType:'blob'}),
  occupancy:async(locationId:number):Promise<SteelPlacementOccupancy[]>=>unwrap(await api.get<Envelope<SteelPlacementOccupancy[]>>('/api/steel-receipts/placement/occupancy',{params:{locationId}})),
};
