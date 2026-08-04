import type { GridPage,GridRequest } from '@/components/shared/AdvancedDataGrid';
import { api } from '@/lib/axios';
import type { ProcurementDocumentDetail,ProcurementDocumentType,ProcurementGridRow,ProcurementRequestLineInput,ProcurementSummary,SupplierQuoteLineInput } from './types';

interface Envelope<T>{success:boolean;data:T;message?:string}
const unwrap=<T,>(x:Envelope<T>):T=>{if(!x.success)throw new Error(x.message||'Satınalma işlemi başarısız.');return x.data;};
export const procurementApi={
  summary:async():Promise<ProcurementSummary>=>unwrap(await api.get<Envelope<ProcurementSummary>>('/api/procurement/summary')),
  paged:async(type:ProcurementDocumentType,request:GridRequest):Promise<GridPage<ProcurementGridRow>>=>unwrap(await api.post<Envelope<GridPage<ProcurementGridRow>>>(`/api/procurement/${type}/paged`,request)),
  detail:async(type:ProcurementDocumentType,id:number):Promise<ProcurementDocumentDetail>=>unwrap(await api.get<Envelope<ProcurementDocumentDetail>>(`/api/procurement/${type}/${id}`)),
  createRequest:async(payload:{requestDate:string;requiredDate?:string;departmentCode?:string;projectCode?:string;subject:string;description?:string;lines:ProcurementRequestLineInput[]}):Promise<number>=>unwrap<{id:number}>(await api.post<Envelope<{id:number}>>('/api/procurement/requests',payload)).id,
  convertRequestToRfq:async(id:number,payload:{responseDueDate:string;supplierIds:number[];buyerMessage?:string}):Promise<number>=>unwrap<{rfqId:number}>(await api.post<Envelope<{rfqId:number}>>(`/api/procurement/requests/${id}/convert-to-rfq`,payload)).rfqId,
  createQuote:async(rfqId:number,payload:{supplierId:number;quoteNo:string;quoteDate?:string;validUntil?:string;currencyCode:string;exchangeRate:number;note?:string;lines:SupplierQuoteLineInput[]}):Promise<number>=>unwrap<{id:number}>(await api.post<Envelope<{id:number}>>(`/api/procurement/rfqs/${rfqId}/quotes`,payload)).id,
  convertQuoteToOrder:async(id:number):Promise<number>=>unwrap<{orderId:number}>(await api.post<Envelope<{orderId:number}>>(`/api/procurement/quotes/${id}/convert-to-order`)).orderId,
  transition:async(type:ProcurementDocumentType,id:number,action:string,note?:string):Promise<void>=>{await api.post(`/api/procurement/${type}s/${id}/${action}`,{note:note?.trim()||null});},
};
