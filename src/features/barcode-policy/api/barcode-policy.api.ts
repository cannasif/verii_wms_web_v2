import type { GridPage,GridRequest } from '@/components/shared/AdvancedDataGrid';
import { api } from '@/lib/axios';
import type { BarcodeGeneratePayload,BarcodePolicy,BarcodePolicyProfileUpdate,BarcodePolicyScope,BarcodePreview,GeneratedBarcodeRow } from '../types/barcode-policy.types';
interface Envelope<T>{success:boolean;data:T;message?:string}
const unwrap=<T,>(value:Envelope<T>):T=>{if(!value.success)throw new Error(value.message||'Barkod politikası işlemi tamamlanamadı.');return value.data};
export const barcodePolicyApi={
 get:async()=>unwrap(await api.get<Envelope<BarcodePolicy>>('/api/barcode-designer/policy')),
 updateProfile:async(scope:BarcodePolicyScope,request:BarcodePolicyProfileUpdate)=>unwrap(await api.put<Envelope<BarcodePolicy>>(`/api/barcode-designer/policy/profiles/${scope}`,request)),
 preview:async(scope:BarcodePolicyScope,request:BarcodeGeneratePayload)=>unwrap(await api.post<Envelope<BarcodePreview>>(`/api/barcode-designer/policy/${scope}/preview`,request)),
 generate:async(scope:BarcodePolicyScope,request:BarcodeGeneratePayload)=>unwrap(await api.post<Envelope<BarcodePreview>>(`/api/barcode-designer/policy/${scope}/generate`,request)),
 generatedPaged:async(request:GridRequest):Promise<GridPage<GeneratedBarcodeRow>>=>unwrap(await api.post<Envelope<GridPage<GeneratedBarcodeRow>>>('/api/barcode-designer/generated/paged',request)),
};
