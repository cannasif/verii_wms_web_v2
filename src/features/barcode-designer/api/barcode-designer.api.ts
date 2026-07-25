import type { GridPage, GridRequest } from '@/components/shared/AdvancedDataGrid';
import { api } from '@/lib/axios';
import type { BarcodeSchemaField, BarcodeTemplatePayload, BarcodeTemplateRow, BarcodeTemplateVersion } from '../types/barcode-designer.types';
interface Envelope<T>{success:boolean;data:T;message?:string}
const unwrap=<T,>(x:Envelope<T>):T=>{if(!x.success)throw new Error(x.message||'Barkod tasarım işlemi başarısız.');return x.data};
export const barcodeDesignerApi={
  getPaged:async(request:GridRequest):Promise<GridPage<BarcodeTemplateRow>>=>unwrap(await api.post<Envelope<GridPage<BarcodeTemplateRow>>>('/api/barcode-designer/templates/paged',request)),
  get:async(id:number)=>unwrap(await api.get<Envelope<BarcodeTemplateRow>>(`/api/barcode-designer/templates/${id}`)),
  create:async(request:BarcodeTemplatePayload)=>unwrap(await api.post<Envelope<{id:number}>>('/api/barcode-designer/templates',request)).id,
  update:async(id:number,request:BarcodeTemplatePayload)=>{unwrap(await api.put<Envelope<boolean>>(`/api/barcode-designer/templates/${id}`,request));},
  delete:async(id:number)=>{unwrap(await api.delete<Envelope<boolean>>(`/api/barcode-designer/templates/${id}`));},
  getDraft:async(id:number)=>unwrap(await api.get<Envelope<BarcodeTemplateVersion|null>>(`/api/barcode-designer/templates/${id}/draft`)),
  getVersions:async(id:number)=>unwrap(await api.get<Envelope<BarcodeTemplateVersion[]>>(`/api/barcode-designer/templates/${id}/versions`)),
  getFields:async()=>unwrap(await api.get<Envelope<BarcodeSchemaField[]>>('/api/barcode-designer/schema-fields')),
  saveDraft:async(id:number,templateJson:string,notes:string)=>unwrap(await api.post<Envelope<BarcodeTemplateVersion>>(`/api/barcode-designer/templates/${id}/drafts`,{templateJson,notes})),
  publish:async(id:number,versionId:number)=>unwrap(await api.post<Envelope<BarcodeTemplateVersion>>(`/api/barcode-designer/templates/${id}/publish`,{versionId})),
};
